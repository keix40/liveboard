import * as Y from "yjs";
import { pageSocialKey } from "@liveboard/shared";
import { resolvePageId } from "./page-model";
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

const EMPTY_COMMENTS = new Y.Map<Y.Map<unknown>>();

export function readComments(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  const key = pageSocialKey("comments", resolvePageId(doc, pageId));
  if (!doc.share.has(key)) return EMPTY_COMMENTS;
  return doc.getMap(key);
}

export function writeComments(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(pageSocialKey("comments", resolvePageId(doc, pageId)));
}

/** @deprecated prefer readComments — kept for call sites that expect the name getComments */
export function getComments(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return readComments(doc, pageId);
}

export function addComment(
  doc: Y.Doc,
  c: Omit<PinnedComment, "id" | "createdAt">,
  pageId?: string,
): void {
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
    writeComments(doc, pageId).set(id, m);
  }, LOCAL_ORIGIN);
}
