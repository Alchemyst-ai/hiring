// ─────────────────────────────────────────────────────────────
// WebSocket Connection Manager
//
// Manages the WebSocket lifecycle: connect, disconnect,
// reconnect with exponential backoff, heartbeat (PING/PONG),
// seq tracking, and RESUME-based recovery.
// ─────────────────────────────────────────────────────────────

import type { ServerMessage, ClientMessage, ConnectionStatus } from "./types";

export type WsEventType =
  | "connecting"
  | "open"
  | "resuming"
  | "close"
  | "message"
  | "error"
  | "reconnecting"
  | "pong_sent";

export interface WsEvent {
  type: WsEventType;
  message?: ServerMessage;
  error?: Event;
  pongEcho?: string;
}

export type WsEventHandler = (event: WsEvent) => void;

const DEFAULT_WS_URL = "ws://localhost:4747/ws";
const MAX_RECONNECT_DELAY_MS = 10_000;
const INITIAL_RECONNECT_DELAY_MS = 500;
const PONG_TIMEOUT_MS = 3_000;
const PING_CHECK_INTERVAL_MS = 1_000;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: WsEventHandler | null = null;

  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;

  private lastChallenge: string | null = null;
  private lastPingTime: number = 0;
  private pongCheckTimer: ReturnType<typeof setInterval> | null = null;

  private processedSeq: number = 0;
  private status: ConnectionStatus = "disconnected";

  constructor(url: string = DEFAULT_WS_URL) {
    this.url = url;
  }

  setHandler(handler: WsEventHandler): void {
    this.handler = handler;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }
    this.shouldReconnect = true;
    this.status = "connecting";
    this.emit({ type: "connecting" });
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();
    this.status = "disconnected";
    this.reconnectAttempts = 0;
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  setProcessedSeq(seq: number): void {
    if (seq > this.processedSeq) {
      this.processedSeq = seq;
    }
  }

  resetProcessedSeq(): void {
    this.processedSeq = 0;
  }

  getProcessedSeq(): number {
    return this.processedSeq;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendResume(): void {
    if (this.processedSeq > 0) {
      this.status = "resuming";
      this.emit({ type: "resuming" });
      this.send({ type: "RESUME", last_seq: this.processedSeq });
    }
  }

  private createConnection(): void {
    this.cleanup();

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.lastChallenge = null;
      this.startPongCheck();

      if (this.processedSeq > 0) {
        this.sendResume();
      } else {
        this.status = "connected";
      }

      this.emit({ type: "open" });
    };

    this.ws.onclose = () => {
      this.stopPongCheck();
      this.lastChallenge = null;

      if (this.shouldReconnect) {
        this.status = "reconnecting";
        this.emit({ type: "reconnecting" });
        this.scheduleReconnect();
      } else {
        this.status = "disconnected";
        this.emit({ type: "close" });
      }
    };

    this.ws.onerror = (err) => {
      this.emit({ type: "error", error: err });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "PING") {
          this.handlePing(msg.challenge);
        }
        this.emit({ type: "message", message: msg });
      } catch {
        // Malformed message — ignore
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.status = "connecting";
      this.emit({ type: "connecting" });
      this.createConnection();
    }, delay);
  }

  private cleanup(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPongCheck();
    this.lastChallenge = null;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private handlePing(challenge: string): void {
    if (challenge === "") return;
    this.lastChallenge = challenge;
    this.lastPingTime = Date.now();
    this.send({ type: "PONG", echo: challenge });
    this.emit({ type: "pong_sent", pongEcho: challenge });
  }

  private startPongCheck(): void {
    this.stopPongCheck();
    this.pongCheckTimer = setInterval(() => {
      if (this.lastChallenge !== null) {
        const elapsed = Date.now() - this.lastPingTime;
        if (elapsed > PONG_TIMEOUT_MS) {
          this.lastChallenge = null;
        }
      }
    }, PING_CHECK_INTERVAL_MS);
  }

  private stopPongCheck(): void {
    if (this.pongCheckTimer !== null) {
      clearInterval(this.pongCheckTimer);
      this.pongCheckTimer = null;
    }
  }

  private emit(event: WsEvent): void {
    this.handler?.(event);
  }
}
