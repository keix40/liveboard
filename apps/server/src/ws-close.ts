import type { Socket } from "node:net";
import { WebSocket } from "ws";
import { formatAppCloseReason } from "@liveboard/shared";

const TERMINATE_AFTER_MS = 1_500;

type WsWithSocket = WebSocket & { _socket?: Socket };

function endUnderlyingTcp(ws: WebSocket): void {
  const raw = (ws as WsWithSocket)._socket;
  if (!raw || raw.destroyed) return;
  try {
    raw.setNoDelay(true);
    raw.end();
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    if (!raw.destroyed) raw.destroy();
  }, 500).unref();
}

function scheduleTerminate(ws: WebSocket): void {
  setTimeout(() => {
    try {
      if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
    } catch {
      /* ignore */
    }
    endUnderlyingTcp(ws);
  }, TERMINATE_AFTER_MS).unref();
}

/**
 * Send an app close frame, then drop the TCP session without waiting on the close handshake.
 * Required behind proxies (e.g. Render) that may not forward WebSocket close frames to the client.
 */
export function forceCloseWebSocket(ws: WebSocket, code: number, detail: string): void {
  const reason = formatAppCloseReason(code, detail);

  const closeNow = () => {
    try {
      if (ws.readyState === WebSocket.CLOSED) return;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
        endUnderlyingTcp(ws);
        return;
      }
      ws.close(code, reason);
      endUnderlyingTcp(ws);
      scheduleTerminate(ws);
    } catch {
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      endUnderlyingTcp(ws);
    }
  };

  if (ws.readyState === WebSocket.CONNECTING) {
    ws.once("open", () => queueMicrotask(closeNow));
  } else {
    queueMicrotask(closeNow);
  }
}

/** @deprecated Use {@link forceCloseWebSocket}. */
export const scheduleAppClose = forceCloseWebSocket;
