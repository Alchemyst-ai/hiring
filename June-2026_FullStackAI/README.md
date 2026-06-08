# Full Stack AI Engineer Assignment

## Overview

In this assignment, you will build an **Agent Console**  a Next.js application that connects to a provided mock AI agent backend over WebSockets, renders streaming responses with mid-stream tool call interruptions, displays a live agent trace timeline, and survives the backend's chaos mode without crashing or losing state.

The backend (`agent-server`) is provided as a Docker container. You do not modify it. It speaks a documented WebSocket protocol, simulates a context-aware AI agent that streams responses, makes tool calls, retrieves context, and  when chaos mode is enabled  drops connections, reorders messages, injects latency spikes, and sends malformed heartbeats. Your job is to build a frontend that handles all of it gracefully.

This is not a chat UI exercise. It is a systems exercise that happens to have a frontend. You will be evaluated on how your application _behaves under stress_, not how it looks in a screenshot.

---

## Why This Assignment Exists

At Alchemyst AI, the frontend is the last mile between a context-aware AI agent and a paying client. If the agent streams a response and the UI jitters, the client sees a broken product. If a tool call happens mid-stream and the message reflows, the client loses trust. If the WebSocket drops and the reconnection silently loses three messages, the client sees an incoherent response and blames the AI.

We need engineers who understand that real-time AI interfaces are a distributed systems problem with a render loop attached.

---

## Prerequisites

- **Docker** installed and running (the agent-server ships as a container).
- **Node.js 20+** and a package manager of your choice (`npm`, `pnpm`, `yarn`).
- Read the **Protocol Reference** (Section below) and the `agent-server/README.md` end-to-end before writing any code. Understand every message type and its sequence number semantics before you touch a WebSocket.
- Run the agent-server in `--mode normal` first. Watch the raw WebSocket frames in your browser's Network tab. Only then start building.

---

## The Agent Server

The `agent-server` directory contains a Dockerised WebSocket server that simulates a context-aware AI agent. Run it as:

```bash
docker build -t agent-server ./agent-server
docker run -p 4747:4747 agent-server            # normal mode
docker run -p 4747:4747 agent-server --mode chaos  # chaos mode
```

The server exposes:
- `ws://localhost:4747/ws`  the main WebSocket endpoint
- `GET http://localhost:4747/health`  healthcheck
- `GET http://localhost:4747/log`  returns a JSON array of every client-side event the server recorded during the session (heartbeat responses, RESUME messages, acknowledgements). **This is how we verify your client's protocol compliance.**

You send a user message; the agent responds by streaming tokens, optionally making tool calls mid-stream, and periodically broadcasting context snapshots. Details in the Protocol Reference below.

---

## Protocol Reference

Every WebSocket message is a JSON object with a `type` field and a monotonically increasing `seq` (sequence number). The `seq` is critical  it is how the client tracks what it has received and how state recovery works after reconnection.

### Client → Server Messages

| Type | Fields | Description |
|---|---|---|
| `USER_MESSAGE` | `content: string` | Send a user message to the agent. |
| `PONG` | `echo: string` | Response to a server PING. Must echo the `challenge` field from the PING, verbatim. |
| `RESUME` | `last_seq: number` | Sent immediately upon reconnection. Tells the server the last `seq` the client successfully processed. The server replays all events after that `seq`. |
| `TOOL_ACK` | `call_id: string` | Acknowledges that the client has rendered a tool call card. The server waits for this before sending `TOOL_RESULT`. If not received within 5 seconds, the server logs a protocol violation and sends the result anyway. |

### Server → Client Messages

| Type | Fields | Description |
|---|---|---|
| `TOKEN` | `seq`, `text: string`, `stream_id: string` | A chunk of the agent's streaming response. Tokens arrive roughly every 30–80ms. `stream_id` groups tokens belonging to the same response. |
| `TOOL_CALL` | `seq`, `call_id: string`, `tool_name: string`, `args: object`, `stream_id: string` | The agent is invoking a tool mid-stream. The current token stream is paused (no more `TOKEN` events for this `stream_id` until `TOOL_RESULT`). |
| `TOOL_RESULT` | `seq`, `call_id: string`, `result: object`, `stream_id: string` | The tool returned a result. Token streaming for the `stream_id` resumes after this event. |
| `CONTEXT_SNAPSHOT` | `seq`, `context_id: string`, `data: object` | A snapshot of what data the agent is currently working with. Sent at the start of a response and whenever the agent's context changes mid-response. |
| `PING` | `seq`, `challenge: string` | Heartbeat. Client must reply with a `PONG` containing the exact `challenge` string within 3 seconds. Three missed PONGs = server terminates the connection. |
| `STREAM_END` | `seq`, `stream_id: string` | The agent has finished its response for this `stream_id`. |
| `ERROR` | `seq`, `code: string`, `message: string` | A server-side error. May arrive at any point. |

