import * as Y from "yjs";

/**
 * Merge a snapshot and a list of updates into one compact update.
 * Going through a Y.Doc (instead of Y.mergeUpdates) lets Yjs garbage-collect
 * deleted content, so snapshots don't grow forever with erased strokes.
 */
export function foldUpdates(snapshot: Uint8Array | null, updates: Uint8Array[]): Uint8Array | null {
  if (!snapshot && updates.length === 0) return null;
  const doc = new Y.Doc({ gc: true });
  if (snapshot) Y.applyUpdate(doc, snapshot);
  for (const u of updates) Y.applyUpdate(doc, u);
  const merged = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return merged;
}
