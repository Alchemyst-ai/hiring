# Agent Console — Full Stack AI Engineer Assignment

## Architectural Approach

The Agent Console is built as a **state-machine-driven WebSocket client** in Next.js 15 (App Router, Turbopack dev). The core insight is that real-time AI agent rendering is a distributed systems problem: the frontend must handle out-of-order delivery, mid-stream tool call interruptions, connection drops with state recovery, and chaotic failure modes — all while maintaining a smooth, incremental rendering experience.

The architecture separates concerns into three layers:

1. **Protocol Layer** (`src/lib/`): Pure-logic modules for WebSocket lifecycle management (`WebSocketManager`), seq-based reordering and deduplication (`ReorderBuffer`), JSON diffing (`diff`), RAF-coalesced flushing (`flushScheduler`), and a central hook (`useAgentConsole`) that acts as the state machine, driving all protocol decisions.
2. **Rendering Layer** (`src/components/`): Stateless display components — `ChatPanel`, `ToolCard`, `TraceTimeline`, `ContextInspector`, `ConnectionIndicator` — that receive state via props and dispatch actions upward.
3. **Layout Layer**: The main `AgentConsole` component wires the hook to the UI via a single-page layout with a conversation panel (left) and sidebar (right) containing the trace timeline and context inspector.

## State Machine

```
┌─────────────┐     connect()     ┌──────────────┐
│ Disconnected │ ───────────────→ │  Connecting   │
└─────────────┘                   └──────┬───────┘
      ↑                                  │ ws.onopen
      │                                  ↓
      │                           ┌──────────────┐
      │       ws.close            │  Connected   │
      ├──────────────────────────←│              │
      │                           └──────┬───────┘
      │                                  │
      │     ┌────────────────────────────┼────────────────────┐
      │     │                            │                    │
      │     ▼                            ▼                    ▼
      │  ┌──────────┐              ┌─────────┐          ┌──────────┐
      │  │ Streaming│              │Tool Call│          │Heartbeat │
      │  │ (TOKEN)  │              │Pending  │          │(PING→PONG)│
      │  └────┬─────┘              └────┬────┘          └──────────┘
      │     TOOL_CALL                  │ TOOL_RESULT
      │     event                       │ + TOOL_ACK sent
      │     │                           ▼
      │     │                      ┌──────────┐
      │     └─────────────────────→│Resuming  │
      │                            │Stream    │
      │                            └──────────┘
      │                                  │ STREAM_END
      │                                  ↓
      │                           ┌──────────────┐
      └──────────────────────────│ Reconnecting  │
                ws.close          │(auto: 500ms→1s│
                                 │ →2s→4s→10s)  │
                                 └──────┬───────┘
                                        │ ws.onopen → send RESUME(last_seq)
                                        │ → server replays events after seq
                                        ↓
                                 ┌──────────────┐
                                 │   Resuming    │
                                 └──────┬───────┘
                                        │ Replay complete
                                        ↓
                                 ┌──────────────┐
                                 │  Connected    │
                                 └──────────────┘
```

### Connection States
- **disconnected**: Initial state. No WebSocket. User clicks "Connect".
- **connecting**: WebSocket opening. Transient.
- **connected**: Socket open. Processing messages. Heartbeat active.
- **reconnecting**: Socket dropped. Exponential backoff active. UI shows non-blocking indicator.
- **resuming**: Socket re-opened. Sending RESUME with last_seq. Processing replayed events.

## Running the Application

### 1. Start the Agent Server (Docker)

```bash
cd agent-server
docker build -t agent-server .
docker run -p 4747:4747 agent-server                # normal mode
docker run -p 4747:4747 agent-server --mode chaos    # chaos mode
```

### 2. Start the Frontend

```bash
cd June-2026_FullStackAI
npm install
npm run dev          # Turbopack dev server
# or for production:
npm run build && npm run start
npm test             # unit tests (ReorderBuffer, diff)
npm run typecheck    # strict TypeScript
npm run verify:server # protocol compliance against agent-server
```

Open [http://localhost:3000](http://localhost:3000), click "Connect", and send a message.

**Important:** The agent-server accepts only **one** WebSocket client. Before connecting, close other clients:

```bash
bash scripts/ensure-clean-ws.sh   # kills Cursor/IDE clients on :4747
curl -s http://localhost:4747/reset
```

### 3. Verify Protocol Compliance

```bash
npm run verify:server
curl -s http://localhost:4747/log | python3 -m json.tool
```

### 4. Capture submission artifacts

```bash
# Normal mode screenshots (README)
npm run capture:screenshots

# Chaos mode screen recording (Task 5)
# Start agent-server with --mode chaos first, then:
npm run capture:chaos-video
```

## Screenshots

### Normal mode — streamed response with tool call
![Stream with tool call](docs/screenshot-stream-tool.png)

### Trace timeline panel
![Trace timeline](docs/screenshot-trace.png)

### Context inspector with diff
![Context diff](docs/screenshot-context-diff.png)

## Chaos Mode Recording (Task 5)

Screen recording demonstrating chaos survival (connection drops, out-of-order delivery, rapid tool calls, oversized context, corrupt heartbeat):

- **MP4:** [docs/chaos-mode-recording.mp4](docs/chaos-mode-recording.mp4)
- **WebM:** [docs/chaos-mode-recording.webm](docs/chaos-mode-recording.webm)

Recorded against `agent-server --mode chaos` with on-screen scenario labels.

## Key Design Decisions

- **State machine over useEffect spaghetti**: All WebSocket lifecycle, message processing, and recovery logic lives in `useAgentConsole` as a centralized hook with refs for high-frequency updates and React state for rendering. This prevents the "stream of useEffect bugs" common in real-time apps.
- **Refs for high-frequency update paths**: Token streaming updates happen at ~30ms intervals. Using React state directly would trigger 30+ re-renders per second. Instead, we accumulate into refs and flush to React state on a `requestAnimationFrame` schedule via `flushScheduler` (max ~60 flushes/sec).
- **Sequential seq buffer**: The `ReorderBuffer` uses a `Map<seq, message>` that accepts out-of-order messages and emits them in order. It drops duplicates silently. This is simpler and more correct than naive sort-on-every-insert approaches.
- **CSS over animation libraries**: Layout shift during tool call interruptions is prevented by rendering tool cards as block elements within the message flow. The streaming text uses `white-space: pre-wrap` and the cursor is a CSS-animated `▊` character that is exactly one character wide, preventing reflow when it appears/disappears.

## Submission Checklist

Before emailing your repo link, confirm:

- [ ] **README** — architectural approach, state machine diagram, run instructions (this file)
- [ ] **DECISIONS.md** — seq ordering, layout shift, reconnection, scale questions
- [ ] **Screenshots** — 3 images in `docs/` (stream+tool, trace, context diff)
- [ ] **Chaos recording** — 3–5 min screen capture in `docs/chaos-mode-recording.mp4` (or `.webm`)
- [ ] **Protocol compliance** — `npm run verify:server` passes in normal mode; `curl localhost:4747/log` shows no violations during a clean run
- [ ] **Tests** — `npm test` and `npm run typecheck` pass
- [ ] **Git** — `src/lib/` is committed (root `.gitignore` uses `/lib/` so it is not excluded)
- [ ] **Single WS client** — run `bash scripts/ensure-clean-ws.sh` before Connect during demo

Email your **GitHub repo link** plus the chaos recording to:

- **anuran@getalchemystai.com** (subject: `Full Stack AI Engineer Assignment — <Your Name>`)
- CC: **vedanta@getalchemystai.com**, **khushi@getalchemystai.com**