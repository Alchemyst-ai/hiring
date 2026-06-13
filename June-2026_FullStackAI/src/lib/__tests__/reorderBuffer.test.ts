// ─────────────────────────────────────────────────────────────
// Unit tests for ReorderBuffer
//
// Tests: in-order, out-of-order, duplicates, gaps, flush,
// overflow, and edge cases.
// ─────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach } from "vitest";
import { ReorderBuffer } from "../reorderBuffer";
import type { ServerMessage } from "../types";

function token(seq: number, text: string = ""): ServerMessage {
  return { type: "TOKEN", seq, text, stream_id: "s1" };
}

function toolCall(seq: number, callId: string = "tc_1"): ServerMessage {
  return { type: "TOOL_CALL", seq, call_id: callId, tool_name: "test", args: {}, stream_id: "s1" };
}

function context(seq: number): ServerMessage {
  return { type: "CONTEXT_SNAPSHOT", seq, context_id: "ctx_1", data: {} };
}

describe("ReorderBuffer", () => {
  let buf: ReorderBuffer;

  beforeEach(() => {
    buf = new ReorderBuffer(10);
  });

  describe("in-order messages", () => {
    test("single message passes through immediately", () => {
      const result = buf.accept(token(1));
      expect(result).toHaveLength(1);
      expect(result[0]!.seq).toBe(1);
    });

    test("sequential messages emit in order", () => {
      expect(buf.accept(token(1))).toHaveLength(1);
      expect(buf.accept(token(2))).toHaveLength(1);
      expect(buf.accept(token(3))).toHaveLength(1);
      expect(buf.bufferedCount).toBe(0);
    });
  });

  describe("out-of-order messages", () => {
    test("future message is buffered until gap fills", () => {
      expect(buf.accept(token(3))).toHaveLength(0); // buffered
      expect(buf.bufferedCount).toBe(1);
      // Accepting seq 1 emits 1. Seq 2 is still missing, so seq 3 stays buffered.
      const result = buf.accept(token(1));
      expect(result).toHaveLength(1);
      expect(result[0]!.seq).toBe(1);
      expect(buf.bufferedCount).toBe(1);
    });

    test("gap fills and flushes buffered messages", () => {
      buf.accept(token(3)); // buffered
      buf.accept(token(2)); // buffered (still waiting for 1)
      expect(buf.bufferedCount).toBe(2);
      const result = buf.accept(token(1)); // should emit 1, 2, 3
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.seq)).toEqual([1, 2, 3]);
      expect(buf.bufferedCount).toBe(0);
    });

    test("complex reordering: 4, 2, 5, 1, 3", () => {
      buf.accept(token(4)); // buffered
      expect(buf.bufferedCount).toBe(1);
      buf.accept(token(2)); // buffered
      buf.accept(token(5)); // buffered
      expect(buf.bufferedCount).toBe(3);

      const r1 = buf.accept(token(1)); // emits 1, 2; 4 and 5 stay buffered (3 missing)
      expect(r1.map((m) => m.seq)).toEqual([1, 2]);
      expect(buf.bufferedCount).toBe(2); // 4, 5 buffered (seq 3 missing)

      const r2 = buf.accept(token(3)); // emits 3, 4, 5
      expect(r2.map((m) => m.seq)).toEqual([3, 4, 5]);
      expect(buf.bufferedCount).toBe(0);
    });

    test("fully reversed sequence", () => {
      // Accept 5,4,3,2,1 and expect them emitted in order when gap fills
      expect(buf.accept(token(5))).toHaveLength(0);
      expect(buf.accept(token(4))).toHaveLength(0);
      expect(buf.accept(token(3))).toHaveLength(0);
      expect(buf.accept(token(2))).toHaveLength(0);
      const result = buf.accept(token(1)); // emits 1,2,3,4,5
      expect(result).toHaveLength(5);
      expect(result.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("duplicate detection", () => {
    test("duplicate seq returns empty array", () => {
      buf.accept(token(1));
      const result = buf.accept(token(1));
      expect(result).toHaveLength(0);
    });

    test("duplicate of buffered message returns empty", () => {
      buf.accept(token(3)); // buffered
      const result = buf.accept(token(3)); // duplicate
      expect(result).toHaveLength(0);
    });

    test("duplicate after gap fill is dropped", () => {
      buf.accept(token(2)); // buffered
      buf.accept(token(1)); // emits 1, 2
      const result = buf.accept(token(2)); // duplicate
      expect(result).toHaveLength(0);
    });
  });

  describe("mixed message types", () => {
    test("handles different message types with proper seq", () => {
      buf.accept(context(2));
      const r1 = buf.accept(toolCall(1));
      // Expect emitted: 1 (toolCall), then 2 (context)
      expect(r1).toHaveLength(2);
      expect(r1[0]!.type).toBe("TOOL_CALL");
      expect(r1[1]!.type).toBe("CONTEXT_SNAPSHOT");
    });
  });

  describe("flush()", () => {
    test("flush returns buffered messages in seq order", () => {
      buf.accept(token(3));
      buf.accept(token(5));
      buf.accept(token(4));
      const flushed = buf.flush();
      expect(flushed.map((m) => m.seq)).toEqual([3, 4, 5]);
    });

    test("flush on empty buffer returns []", () => {
      expect(buf.flush()).toHaveLength(0);
    });

    test("flush after gap still returns sorted", () => {
      buf.accept(token(3));
      const flushed = buf.flush();
      expect(flushed.map((m) => m.seq)).toEqual([3]);
    });
  });

  describe("reset()", () => {
    test("reset clears buffer and expected seq", () => {
      buf.accept(token(1));
      buf.accept(token(3));
      buf.reset(10);
      expect(buf.expectedSeq).toBe(10);
      expect(buf.bufferedCount).toBe(0);
      const result = buf.accept(token(10));
      expect(result).toHaveLength(1);
      expect(result[0]!.seq).toBe(10);
    });
  });

  describe("buffer overflow", () => {
    test("drops oldest buffered message when full and incoming has higher seq", () => {
      const smallBuf = new ReorderBuffer(3);
      smallBuf.accept(token(4)); // buffered
      smallBuf.accept(token(5)); // buffered
      smallBuf.accept(token(6)); // buffered
      // Buffer is full (3 items). Accepting seq 7 should drop seq 4
      // (the oldest) because 7 > 6 (the current max).
      const result = smallBuf.accept(token(7));
      expect(result).toHaveLength(0); // nothing emitted
      // Buffer should now have 5, 6, 7 — seq 4 was dropped
      expect(smallBuf.bufferedCount).toBe(3);
      const keys = [...smallBuf["buffer"].keys()].sort((a, b) => a - b);
      expect(keys).toEqual([5, 6, 7]);
    });

    test("drops incoming message if it's older than all buffered", () => {
      const smallBuf = new ReorderBuffer(3);
      smallBuf.accept(token(4)); // buffered
      smallBuf.accept(token(5)); // buffered
      smallBuf.accept(token(6)); // buffered
      // Buffer is full. Accepting seq 2 should be dropped entirely
      // because 2 < 4 (the current min).
      const result = smallBuf.accept(token(2));
      expect(result).toHaveLength(0);
      expect(smallBuf.bufferedCount).toBe(3); // unchanged
    });
  });

  describe("edge cases", () => {
    test("seq 0 is handled", () => {
      buf.reset(0);
      const result = buf.accept(token(0));
      expect(result).toHaveLength(1);
      expect(result[0]!.seq).toBe(0);
    });

    test("large seq numbers work", () => {
      // seq 999999 buffered
      expect(buf.accept(token(999999))).toHaveLength(0);
      expect(buf.bufferedCount).toBe(1);
      // seq 1000000 buffered
      expect(buf.accept(token(1000000))).toHaveLength(0);
      expect(buf.bufferedCount).toBe(2);
      // Now accept seq 1 — emits seq 1, but 999999 and 1000000 stay
      // because they're still much larger than expected
      const result = buf.accept(token(1));
      expect(result).toHaveLength(1);
      expect(result[0]!.seq).toBe(1);
    });

    test("empty buffer initial state", () => {
      expect(buf.bufferedCount).toBe(0);
      expect(buf.expectedSeq).toBe(1);
    });
  });
});