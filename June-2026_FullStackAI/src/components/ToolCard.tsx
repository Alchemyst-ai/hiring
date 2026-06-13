"use client";

import { useLayoutEffect } from "react";
import type { ToolCallWithResult } from "@/lib/types";

export function ToolCard({
  toolCall,
  onAck,
  onHighlight,
  isHighlighted,
}: {
  toolCall: ToolCallWithResult;
  onAck: (callId: string) => void;
  onHighlight?: (traceEventId: string) => void;
  isHighlighted?: boolean;
}) {
  useLayoutEffect(() => {
    onAck(toolCall.call_id);
  }, [toolCall.call_id, onAck]);

  const hasResult = toolCall.result !== null;

  return (
    <div
      className={`toolCard ${hasResult ? "toolCardResult" : "toolCardPending"} ${isHighlighted ? "toolCardHighlighted" : ""}`}
      onClick={() => onHighlight?.(toolCall.traceEventId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHighlight?.(toolCall.traceEventId);
        }
      }}
    >
      <div className="toolCardHeader">
        <span className="toolCardIcon">{hasResult ? "✓" : "⚡"}</span>
        <span className="toolCardName">{toolCall.tool_name}</span>
        <span className="toolCardStatus">{hasResult ? "Complete" : "Running..."}</span>
      </div>
      <div className="toolCardSection">
        <span className="toolCardLabel">Arguments</span>
        <pre className="toolCardCode">{JSON.stringify(toolCall.args, null, 2)}</pre>
      </div>
      {hasResult && (
        <div className="toolCardSection">
          <span className="toolCardLabel">Result</span>
          <pre className="toolCardCode">{JSON.stringify(toolCall.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