### Sequence Number Rules

1. Every server message has a `seq`. Sequence numbers are globally ordered and gapless in normal mode.
2. The client must track the highest `seq` it has fully processed (rendered to the DOM, not just received).
3. On reconnection, the client sends `RESUME` with `last_seq` set to the highest fully-processed `seq`. The server replays everything after it.
4. In chaos mode, the server may send messages with out-of-order `seq` values. The client must buffer and reorder before processing.
5. Duplicate `seq` values are possible in chaos mode. The client must deduplicate.

### Chaos Mode Behaviours

When the server runs with `--mode chaos`, it randomly introduces:

| Behaviour | What happens |
|---|---|
| **Connection drop** | Server kills the WebSocket mid-stream with no close frame. Can happen at any point. |
| **Latency spike** | Token delivery pauses for 2–8 seconds, then resumes in a burst. |
| **Out-of-order delivery** | Messages arrive with `seq` values that are not sequential. |
| **Duplicate messages** | The same `seq` is sent twice. |
| **Rapid tool calls** | Two `TOOL_CALL` events in quick succession for the same `stream_id` before any `TOOL_RESULT`. |
| **Corrupt heartbeat** | A PING arrives with an empty `challenge` field. Client must handle without crashing. |
| **Oversized context** | A `CONTEXT_SNAPSHOT` with a `data` payload exceeding 500KB. |

---

## What to Build

### Task 1  Streaming Chat with Tool Call Interruptions

Build the core chat interface. A user types a message, the agent streams a response token by token, and tool calls interrupt the stream mid-sentence.

**Specific requirements:**

- Tokens must render incrementally as they arrive, not batched into paragraphs after the stream ends.
- When a `TOOL_CALL` event arrives mid-stream, the in-progress text must freeze in place  no flicker, no reflow, no layout shift. A tool call card must appear below the frozen text showing the tool name and arguments.
- The client must send a `TOOL_ACK` for each `TOOL_CALL` within 2 seconds.
- When `TOOL_RESULT` arrives, the tool call card must update to show the result, and token streaming must resume from exactly where it paused. The user must not perceive a gap or duplicate text.
- Multiple sequential tool calls (tool call → result → tool call → result → resume) must render as a stacked sequence, not overwrite each other.

**Why this is hard:** Getting the interleave right  freezing the stream at the exact token boundary, rendering the card, resuming without duplication  requires a state machine, not a `useEffect`. Most AI-generated WebSocket chat code will fail here because it assumes a linear stream.

### Task 2  Agent Trace Timeline

Build a collapsible side panel that shows every protocol event in real time as the agent works.

**Specific requirements:**

- Every event (`TOKEN`, `TOOL_CALL`, `TOOL_RESULT`, `CONTEXT_SNAPSHOT`, `PING`/`PONG`, `ERROR`) must appear as a row in a scrollable, auto-updating timeline.
- `TOKEN` events should be grouped: instead of one row per token, batch consecutive tokens into a single expandable row that shows "Streamed 47 tokens (1.2s)" with the full text visible on expand.
- `TOOL_CALL` and `TOOL_RESULT` rows must be visually linked (same `call_id`, connected by a line or indent).
- Clicking any row should highlight the corresponding element in the chat panel (the text chunk, the tool card, etc.). This is bidirectional  clicking a tool card in the chat should scroll the timeline to its `TOOL_CALL` entry.
- The timeline must not cause visible jank when events are arriving at 30+ per second (token streaming rate). If you are re-rendering the full list on every token, that is wrong.
- Include a filter bar: filter by event type, search by content.

### Task 3  Context Inspector

Build a context panel that shows what data the agent is currently operating on, with diffs.

**Specific requirements:**

- When a `CONTEXT_SNAPSHOT` event arrives, display the `data` object in a readable, syntax-highlighted tree view.
- When a subsequent `CONTEXT_SNAPSHOT` arrives (same `context_id`), compute and display the diff: what keys were added, removed, or changed. Highlight changes visually in the tree.
- For large context objects (500KB+ in chaos mode), the tree must remain interactive  no freezing the tab. Consider virtualisation or lazy expansion.
- Include a "history" scrubber: the user can step backward and forward through the sequence of snapshots for a given `context_id` and see the diff at each step.

**Why this is hard:** Diffing arbitrary nested JSON performantly, rendering it as a navigable tree, and keeping it responsive when the payload is half a megabyte  this requires understanding both algorithms and the DOM.

### Task 4  Reconnection with State Recovery

Implement connection lifecycle management that makes drops invisible to the user.

