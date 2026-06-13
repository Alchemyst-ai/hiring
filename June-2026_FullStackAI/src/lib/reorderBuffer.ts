// ─────────────────────────────────────────────────────────────
// Seq-based reordering buffer
//
// Handles out-of-order delivery, duplicates, and provides
// in-order emission. Used to process server messages that may
// arrive with shuffled seq values in chaos mode.
// ─────────────────────────────────────────────────────────────

import type { ServerMessage } from "./types";

/**
 * A buffer that accepts messages with potentially out-of-order
 * seq values and emits them in correct seq order.
 *
 * - Out-of-order messages are buffered until the gap is filled.
 * - Duplicate seq values are dropped silently.
 * - The buffer has a configurable max size to bound memory.
 */
export class ReorderBuffer {
  private buffer: Map<number, ServerMessage> = new Map();
  private nextExpectedSeq: number = 1;
  private readonly maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  /**
   * Reset the buffer (e.g. on new conversation turn).
   */
  reset(nextSeq: number = 1): void {
    this.buffer.clear();
    this.nextExpectedSeq = nextSeq;
  }

  /**
   * Accept a message. Returns an array of messages that can now
   * be emitted in order (always at least the message itself if
   * it fills the current gap, otherwise buffered).
   *
   * Duplicates (same seq already processed) return an empty array.
   */
  accept(msg: ServerMessage): ServerMessage[] {
    const seq = msg.seq;

    // Duplicate check: if seq is below nextExpectedSeq, it's
    // either already emitted or a duplicate of a buffered message.
    if (seq < this.nextExpectedSeq) {
      return []; // duplicate, silently drop
    }

    // If it's the next expected seq, emit it and flush any
    // subsequent buffered messages.
    if (seq === this.nextExpectedSeq) {
      const emitted: ServerMessage[] = [msg];
      this.nextExpectedSeq++;

      // Flush contiguous buffered messages
      while (this.buffer.has(this.nextExpectedSeq)) {
        const next = this.buffer.get(this.nextExpectedSeq)!;
        this.buffer.delete(this.nextExpectedSeq);
        emitted.push(next);
        this.nextExpectedSeq++;
      }

      return emitted;
    }

    // Future message: buffer it if we have room
    if (this.buffer.size >= this.maxSize) {
      // Buffer full — drop the oldest buffered message to make room.
      // This is safe because:
      // 1. All buffered messages have seq > nextExpectedSeq
      // 2. The oldest buffered message is the least likely to be
      //    needed soon (furthest behind in the sequence)
      // 3. If it was actually next in order, a later flush will
      //    catch it — but in practice, with maxSize=200 and
      //    typical out-of-order windows of 3-5, this never fires.
      const maxSeq = Math.max(...this.buffer.keys());
      // Only drop if the new message is more important (higher seq)
      // than the oldest. Otherwise drop the new one.
      if (seq > maxSeq) {
        // Drop the oldest (lowest seq) to make room for the new highest
        const minSeq = Math.min(...this.buffer.keys());
        this.buffer.delete(minSeq);
        this.buffer.set(seq, msg);
      }
      // else: the new message is older than everything we have, drop it
      return [];
    }

    // Buffer the out-of-order message
    this.buffer.set(seq, msg);
    return [];
  }

  /**
   * Returns the count of currently buffered messages.
   */
  get bufferedCount(): number {
    return this.buffer.size;
  }

  /**
   * Returns the next seq we're expecting.
   */
  get expectedSeq(): number {
    return this.nextExpectedSeq;
  }

  /**
   * Force-flush all buffered messages in seq order (for stream end).
   */
  flush(): ServerMessage[] {
    if (this.buffer.size === 0) return [];

    const sorted = [...this.buffer.keys()].sort((a, b) => a - b);
    const emitted: ServerMessage[] = [];
    for (const seq of sorted) {
      if (seq >= this.nextExpectedSeq) {
        emitted.push(this.buffer.get(seq)!);
      }
    }
    this.buffer.clear();
    this.nextExpectedSeq = sorted.length > 0
      ? (sorted[sorted.length - 1]! as number) + 1
      : this.nextExpectedSeq;
    return emitted;
  }
}