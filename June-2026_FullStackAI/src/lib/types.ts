// ─────────────────────────────────────────────────────────────
// Protocol types (mirrored from agent-server for the client)
// ─────────────────────────────────────────────────────────────

// ── Server → Client Messages ──────────────────────────────────

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

// ── Client → Server Messages ──────────────────────────────────

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongPayload {
  type: "PONG";
  echo: string;
}

export interface ResumePayload {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckPayload {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessagePayload
  | PongPayload
  | ResumePayload
  | ToolAckPayload;

// ── Connection states for the state machine ───────────────────

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "resuming";

// ── Stream state for a single stream_id ───────────────────────

export interface StreamState {
  streamId: string;
  tokens: string[];
  pendingToolCalls: ToolCallWithResult[];
  isComplete: boolean;
  lastSeq: number; // highest seq processed for this stream
}

export interface ToolCallWithResult {
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  acknowledged: boolean;
  /** Server seq of the TOOL_CALL event — used for timeline linking */
  seq: number;
  /** Stable trace row id for bidirectional highlight */
  traceEventId: string;
}

// ── Trace event for the timeline ──────────────────────────────

export type TraceEventType =
  | "TOKEN"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "PONG"
  | "STREAM_END"
  | "ERROR";

export interface TraceEvent {
  id: string;
  seq: number;
  type: TraceEventType;
  timestamp: number;
  data: Record<string, unknown>;
  // For linking tool_calls <-> tool_results
  call_id?: string;
}

// ── UI-related types ──────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  // For assistant messages, we build content from token streams
  text: string;
  toolCalls: ToolCallWithResult[];
  streamId: string | null;
  isStreaming: boolean;
}

export interface ContextSnapshotEntry {
  context_id: string;
  seq: number;
  data: Record<string, unknown>;
  timestamp: number;
}