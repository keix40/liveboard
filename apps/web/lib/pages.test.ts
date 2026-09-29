import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { capturePageSnapshot, restorePageSnapshot, switchPage } from "./pages";
import { beginStroke, getStrokes, LOCAL_ORIGIN } from "./strokes";
import { ensureBoardMeta } from "./board-meta";

describe("pages", () => {
  it("round-trips page content through snapshots", () => {
    const doc = new Y.Doc();
    ensureBoardMeta(doc, LOCAL_ORIGIN);
    beginStroke(doc, {
      id: "s1",
      authorId: "u",
      color: "#000",
      size: 4,
      first: [0, 0, 0.5],
    });
    const snap = capturePageSnapshot(doc);
    switchPage(doc, "page-1", "page-2");
    expect(getStrokes(doc).length).toBe(0);
    restorePageSnapshot(doc, snap);
    expect(getStrokes(doc).length).toBe(1);
  });
});
