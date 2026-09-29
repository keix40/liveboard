import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import { YKEYS } from "@liveboard/shared";
import { loadConfig } from "../src/config.js";
import { createSyncServer, type SyncServer } from "../src/server.js";
import { MemoryPersistence } from "../src/persistence/memory.js";
import { signRoomToken } from "../src/auth.js";
import { createLogger } from "../src/logger.js";

const SECRET = "test-secret-test-secret-test-secret-123";
let server: SyncServer;
let httpUrl: string;
let wsUrl: string;

beforeAll(async () => {
  const cfg = loadConfig({
    port: 0,
    host: "127.0.0.1",
    jwtSecret: SECRET,
    persistence: "memory",
    redisUrl: undefined,
    allowedOrigins: [],
    compactEveryNUpdates: 1000,
    roomIdleMs: 50,
  });
  server = createSyncServer(cfg, { persistence: new MemoryPersistence(), log: createLogger("error") });
  const port = await server.listen();
  httpUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await server.close();
});

describe("room health under load", () => {
  it("keeps /healthz responsive with 20 pen updates on a 2k-stroke board", async () => {
    const roomId = `perf-${Date.now()}`;
    const token = await signRoomToken({ sub: "editor-1", name: "E", room: roomId, role: "editor" }, SECRET);
    const doc = new Y.Doc({ gc: true });
    const strokes = doc.getArray(YKEYS.strokes);
    for (let i = 0; i < 2000; i++) {
      const m = new Y.Map<unknown>();
      m.set("id", `s-${i}`);
      m.set("points", new Y.Array());
      strokes.push([m]);
    }
    doc.getMap(YKEYS.meta).set("lockedIds", Array.from({ length: 500 }, (_, i) => `s-${i}`));

    const provider = new WebsocketProvider(wsUrl, roomId, doc, {
      params: { token },
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
      disableBc: true,
    });
    await new Promise<void>((resolve) => {
      provider.on("sync", (synced: boolean) => {
        if (synced) resolve();
      });
    });

    for (let i = 0; i < 20; i++) {
      const row = strokes.get(1999)! as Y.Map<unknown>;
      const pts = row.get("points") as Y.Array<number>;
      pts.push([i, i, 0.5]);
    }
    await new Promise((r) => setTimeout(r, 100));

    const t0 = performance.now();
    const res = await fetch(`${httpUrl}/healthz`);
    const ms = performance.now() - t0;
    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(50);
    provider.destroy();
  });
});
