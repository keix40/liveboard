import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import { loadConfig } from "../src/config.js";
import { createSyncServer, type SyncServer } from "../src/server.js";
import { MemoryPersistence } from "../src/persistence/memory.js";
import { signRoomToken } from "../src/auth.js";
import { createLogger } from "../src/logger.js";
import { CloseCode, formatAppCloseReason, MessageType, parseAppCloseCode } from "@liveboard/shared";
import * as encoding from "lib0/encoding";

const SECRET = "test-secret-test-secret-test-secret-123";
let server: SyncServer;
let url: string;
const persistence = new MemoryPersistence();

const waitFor = async (cond: () => boolean, ms = 5000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
};

const token = (room: string, role: "editor" | "viewer" = "editor", secret = SECRET) =>
  signRoomToken({ sub: `u-${Math.random()}`, name: "tester", room, role }, secret);

async function connect(room: string, tok: string) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(url, room, doc, {
    params: { token: tok },
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    disableBc: true,
  });
  return { doc, provider };
}

beforeAll(async () => {
  const cfg = loadConfig({
    port: 0,
    host: "127.0.0.1",
    jwtSecret: SECRET,
    persistence: "memory",
    redisUrl: undefined,
    allowedOrigins: [],
    compactEveryNUpdates: 5,
    roomIdleMs: 50,
  });
  server = createSyncServer(cfg, { persistence, log: createLogger("error") });
  const port = await server.listen();
  url = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await server.close();
});

