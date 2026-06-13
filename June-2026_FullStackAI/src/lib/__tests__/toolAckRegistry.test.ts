import { describe, test, expect, beforeEach } from "vitest";
import { markToolAckSent, resetToolAckRegistry } from "../toolAckRegistry";

describe("toolAckRegistry", () => {
  beforeEach(() => {
    resetToolAckRegistry();
  });

  test("marks first ack as sendable", () => {
    expect(markToolAckSent("tc_1")).toBe(true);
  });

  test("deduplicates repeated acks for same call_id", () => {
    expect(markToolAckSent("tc_1")).toBe(true);
    expect(markToolAckSent("tc_1")).toBe(false);
  });

  test("reset clears registry for new conversation turn", () => {
    markToolAckSent("tc_1");
    resetToolAckRegistry();
    expect(markToolAckSent("tc_1")).toBe(true);
  });
});
