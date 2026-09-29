import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { FilePersistence } from "../src/persistence/file.js";
import { YKEYS } from "@liveboard/shared";

const log = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as const;

describe("FilePersistence", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("survives restart via snapshot + updates", async () => {
    dir = await mkdtemp(join(tmpdir(), "lb-file-"));
    const room = "test-room";
    const p1 = new FilePersistence(dir, log as never);
    await p1.init();
    const doc = new Y.Doc();
    const stroke = new Y.Map();
    stroke.set("id", "legacy");
    doc.getArray(YKEYS.strokes).push([stroke]);
    await p1.storeUpdate(room, Y.encodeStateAsUpdate(doc));
    await p1.compact(room);
    await p1.close();

    const p2 = new FilePersistence(dir, log as never);
    await p2.init();
    const loaded = await p2.load(room);
    expect(loaded).not.toBeNull();
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, loaded!);
    expect(doc2.getArray(YKEYS.strokes).length).toBe(1);
    await p2.close();
  });
});
