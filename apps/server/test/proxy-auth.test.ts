import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { loadConfig } from "../src/config.js";
import { createSyncServer, type SyncServer } from "../src/server.js";
import { MemoryPersistence } from "../src/persistence/memory.js";
import { signRoomToken } from "../src/auth.js";
import { createLogger } from "../src/logger.js";
import { CloseCode } from "@liveboard/shared";
import { startFinBlockingProxy } from "./fin-blocking-proxy.js";
const SECRET = "test-secret-test-secret-test-secret-123";
let server: SyncServer;
let backendPort: number;

beforeAll(async () => {
  const cfg = loadConfig({
    port: 0,
    host: "127.0.0.1",
    jwtSecret: SECRET,
    persistence: "memory",
    maxConnectionsPerRoom: 1,
  });
  server = createSyncServer(cfg, { persistence: new MemoryPersistence(), log: createLogger("error") });
  backendPort = await server.listen();
});

afterAll(async () => {
  await server.close();
});

async function waitForConnectFailure(
  wsUrl: string,
  maxMs = 8_000,
): Promise<{ kind: "http" | "close" | "watchdog"; code: number; ms: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for failure")), maxMs);
    const ws = new WebSocket(wsUrl);
    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      resolve({ kind: "http", code: res.statusCode ?? 0, ms: Date.now() - start });
    });
    ws.on("close", (code) => {
      clearTimeout(timer);
      resolve({ kind: "close", code, ms: Date.now() - start });
    });
    ws.on("error", () => {});
  });
}

describe("fin-blocking TCP proxy", () => {
  it("returns HTTP 401 for a bad token within a few seconds (no hung socket)", async () => {
    const proxy = await startFinBlockingProxy({ host: "127.0.0.1", port: backendPort });
    try {
      const outcome = await waitForConnectFailure(`ws://127.0.0.1:${proxy.port}/room-proxy-bad?token=not-a-jwt`);
      expect(outcome.kind).toBe("http");
      expect(outcome.code).toBe(401);
      expect(outcome.ms).toBeLessThan(5_000);
    } finally {
      await proxy.close();
    }
  });

  it("force-closes room-full through the proxy within a few seconds", async () => {
    const room = "room-proxy-full";
    const tok = await signRoomToken({ sub: "u1", name: "a", room, role: "editor" }, SECRET);
    const hold = new WebSocket(`ws://127.0.0.1:${backendPort}/${room}?token=${tok}`);
    await new Promise<void>((resolve) => hold.on("open", () => resolve()));

    const proxy = await startFinBlockingProxy({ host: "127.0.0.1", port: backendPort });
    try {
      const tok2 = await signRoomToken({ sub: "u2", name: "b", room, role: "editor" }, SECRET);
      const outcome = await waitForConnectFailure(`ws://127.0.0.1:${proxy.port}/${room}?token=${tok2}`);
      expect(outcome.ms).toBeLessThan(5_000);
      expect(outcome.kind).toBe("close");
      expect(outcome.code).toBe(CloseCode.RoomFull);
    } finally {
      await proxy.close();
      hold.close();
    }
  });
});
