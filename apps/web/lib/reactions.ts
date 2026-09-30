import * as Y from "yjs";
import { pageSocialKey } from "@liveboard/shared";
import { resolvePageId } from "./page-model";
import { LOCAL_ORIGIN } from "./strokes";

export interface BoardReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  authorId: string;
  createdAt: number;
  count?: number;
}

const EMPTY_REACTIONS = new Y.Map<Y.Map<unknown>>();

/** Merge repeated reactions at the same spot (world units). */
export const REACTION_MERGE_RADIUS = 28;
export const MAX_REACTIONS_PER_USER_PER_PAGE = 40;

export function readReactions(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  const key = pageSocialKey("reactions", resolvePageId(doc, pageId));
  if (!doc.share.has(key)) return EMPTY_REACTIONS;
  return doc.getMap(key);
}

export function writeReactions(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(pageSocialKey("reactions", resolvePageId(doc, pageId)));
}

export function getReactions(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return readReactions(doc, pageId);
}

function countReactionsByAuthor(map: Y.Map<Y.Map<unknown>>, authorId: string): number {
  let n = 0;
  map.forEach((m) => {
    if (String(m.get("authorId")) === authorId) n += Number(m.get("count") ?? 1);
  });
  return n;
}

export function addReaction(
  doc: Y.Doc,
  r: Omit<BoardReaction, "id" | "createdAt" | "count">,
  pageId?: string,
): void {
  doc.transact(() => {
    const map = writeReactions(doc, pageId);
    if (countReactionsByAuthor(map, r.authorId) >= MAX_REACTIONS_PER_USER_PER_PAGE) return;

    let mergeId: string | null = null;
    map.forEach((m, id) => {
      if (!(m instanceof Y.Map)) return;
      if (String(m.get("emoji")) !== r.emoji) return;
      if (String(m.get("authorId")) !== r.authorId) return;
      const x = Number(m.get("x") ?? 0);
      const y = Number(m.get("y") ?? 0);
      if (Math.hypot(x - r.x, y - r.y) <= REACTION_MERGE_RADIUS) mergeId = id;
    });

    if (mergeId) {
      const mergeTarget = map.get(mergeId);
      if (!(mergeTarget instanceof Y.Map)) return;
      const prev = Number(mergeTarget.get("count") ?? 1);
      mergeTarget.set("count", prev + 1);
      return;
    }

    const m = new Y.Map<unknown>();
    const id = crypto.randomUUID();
    m.set("id", id);
    m.set("emoji", r.emoji);
    m.set("x", r.x);
    m.set("y", r.y);
    m.set("authorId", r.authorId);
    m.set("createdAt", Date.now());
    m.set("count", 1);
    map.set(id, m);
  }, LOCAL_ORIGIN);
}
