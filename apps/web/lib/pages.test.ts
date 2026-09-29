import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { writeBoardMeta } from "./board-meta";
import { beginStroke, getStrokes, LOCAL_ORIGIN } from "./strokes";

describe("pages", () => {
  it("switching page id changes which stroke array is active", () => {
    const doc = new Y.Doc();
    writeBoardMeta(doc, { pageOrder: ["page-1", "page-2"], activePageId: "page-1" }, LOCAL_ORIGIN);
    beginStroke(doc, {
      id: "s1",
      authorId: "u",
      color: "#000",
      size: 4,
      first: [1, 1, 0.5],
      pageId: "page-1",
    });
    expect(getStrokes(doc, "page-2").length).toBe(0);
    beginStroke(doc, {
      id: "s2",
      authorId: "u",
      color: "#000",
      size: 4,
      first: [2, 2, 0.5],
      pageId: "page-2",
    });
    expect(getStrokes(doc, "page-2").length).toBe(1);
    expect(getStrokes(doc, "page-1").length).toBe(1);
  });
});
