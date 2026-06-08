// Quick integration test for the agent server
// Tests: connection, USER_MESSAGE, TOKEN streaming, TOOL_CALL/ACK/RESULT, PING/PONG, RESUME

import WebSocket from "ws";

const PORT = 4748;
const WS_URL = `ws://localhost:${PORT}/ws`;
const HTTP_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function waitForMessages(ws, count, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const timer = setTimeout(() => {
      ws.removeAllListeners("message");
      resolve(messages); // resolve with what we have, not reject
    }, timeoutMs);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      messages.push(msg);
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.removeAllListeners("message");
        resolve(messages);
      }
    });
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testNormalFlow() {
  console.log("\n── Test 1: Normal flow (greeting) ──");
  const ws = await connect();
  assert(ws.readyState === WebSocket.OPEN, "WebSocket connected");

  // Send a greeting
  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "hello" }));

  // Collect messages
  const msgs = await waitForMessages(ws, 20, 10000);
  assert(msgs.length > 0, `Received ${msgs.length} messages`);

  // Check we got a CONTEXT_SNAPSHOT
  const contexts = msgs.filter((m) => m.type === "CONTEXT_SNAPSHOT");
  assert(contexts.length >= 1, `Got ${contexts.length} CONTEXT_SNAPSHOT(s)`);

  // Check we got TOKEN messages
  const tokens = msgs.filter((m) => m.type === "TOKEN");
  assert(tokens.length > 0, `Got ${tokens.length} TOKEN(s)`);

  // Check all messages have seq
  const allHaveSeq = msgs.every((m) => typeof m.seq === "number" && m.seq > 0);
  assert(allHaveSeq, "All messages have valid seq numbers");

  // Check seq is monotonically increasing
  const seqs = msgs.map((m) => m.seq);
  const isMonotonic = seqs.every((s, i) => i === 0 || s > seqs[i - 1]);
  assert(isMonotonic, "Seq numbers are monotonically increasing");

  // Check STREAM_END
  const ends = msgs.filter((m) => m.type === "STREAM_END");
  assert(ends.length === 1, "Got STREAM_END");

  // Reconstruct text
  const text = tokens.map((t) => t.text).join("");
  assert(text.includes("Alchemyst Agent"), `Streamed text contains expected content: "${text.slice(0, 50)}..."`);

  ws.close();
  await sleep(200);
}

async function testToolCallFlow() {
  console.log("\n── Test 2: Tool call flow (report) ──");
  const ws = await connect();

  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "summarize the report" }));

  // Collect messages — need enough for context + tokens + tool call + result + more tokens + end
  const allMsgs = [];
  let toolCallSeen = false;
  let streamEnded = false;

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 20000);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      allMsgs.push(msg);

      // When we see a TOOL_CALL, send ACK
      if (msg.type === "TOOL_CALL" && !toolCallSeen) {
        toolCallSeen = true;
        ws.send(JSON.stringify({ type: "TOOL_ACK", call_id: msg.call_id }));
      }

      // When we see STREAM_END or a PING, check if stream is done
      if (msg.type === "STREAM_END") {
        streamEnded = true;
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }

      // Respond to PINGs
      if (msg.type === "PING" && msg.challenge) {
        ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
      }
    });
  });

  assert(allMsgs.length > 5, `Received ${allMsgs.length} messages`);

  const toolCalls = allMsgs.filter((m) => m.type === "TOOL_CALL");
  assert(toolCalls.length >= 1, `Got ${toolCalls.length} TOOL_CALL(s)`);
  assert(toolCalls[0].tool_name === "lookup_metric", `Tool name is "lookup_metric"`);

  const toolResults = allMsgs.filter((m) => m.type === "TOOL_RESULT");
  assert(toolResults.length >= 1, `Got ${toolResults.length} TOOL_RESULT(s)`);
  assert(toolResults[0].call_id === toolCalls[0].call_id, "TOOL_RESULT call_id matches TOOL_CALL");

  // Check tool call and result have same stream_id
  assert(toolCalls[0].stream_id === toolResults[0].stream_id, "Tool call and result share stream_id");

  assert(streamEnded, "Stream ended properly");

  ws.close();
  await sleep(200);
}

async function testMultiToolFlow() {
  console.log("\n── Test 3: Multi-tool flow (analyze) ──");
  const ws = await connect();

  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "analyze the correlation" }));

  const allMsgs = [];
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 25000);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      allMsgs.push(msg);

      if (msg.type === "TOOL_CALL") {
        ws.send(JSON.stringify({ type: "TOOL_ACK", call_id: msg.call_id }));
      }
      if (msg.type === "PING" && msg.challenge) {
        ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
      }
      if (msg.type === "STREAM_END") {
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }
    });
  });

  const toolCalls = allMsgs.filter((m) => m.type === "TOOL_CALL");
  assert(toolCalls.length === 2, `Got exactly 2 TOOL_CALL(s): ${toolCalls.length}`);
  assert(toolCalls[0].tool_name === "fetch_dataset", `First tool: ${toolCalls[0].tool_name}`);
  assert(toolCalls[1].tool_name === "compute_correlation", `Second tool: ${toolCalls[1].tool_name}`);

  const toolResults = allMsgs.filter((m) => m.type === "TOOL_RESULT");
  assert(toolResults.length === 2, `Got exactly 2 TOOL_RESULT(s): ${toolResults.length}`);

  ws.close();
  await sleep(200);
}

