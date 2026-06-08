import { ChaosConfig, ServerMessage } from "./types.js";

// ─────────────────────────────────────────────────────────────
// ChaosEngine
//
// Wraps the message delivery pipeline and injects failures:
// - Out-of-order delivery (buffered shuffle)
// - Duplicate messages
// - Latency spikes
// - Connection drops (signalled, not executed here)
// - Corrupt heartbeats
// ─────────────────────────────────────────────────────────────

export class ChaosEngine {
  private config: ChaosConfig;
  private messagesSent: number = 0;
  private reorderBuffer: ServerMessage[] = [];
  private readonly REORDER_BUFFER_SIZE = 4;

  constructor(config: ChaosConfig) {
    this.config = config;
  }

  reset(): void {
    this.messagesSent = 0;
    this.reorderBuffer = [];
  }

  /**
   * Check if the connection should be dropped.
   * Called before each message send. Returns true if it is time to kill
   * the connection. The caller is responsible for actually closing the socket.
   */
  shouldDropConnection(): boolean {
    if (this.config.dropAfterMessages === null) return false;
    return this.messagesSent >= this.config.dropAfterMessages;
  }

  /**
   * Check if a PING should have its challenge corrupted.
   */
  shouldCorruptPing(): boolean {
    return Math.random() < this.config.corruptPingProbability;
  }

  /**
   * Process a message through the chaos pipeline.
   * Returns an array of messages to send (may be empty if buffered,
   * may contain duplicates, may be reordered).
   *
   * Also returns a delay in ms to wait before sending.
   */
  process(message: ServerMessage): { messages: ServerMessage[]; delayMs: number } {
    this.messagesSent++;

    const output: ServerMessage[] = [];
    let delayMs = 0;

    // ── Latency spike ─────────────────────────────────────
    if (Math.random() < this.config.latencySpikeProbability) {
      const [min, max] = this.config.latencySpikeMs;
      delayMs = min + Math.random() * (max - min);
    }

    // ── Reorder: buffer messages and shuffle ──────────────
    if (Math.random() < this.config.reorderProbability) {
      this.reorderBuffer.push(message);
      if (this.reorderBuffer.length >= this.REORDER_BUFFER_SIZE) {
        // Fisher-Yates shuffle
        const buf = [...this.reorderBuffer];
        for (let i = buf.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [buf[i], buf[j]] = [buf[j], buf[i]];
        }
        output.push(...buf);
        this.reorderBuffer = [];
      }
      // If buffer not yet full, return empty — messages are held
      if (output.length === 0) return { messages: [], delayMs: 0 };
    } else {
      // Flush any pending buffer first (in shuffled order), then this message
      if (this.reorderBuffer.length > 0) {
        const buf = [...this.reorderBuffer, message];
        for (let i = buf.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [buf[i], buf[j]] = [buf[j], buf[i]];
        }
        output.push(...buf);
        this.reorderBuffer = [];
      } else {
        output.push(message);
      }
    }

    // ── Duplicate: occasionally send a message twice ──────
    const finalOutput: ServerMessage[] = [];
    for (const msg of output) {
      finalOutput.push(msg);
      if (Math.random() < this.config.duplicateProbability) {
        finalOutput.push(msg); // exact duplicate, same seq
      }
    }

    return { messages: finalOutput, delayMs };
  }

  /**
   * Flush any remaining buffered messages (e.g. at stream end).
   */
  flush(): ServerMessage[] {
    if (this.reorderBuffer.length === 0) return [];
    const buf = [...this.reorderBuffer];
    // Shuffle before flushing
    for (let i = buf.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [buf[i], buf[j]] = [buf[j], buf[i]];
    }
    this.reorderBuffer = [];
    return buf;
  }
}

/**
 * Generate a chaos config with random parameters.
 * Each connection gets a different chaos profile so candidates
 * can't hard-code around a specific pattern.
 */
export function generateChaosConfig(): ChaosConfig {
  return {
    // Drop after 15-45 messages (roughly mid-stream for most scripts)
    dropAfterMessages: Math.random() < 0.5
      ? 15 + Math.floor(Math.random() * 30)
      : null,
    reorderProbability: 0.15 + Math.random() * 0.2,    // 15-35%
    duplicateProbability: 0.05 + Math.random() * 0.1,   // 5-15%
    latencySpikeProbability: 0.05 + Math.random() * 0.08, // 5-13%
    latencySpikeMs: [2000, 6000 + Math.random() * 2000],
    corruptPingProbability: 0.15 + Math.random() * 0.1, // 15-25%
  };
}
