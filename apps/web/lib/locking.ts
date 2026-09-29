import type * as Y from "yjs";
import { readBoardMeta, writeBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";

export function isLocked(doc: Y.Doc, id: string): boolean {
  return readBoardMeta(doc).lockedIds.includes(id);
}

export function toggleLock(doc: Y.Doc, id: string): void {
  const meta = readBoardMeta(doc);
  const next = meta.lockedIds.includes(id) ? meta.lockedIds.filter((x) => x !== id) : [...meta.lockedIds, id];
  writeBoardMeta(doc, { lockedIds: next }, LOCAL_ORIGIN);
}
