"use client";

import type { ConnectionStatus } from "@/lib/types";

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
  reconnecting: "Reconnecting...",
  resuming: "Resuming...",
};

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  disconnected: "#ef4444",
  connecting: "#f59e0b",
  connected: "#22c55e",
  reconnecting: "#f59e0b",
  resuming: "#3b82f6",
};

export function ConnectionIndicator({
  status,
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isLive =
    status === "connected" || status === "resuming" || status === "reconnecting";
  const isTransient = status === "connecting";

  return (
    <div className="connectionIndicator">
      <span
        className="connectionDot"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      <span className="connectionLabel">{STATUS_LABELS[status]}</span>
      {isLive ? (
        <button className="connectionBtn" onClick={onDisconnect}>
          Disconnect
        </button>
      ) : (
        <button
          className="connectionBtn connectionBtnConnect"
          onClick={onConnect}
          disabled={isTransient}
        >
          {isTransient ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );
}