**Specific requirements:**

- When the WebSocket connection drops, show a non-blocking reconnection indicator within 500ms. The chat panel must remain interactive (the user can scroll, copy text, read).
- Reconnection attempts must use exponential backoff: 500ms, 1s, 2s, 4s, capped at 10s.
- Upon successful reconnection, the client must send a `RESUME` message containing the `last_seq` it fully processed. This must happen as the first message on the new connection.
- When the server replays missed events, the client must process them in `seq` order, deduplicate any that were already processed, and stitch them into the existing DOM state without visible jumps.
- If the connection drops mid-tool-call (after `TOOL_CALL` but before `TOOL_RESULT`), the tool card must remain visible with a "waiting" state, and the result must render correctly when the replayed events include the `TOOL_RESULT`.
- Heartbeat management: respond to every `PING` with a `PONG` within 3 seconds. Handle corrupt PINGs (empty `challenge`) without crashing.

**Why this is hard:** Reconnection that actually works  not just reconnects but _recovers state_  requires tracking what the DOM has consumed, not just what the socket has received. Most reconnection code in tutorials handles the "reconnect" part but destroys the "recovery" part.

### Task 5  Chaos Survival

Enable chaos mode (`--mode chaos`) and record your screen (3–5 minutes) showing your application handling the following scenarios, labelling each as it happens:

1. **Connection drop mid-stream:** The agent is streaming tokens, the connection dies, your app reconnects, and the response continues seamlessly.
2. **Out-of-order messages:** Tokens arrive with shuffled `seq` values. Your app reorders them and renders the text correctly.
3. **Rapid tool calls:** Two tool calls fire in quick succession. Both cards appear, both results land, and streaming resumes without duplication.
4. **Oversized context snapshot:** A 500KB+ context snapshot arrives. The context panel renders without freezing the chat.
5. **Corrupt heartbeat:** A PING with an empty challenge arrives. Your app does not crash or disconnect.

This recording is **mandatory**. A submission without it will be treated as incomplete.

---

## Technical Constraints

- **Framework:** Next.js 14+ (App Router). No Pages Router.
- **Language:** TypeScript in strict mode (`"strict": true` in tsconfig). No `any` types outside a single, clearly documented escape hatch file. No `@ts-ignore`.
- **Styling:** Your choice (Tailwind, CSS Modules, vanilla CSS), but the app must be usable, not necessarily beautiful. Function over aesthetics  we want correct rendering, not gradients.
- **State management:** Your choice, but document why. If you pick Redux for a WebSocket app and can justify it, fine. If you pick `useState` and it holds up under chaos, also fine. We will read your rationale.
- **No AI chat component libraries.** No `ai` SDK streaming helpers, no `vercel/ai`, no `langchain` frontend packages. You are building the streaming renderer from scratch. That is the point.

---

## Deliverables

Submit a repository (public Git repo or tarball) containing:

1. **Your Next.js application**  fully buildable with `npm install && npm run build && npm run start`. No manual steps. No missing env vars. If it does not build on the first try, that is a signal.

2. **A `README.md`** with:
   - A 2–3 sentence summary of your architectural approach.
   - A state machine diagram (ASCII, Mermaid, or image) showing your WebSocket connection states and transitions (connected → streaming → tool_call_pending → reconnecting → resuming, etc.).
   - Instructions to run the app against the agent-server.
   - Screenshots of the app in normal mode showing: (a) a streamed response with a tool call, (b) the trace timeline, (c) the context inspector showing a diff.
   
3. **The chaos mode screen recording** (Task 5). Upload to YouTube (unlisted), Loom, or include as an `.mp4` in the repo.

4. **A `DECISIONS.md`** file (1–2 pages) covering:
   - Your approach to `seq`-based ordering and deduplication. What data structure did you use and why?
   - How you prevent layout shift during tool call interruptions. What CSS or rendering strategy?
   - Your reconnection state recovery approach. How do you track what the DOM has "consumed" vs. what the socket has "received"?
   - What you would change if this needed to handle 50 concurrent agent streams on one screen (an "operations dashboard" scenario).
   - What you would change if the agent's responses were 100x longer (think: full document generation, not chat).

---

## Evaluation Criteria

| Criteria | Weight | What we are checking |
|---|---|---|
| **Protocol compliance** | 25% | We run the agent-server with logging (`/log` endpoint) and check: Are `PONG` responses timely? Are `TOOL_ACK` messages sent? Is the `RESUME` message correct after drops? Does the client deduplicate? |
| **Chaos survival** | 25% | We watch your recording and run chaos mode ourselves. Does the app crash? Does the DOM enter an inconsistent state? Are messages lost? Does the UI freeze? |
| **Streaming fidelity** | 20% | Token rendering is smooth and incremental. Tool calls interrupt and resume without duplication, reflow, or flicker. The final rendered text matches what the server sent (we compare against server logs). |
| **Code quality** | 15% | TypeScript strictness. State machine clarity. No `useEffect` spaghetti. Clear separation between protocol handling and rendering. Tests for non-trivial logic (the reordering buffer, the diff engine). |
| **Architectural judgment** | 15% | The DECISIONS.md shows you understand _why_ you made your choices, not just _what_ you built. Bonus points for identifying failure modes we didn't ask about. |

