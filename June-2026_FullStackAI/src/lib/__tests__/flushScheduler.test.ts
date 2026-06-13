import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createFlushScheduler } from "../flushScheduler";

describe("createFlushScheduler", () => {
  beforeEach(() => {
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("schedule coalesces multiple calls into one flush", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    );

    const flush = vi.fn();
    const scheduler = createFlushScheduler(flush);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  test("flushNow runs immediately and cancels pending rAF", () => {
    let rafCallback: FrameRequestCallback = () => {};
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        rafCallback = cb;
        return 1;
      },
    );

    const flush = vi.fn();
    const scheduler = createFlushScheduler(flush);

    scheduler.schedule();
    scheduler.flushNow();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    rafCallback(0);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  test("cancel prevents scheduled flush", () => {
    let rafCallback: FrameRequestCallback = () => {};
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        rafCallback = cb;
        return 2;
      },
    );

    const flush = vi.fn();
    const scheduler = createFlushScheduler(flush);
    scheduler.schedule();
    scheduler.cancel();
    rafCallback(0);

    expect(flush).not.toHaveBeenCalled();
  });
});
