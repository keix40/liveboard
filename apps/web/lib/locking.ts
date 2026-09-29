import * as Y from "yjs";
import { readBoardMeta, writeBoardMeta } from "./board-meta";
import { getAssets, readAsset } from "./assets";
import { LOCAL_ORIGIN } from "./strokes";

export function isLocked(doc: Y.Doc, id: string): boolean {
  if (readBoardMeta(doc).lockedIds.includes(id)) return true;
  const asset = getAssets(doc).get(id);
  if (asset instanceof Y.Map) return readAsset(asset).locked;
  return false;
}

export function toggleLock(doc: Y.Doc, id: string): void {
  const meta = readBoardMeta(doc);
  const next = meta.lockedIds.includes(id) ? meta.lockedIds.filter((x) => x !== id) : [...meta.lockedIds, id];
  writeBoardMeta(doc, { lockedIds: next }, LOCAL_ORIGIN);
}
