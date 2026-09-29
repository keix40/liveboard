import { WebSocket } from "ws";
import { formatAppCloseReason } from "@liveboard/shared";

/**
 * Close with an app-level code after the socket is fully open.
 * Immediate closes right after the HTTP 101 upgrade are unreliable through some proxies.
 */
export function scheduleAppClose(ws: WebSocket, code: number, detail: string): void {
  const reason = formatAppCloseReason(code, detail);
  const close = () => {
    try {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return;
      ws.close(code, reason);
    } catch {
      ws.terminate();
    }
  };
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.once("open", () => queueMicrotask(close));
  } else {
    queueMicrotask(close);
  }
}
