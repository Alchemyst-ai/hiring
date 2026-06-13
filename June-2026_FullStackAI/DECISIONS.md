# Design Decisions — Agent Console

## Approach to seq-based Ordering and Deduplication

**Data structure: `Map<number, ServerMessage>` (the `ReorderBuffer` class)**

I chose a `Map` keyed by `seq` because it provides O(1) insertion and lookup, which is critical when tokens arrive every 30ms and we need to buffer out-of-order messages without jank.

The buffer maintains a `nextExpectedSeq` counter. When a message arrives:

1. If `seq < nextExpectedSeq`, it's a **duplicate** — silently dropped.
2. If `seq === nextExpectedSeq`, it's emitted immediately, then we flush any contiguous buffered messages from `nextExpectedSeq+1` upward.
3. If `seq > nextExpectedSeq`, it's **out of order** — stored in the map until the gap is filled.

This approach handles:
- **Gaps**: If seq 5 arrives before seq 4, seq 5 is buffered. When seq 4 arrives, both are emitted in order.
- **Duplicates**: Direct seq comparison against `nextExpectedSeq` and the map means duplicates never double-emit.
- **Chaos reordering**: The buffer size (max 200) handles worst-case out-of-ordering since seq values grow linearly with message count; a full buffer is a protocol violation scenario.

**Alternative considered**: Pushing everything into an array and sorting by seq on each tick. Rejected because that would be O(n log n) on every token arrival. At 30+ events/sec, that's measurable jank.

## Preventing Layout Shift During Tool Call Interruptions

**Strategy: Block-level rendering with deterministic dimensions**

The tool card rendering follows these principles:

1. **Streaming text renders as `white-space: pre-wrap` inside a block element.** The text grows downward naturally. When a `TOOL_CALL` arrives, the current text is frozen in place — no reflow happens because the text elements are already laid out.
2. **Tool cards are rendered below the text in the same message bubble**, as stacked block elements within a `toolCallStack` grid container. Since the streaming text is a block and the tool card is a block below it, the card pushes subsequent content down without affecting the text's position.
3. **The streaming cursor is a single `▊` character** rendered as `display: inline-block` with `animation: blink 1s`. It occupies exactly one character width, so its appearance/disappearance doesn't cause reflow. This is critical — a `::after` pseudo-element or absolute-positioned cursor would require more careful management.
4. **No height animations or transitions.** The tool card appears immediately (no CSS transitions from `height: 0` to `height: auto`, which would cause layout shifts). It just appears as a new block element in the flow.

**Tool call → Tool result transition**: The card starts with `toolCardPending` class (amber left border, "Running..." status). When `TOOL_RESULT` arrives, it transitions to `toolCardResult` (green border, "Complete" status, result JSON shown). The card element stays in the same DOM position throughout — no removal/reinsertion, no layout shift.

## Reconnection State Recovery Approach

**Tracking "consumed" vs "received":**

The key insight is that `WebSocketManager.processedSeq` tracks the highest seq that has been *rendered to the DOM*, not just received over the socket. Here's how it works:

1. When the WebSocket receives a message, it goes through the `ReorderBuffer` first (for ordering/dedup).
2. Ordered messages are processed by `processMessage()`, which updates refs (not React state).
3. Periodically (`flushState()`), refs are copied to React state to trigger re-renders.
4. Only when each server message is fully processed does `setProcessedSeq()` update the WebSocketManager's `processedSeq` (updated per-message, not only at `STREAM_END`, so mid-stream reconnect sends a correct `RESUME`).

On reconnection:

1. `WebSocketManager.onopen` detects that `processedSeq > 0` (meaning there was previous state).
2. It immediately sends `RESUME { last_seq: processedSeq }` as the first message on the new connection.
3. The server replays all events after that seq.
4. Replayed events go through the same `ReorderBuffer` → `processMessage` pipeline, which deduplicates against already-rendered content.

