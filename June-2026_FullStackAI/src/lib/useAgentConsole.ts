"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketManager } from "./websocketManager";
import { ReorderBuffer } from "./reorderBuffer";
import { createFlushScheduler } from "./flushScheduler";
import { markToolAckSent, resetToolAckRegistry } from "./toolAckRegistry";
import type {
  ServerMessage,
  ConversationMessage,
  TraceEvent,
  ContextSnapshotEntry,
  ToolCallWithResult,
  ConnectionStatus,
} from "./types";

const WS_URL = "ws://localhost:4747/ws";

function traceIdForSeq(seq: number): string {
  return `evt_seq_${seq}`;
}

export type ConnectionState = {
  status: ConnectionStatus;
};

export interface AgentConsoleState {
  connection: ConnectionState;
  messages: ConversationMessage[];
  traceEvents: TraceEvent[];
  contextSnapshots: ContextSnapshotEntry[];
}

export interface AgentConsoleActions {
  sendMessage: (content: string) => void;
  connect: () => void;
  disconnect: () => void;
  highlightEvent: (eventId: string) => void;
  highlightedEventId: string | null;
  sendToolAck: (callId: string) => void;
}

export function useAgentConsole(): AgentConsoleState & AgentConsoleActions {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [contextSnapshots, setContextSnapshots] = useState<ContextSnapshotEntry[]>([]);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const messagesRef = useRef<ConversationMessage[]>([]);
  const traceEventsRef = useRef<TraceEvent[]>([]);
  const contextSnapshotsRef = useRef<ContextSnapshotEntry[]>([]);

  const wsRef = useRef<WebSocketManager | null>(null);
  const reorderBufRef = useRef<ReorderBuffer>(new ReorderBuffer());
  const processedSeqRef = useRef<number>(0);
  const isResumingRef = useRef(false);
  const resumeFallbackRef = useRef<number | null>(null);

  const clearResumeFallback = useCallback(() => {
    if (resumeFallbackRef.current !== null) {
      clearTimeout(resumeFallbackRef.current);
      resumeFallbackRef.current = null;
    }
  }, []);

  const currentStreamRef = useRef<{
    streamId: string;
    messageIdx: number;
  } | null>(null);

  const flushState = useCallback(() => {
    setMessages(messagesRef.current.slice());
    setTraceEvents(traceEventsRef.current.slice());
    setContextSnapshots(contextSnapshotsRef.current.slice());
  }, []);

  const flushSchedulerRef = useRef(createFlushScheduler(flushState));

  const scheduleFlush = useCallback(() => {
    flushSchedulerRef.current.schedule();
  }, []);

  const markProcessedSeq = useCallback((seq: number) => {
    if (seq > processedSeqRef.current) {
      processedSeqRef.current = seq;
      wsRef.current?.setProcessedSeq(seq);
    }
  }, []);

  const ensureAssistantStream = useCallback(
    (streamId: string): number => {
      const msgs = messagesRef.current;

      if (currentStreamRef.current?.streamId === streamId) {
        return currentStreamRef.current.messageIdx;
      }

      const existingIdx = msgs.findIndex(
        (m) => m.role === "assistant" && m.streamId === streamId && m.isStreaming,
      );
      if (existingIdx >= 0) {
        currentStreamRef.current = { streamId, messageIdx: existingIdx };
        return existingIdx;
      }

      const newMsg: ConversationMessage = {
        id: `msg_${streamId}`,
        role: "assistant",
        text: "",
        toolCalls: [],
        streamId,
        isStreaming: true,
      };
      msgs.push(newMsg);
      const msgIdx = msgs.length - 1;
      currentStreamRef.current = { streamId, messageIdx: msgIdx };
      return msgIdx;
    },
    [],
  );

  const processToken = useCallback((msg: ServerMessage & { type: "TOKEN" }) => {
    const msgIdx = ensureAssistantStream(msg.stream_id);
    const msgs = messagesRef.current;
    msgs[msgIdx] = {
      ...msgs[msgIdx]!,
      text: msgs[msgIdx]!.text + msg.text,
    };
  }, [ensureAssistantStream]);

  const processToolCall = useCallback(
    (msg: ServerMessage & { type: "TOOL_CALL" }) => {
      const msgIdx = ensureAssistantStream(msg.stream_id);
      const msgs = messagesRef.current;
      const traceEventId = traceIdForSeq(msg.seq);

      const tc: ToolCallWithResult = {
        call_id: msg.call_id,
        tool_name: msg.tool_name,
        args: msg.args,
        result: null,
        acknowledged: false,
        seq: msg.seq,
        traceEventId,
      };

      msgs[msgIdx] = {
        ...msgs[msgIdx]!,
        toolCalls: [...msgs[msgIdx]!.toolCalls, tc],
      };
    },
    [ensureAssistantStream],
  );

  const processToolResult = useCallback((msg: ServerMessage & { type: "TOOL_RESULT" }) => {
    const msgs = messagesRef.current;
    let msgIdx = currentStreamRef.current?.messageIdx ?? -1;

    if (msgIdx < 0) {
      msgIdx = msgs.findIndex(
        (m) =>
          m.role === "assistant" &&
          m.streamId === msg.stream_id &&
          m.toolCalls.some((tc) => tc.call_id === msg.call_id),
      );
    }

    if (msgIdx >= 0 && msgIdx < msgs.length) {
      const toolCalls = msgs[msgIdx]!.toolCalls.map((tc) =>
        tc.call_id === msg.call_id ? { ...tc, result: msg.result } : tc,
      );
      msgs[msgIdx] = { ...msgs[msgIdx]!, toolCalls };
    }
  }, []);

  const processContextSnapshot = useCallback((msg: ServerMessage & { type: "CONTEXT_SNAPSHOT" }) => {
    contextSnapshotsRef.current.push({
      context_id: msg.context_id,
      seq: msg.seq,
      data: msg.data,
      timestamp: Date.now(),
    });
  }, []);

  const processStreamEnd = useCallback((msg: ServerMessage & { type: "STREAM_END" }) => {
    const msgs = messagesRef.current;
    const msgIdx = currentStreamRef.current?.messageIdx ?? -1;

    if (msgIdx >= 0 && msgIdx < msgs.length) {
      msgs[msgIdx] = { ...msgs[msgIdx]!, isStreaming: false };
    }

    if (currentStreamRef.current?.streamId === msg.stream_id) {
      currentStreamRef.current = null;
    }
  }, []);

  const appendTraceEvent = useCallback((event: TraceEvent) => {
    traceEventsRef.current.push(event);
  }, []);

  const processMessage = useCallback(
    (msg: ServerMessage) => {
      markProcessedSeq(msg.seq);

      const traceEvent: TraceEvent = {
        id: traceIdForSeq(msg.seq),
        seq: msg.seq,
        type: msg.type,
        timestamp: Date.now(),
        data: {},
        call_id: "call_id" in msg ? (msg as { call_id: string }).call_id : undefined,
      };

      for (const [key, val] of Object.entries(msg)) {
        if (key !== "type" && key !== "seq") {
          traceEvent.data[key] = val as unknown;
        }
      }

      appendTraceEvent(traceEvent);

      switch (msg.type) {
        case "TOKEN":
          processToken(msg);
          break;
        case "TOOL_CALL":
          processToolCall(msg);
          break;
        case "TOOL_RESULT":
          processToolResult(msg);
          break;
        case "CONTEXT_SNAPSHOT":
          processContextSnapshot(msg);
          break;
        case "STREAM_END":
          processStreamEnd(msg);
          break;
        case "PING":
        case "ERROR":
          break;
      }

      if (isResumingRef.current) {
        isResumingRef.current = false;
        clearResumeFallback();
        setStatus("connected");
      }
    },
    [
      appendTraceEvent,
      markProcessedSeq,
      processContextSnapshot,
      processStreamEnd,
      processToken,
      processToolCall,
      processToolResult,
      clearResumeFallback,
    ],
  );

  const sendToolAck = useCallback((callId: string) => {
    if (!markToolAckSent(callId)) return;
    wsRef.current?.send({ type: "TOOL_ACK", call_id: callId });
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      const ws = wsRef.current;
      if (!ws?.isConnected()) return;

      reorderBufRef.current.reset(1);
      processedSeqRef.current = 0;
      ws.resetProcessedSeq();
      currentStreamRef.current = null;
      resetToolAckRegistry();

      traceEventsRef.current = [];
      contextSnapshotsRef.current = [];

      const userMsg: ConversationMessage = {
        id: `msg_user_${Date.now()}`,
        role: "user",
        text: content,
        toolCalls: [],
        streamId: null,
        isStreaming: false,
      };
      messagesRef.current.push(userMsg);
      flushSchedulerRef.current.flushNow();

      ws.send({ type: "USER_MESSAGE", content });
    },
    [],
  );

  const connect = useCallback(() => {
    wsRef.current?.disconnect();

    const ws = new WebSocketManager(WS_URL);
    wsRef.current = ws;

    ws.setHandler((event) => {
      switch (event.type) {
        case "connecting":
          setStatus("connecting");
          break;
        case "open":
          if (ws.getProcessedSeq() === 0) {
            setStatus("connected");
          }
          break;
        case "resuming":
          isResumingRef.current = true;
          setStatus("resuming");
          clearResumeFallback();
          resumeFallbackRef.current = window.setTimeout(() => {
            if (isResumingRef.current) {
              isResumingRef.current = false;
              setStatus("connected");
            }
          }, 3000);
          break;
        case "reconnecting":
          setStatus("reconnecting");
          break;
        case "close":
          setStatus("disconnected");
          break;
        case "pong_sent":
          appendTraceEvent({
            id: `pong_${Date.now()}`,
            seq: -1,
            type: "PONG",
            timestamp: Date.now(),
            data: { echo: event.pongEcho ?? "" },
          });
          scheduleFlush();
          break;
        case "message":
          if (event.message) {
            const ordered = reorderBufRef.current.accept(event.message);
            for (const orderedMsg of ordered) {
              processMessage(orderedMsg);
            }
            scheduleFlush();
          }
          break;
        case "error":
          break;
      }
    });

    ws.connect();
  }, [appendTraceEvent, clearResumeFallback, processMessage, scheduleFlush]);

  const disconnect = useCallback(() => {
    flushSchedulerRef.current.cancel();
    wsRef.current?.disconnect();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  const highlightEvent = useCallback((eventId: string) => {
    setHighlightedEventId(eventId);
    window.setTimeout(() => setHighlightedEventId(null), 1500);
  }, []);

  useEffect(() => {
    return () => {
      clearResumeFallback();
      flushSchedulerRef.current.cancel();
      wsRef.current?.disconnect();
    };
  }, [clearResumeFallback]);

  return {
    connection: { status },
    messages,
    traceEvents,
    contextSnapshots,
    sendMessage,
    connect,
    disconnect,
    highlightEvent,
    highlightedEventId,
    sendToolAck,
  };
}
