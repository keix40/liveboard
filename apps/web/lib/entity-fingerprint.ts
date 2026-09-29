import * as Y from "yjs";
import { allPageContentKeys } from "@liveboard/shared";

function fingerprintInStrokes(strokes: Y.Array<unknown>, id: string): string | null {
  for (let i = 0; i < strokes.length; i++) {
    const row = strokes.get(i);
    if (row instanceof Y.Map && String(row.get("id")) === id) {
      return JSON.stringify(row.toJSON());
    }
  }
  return null;
}

export function entityFingerprint(doc: Y.Doc, id: string): string | null {
  for (const key of allPageContentKeys(doc.share.keys())) {
    const t = doc.share.get(key);
    if (t instanceof Y.Array) {
      const found = fingerprintInStrokes(t, id);
      if (found) return found;
    } else if (t instanceof Y.Map) {
      const row = t.get(id);
      if (row instanceof Y.Map) return JSON.stringify(row.toJSON());
    }
  }
  return null;
}
