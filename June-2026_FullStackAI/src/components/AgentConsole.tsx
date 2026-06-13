"use client";

import { useAgentConsole } from "@/lib/useAgentConsole";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { ChatPanel } from "./ChatPanel";
import { TraceTimeline } from "./TraceTimeline";
import { ContextInspector } from "./ContextInspector";

export function AgentConsole() {
  const {
    connection,
    messages,
    traceEvents,
    contextSnapshots,
    sendMessage,
    connect,
    disconnect,
    highlightEvent,
    highlightedEventId,
    sendToolAck,
  } = useAgentConsole();

  return (
    <main className="shell">
      <section className="hero card">
        <div>
          <p className="eyebrow">June 2026 Full Stack AI</p>
          <h1>Agent Console</h1>
          <p className="lede">
            Real-time agent conversation with streaming responses, tool call interruptions,
            trace timeline, and context inspector. Connect to the agent server
            at <code>ws://localhost:4747/ws</code> to begin.
          </p>
        </div>
        <ConnectionIndicator
          status={connection.status}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      </section>

      <section className="grid">
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          onAckToolCall={sendToolAck}
          onHighlightEvent={highlightEvent}
          highlightedEventId={highlightedEventId}
          connectionStatus={connection.status}
        />

        <aside className="sidebar">
          <TraceTimeline
            events={traceEvents}
            onHighlightEvent={highlightEvent}
            highlightedEventId={highlightedEventId}
          />

          <ContextInspector snapshots={contextSnapshots} />
        </aside>
      </section>
    </main>
  );
}