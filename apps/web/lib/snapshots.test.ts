import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { pushSnapshot, listHistorySnapshots, restoreHistorySnapshot } from "./snapshots";
import { beginStroke, getStrokes, LOCAL_ORIGIN } from "./strokes";
import { ensureBoardMeta } from "./board-meta";

describe("snapshots", () => {
  it("restore replaces board content and lists history", () => {
    const doc = new Y.Doc();
    ensureBoardMeta(doc, LOCAL_ORIGIN);
    beginStroke(doc, { id: "s1", authorId: "u", color: "#000", size: 4, first: [1, 2, 0.5] });
    pushSnapshot(doc, "Before");
    doc.transact(() => getStrokes(doc).delete(0, 1), LOCAL_ORIGIN);
    expect(getStrokes(doc).length).toBe(0);
    const list = listHistorySnapshots(doc);
    expect(list.length).toBe(1);
    restoreHistorySnapshot(doc, list[0]!.page);
    expect(getStrokes(doc).length).toBe(1);
  });
});
