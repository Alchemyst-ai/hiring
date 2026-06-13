"use client";

import { useRef, useEffect, useState, useMemo, forwardRef } from "react";
import type { TraceEvent, TraceEventType } from "@/lib/types";

const EVENT_COLORS: Record<TraceEventType, string> = {
  TOKEN: "#3b82f6",
  TOOL_CALL: "#f59e0b",
  TOOL_RESULT: "#22c55e",
  CONTEXT_SNAPSHOT: "#8b5cf6",
  PING: "#6b7280",
  PONG: "#9ca3af",
  STREAM_END: "#ef4444",
  ERROR: "#ef4444",
};

const EVENT_ICONS: Record<TraceEventType, string> = {
  TOKEN: "T",
  TOOL_CALL: "⚡",
  TOOL_RESULT: "✓",
  CONTEXT_SNAPSHOT: "📋",
  PING: "♥",
  PONG: "♡",
  STREAM_END: "■",
  ERROR: "✕",
};

const TraceRow = forwardRef<
  HTMLDivElement,
  {
    type: string;
    seq: number;
    label: string;
    detail: string;
    color: string;
    icon: string;
    onClick: () => void;
    isHighlighted: boolean;
    linked?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
  }
>(function TraceRow(
  {
    type,
    seq,
    label,
    detail,
    color,
    icon,
    onClick,
    isHighlighted,
    linked,
    expanded,
    onToggleExpand,
  },
  ref,
) {
  const hasExpandableDetail = Boolean(detail && onToggleExpand);

  return (
    <div
      ref={ref}
      className={`traceRow ${isHighlighted ? "traceRowHighlighted" : ""} ${linked ? "traceRowLinked" : ""}`}
      onClick={hasExpandableDetail ? onToggleExpand : onClick}
    >
      <span className="traceEventDot" style={{ backgroundColor: color }}>
        {icon}
      </span>
      <div className="traceEventBody">
        <div className="traceEventHeader">
          <span className="traceEventType" style={{ color }}>
            {type}
          </span>
          <span className="traceEventSeq">#{seq}</span>
        </div>
        <span className="traceEventText">{label}</span>
        {detail && (
          <span className={`traceEventDetail ${expanded ? "traceEventDetailExpanded" : ""}`}>
            {expanded || !hasExpandableDetail ? detail : `${detail.slice(0, 120)}${detail.length > 120 ? "…" : ""}`}
          </span>
        )}
        {hasExpandableDetail && (
          <button
            type="button"
            className="traceExpandBtn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
          >
            {expanded ? "Collapse" : "Expand full text"}
          </button>
        )}
      </div>
    </div>
  );
});

function getEventLabel(evt: TraceEvent): string {
  switch (evt.type) {
    case "TOOL_CALL":
      return `${String(evt.data.tool_name ?? "tool")} (${String(evt.data.call_id ?? "")})`;
    case "TOOL_RESULT":
      return `${String(evt.data.call_id ?? "")} → result`;
    case "CONTEXT_SNAPSHOT":
      return `context_id: ${String(evt.data.context_id ?? "")}`;
    case "PING":
      return `challenge: ${String(evt.data.challenge ?? "(empty)")}`;
    case "PONG":
      return `echo: ${String(evt.data.echo ?? "(empty)")}`;
    case "STREAM_END":
      return `stream_id: ${String(evt.data.stream_id ?? "")}`;
    case "ERROR":
      return `${String(evt.data.code ?? "")}: ${String(evt.data.message ?? "")}`;
    default:
      return "";
  }
}

