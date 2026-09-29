import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createSyncServer, type SyncServer } from "../src/server.js";
import { MemoryPersistence } from "../src/persistence/memory.js";
import { createLogger } from "../src/logger.js";
import * as Y from "yjs";
const SECRET = "test-internal-secret-test-internal-sec";
let server: SyncServer;
let baseUrl: string;
const persistence = new MemoryPersistence();

beforeAll(async () => {
  const cfg = loadConfig({
    port: 0,
    host: "127.0.0.1",
    jwtSecret: "test-secret-test-secret-test-secret-123",
    persistence: "memory",
    internalSecret: SECRET,
    redisUrl: undefined,
    allowedOrigins: [],
    compactEveryNUpdates: 5,
    roomIdleMs: 50,
  });
  server = createSyncServer(cfg, { persistence, log: createLogger("error") });
  const port = await server.listen();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await server.close();
});

describe("internal has-content", () => {
  it("reports false for new room and true after persisted update", async () => {
    const room = `probe-${Date.now()}`;
    const empty = await fetch(`${baseUrl}/internal/rooms/${room}/has-content`, {
      headers: { "x-liveboard-internal": SECRET },
    });
    expect(empty.status).toBe(200);
    expect(((await empty.json()) as { hasContent: boolean }).hasContent).toBe(false);

    const doc = new Y.Doc();
    doc.getArray("strokes").push([1]);
    const update = Y.encodeStateAsUpdate(doc);
    await persistence.storeUpdate(room, update);

    const full = await fetch(`${baseUrl}/internal/rooms/${room}/has-content`, {
      headers: { "x-liveboard-internal": SECRET },
    });
    expect(((await full.json()) as { hasContent: boolean }).hasContent).toBe(true);
  });
});
