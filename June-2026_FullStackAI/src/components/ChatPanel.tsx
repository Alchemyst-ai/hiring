"use client";

import { useState, useRef, useEffect } from "react";
import type { ConversationMessage } from "@/lib/types";
import { ToolCard } from "./ToolCard";

export function ChatPanel({
  messages,
  onSendMessage,
  onAckToolCall,
  onHighlightEvent,
  highlightedEventId,
  connectionStatus,
}: {
  messages: ConversationMessage[];
  onSendMessage: (content: string) => void;
  onAckToolCall: (callId: string) => void;
  onHighlightEvent: (eventId: string) => void;
  highlightedEventId: string | null;
  connectionStatus: string;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const isConnected =
    connectionStatus === "connected" || connectionStatus === "resuming";

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!highlightedEventId?.startsWith("evt_seq_")) return;
    const el = listRef.current?.querySelector(
      `[data-trace-id="${highlightedEventId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedEventId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !isConnected) return;
    onSendMessage(trimmed);
    setDraft("");
  };

  return (
    <article className="card chatCard">
      <header className="cardHeader">
        <h2>Conversation</h2>
        <span className="muted">
          {messages.length > 0
            ? `${messages.length} message${messages.length !== 1 ? "s" : ""}`
            : "Send a message to start"}
        </span>
      </header>

      <div className="messageList" ref={listRef}>
        {messages.length === 0 && (
          <div className="emptyState">
            <p>Connect to the agent server and send a message.</p>
            <p className="muted">Try: &quot;Summarise the Q3 report&quot; or &quot;Analyze the data&quot;</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onAckToolCall={onAckToolCall}
            onHighlightEvent={onHighlightEvent}
            highlightedEventId={highlightedEventId}
          />
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          aria-label="Type a message"
          placeholder={
            isConnected
              ? "Type a message for the agent..."
              : "Connect to the server to start..."
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !draft.trim()}>
          Send
        </button>
      </form>
    </article>
  );
}

function MessageBubble({
  message,
  onAckToolCall,
  onHighlightEvent,
  highlightedEventId,
}: {
  message: ConversationMessage;
  onAckToolCall: (callId: string) => void;
  onHighlightEvent: (eventId: string) => void;
  highlightedEventId: string | null;
}) {
  if (message.role === "user") {
    return <div className="message messageUser">{message.text}</div>;
  }

  const isBatchHighlighted =
    highlightedEventId?.startsWith("batch-") &&
    message.streamId !== null &&
    (highlightedEventId === `batch-${message.streamId}` ||
      highlightedEventId.startsWith(`batch-${message.streamId}-`));

  return (
    <div
      className={`message messageAssistant ${isBatchHighlighted ? "messageHighlighted" : ""}`}
      data-stream-id={message.streamId ?? undefined}
    >
      <div className="messageContent">
        {message.text || message.isStreaming ? (
          <StreamingText text={message.text} isStreaming={message.isStreaming} />
        ) : null}
      </div>
      {message.toolCalls.length > 0 && (
        <div className="toolCallStack">
          {message.toolCalls.map((tc) => (
            <div key={tc.call_id} data-trace-id={tc.traceEventId}>
              <ToolCard
                toolCall={tc}
                onAck={onAckToolCall}
                onHighlight={onHighlightEvent}
                isHighlighted={highlightedEventId === tc.traceEventId}
              />
            </div>
          ))}
        </div>
      )}
      {message.isStreaming && !message.text && message.toolCalls.length === 0 && (
        <span className="streamingCursor">▊</span>
      )}
    </div>
  );
}

function StreamingText({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  return (
    <span className="streamingText">
      {text}
      {isStreaming && <span className="streamingCursor">▊</span>}
    </span>
  );
}