describe("sync server", () => {
  it("serves /healthz", async () => {
    const res = await fetch(url.replace("ws://", "http://") + "/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; persistence: string };
    expect(body.status).toBe("ok");
    expect(body.persistence).toBe("memory");
  });

  it("syncs a Y.Array between two clients and shares awareness", async () => {
    const a = await connect("room-sync", await token("room-sync"));
    const b = await connect("room-sync", await token("room-sync"));
    await waitFor(() => a.provider.synced && b.provider.synced);

    a.doc.getArray<number>("strokes").push([1, 2, 3]);
    await waitFor(() => b.doc.getArray("strokes").length === 3);
    expect(b.doc.getArray("strokes").toArray()).toEqual([1, 2, 3]);

    a.provider.awareness.setLocalStateField("cursor", { x: 10, y: 20 });
    await waitFor(() => b.provider.awareness.getStates().get(a.doc.clientID)?.cursor?.x === 10);

    a.provider.destroy();
    b.provider.destroy();
  });

  it("persists updates, compacts, and restores a room after eviction", async () => {
    const a = await connect("room-persist", await token("room-persist"));
    await waitFor(() => a.provider.synced);
    for (let i = 0; i < 12; i++) a.doc.getArray<number>("strokes").push([i]);
    await waitFor(() => persistence.logLength("room-persist") < 12); // compaction ran
    a.provider.destroy();
    await new Promise((r) => setTimeout(r, 200)); // > roomIdleMs -> evicted

    const b = await connect("room-persist", await token("room-persist"));
    await waitFor(() => b.provider.synced);
    expect(b.doc.getArray("strokes").length).toBe(12);
    b.provider.destroy();
  });

  it("ignores writes from viewers", async () => {
    const editor = await connect("room-view", await token("room-view"));
    const viewer = await connect("room-view", await token("room-view", "viewer"));
    await waitFor(() => editor.provider.synced && viewer.provider.synced);
    viewer.doc.getArray<number>("strokes").push([42]);
    editor.doc.getArray<number>("strokes").push([7]);
    await waitFor(() => viewer.doc.getArray("strokes").toArray().includes(7));
    await new Promise((r) => setTimeout(r, 100));
    expect(editor.doc.getArray("strokes").toArray()).toEqual([7]);
    editor.provider.destroy();
    viewer.provider.destroy();
  });

  it("rejects bad tokens with close code 4401 and wrong-room tokens with 4403", async () => {
    const closeEvent = (room: string, tok: string) =>
      new Promise<{ code: number; reason: string }>((resolve) => {
        const ws = new WebSocket(`${url}/${room}?token=${tok}`);
        ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() }));
      });
    const badSecret = await closeEvent("room-auth", await token("room-auth", "editor", "x".repeat(40)));
    expect(badSecret.code).toBe(CloseCode.Unauthorized);
    expect(parseAppCloseCode(badSecret.code, badSecret.reason)).toBe(CloseCode.Unauthorized);

    const wrongRoom = await closeEvent("room-auth", await token("other-room"));
    expect(wrongRoom.code).toBe(CloseCode.Forbidden);
    expect(parseAppCloseCode(wrongRoom.code, wrongRoom.reason)).toBe(CloseCode.Forbidden);

    expect((await closeEvent("room-auth", "")).code).toBe(CloseCode.Unauthorized);
  });

  it("embeds app close codes in the close reason for proxy-safe auth failures", async () => {
    const wrongRoom = await new Promise<{ code: number; reason: string }>((resolve) => {
      void token("other-room").then((tok) => {
        const ws = new WebSocket(`${url}/room-proxy?token=${encodeURIComponent(tok)}`);
        ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() }));
      });
    });
    expect(wrongRoom.reason.startsWith(formatAppCloseReason(CloseCode.Forbidden, "x").slice(0, 7))).toBe(true);
  });

  it("stops processing frames after a kick", async () => {
    const roomId = "room-kick";
    const tok = await token(roomId);
    const editor = await connect(roomId, tok);
    await waitFor(() => editor.provider.synced);

    const ws = editor.provider.ws as unknown as WebSocket;
    const before = editor.doc.getArray<number>("strokes").length;
    ws.send("not-binary", { binary: false });
    await waitFor(() => ws.readyState === WebSocket.CLOSED);

    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MessageType.QueryAwareness);
    try {
      ws.send(encoding.toUint8Array(enc), { binary: true });
    } catch {
      /* socket may already be gone */
    }
    await new Promise((r) => setTimeout(r, 100));
    expect(editor.doc.getArray<number>("strokes").length).toBe(before);

    editor.provider.destroy();
  });

  it("rate-limits a burst in one event-loop turn as a single charge", async () => {
    const cfg = loadConfig({
      port: 0,
      host: "127.0.0.1",
      jwtSecret: SECRET,
      persistence: "memory",
      redisUrl: undefined,
      allowedOrigins: [],
      compactEveryNUpdates: 5,
      roomIdleMs: 50,
      rateLimit: { msgsPerSec: 1, burst: 1 },
    });
    const local = createSyncServer(cfg, { persistence: new MemoryPersistence(), log: createLogger("error") });
    const port = await local.listen();
    const localUrl = `ws://127.0.0.1:${port}`;
    const roomId = "room-rate";
    const tok = await token(roomId);

    const ws = await new Promise<WebSocket>((resolve) => {
      const socket = new WebSocket(`${localUrl}/${roomId}?token=${tok}`);
      socket.on("open", () => resolve(socket));
    });
    await new Promise((r) => setTimeout(r, 30));

    const frame = () => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MessageType.QueryAwareness);
      return encoding.toUint8Array(enc);
    };
    ws.send(frame(), { binary: true });
    ws.send(frame(), { binary: true });
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await new Promise<void>((resolve) => setImmediate(resolve));
    const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
    ws.send(frame(), { binary: true });
    expect(await closed).toBe(CloseCode.RateLimited);

    await local.close();
  });

  it("rejects upgrades without Origin when ALLOWED_ORIGINS is configured", async () => {
    const cfg = loadConfig({
      port: 0,
      host: "127.0.0.1",
      jwtSecret: SECRET,
      persistence: "memory",
      allowedOrigins: ["http://localhost:3000"],
    });
    const local = createSyncServer(cfg, { persistence: new MemoryPersistence(), log: createLogger("error") });
    const port = await local.listen();
    const err = await new Promise<string>((resolve) => {
      void token("room-origin").then((tok) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/room-origin?token=${encodeURIComponent(tok)}`);
        ws.on("unexpected-response", (_req, res) => resolve(String(res.statusCode)));
        ws.on("error", () => {});
      });
    });
    expect(err).toBe("403");
    await local.close();
  });

  it("rejects invalid room ids at the HTTP layer", async () => {
    const err = await new Promise<string>((resolve) => {
      const ws = new WebSocket(`${url}/a?token=x`);
      ws.on("unexpected-response", (_req, res) => resolve(String(res.statusCode)));
      ws.on("error", () => {});
    });
    expect(err).toBe("400");
  });
});
