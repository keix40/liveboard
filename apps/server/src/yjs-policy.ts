import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";

function readLockedIds(doc: Y.Doc): string[] {
  const raw = doc.getMap(YKEYS.meta).get("lockedIds");
  const fromMeta = Array.isArray(raw) ? (raw as string[]) : [];
  const fromAssets: string[] = [];
  doc.getMap(YKEYS.assets).forEach((row, id) => {
    if (row instanceof Y.Map && row.get("locked") === true) fromAssets.push(id);
  });
  return [...new Set([...fromMeta, ...fromAssets])];
}

/** Stable JSON fingerprint for a board object id (stroke, shape, note, or asset). */
export function entityFingerprint(doc: Y.Doc, id: string): string | null {
  const strokes = doc.getArray(YKEYS.strokes);
  for (let i = 0; i < strokes.length; i++) {
    const row = strokes.get(i);
    if (row instanceof Y.Map && String(row.get("id")) === id) {
      return JSON.stringify(row.toJSON());
    }
  }
  for (const key of [YKEYS.shapes, YKEYS.notes, YKEYS.assets] as const) {
    const row = doc.getMap(key).get(id);
    if (row instanceof Y.Map) return JSON.stringify(row.toJSON());
  }
  return null;
}

/**
 * Returns true when applying `update` to `doc` would not mutate any locked entity.
 * Uses a trial doc so rejected updates never touch the live room document.
 */
export function policyAllowsUpdate(doc: Y.Doc, update: Uint8Array): boolean {
  const locked = readLockedIds(doc);
  if (locked.length === 0) return true;

  const before = new Map<string, string | null>();
  for (const id of locked) before.set(id, entityFingerprint(doc, id));

  const trial = new Y.Doc({ gc: true });
  Y.applyUpdate(trial, Y.encodeStateAsUpdate(doc));
  try {
    Y.applyUpdate(trial, update);
  } catch {
    return false;
  }

  for (const id of locked) {
    if (before.get(id) !== entityFingerprint(trial, id)) return false;
  }
  return true;
}