**Mid-tool-call recovery**: If the connection drops after `TOOL_CALL` but before `TOOL_RESULT`:
- The tool card stays visible with "Running..." state (it's in the React state from the last flush).
- When the connection resumes, the server replays from the last processed seq (which was before the tool call if it wasn't fully acknowledged, or after it if `TOOL_ACK` was sent).
- If the `TOOL_RESULT` is replayed, the card updates to show the result.
- The tool card's `useEffect` only sends `TOOL_ACK` once (guarded by `ackSent` ref), so replayed tool calls won't double-ACK.

## Handling 50 Concurrent Agent Streams (Operations Dashboard)

If this needed to handle 50 concurrent agent streams on one screen:

1. **Virtualized rendering**: Currently, `messageList` renders every message. At 50 streams, that's hundreds of simultaneous messages. We'd use a virtual list (e.g., `react-window` or `@tanstack/virtual`) to render only visible messages.

2. **Per-stream WebSocket managers**: Each agent stream would get its own `WebSocketManager` instance, with its own `ReorderBuffer` and seq tracking. The `useAgentConsole` hook would become a collection of hooks (one per stream), or a single hook managing a `Map<streamId, StreamState>`.

3. **Dedicated trace timeline per stream**: The current single timeline would become per-stream, or a combined timeline with streamId as a filter dimension. Each timeline would use virtualized rendering internally.

4. **Shared context inspector with stream selector**: The context panel would show which stream's context is being inspected, with a selector to switch between streams. Memory would be bounded by keeping only the last N snapshots per stream.

5. **Throttled state flushes**: With 50 streams, each emitting 30+ events/sec, flushing to React state on every message would saturate the render thread. We'd use a shared flush scheduler that coalesces updates and flushes on `requestAnimationFrame` (max 60 flushes/sec total, not per stream).

6. **Worker for reordering/diffing**: The `ReorderBuffer` and `computeDiff` operations would be offloaded to a Web Worker to avoid blocking the main thread. PostMessage would deliver ordered messages and diff results to the React renderer.

## Handling 100x Longer Responses (Full Document Generation)

If responses were 100x longer (full documents, not chat):

1. **Lazy text rendering**: Instead of appending all tokens to a single string, we'd render text as a list of "chunks" (e.g., 100-token batches). The initial render shows the first batch, with subsequent batches rendered as they arrive. This prevents a single massive DOM text node from causing layout slowdowns.

2. **Virtualized document view**: The document would render in a virtual scroller, showing only the visible portion. As the user scrolls, more chunks are materialized into the DOM. This is the standard approach for long documents (like Google Docs' rendering).

3. **Streaming to disk-backed storage**: Accumulating 100x the token count in memory would be unsustainable. We'd write completed chunks to IndexedDB (or a shared worker's storage), keeping only the most recent ~500 tokens in memory for immediate display. The user can scroll back, triggering a load from IndexedDB.

4. **Throttled context diff**: For context snapshots that could be proportionally larger, we'd limit diff computation to only the keys visible in the collapsed tree view (deferring deep diffs until the user expands a node). This avoids the O(n) traversal of the entire object on every snapshot.

5. **Incremental trace timeline**: The trace timeline would cap visible events (e.g., last 1000 events) with a "load earlier" button, similar to how Chrome DevTools Network tab handles many requests.

## Identified Protocol Race Condition

**The `TOOL_ACK` timeout creates a race condition**: The server waits 5 seconds for a `TOOL_ACK` before sending `TOOL_RESULT` anyway. But if the network is slow or the client's render cycle is deferred (e.g., the browser tab was backgrounded), the `TOOL_ACK` might arrive *after* the timeout fires.

In this case:
- The server logs a violation for late `TOOL_ACK`.
- The server sends `TOOL_RESULT` anyway.
- The client processes the result normally.

The race condition means a client can be protocol-compliant in intent (it did acknowledge) but still get flagged for a violation (the ACK arrived late). The mitigation is to send `TOOL_ACK` *immediately* when the tool call is received (not when it's rendered), using a `setTimeout(0)` or similar to defer the render but send the ACK synchronously. However, the assignment spec says "when the client has rendered a tool call card", so the client must render first. This tension is inherent in the protocol.