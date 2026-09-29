import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { LOCAL_ORIGIN } from "./strokes";

export interface BoardReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  authorId: string;
  createdAt: number;
}

export function getReactions(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(YKEYS.reactions);
}

export function addReaction(doc: Y.Doc, r: Omit<BoardReaction, "id" | "createdAt">): void {
  doc.transact(() => {
    const m = new Y.Map<unknown>();
    const id = crypto.randomUUID();
    m.set("id", id);
    m.set("emoji", r.emoji);
    m.set("x", r.x);
    m.set("y", r.y);
    m.set("authorId", r.authorId);
    m.set("createdAt", Date.now());
    getReactions(doc).set(id, m);
  }, LOCAL_ORIGIN);
}
