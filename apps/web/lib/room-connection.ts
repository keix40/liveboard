import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { CloseCode, type AwarenessState } from "@liveboard/shared";
import type { Identity } from "./identity";

export type ConnectionStatus =
  | "offline" //       browser has no network; edits go to IndexedDB only
  | "connecting"
  | "connected"
  | "disconnected" //  lost the socket, y-websocket is backing off and retrying
  | "room-full"
  | "unauthorized";

export interface RoomConnection {
  doc: Y.Doc;
  provider: WebsocketProvider;
  destroy(): void;
}

interface TokenResponse {
  token: string;
  expiresAt: number;
}

async function fetchRoomToken(roomId: string, identity: Identity): Promise<TokenResponse> {
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ room: roomId, userId: identity.id, name: identity.name }),
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

/**
 * Wires a Y.Doc to (1) IndexedDB for offline-first persistence and (2) the sync server.
 *
 * Reconnect strategy:
 *  - Transient drops (network, server deploy -> close 1001/1006): y-websocket retries with
 *    exponential backoff (100ms * 2^n, capped at `maxBackoffTime`).
 *  - 4401 (expired/invalid token): fetch a fresh token, then reconnect.
 *  - 4408 (rate limited): wait, then reconnect.
 *  - 4403 / 4429: terminal, surface to the UI.
 *  - `online` event: reconnect immediately instead of waiting out the backoff.
 */
export function createRoomConnection(opts: {
  roomId: string;
  identity: Identity;
  wsUrl: string;
  onStatus: (s: ConnectionStatus) => void;
}): RoomConnection {
  const { roomId, identity, wsUrl, onStatus } = opts;
  const doc = new Y.Doc();
  const idb = new IndexeddbPersistence(`liveboard:${roomId}`, doc);
  const provider = new WebsocketProvider(wsUrl, roomId, doc, {
    connect: false,
    maxBackoffTime: 10_000,
    params: {},
  });

  const initial: AwarenessState = { user: identity, cursor: null, tool: "pen" };
  provider.awareness.setLocalState(initial);

  let destroyed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let tokenFailures = 0;

  const scheduleRefresh = (expiresAt: number) => {
    clearTimeout(refreshTimer);
    // Refresh one minute before expiry; the new token is used on the next (re)connect.
    const ms = Math.max(5_000, expiresAt * 1000 - Date.now() - 60_000);
    refreshTimer = setTimeout(() => void refreshToken(false), ms);
  };

  async function refreshToken(connectAfter: boolean) {
    try {
      const { token, expiresAt } = await fetchRoomToken(roomId, identity);
      if (destroyed) return;
      tokenFailures = 0;
      provider.params = { token };
      scheduleRefresh(expiresAt);
      if (connectAfter) provider.connect();
    } catch {
      if (destroyed) return;
      onStatus(navigator.onLine ? "disconnected" : "offline");
      const delay = Math.min(30_000, 1000 * 2 ** tokenFailures++);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void refreshToken(connectAfter), delay);
    }
  }

  provider.on("status", ({ status }) => {
    onStatus(status === "disconnected" && !navigator.onLine ? "offline" : status);
  });

  provider.on("closed", ({ code }) => {
    if (code === CloseCode.Unauthorized) void refreshToken(true);
    else if (code === CloseCode.RateLimited) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => provider.connect(), 5_000);
    } else if (code === CloseCode.RoomFull) onStatus("room-full");
    else onStatus("unauthorized");
  });

  const handleOnline = () => {
    if (!provider.wsconnected && !provider.wsconnecting) void refreshToken(true);
  };
  const handleOffline = () => onStatus("offline");
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  onStatus(navigator.onLine ? "connecting" : "offline");
  // Paint local (IndexedDB) state first, then go online.
  void idb.whenSynced.then(() => {
    if (!destroyed) void refreshToken(true);
  });

  return {
    doc,
    provider,
    destroy() {
      destroyed = true;
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      provider.awareness.setLocalState(null);
      provider.destroy();
      void idb.destroy();
      doc.destroy();
    },
  };
}
