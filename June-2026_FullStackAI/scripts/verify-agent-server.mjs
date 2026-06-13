#!/usr/bin/env node
/**
 * Protocol compliance verification against the agent-server.
 * Mirrors client behavior: ReorderBuffer, PONG, TOOL_ACK, RESUME, reconnection.
 *
 * Usage:
 *   node scripts/verify-agent-server.mjs              # normal mode
 *   node scripts/verify-agent-server.mjs --mode chaos   # chaos mode
 */

const WS_URL = process.env.WS_URL ?? "ws://localhost:4747/ws";
const LOG_URL = process.env.LOG_URL ?? "http://localhost:4747/log";
const RESET_URL = process.env.RESET_URL ?? "http://localhost:4747/reset";
const HEALTH_URL = process.env.HEALTH_URL ?? "http://localhost:4747/health";
const MODE = process.argv.includes("--mode") && process.argv.includes("chaos") ? "chaos" : "normal";
const MAX_RECONNECTS = MODE === "chaos" ? 10 : 0;

class ReorderBuffer {
  constructor(maxSize = 200) {
    this.buffer = new Map();
    this.nextExpectedSeq = 1;
    this.maxSize = maxSize;
  }

  reset(nextSeq = 1) {
    this.buffer.clear();
    this.nextExpectedSeq = nextSeq;
  }

  accept(msg) {
    const seq = msg.seq;
    if (seq < this.nextExpectedSeq) return [];
    if (seq === this.nextExpectedSeq) {
      const emitted = [msg];
      this.nextExpectedSeq++;
      while (this.buffer.has(this.nextExpectedSeq)) {
        emitted.push(this.buffer.get(this.nextExpectedSeq));
        this.buffer.delete(this.nextExpectedSeq);
        this.nextExpectedSeq++;
      }
      return emitted;
    }
    if (this.buffer.size >= this.maxSize) {
      const minSeq = Math.min(...this.buffer.keys());
      const forced = this.buffer.get(minSeq);
      this.buffer.delete(minSeq);
      this.buffer.set(seq, msg);
      return this.accept(forced);
    }
    this.buffer.set(seq, msg);
    return [];
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function runSession(label, userMessage) {
  await fetch(`${RESET_URL}`).catch(() => {});

  const reorderBuf = new ReorderBuffer();
  let processedSeq = 0;
  let streamEnded = false;
  let tokenText = "";
  const toolAcks = new Set();
  let reconnectAttempts = 0;
  let userMessageSent = false;
  let done = false;
  let ws = null;

  const finish = (result) => {
    if (done) return;
    done = true;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    return result;
  };

  const processOrdered = (m, send) => {
    if (m.seq > processedSeq) processedSeq = m.seq;

    switch (m.type) {
      case "TOKEN":
        tokenText += m.text;
        break;
      case "TOOL_CALL":
        send({ type: "TOOL_ACK", call_id: m.call_id });
        toolAcks.add(m.call_id);
        break;
      case "STREAM_END":
        streamEnded = true;
        break;
    }
  };

  const connect = () =>
    new Promise((resolve, reject) => {
      if (done) return;
      ws = new WebSocket(WS_URL);

      ws.addEventListener("open", () => {
        reconnectAttempts = 0;
        if (processedSeq > 0) {
          ws.send(JSON.stringify({ type: "RESUME", last_seq: processedSeq }));
        } else if (!userMessageSent) {
          ws.send(JSON.stringify({ type: "USER_MESSAGE", content: userMessage }));
          userMessageSent = true;
        }
      });

      ws.addEventListener("message", (event) => {
        let msg;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (msg.type === "PING") {
          if (msg.challenge && msg.challenge !== "") {
            ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
          }
          return;
        }

        const send = (payload) => ws.send(JSON.stringify(payload));
        for (const m of reorderBuf.accept(msg)) {
          processOrdered(m, send);
          if (streamEnded) {
            resolve(
              finish({
                tokenText,
                toolAcks: [...toolAcks],
                processedSeq,
                streamEnded,
              }),
            );
          }
        }
      });

      ws.addEventListener("close", async () => {
        if (done || streamEnded) return;
        if (reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          const delay = Math.min(500 * Math.pow(2, reconnectAttempts - 1), 10_000);
          await sleep(delay);
          connect().then(resolve).catch(reject);
        } else {
          reject(new Error(`${label}: connection closed before STREAM_END (${reconnectAttempts} reconnects)`));
        }
      });

      ws.addEventListener("error", () => {
        // close handler manages recovery
      });
    });

  const timeout = sleep(90_000).then(() => {
    finish(null);
    throw new Error(`${label}: timed out waiting for STREAM_END`);
  });

  return Promise.race([connect(), timeout]);
}

async function main() {
  console.log(`\n🔍 Agent server verification (${MODE} mode)\n`);

  try {
    const health = await fetchJson(HEALTH_URL);
    console.log(`✓ Server healthy — mode: ${health.mode ?? "unknown"}`);
  } catch {
    console.error(`✗ Cannot reach agent server at ${HEALTH_URL}`);
    console.error(`  Start it with: cd agent-server && npm start${MODE === "chaos" ? " -- --mode chaos" : ""}`);
    process.exit(1);
  }

  const scenarios = [
    { label: "Greeting", message: "hello" },
    { label: "Report summary (tool call)", message: "Summarise the Q3 report" },
  ];

  if (MODE === "chaos") {
    scenarios.push({ label: "Multi-tool analysis", message: "Analyze and compare the data" });
  }

  for (const { label, message } of scenarios) {
    process.stdout.write(`  Running: ${label}... `);
    try {
      const result = await runSession(label, message);
      console.log(`✓ (${result.tokenText.length} chars, ${result.toolAcks.length} TOOL_ACKs, seq=${result.processedSeq})`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
    await sleep(300);
  }

  const log = await fetchJson(LOG_URL);
  const violations = log.filter((e) => e.verdict === "violation");
  const errors = log.filter((e) => e.verdict === "error");

  console.log(`\n📋 Server log: ${log.length} entries`);

  if (violations.length === 0 && errors.length === 0) {
    console.log("✓ No protocol violations or errors\n");
    process.exit(0);
  }

  console.log(`✗ ${violations.length} violation(s), ${errors.length} error(s):\n`);
  for (const v of [...violations, ...errors]) {
    console.log(`  - [${v.verdict}] ${v.type ?? v.event ?? JSON.stringify(v)}`);
  }
  console.log("");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
