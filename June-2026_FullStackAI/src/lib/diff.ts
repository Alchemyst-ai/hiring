// ─────────────────────────────────────────────────────────────
// JSON diff engine for context snapshot comparison
//
// Computes a diff between two arbitrary JSON values (usually
// Record<string, unknown>). Returns a tree-structured diff that
// the ContextInspector component can render with visual highlights.
//
// This is a shallow-first diff: it identifies added, removed,
// and changed keys at each level, recursing into nested objects
// but treating arrays as atomic (showing additions/removals by
// index).
// ─────────────────────────────────────────────────────────────

export type DiffType = "added" | "removed" | "changed" | "unchanged";

export interface DiffNode {
  key: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
  children?: DiffNode[];
}

/**
 * Compute a diff between two JSON values.
 * Returns an array of DiffNode entries for the top-level keys.
 * If both values are objects, it recurses. Arrays are compared
 * element-by-element by index.
 */
export function computeDiff(
  oldVal: Record<string, unknown> | null | undefined,
  newVal: Record<string, unknown> | null | undefined,
  options?: { shallowOnly?: boolean },
): DiffNode[] {
  const oldObj = oldVal ?? {};
  const newObj = newVal ?? {};
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const result: DiffNode[] = [];
  const shallowOnly = options?.shallowOnly ?? false;

  for (const key of allKeys) {
    const oldV = oldObj[key];
    const newV = newObj[key];

    if (!(key in oldObj)) {
      result.push({ key, type: "added", newValue: newV });
    } else if (!(key in newObj)) {
      result.push({ key, type: "removed", oldValue: oldV });
    } else if (!deepEqual(oldV, newV)) {
      if (!shallowOnly && isObject(oldV) && isObject(newV)) {
        const children = computeDiff(
          oldV as Record<string, unknown>,
          newV as Record<string, unknown>,
          options,
        );
        if (children.length > 0) {
          result.push({ key, type: "changed", children });
        } else {
          result.push({ key, type: "unchanged", oldValue: oldV, newValue: newV });
        }
      } else {
        result.push({ key, type: "changed", oldValue: oldV, newValue: newV });
      }
    } else {
      result.push({ key, type: "unchanged", oldValue: oldV, newValue: newV });
    }
  }

  // Sort: added first, then removed, then changed, then unchanged
  const order: Record<DiffType, number> = {
    added: 0,
    removed: 1,
    changed: 2,
    unchanged: 3,
  };
  result.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

  return result;
}

/**
 * Deep equality check for arbitrary JSON-serializable values.
 * Handles primitives, objects, and arrays.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!(key in (b as Record<string, unknown>))) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    return true;
  }

  return a === b;
}

function isObject(val: unknown): val is object {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/** Payloads above this size use top-level diff only until a node is expanded. */
export const LARGE_CONTEXT_BYTES = 100_000;

export function estimateJsonBytes(val: unknown): number {
  try {
    return JSON.stringify(val).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}