> **Note:** Incomplete submissions are accepted if your `DECISIONS.md` documents what you attempted, what failed, and what you would do differently. We would rather see a well-documented partial implementation than a fully working app you do not understand.

---

## What Will Get You Rejected

To be transparent about what we filter on:

- **AI-generated code with no understanding.** We will ask you to walk through your WebSocket state machine in a follow-up call. If you cannot explain why your reconnection logic sends `RESUME` before processing buffered events, that is a problem.
- **No screen recording.** This is not optional. Code that compiles is not the same as code that works.
- **`any` types sprinkled throughout.** This tells us you fought the type system instead of designing with it.
- **The app works in normal mode but crashes in chaos mode.** Normal mode is the tutorial. Chaos mode is the job.

---

## What Will Impress Us

Also being transparent here:

- A reconnection sequence so smooth we have to check the logs to confirm the drop actually happened.
- A trace timeline that we instinctively start using as a debugging tool while evaluating your submission.
- A `DECISIONS.md` that identifies a failure mode in the protocol itself (there is at least one  the `TOOL_ACK` timeout creates a race condition; if you spot it and document it, that is a strong signal).
- Unit tests for your reordering buffer with edge cases (empty buffer, single element, duplicates, fully reversed sequence).

---

## Timeline

Implementation should take approximately 4–5 days. The scope is intentionally larger than what you might finish  we want to see what you prioritise.

**Final Deadline: To Be Announced**

---

## Submission

Email your repo link (or tarball) to **anuran@getalchemystai.com** with the subject line:

```
Full Stack AI Engineer Assignment  <Your Name>
```

CC: **vedanta@getalchemystai.com** and **khushi@getalchemystai.com**.

Include the link to your chaos mode screen recording in the email body.

---

## Appendix: Quick Protocol Interaction Example

```
CLIENT  →  { "type": "USER_MESSAGE", "content": "Summarise the Q3 report" }

SERVER  ←  { "type": "CONTEXT_SNAPSHOT", "seq": 1, "context_id": "ctx_01", "data": { "report": "Q3-2025", "pages": 47, "sections": ["revenue", "ops", "forecast"] } }
SERVER  ←  { "type": "TOKEN", "seq": 2, "stream_id": "s_01", "text": "Based on " }
SERVER  ←  { "type": "TOKEN", "seq": 3, "stream_id": "s_01", "text": "the Q3 report, " }
SERVER  ←  { "type": "TOKEN", "seq": 4, "stream_id": "s_01", "text": "revenue grew " }
SERVER  ←  { "type": "TOOL_CALL", "seq": 5, "call_id": "tc_01", "tool_name": "lookup_metric", "args": { "metric": "revenue_yoy" }, "stream_id": "s_01" }

        -- stream paused, client renders tool card --

CLIENT  →  { "type": "TOOL_ACK", "call_id": "tc_01" }

SERVER  ←  { "type": "TOOL_RESULT", "seq": 6, "call_id": "tc_01", "result": { "value": "23.4%", "period": "YoY" }, "stream_id": "s_01" }

        -- stream resumes --

SERVER  ←  { "type": "TOKEN", "seq": 7, "stream_id": "s_01", "text": "23.4% year-over-year" }
SERVER  ←  { "type": "TOKEN", "seq": 8, "stream_id": "s_01", "text": ", driven primarily by..." }
        ...
SERVER  ←  { "type": "STREAM_END", "seq": 42, "stream_id": "s_01" }

        -- during all of the above, heartbeats are interleaved --

SERVER  ←  { "type": "PING", "seq": 15, "challenge": "a1b2c3" }
CLIENT  →  { "type": "PONG", "echo": "a1b2c3" }
```


### Quick Start

```bash
# 1. Start the mock agent backend
cd agent-server
docker build -t agent-server .
docker run -p 4747:4747 agent-server

# 2. Build your Next.js application against ws://localhost:4747/ws

# 3. Test with chaos mode
docker run -p 4747:4747 agent-server --mode chaos
```

Read the full assignment document before starting. Understand the protocol before writing code.

Wishing everyone who is solving this - best of luck!

_- Vedanta Banerjee_
_SWE & TPM, Alchemyst Labs_