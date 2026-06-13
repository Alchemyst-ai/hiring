"use client";

import { useState, useMemo, useEffect } from "react";
import type { ContextSnapshotEntry } from "@/lib/types";
import { computeDiff, estimateJsonBytes, LARGE_CONTEXT_BYTES, type DiffNode } from "@/lib/diff";

/**
 * Context panel that displays context snapshots with:
 * - Syntax-highlighted tree view of the data
 * - Diff view when new snapshots arrive (same context_id)
 * - History scrubber to step through snapshots (view any snapshot pair)
 * - Lazy expansion for large objects (500KB+)
 */
export function ContextInspector({
  snapshots,
}: {
  snapshots: ContextSnapshotEntry[];
}) {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Group snapshots by context_id
  const grouped = useMemo(() => {
    const map = new Map<string, ContextSnapshotEntry[]>();
    for (const snap of snapshots) {
      const group = map.get(snap.context_id) ?? [];
      group.push(snap);
      map.set(snap.context_id, group);
    }
    return map;
  }, [snapshots]);

  const contextIds = useMemo(() => [...grouped.keys()], [grouped]);

  // Auto-select first context_id if current selection is gone
  const effectiveContextId = selectedContextId && contextIds.includes(selectedContextId)
    ? selectedContextId
    : contextIds[0] ?? null;

  const currentSnapshots = effectiveContextId
    ? grouped.get(effectiveContextId) ?? []
    : [];

  // Snapshot index for the scrubber (0 = oldest, n-1 = latest)
  const [snapshotIndex, setSnapshotIndex] = useState<number>(0);

  // Jump to latest snapshot when context changes or new snapshots arrive
  useEffect(() => {
    setSnapshotIndex(Math.max(0, currentSnapshots.length - 1));
  }, [effectiveContextId, currentSnapshots.length]);

  // Compute diff between the selected snapshot and its predecessor
  const diffNodes = useMemo(() => {
    if (currentSnapshots.length === 0) return [];
    const idx = Math.min(snapshotIndex, currentSnapshots.length - 1);
    const snap = currentSnapshots[idx];
    if (!snap) return [];

    const payloadBytes = estimateJsonBytes(snap.data);
    const shallowOnly = payloadBytes >= LARGE_CONTEXT_BYTES;

    if (idx === 0) {
      return computeDiff(null, snap.data, { shallowOnly });
    }
    const prev = currentSnapshots[idx - 1];
    return computeDiff(prev!.data, snap.data, { shallowOnly });
  }, [currentSnapshots, snapshotIndex]);

  // Handle empty state
  if (contextIds.length === 0) {
    return (
      <article className="card panelCard contextCard">
        <header className="cardHeader">
          <h2>Context Inspector</h2>
          <span className="muted">No snapshots yet</span>
        </header>
        <div className="contextEmpty">
          <p>Context snapshots will appear here when the agent shares them.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="card panelCard contextCard">
      <header className="cardHeader">
        <h2>Context Inspector</h2>
        <span className="muted">
          {currentSnapshots.length} snapshot{currentSnapshots.length !== 1 ? "s" : ""}
        </span>
      </header>

      {/* Context ID selector */}
      <div className="contextSelector">
        <label className="contextSelectorLabel" htmlFor="context-id-select">
          Context
        </label>
        <select
          id="context-id-select"
          value={effectiveContextId ?? ""}
          onChange={(e) => {
            setSelectedContextId(e.target.value);
            setSnapshotIndex(0);
          }}
          className="contextSelectorSelect"
        >
          {contextIds.map((cid) => (
            <option key={cid} value={cid}>
              {cid}
            </option>
          ))}
        </select>
      </div>

      {/* History scrubber — step through snapshots */}
      {currentSnapshots.length > 1 && (
        <div className="contextHistory">
          <span className="contextHistoryLabel">
            Snapshot {snapshotIndex + 1} of {currentSnapshots.length}
            {snapshotIndex > 0 ? " (showing diff)" : " (initial)"}
          </span>
          <div className="contextHistoryScrubber">
            {currentSnapshots.map((snap, idx) => (
              <button
                key={snap.seq}
                className={`contextHistoryDot ${
                  idx === snapshotIndex ? "contextHistoryDotActive" : ""
                }`}
                onClick={() => setSnapshotIndex(idx)}
                title={`Seq #${snap.seq}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Diff tree */}
      <div className="contextTree">
        {estimateJsonBytes(currentSnapshots[snapshotIndex]?.data) >= LARGE_CONTEXT_BYTES && (
          <p className="contextLargeHint muted">
            Large snapshot — showing top-level diff only. Expand nodes for detail.
          </p>
        )}
        {diffNodes.length > 0 ? (
          diffNodes.map((node) => (
            <DiffTreeNode
              key={node.key}
              node={node}
              depth={0}
              expandedKeys={expandedKeys}
              onToggle={(key) => {
                const next = new Set(expandedKeys);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                setExpandedKeys(next);
              }}
            />
          ))
        ) : (
          <div className="contextNoChanges">No changes detected</div>
        )}
      </div>
    </article>
  );
}

// ── Diff tree node ───────────────────────────────────────────

function DiffTreeNode({
  node,
  depth,
  expandedKeys,
  onToggle,
}: {
  node: DiffNode;
  depth: number;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const fullKey = `${depth}_${node.key}`;
  const isExpanded = expandedKeys.has(fullKey) && hasChildren;

  const typeClass =
    node.type === "added"
      ? "diffAdded"
      : node.type === "removed"
        ? "diffRemoved"
        : node.type === "changed"
          ? "diffChanged"
          : "diffUnchanged";

  const indent = depth * 16;

  return (
    <div className="diffNode">
      <div
        className={`diffNodeRow ${typeClass}`}
        style={{ paddingLeft: `${12 + indent}px` }}
        onClick={() => hasChildren && onToggle(fullKey)}
      >
        {hasChildren && (
          <span className="diffToggle">{isExpanded ? "▼" : "▶"}</span>
        )}
        <span className="diffKey">{node.key}</span>
        {node.type !== "unchanged" && (
          <span className="diffBadge">{node.type}</span>
        )}
        {!hasChildren && node.type === "added" && (
          <span className="diffValue">{formatValue(node.newValue)}</span>
        )}
        {!hasChildren && node.type === "removed" && (
          <span className="diffValue diffOldValue">{formatValue(node.oldValue)}</span>
        )}
        {!hasChildren && node.type === "changed" && (
          <span className="diffValue">
            <span className="diffOldValue">{formatValue(node.oldValue)}</span>
            {" → "}
            <span className="diffNewValue">{formatValue(node.newValue)}</span>
          </span>
        )}
        {!hasChildren && node.type === "unchanged" && (
          <span className="diffValue">{formatValue(node.oldValue)}</span>
        )}
      </div>
      {isExpanded &&
        node.children?.map((child) => (
          <DiffTreeNode
            key={child.key}
            node={child}
            depth={depth + 1}
            expandedKeys={expandedKeys}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (typeof val === "string") {
    if (val.length > 80) return `"${val.slice(0, 80)}..."`;
    return `"${val}"`;
  }
  if (typeof val === "object") {
    const str = JSON.stringify(val);
    if (str.length > 60) return str.slice(0, 60) + "...";
    return str;
  }
  return String(val);
}