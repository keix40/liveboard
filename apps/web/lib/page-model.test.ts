import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ensurePage, getPageContent } from "./page-model";
import { beginStroke, getStrokes } from "./strokes";
import { readBoardMeta, writeBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";

describe("page model", () => {
  it("keeps strokes on the page being edited", () => {
    const doc = new Y.Doc();
    writeBoardMeta(doc, { pageOrder: ["page-1", "page-2"], activePageId: "page-1" }, LOCAL_ORIGIN);
    ensurePage(doc, "page-1");
    ensurePage(doc, "page-2");

    beginStroke(doc, {
      id: "s-a",
      authorId: "u1",
      color: "#000",
      size: 4,
      first: [0, 0, 0.5],
      pageId: "page-2",
    });
    expect(getStrokes(doc, "page-2").length).toBe(1);
    expect(getStrokes(doc, "page-1").length).toBe(0);

    beginStroke(doc, {
      id: "s-b",
      authorId: "u1",
      color: "#000",
      size: 4,
      first: [1, 1, 0.5],
      pageId: "page-1",
    });
    expect(getStrokes(doc, "page-1").length).toBe(1);
    expect(getPageContent(doc, "page-2").strokes.length).toBe(1);
    expect(readBoardMeta(doc)?.activePageId).toBe("page-1");
  });
});
