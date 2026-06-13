/**
 * Coalesces high-frequency state flushes to one per animation frame.
 * Used during token streaming (~30 events/sec) to avoid saturating React.
 */
export function createFlushScheduler(flush: () => void) {
  let rafId: number | null = null;
  let generation = 0;

  return {
    schedule() {
      if (rafId !== null) return;
      const gen = ++generation;
      rafId = requestAnimationFrame(() => {
        if (gen !== generation) return;
        rafId = null;
        flush();
      });
    },
    flushNow() {
      generation++;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      flush();
    },
    cancel() {
      generation++;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
