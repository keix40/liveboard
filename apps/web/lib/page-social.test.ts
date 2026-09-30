import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { pageSocialKey } from "@liveboard/shared";
import { addComment, readComments } from "./comments";
import { addReaction, readReactions } from "./reactions";
import { writeBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";

describe("per-page comments and reactions", () => {
  it("uses legacy keys on page-1 and scoped keys on other pages", () => {
    expect(pageSocialKey("comments", "page-1")).toBe("comments");
    expect(pageSocialKey("reactions", "page-1")).toBe("reactions");
    expect(pageSocialKey("comments", "page-2")).toBe("comments:page-2");
    expect(pageSocialKey("reactions", "page-2")).toBe("reactions:page-2");
  });

  it("does not create maps on read and scopes data per page", () => {
    const doc = new Y.Doc();
    writeBoardMeta(doc, { pageOrder: ["page-1", "page-2"], activePageId: "page-1" }, LOCAL_ORIGIN);

    expect(doc.share.has("comments")).toBe(false);
    expect(doc.share.has("comments:page-2")).toBe(false);
    expect(readComments(doc, "page-2").size).toBe(0);

    addComment(
      doc,
      { x: 1, y: 2, text: "on page 2", pinned: true, authorId: "u1" },
      "page-2",
    );
    expect(doc.share.has("comments")).toBe(false);
    expect(doc.share.has("comments:page-2")).toBe(true);
    expect(readComments(doc, "page-1").size).toBe(0);
    expect(readComments(doc, "page-2").size).toBe(1);

    addComment(
      doc,
      { x: 3, y: 4, text: "on page 1", pinned: true, authorId: "u1" },
      "page-1",
    );
    expect(doc.share.has("comments")).toBe(true);
    expect(readComments(doc, "page-1").size).toBe(1);
  });

  it("aggregates repeated reactions and limits stacking per user", () => {
    const doc = new Y.Doc();
    const author = "user-a";
    addReaction(doc, { emoji: "👍", x: 100, y: 100, authorId: author }, "page-1");
    addReaction(doc, { emoji: "👍", x: 105, y: 102, authorId: author }, "page-1");
    addReaction(doc, { emoji: "👍", x: 110, y: 98, authorId: author }, "page-1");

    expect(readReactions(doc, "page-1").size).toBe(1);
    const only = readReactions(doc, "page-1").values().next().value as Y.Map<unknown>;
    expect(Number(only.get("count"))).toBe(3);

    addReaction(doc, { emoji: "👍", x: 400, y: 400, authorId: author }, "page-1");
    expect(readReactions(doc, "page-1").size).toBe(2);
  });
});
