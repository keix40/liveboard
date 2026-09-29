import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { beginStroke, getStrokes, LOCAL_ORIGIN } from "./strokes";

function syncAll(docs: Y.Doc[]): void {
  for (let i = 0; i < docs.length; i++) {
    for (let j = 0; j < docs.length; j++) {
      if (i === j) continue;
      Y.applyUpdate(docs[j]!, Y.encodeStateAsUpdate(docs[i]!, Y.encodeStateVector(docs[j]!)));
    }
  }
}

function strokeCount(doc: Y.Doc): number {
  if (!doc.share.has(YKEYS.strokes)) return 0;
  return doc.getArray(YKEYS.strokes).length;
}

describe("page yjs concurrency", () => {
  it("sanity: full state update copies legacy strokes", () => {
    const server = new Y.Doc();
    beginStroke(server, {
      id: "s0",
      authorId: "a",
      color: "#000",
      size: 4,
      first: [0, 0, 0.5],
      pageId: "page-1",
    });
    expect(server.getArray(YKEYS.strokes).length).toBe(1);
    expect(Y.encodeStateAsUpdate(server).byteLength).toBeGreaterThan(0);
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    expect(client.getArray(YKEYS.strokes).length).toBe(1);
    expect(getStrokes(client, "page-1").doc).toBe(client);
  });

  it("N peers joining sequentially never wipe existing page-1 strokes (100 runs)", () => {
    for (let run = 0; run < 100; run++) {
      const server = new Y.Doc();
      beginStroke(server, {
        id: "seed",
        authorId: "a",
        color: "#000",
        size: 4,
        first: [1, 1, 0.5],
        pageId: "page-1",
      });
      for (let i = 0; i < 2; i++) {
        beginStroke(server, {
          id: `s${i}`,
          authorId: "a",
          color: "#000",
          size: 4,
          first: [i * 10, i * 10, 0.5],
          pageId: "page-1",
        });
      }
      expect(strokeCount(server)).toBe(3);

      const peers: Y.Doc[] = [];
      for (let p = 0; p < 6; p++) {
        const client = new Y.Doc();
        Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
        expect(strokeCount(client)).toBe(3);
        peers.push(client);
        syncAll([server, ...peers]);
        expect(strokeCount(server)).toBe(3);
        for (const doc of peers) expect(strokeCount(doc)).toBe(3);
      }
    }
  });

  it("legacy top-level strokes stay visible as page-1 under concurrent joins (100 runs)", () => {
    for (let run = 0; run < 100; run++) {
      const server = new Y.Doc();
      beginStroke(server, {
        id: "legacy-1",
        authorId: "x",
        color: "#000",
        size: 4,
        first: [0, 0, 0.5],
        pageId: "page-1",
      });
      expect(strokeCount(server)).toBe(1);

      const peers: Y.Doc[] = [];
      for (let p = 0; p < 3; p++) {
        const client = new Y.Doc();
        Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
        expect(strokeCount(client)).toBe(1);
        expect(getStrokes(client, "page-1").doc).toBe(client);
        expect(client.share.has(YKEYS.pages)).toBe(false);
        peers.push(client);
        syncAll([server, ...peers]);
      }
      expect(server.getArray(YKEYS.strokes).length).toBe(1);
      for (const doc of peers) expect(strokeCount(doc)).toBe(1);
    }
  });
});
