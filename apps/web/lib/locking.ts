import * as Y from "yjs";
import { MAX_LOCKED_IDS } from "@liveboard/shared";
import { readBoardMeta, writeBoardMeta } from "./board-meta";
import { getAssets, readAsset } from "./assets";
import { LOCAL_ORIGIN } from "./strokes";

export function isLocked(doc: Y.Doc, id: string): boolean {
  if (readBoardMeta(doc).lockedIds.includes(id)) return true;
  const asset = getAssets(doc).get(id);
  if (asset instanceof Y.Map) return readAsset(asset).locked;
  return false;
}

export function canToggleLock(doc: Y.Doc, id: string, userId: string): boolean {
  const meta = readBoardMeta(doc);
  if (meta.ownerId === userId) return true;
  const owners = meta.lockOwners;
  if (!meta.lockedIds.includes(id)) return true;
  const locker = owners[id];
  return !locker || locker === userId;
}

export function toggleLock(doc: Y.Doc, id: string, userId: string): void {
  if (!canToggleLock(doc, id, userId)) return;
  const meta = readBoardMeta(doc);
  const owners = { ...meta.lockOwners };
  const locked = meta.lockedIds.includes(id);
  if (locked) {
    delete owners[id];
    writeBoardMeta(
      doc,
      { lockedIds: meta.lockedIds.filter((x) => x !== id), lockOwners: owners },
      LOCAL_ORIGIN,
    );
  } else if (meta.lockedIds.length < MAX_LOCKED_IDS) {
    owners[id] = userId;
    writeBoardMeta(doc, { lockedIds: [...meta.lockedIds, id], lockOwners: owners }, LOCAL_ORIGIN);
  }
}
