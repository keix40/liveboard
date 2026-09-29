import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { type AwarenessState } from "@liveboard/shared";
import type { Identity } from "./identity";
import { resolveTerminalClose, terminalCloseAction } from "./terminal-close";
import { createSyncWatchdog } from "./sync-watchdog";

export type ConnectionStatus =
  | "offline" //       browser has no network; edits go to IndexedDB only
  | "connecting"
  | "connected"
  | "disconnected" //  lost the socket, y-websocket is backing off and retrying
  | "room-full"
  | "unauthorized"
  | "connect-failed"; // couldn't sync after retries (auth/network/proxy)

export interface RoomConnection {
  doc: Y.Doc;
  provider: WebsocketProvider;
  destroy(): void;
}

export interface RoomConnectionOptions {
  roomId: string;
  identity: Identity;
  wsUrl: string;
  onStatus: (s: ConnectionStatus) => void;
  /** Max ms after `open` to wait for first successful sync before retrying. */
  syncTimeoutMs?: number;
  /** Max hung-session / auth refresh attempts before showing connect-failed. */
  maxConnectAttempts?: number;
}

interface TokenResponse {
  token: string;
  expiresAt: number;
}

const DEFAULT_SYNC_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_CONNECT_ATTEMPTS = 3;

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
 */
export function createRoomConnection(opts: RoomConnectionOptions): RoomConnection {
  const {
    roomId,
    identity,
    wsUrl,
    onStatus,
    syncTimeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
    maxConnectAttempts = DEFAULT_MAX_CONNECT_ATTEMPTS,
  } = opts;
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
  let handledTerminalClose = false;
  let authRefreshAttempts = 0;
  let connectBackoffAttempt = 0;

  const failConnect = () => {
    provider.shouldConnect = false;
    provider.disconnect();
    onStatus("connect-failed");
  };

  const syncWatchdog = createSyncWatchdog({
    timeoutMs: syncTimeoutMs,
    maxAttempts: maxConnectAttempts,
    onRetry: () => {
      connectBackoffAttempt++;
      provider.disconnect();
      provider.shouldConnect = false;
      const delay = Math.min(8_000, 1_000 * 2 ** (connectBackoffAttempt - 1));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void refreshToken(true), delay);
    },
    onGiveUp: failConnect,
  });

  const scheduleRefresh = (expiresAt: number) => {
    clearTimeout(refreshTimer);
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
      if (connectAfter) {
        provider.shouldConnect = true;
        syncWatchdog.armConnecting();
        provider.connect();
      }
    } catch {
      if (destroyed) return;
      onStatus(navigator.onLine ? "disconnected" : "offline");
      const delay = Math.min(30_000, 1000 * 2 ** tokenFailures++);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void refreshToken(connectAfter), delay);
    }
  }

  const applyTerminalClose = (code: number) => {
    if (handledTerminalClose) return;
    const action = terminalCloseAction(code);
    if (!action) return;
    handledTerminalClose = true;
    syncWatchdog.dispose();
    if (action === "refresh-token") {
      authRefreshAttempts++;
      if (authRefreshAttempts > maxConnectAttempts) {
        failConnect();
        return;
      }
      void refreshToken(true);
    } else if (action === "retry-rate-limit") {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        provider.shouldConnect = true;
        syncWatchdog.armConnecting();
        provider.connect();
      }, 5_000);
    } else if (action === "room-full") onStatus("room-full");
    else onStatus("unauthorized");
  };

  provider.on("sync", (synced: boolean) => {
    if (synced) {
      authRefreshAttempts = 0;
      connectBackoffAttempt = 0;
      syncWatchdog.notifySynced();
    }
  });

  provider.on("status", ({ status }) => {
    if (status === "connected") handledTerminalClose = false;
    if (status === "connecting") syncWatchdog.armConnecting();
    onStatus(status === "disconnected" && !navigator.onLine ? "offline" : status);
  });

  provider.on("connection-close", (event) => {
    if (!event) return;
    syncWatchdog.dispose();
    const resolved = resolveTerminalClose(event.code, event.reason);
    if (resolved !== null && event.code < 4400) {
      provider.shouldConnect = false;
      applyTerminalClose(resolved);
      return;
    }
    if (event.code === 1006 || event.code === 1000) {
      // Proxy dropped the close frame; retry with a fresh token up to the cap.
      authRefreshAttempts++;
      if (authRefreshAttempts > maxConnectAttempts) {
        failConnect();
        return;
      }
      void refreshToken(true);
    }
  });

  provider.on("closed", ({ code, reason }) => {
    syncWatchdog.dispose();
    const resolved = resolveTerminalClose(code, reason) ?? code;
    applyTerminalClose(resolved);
  });

  const handleOnline = () => {
    if (!provider.wsconnected && !provider.wsconnecting) void refreshToken(true);
  };
  const handleOffline = () => onStatus("offline");
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  onStatus(navigator.onLine ? "connecting" : "offline");
  void idb.whenSynced.then(() => {
    if (!destroyed) void refreshToken(true);
  });

  return {
    doc,
    provider,
    destroy() {
      destroyed = true;
      syncWatchdog.dispose();
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
