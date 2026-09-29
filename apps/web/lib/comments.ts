import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { LOCAL_ORIGIN } from "./strokes";

export interface PinnedComment {
  id: string;
  x: number;
  y: number;
  text: string;
  pinned: boolean;
  authorId: string;
  createdAt: number;
}

export function getComments(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(YKEYS.comments);
}

export function addComment(doc: Y.Doc, c: Omit<PinnedComment, "id" | "createdAt">): void {
  doc.transact(() => {
    const id = crypto.randomUUID();
    const m = new Y.Map<unknown>();
    m.set("id", id);
    m.set("x", c.x);
    m.set("y", c.y);
    m.set("text", c.text);
    m.set("pinned", c.pinned);
    m.set("authorId", c.authorId);
    m.set("createdAt", Date.now());
    getComments(doc).set(id, m);
  }, LOCAL_ORIGIN);
}
