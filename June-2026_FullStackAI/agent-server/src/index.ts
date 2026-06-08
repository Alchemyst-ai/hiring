import { AgentServer } from "./server.js";
import type { ServerMode } from "./types.js";

// ─────────────────────────────────────────────────────────────
// CLI entry point
// Usage:
//   node dist/index.js                  # normal mode, port 4747
//   node dist/index.js --mode chaos     # chaos mode
//   node dist/index.js --port 8080      # custom port
// ─────────────────────────────────────────────────────────────

function parseArgs(args: string[]): { mode: ServerMode; port: number } {
  let mode: ServerMode = "normal";
  let port = 4747;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && i + 1 < args.length) {
      const val = args[i + 1];
      if (val === "normal" || val === "chaos") {
        mode = val;
      } else {
        console.error(`Invalid mode: ${val}. Must be "normal" or "chaos".`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--port" && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${args[i + 1]}`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Agent Server — Mock AI agent backend for the Full Stack assignment

Usage:
  node dist/index.js [options]

Options:
  --mode <normal|chaos>   Server mode (default: normal)
  --port <number>         Port to listen on (default: 4747)
  --help, -h              Show this help message

Endpoints:
  ws://localhost:<port>/ws       WebSocket endpoint
  GET http://localhost:<port>/health   Health check
  GET http://localhost:<port>/log      Client event log (JSON)
  GET http://localhost:<port>/reset    Reset session state

Trigger Keywords (in USER_MESSAGE):
  hello, hi, hey          → Simple greeting (no tool calls)
  report, summary, q3     → Report summary (1 tool call + context updates)
  analyze, compare        → Multi-tool analysis (2 tool calls)
  lookup, find, search    → Immediate tool call before tokens
  schema, database, large → Large context snapshot (~550KB)
  long, detailed, document→ Long response with many tokens
  (anything else)         → Default response (1 tool call)
`);
      process.exit(0);
    }
  }

  return { mode, port };
}

const { mode, port } = parseArgs(process.argv.slice(2));

console.log("╔══════════════════════════════════════════════╗");
console.log("║         Alchemyst Agent Server v1.0          ║");
console.log("╚══════════════════════════════════════════════╝");
console.log();

const server = new AgentServer(mode);
server.listen(port);
