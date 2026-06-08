// ─────────────────────────────────────────────────────────────
// Protocol type definitions for the Agent Server
// These are the canonical types for the WebSocket protocol.
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

// ── Response Script Types ─────────────────────────────────────

export interface ScriptTokenEvent {
  kind: "token";
  text: string;
}

export interface ScriptToolCallEvent {
  kind: "tool_call";
  tool_name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface ScriptContextEvent {
  kind: "context";
  context_id: string;
  data: Record<string, unknown>;
}

export type ScriptEvent = ScriptTokenEvent | ScriptToolCallEvent | ScriptContextEvent;

export interface ResponseScript {
  id: string;
  name: string;
  triggers: string[];          // Keywords that select this script
  events: ScriptEvent[];
}

// ── Log Entry Types ───────────────────────────────────────────

export interface ClientLogEntry {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
  verdict?: string;             // "ok", "violation", "late", etc.
}

// ── Chaos Configuration ───────────────────────────────────────

export interface ChaosConfig {
  dropAfterMessages: number | null;
  reorderProbability: number;
  duplicateProbability: number;
  latencySpikeProbability: number;
  latencySpikeMs: [number, number];   // [min, max]
  corruptPingProbability: number;
}

// ── Server Mode ───────────────────────────────────────────────

export type ServerMode = "normal" | "chaos";
