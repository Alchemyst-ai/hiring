#!/usr/bin/env node
/**
 * Captures README screenshots and chaos-mode screen recording.
 * Prerequisites: agent-server + frontend running on 4747 / 3000.
 *
 * Usage:
 *   node scripts/capture-submission.mjs --mode screenshots
 *   node scripts/capture-submission.mjs --mode chaos-video
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const MODE = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "screenshots";

async function waitForApp(page) {
  await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector("h1:has-text('Agent Console')", { timeout: 30_000 });
}

async function connectAndSend(page, message) {
  const connectBtn = page.getByRole("button", { name: "Connect" });
  await connectBtn.click();
  await page.waitForFunction(
    () => {
      const ta = document.querySelector("textarea");
      return ta && !ta.disabled;
    },
    { timeout: 15_000 },
  );

  const textarea = page.getByRole("textbox", { name: "Type a message" });
  await textarea.fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}

async function waitForStreamComplete(page, timeoutMs = 45_000) {
  await page.waitForFunction(
    () => {
      const cards = document.querySelectorAll(".toolCardResult, .messageAssistant");
      const streaming = document.querySelector(".messageAssistant .streamingCursor");
      const hasAssistant = document.querySelectorAll(".messageAssistant").length > 0;
      return hasAssistant && !streaming && document.querySelectorAll(".toolCard").length >= 0;
    },
    { timeout: timeoutMs },
  ).catch(() => {});
  await page.waitForTimeout(1500);
}

async function captureScreenshots() {
  await mkdir(DOCS, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await waitForApp(page);
    await connectAndSend(page, "Summarise the Q3 report");
    await waitForStreamComplete(page, 60_000);

    await page.screenshot({
      path: path.join(DOCS, "screenshot-stream-tool.png"),
      fullPage: false,
    });
    console.log("✓ docs/screenshot-stream-tool.png");

    await page.screenshot({
      path: path.join(DOCS, "screenshot-trace.png"),
      clip: { x: 720, y: 120, width: 700, height: 700 },
    });
    console.log("✓ docs/screenshot-trace.png");

    await page.screenshot({
      path: path.join(DOCS, "screenshot-context-diff.png"),
      clip: { x: 720, y: 520, width: 700, height: 380 },
    });
    console.log("✓ docs/screenshot-context-diff.png");
  } finally {
    await browser.close();
  }
}

async function showOverlay(page, text) {
  await page.evaluate((label) => {
    let el = document.getElementById("chaos-label");
    if (!el) {
      el = document.createElement("div");
      el.id = "chaos-label";
      el.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;" +
        "background:#0f766e;color:#fff;padding:12px 24px;border-radius:12px;" +
        "font:bold 18px system-ui;box-shadow:0 8px 32px rgba(0,0,0,0.3);";
      document.body.appendChild(el);
    }
    el.textContent = label;
  }, text);
}

async function captureChaosVideo() {
  await mkdir(path.join(DOCS, "videos"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(DOCS, "videos"), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  const scenarios = [
    { label: "1. Connection drop mid-stream + RESUME recovery", message: "hello" },
    { label: "2. Out-of-order token delivery (ReorderBuffer)", message: "Summarise the Q3 report" },
    { label: "3. Rapid sequential tool calls", message: "Analyze and compare the data" },
    { label: "4. Oversized context snapshot (500KB+)", message: "Show me the large database schema" },
    { label: "5. Corrupt heartbeat (empty PING challenge)", message: "hello" },
  ];

  let videoPath = null;
  try {
    await waitForApp(page);
    await connectAndSend(page, "hello");
    await showOverlay(page, "Chaos mode — Agent Console survival demo");
    await page.waitForTimeout(2000);

    for (const { label, message } of scenarios) {
      await showOverlay(page, label);
      await page.waitForTimeout(1500);

      const textarea = page.getByRole("textbox", { name: "Type a message" });
      const canSend = !(await textarea.isDisabled());

      if (canSend) {
        await textarea.fill(message);
        await page.getByRole("button", { name: "Send" }).click();
        await waitForStreamComplete(page, 90_000);
      }

      await page.waitForTimeout(4000);
    }

    await showOverlay(page, "Chaos survival complete — check /log for protocol compliance");
    await page.waitForTimeout(3000);
  } finally {
    const video = page.video();
    await page.close();
    await context.close();

    if (video) {
      const dest = path.join(DOCS, "chaos-mode-recording.webm");
      await video.saveAs(dest);
      videoPath = dest;
      console.log(`✓ ${dest}`);
    }

    await browser.close();
  }

  return videoPath;
}

async function main() {
  if (MODE === "chaos-video") {
    console.log("\n🎬 Recording chaos mode demo...\n");
    await captureChaosVideo();
  } else {
    console.log("\n📸 Capturing README screenshots...\n");
    await captureScreenshots();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