export function TraceTimeline({
  events,
  onHighlightEvent,
  highlightedEventId,
}: {
  events: TraceEvent[];
  onHighlightEvent: (eventId: string) => void;
  highlightedEventId: string | null;
}) {
  const [filter, setFilter] = useState<TraceEventType | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  const toolCallIds = useMemo(() => {
    const ids = new Set<string>();
    for (const evt of events) {
      if (evt.type === "TOOL_CALL" && evt.call_id) ids.add(evt.call_id);
    }
    return ids;
  }, [events]);

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedEventId]);

  useEffect(() => {
    if (!highlightedEventId && listRef.current) {
      const el = listRef.current;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isAtBottom) el.scrollTop = el.scrollHeight;
    }
  }, [events, highlightedEventId]);

  const tokenBatches = useMemo(() => {
    const batches: Array<{
      id: string;
      streamId: string | null;
      count: number;
      durationMs: number;
      combinedText: string;
      seqRange: [number, number];
    }> = [];
    let i = 0;
    while (i < events.length) {
      if (events[i]!.type === "TOKEN") {
        const startIdx = i;
        let combinedText = String(events[i]!.data.text ?? "");
        i++;
        while (i < events.length && events[i]!.type === "TOKEN") {
          combinedText += String(events[i]!.data.text ?? "");
          i++;
        }
        const batchEvents = events.slice(startIdx, i);
        const count = batchEvents.length;
        const durationMs =
          count > 1
            ? batchEvents[count - 1]!.timestamp - batchEvents[0]!.timestamp
            : 0;
        const streamId = String(batchEvents[0]!.data.stream_id ?? "");
        batches.push({
          id: streamId ? `batch-${streamId}-${batchEvents[0]!.seq}` : `batch-${batchEvents[0]!.seq}`,
          streamId: streamId || null,
          count,
          durationMs,
          combinedText,
          seqRange: [batchEvents[0]!.seq, batchEvents[count - 1]!.seq],
        });
      } else {
        i++;
      }
    }
    return batches;
  }, [events]);

  type DisplayItem =
    | { kind: "batch"; batch: (typeof tokenBatches)[number] }
    | { kind: "event"; event: TraceEvent };

  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [];
    let batchIdx = 0;
    let i = 0;
    while (i < events.length) {
      if (events[i]!.type === "TOKEN") {
        if (batchIdx < tokenBatches.length) {
          items.push({ kind: "batch", batch: tokenBatches[batchIdx]! });
          batchIdx++;
        }
        while (i < events.length && events[i]!.type === "TOKEN") i++;
      } else {
        items.push({ kind: "event", event: events[i]! });
        i++;
      }
    }
    return items;
  }, [events, tokenBatches]);

  const matchesFilter = (type: TraceEventType) => filter === "ALL" || filter === type;

  const matchesSearch = (payload: string) =>
    !searchQuery || payload.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <article className="card panelCard traceCard">
      <header className="cardHeader">
        <h2>Trace Timeline</h2>
        <span className="muted">{events.length} events</span>
      </header>

      <div className="traceFilters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TraceEventType | "ALL")}
          className="traceFilterSelect"
          aria-label="Filter trace events"
        >
          <option value="ALL">All events</option>
          <option value="TOKEN">Tokens</option>
          <option value="TOOL_CALL">Tool calls</option>
          <option value="TOOL_RESULT">Tool results</option>
          <option value="CONTEXT_SNAPSHOT">Context</option>
          <option value="PING">Heartbeats</option>
          <option value="PONG">PONG</option>
          <option value="ERROR">Errors</option>
        </select>
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="traceSearchInput"
          aria-label="Search trace events"
        />
      </div>

      <div className="traceList" ref={listRef}>
        {displayItems.map((item) => {
          if (item.kind === "batch") {
            if (!matchesFilter("TOKEN")) return null;
            const searchPayload = item.batch.combinedText;
            if (!matchesSearch(searchPayload)) return null;

            const expanded = expandedBatches.has(item.batch.id);
            return (
              <TraceRow
                key={item.batch.id}
                type="TOKEN"
                seq={item.batch.seqRange[0]}
                label={`Streamed ${item.batch.count} tokens${item.batch.durationMs > 0 ? ` (${(item.batch.durationMs / 1000).toFixed(1)}s)` : ""}`}
                detail={item.batch.combinedText}
                color={EVENT_COLORS.TOKEN}
                icon={EVENT_ICONS.TOKEN}
                onClick={() => onHighlightEvent(item.batch.id)}
                isHighlighted={highlightedEventId === item.batch.id}
                expanded={expanded}
                onToggleExpand={() => {
                  setExpandedBatches((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.batch.id)) next.delete(item.batch.id);
                    else next.add(item.batch.id);
                    return next;
                  });
                }}
              />
            );
          }

          const evt = item.event;
          if (!matchesFilter(evt.type)) return null;
          if (!matchesSearch(JSON.stringify(evt.data))) return null;

          const linked =
            (evt.type === "TOOL_CALL" || evt.type === "TOOL_RESULT") &&
            Boolean(evt.call_id && toolCallIds.has(evt.call_id));

          return (
            <TraceRow
              key={evt.id}
              type={evt.type}
              seq={evt.seq}
              label={getEventLabel(evt)}
              detail=""
              color={EVENT_COLORS[evt.type]}
              icon={EVENT_ICONS[evt.type]}
              onClick={() => onHighlightEvent(evt.id)}
              isHighlighted={highlightedEventId === evt.id}
              linked={linked}
              ref={highlightedEventId === evt.id ? highlightedRef : undefined}
            />
          );
        })}
        {displayItems.length === 0 && (
          <div className="traceEmpty">No events yet. Send a message to the agent.</div>
        )}
      </div>
    </article>
  );
}
