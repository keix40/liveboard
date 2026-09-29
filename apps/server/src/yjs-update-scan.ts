import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";

const CONTENT_KEYS = new Set<string>([
  YKEYS.strokes,
  YKEYS.shapes,
  YKEYS.notes,
  YKEYS.assets,
  YKEYS.meta,
  YKEYS.snapshots,
  YKEYS.pageSnapshots,
]);

/**
 * Fast heuristic: does the update binary mention a locked entity id or shared content key?
 * Pen point streaming on an unlocked stroke usually matches neither locked ids nor meta/shapes.
 */
export function updateMayTouchLockedEntities(update: Uint8Array, lockedIds: Set<string>): boolean {
  if (lockedIds.size === 0) return false;
  const text = Buffer.from(update).toString("latin1");
  for (const id of lockedIds) {
    if (text.includes(id)) return true;
  }
  for (const k of CONTENT_KEYS) {
    if (text.includes(k)) return true;
  }
  return false;
}

/** @deprecated use updateMayTouchLockedEntities */
export function updateMayTouchBoardContent(update: Uint8Array): boolean {
  const text = Buffer.from(update).toString("latin1");
  for (const k of CONTENT_KEYS) {
    if (text.includes(k)) return true;
  }
  return false;
}

/** True when applying `update` to `doc` changes encoded state (non-empty / non-redundant). */
export function updateChangesDoc(doc: Y.Doc, update: Uint8Array): boolean {
  if (update.length === 0) return false;
  const sv = Y.encodeStateVector(doc);
  const trial = new Y.Doc({ gc: true });
  Y.applyUpdate(trial, Y.encodeStateAsUpdate(doc));
  Y.applyUpdate(trial, update);
  const after = Y.encodeStateVector(trial);
  return Buffer.from(sv).compare(Buffer.from(after)) !== 0;
}

export function isViewerHandshakeNoOp(doc: Y.Doc, update: Uint8Array): boolean {
  return !updateChangesDoc(doc, update);
}