async function testPingPong() {
  console.log("\n── Test 4: Heartbeat (PING/PONG) ──");
  const ws = await connect();

  // Send a message to start a session
  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "hello" }));

  // Wait for a PING (heartbeat starts ~2s after connection, interval ~12s)
  // So we may need to wait a while
  let pingReceived = false;
  let pingChallenge = "";

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 16000);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "PING") {
        pingReceived = true;
        pingChallenge = msg.challenge;
        // Send PONG
        ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }
    });
  });

  assert(pingReceived, "Received a PING");
  assert(typeof pingChallenge === "string", "PING has a challenge string");

  // Check the log to verify PONG was recorded
  const logRes = await fetch(`${HTTP_URL}/log`);
  const log = await logRes.json();
  const pongEntries = log.filter((e) => e.type === "PONG" && e.verdict === "ok");
  assert(pongEntries.length >= 1, `Log shows ${pongEntries.length} successful PONG(s)`);

  ws.close();
  await sleep(200);
}

async function testResume() {
  console.log("\n── Test 5: RESUME (reconnection) ──");

  // Step 1: Connect and start a stream, then disconnect mid-stream
  const ws1 = await connect();
  ws1.send(JSON.stringify({ type: "USER_MESSAGE", content: "write a long detailed document" }));

  const firstBatch = [];
  let lastSeq = 0;

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 4000); // Collect messages for 4 seconds
    ws1.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      firstBatch.push(msg);
      lastSeq = msg.seq;

      if (msg.type === "TOOL_CALL") {
        ws1.send(JSON.stringify({ type: "TOOL_ACK", call_id: msg.call_id }));
      }
      if (msg.type === "PING" && msg.challenge) {
        ws1.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
      }
    });
  });

  assert(firstBatch.length > 3, `First connection received ${firstBatch.length} messages before disconnect`);
  assert(lastSeq > 0, `Last seq was ${lastSeq}`);

  // Disconnect
  ws1.terminate();
  await sleep(500);

  // Step 2: Reconnect and RESUME
  const ws2 = await connect();
  ws2.send(JSON.stringify({ type: "RESUME", last_seq: lastSeq }));

  // The server should replay events after lastSeq
  // Note: the stream was aborted when ws1 disconnected, so replay = already-sent events after lastSeq
  // For the "long" script, there may be events in history beyond lastSeq
  const replayedMsgs = await waitForMessages(ws2, 5, 5000);

  // The replayed messages should have seq > lastSeq
  if (replayedMsgs.length > 0) {
    const allAfterLastSeq = replayedMsgs.every((m) => m.seq > lastSeq);
    assert(allAfterLastSeq, "All replayed messages have seq > last_seq");
  }

  // Check the log for the RESUME entry
  const logRes = await fetch(`${HTTP_URL}/log`);
  const log = await logRes.json();
  const resumeEntries = log.filter((e) => e.type === "RESUME");
  assert(resumeEntries.length >= 1, `Log shows ${resumeEntries.length} RESUME event(s)`);

  ws2.close();
  await sleep(200);
}

async function testToolAckLogging() {
  console.log("\n── Test 6: TOOL_ACK logging ──");

  // Reset the log
  await fetch(`${HTTP_URL}/reset`);

  const ws = await connect();
  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "find the SLA docs" }));

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 15000);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "TOOL_CALL") {
        // Send ACK after 500ms delay (within the 5s timeout)
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "TOOL_ACK", call_id: msg.call_id }));
        }, 500);
      }
      if (msg.type === "PING" && msg.challenge) {
        ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
      }
      if (msg.type === "STREAM_END") {
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }
    });
  });

  const logRes = await fetch(`${HTTP_URL}/log`);
  const log = await logRes.json();
  const ackEntries = log.filter((e) => e.type === "TOOL_ACK" && e.verdict === "ok");
  assert(ackEntries.length >= 1, `Log shows ${ackEntries.length} successful TOOL_ACK(s)`);

  ws.close();
  await sleep(200);
}

async function testLargeContext() {
  console.log("\n── Test 7: Large context snapshot ──");

  const ws = await connect();
  ws.send(JSON.stringify({ type: "USER_MESSAGE", content: "show me the full database schema" }));

  const allMsgs = [];
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 20000);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      allMsgs.push(msg);
      if (msg.type === "TOOL_CALL") {
        ws.send(JSON.stringify({ type: "TOOL_ACK", call_id: msg.call_id }));
      }
      if (msg.type === "PING" && msg.challenge) {
        ws.send(JSON.stringify({ type: "PONG", echo: msg.challenge }));
      }
      if (msg.type === "STREAM_END") {
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }
    });
  });

  const contexts = allMsgs.filter((m) => m.type === "CONTEXT_SNAPSHOT");
  assert(contexts.length >= 1, `Got ${contexts.length} CONTEXT_SNAPSHOT(s)`);

  // Check the first context is large
  const firstCtx = contexts[0];
  const ctxSize = JSON.stringify(firstCtx.data).length;
  assert(ctxSize > 500000, `First context is ${Math.round(ctxSize / 1024)}KB (expected >500KB)`);

  // Check we got context updates (diffs)
  if (contexts.length >= 2) {
    assert(contexts[1].data.analysis_complete === true, "Second context has analysis_complete flag");
  }

  ws.close();
  await sleep(200);
}

// ─── Run all tests ─────────────────────────────────────────

async function main() {
  console.log("Starting agent-server integration tests...\n");

  // Start the server
  const { spawn } = await import("child_process");
  const server = spawn("node", ["dist/index.js", "--port", String(PORT)], {
    cwd: "/home/claude/fullstack-assignment/agent-server",
    stdio: "pipe",
  });

  // Wait for server to be ready
  await sleep(2000);

  try {
    await testNormalFlow();
    await testToolCallFlow();
    await testMultiToolFlow();
    await testPingPong();
    await testResume();
    await testToolAckLogging();
    await testLargeContext();
  } catch (err) {
    console.error("\nTest runner error:", err);
    failed++;
  }

  // Kill server
  server.kill("SIGTERM");

  console.log(`\n${"═".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
