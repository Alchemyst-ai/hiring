# Agent Server

Mock AI agent backend for the Full Stack AI Engineer assignment.

This server simulates a context-aware AI agent that streams responses over WebSocket, makes tool calls mid-stream, sends context snapshots and in chaos mode, it introduces real-world failure conditions.

**You do not modify this server.** You build a frontend that connects to it.

## Quick Start

### Docker (recommended)

```bash
docker build -t agent-server .
docker run -p 4747:4747 agent-server                # normal mode
docker run -p 4747:4747 agent-server --mode chaos    # chaos mode
```

### Local (for inspection)

```bash
npm install
npm run build
npm start                    # normal mode
npm start -- --mode chaos    # chaos mode
npm start -- --port 8080     # custom port
```

## Endpoints

| Endpoint | Description |
|---|---|
| `ws://localhost:4747/ws` | WebSocket - connect your client here |
| `GET /health` | Returns server status, mode, current seq, connection state |
| `GET /log` | Returns JSON array of all client events the server recorded (PONG responses, TOOL_ACK messages, RESUME messages, protocol violations). **This is how evaluators verify your client.** |
| `GET /reset` | Resets the session state (clears history and logs) |

## Trigger Keywords

The server selects a response script based on keywords in your `USER_MESSAGE`:

| Keywords | Script | What it tests |
|---|---|---|
| `hello`, `hi`, `hey` | Simple greeting | Basic token streaming, no tool calls |
| `report`, `summary`, `q3` | Report summary | One tool call mid-stream + context updates |
| `analyze`, `compare` | Multi-tool analysis | Two sequential tool calls |
| `lookup`, `find`, `search` | Knowledge base lookup | Tool call *before* any tokens |
| `schema`, `database`, `large` | Large context | 500KB+ context snapshot + tool call |
| `long`, `detailed`, `document` | Long response | Many tokens + tool call |
| *(anything else)* | Default | Moderate response with one tool call |

## Protocol Reference

See the **Protocol Reference** section in `fullstack-internship-assignment.md` for the complete specification. Key points:

- Every server message has a `type` and a monotonic `seq` number.
- Client must respond to `PING` with `PONG` (echoing the `challenge`) within 3 seconds.
- Client must send `TOOL_ACK` when it renders a tool call card.
- On reconnection, client sends `RESUME` with `last_seq` to get missed events replayed.

## Chaos Mode

When run with `--mode chaos`, the server randomly introduces:

- **Connection drops** mid-stream (hard terminate, no close frame)
- **Out-of-order** message delivery (shuffled `seq` values)
- **Duplicate** messages (same `seq` sent twice)
- **Latency spikes** (2-6 second pauses in token delivery)
- **Corrupt heartbeats** (PING with empty `challenge` field)
- **Oversized context** (500KB+ `CONTEXT_SNAPSHOT` payload)

Each connection gets a randomly generated chaos profile, so the failure pattern is different every time.

## Verifying Your Client

After interacting with the server, hit `GET http://localhost:4747/log` to see what the server recorded about your client's behavior:

```bash
curl -s http://localhost:4747/log | python3 -m json.tool
```

Each log entry has a `verdict` field:
- `"ok"` — correct protocol behavior
- `"violation"` — protocol violation (missed PONG, late TOOL_ACK, etc.)
- `"error"` — malformed message from client
- `"unexpected"` — valid message but out of expected context

All the best!