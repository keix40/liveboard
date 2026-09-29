import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { ensurePageModel } from "./page-model";

function fingerprintInContent(strokes: Y.Array<unknown>, maps: Y.Map<unknown>[], id: string): string | null {
  for (let i = 0; i < strokes.length; i++) {
    const row = strokes.get(i);
    if (row instanceof Y.Map && String(row.get("id")) === id) {
      return JSON.stringify(row.toJSON());
    }
  }
  for (const map of maps) {
    const row = map.get(id);
    if (row instanceof Y.Map) return JSON.stringify(row.toJSON());
  }
  return null;
}

export function entityFingerprint(doc: Y.Doc, id: string): string | null {
  ensurePageModel(doc);
  const pages = doc.getMap(YKEYS.pages);
  if (pages.size > 0) {
    let found: string | null = null;
    pages.forEach((page) => {
      if (found || !(page instanceof Y.Map)) return;
      found = fingerprintInContent(
        page.get("strokes") as Y.Array<unknown>,
        [page.get("shapes"), page.get("notes"), page.get("assets")] as Y.Map<unknown>[],
        id,
      );
    });
    if (found) return found;
  }
  return fingerprintInContent(
    doc.getArray(YKEYS.strokes),
    [doc.getMap(YKEYS.shapes), doc.getMap(YKEYS.notes), doc.getMap(YKEYS.assets)],
    id,
  );
}
