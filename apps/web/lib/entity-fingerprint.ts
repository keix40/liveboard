import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";

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
