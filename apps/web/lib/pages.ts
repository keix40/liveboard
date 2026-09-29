import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { getAssets } from "./assets";
import { getNotes } from "./notes";
import { getShapes } from "./shapes";
import { getStrokes, LOCAL_ORIGIN } from "./strokes";

export interface PageSnapshot {
  strokes: unknown;
  shapes: unknown;
  notes: unknown;
  assets: unknown;
}

export function getPageSnapshots(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(YKEYS.pageSnapshots);
}

export function capturePageSnapshot(doc: Y.Doc): PageSnapshot {
  return {
    strokes: getStrokes(doc).toJSON(),
    shapes: getShapes(doc).toJSON(),
    notes: getNotes(doc).toJSON(),
    assets: getAssets(doc).toJSON(),
  };
}

function restoreStrokes(doc: Y.Doc, data: unknown): void {
  const strokes = getStrokes(doc);
  strokes.delete(0, strokes.length);
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  for (const row of rows) {
    const stroke = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(row)) {
      if (k === "points" && Array.isArray(v)) {
        const pts = new Y.Array<number>();
        pts.push(v as number[]);
        stroke.set("points", pts);
      } else stroke.set(k, v);
    }
    strokes.push([stroke]);
  }
}

function restoreMap(
  doc: Y.Doc,
  key: typeof YKEYS.shapes | typeof YKEYS.notes | typeof YKEYS.assets,
  data: unknown,
): void {
  const map = doc.getMap(key);
  map.forEach((_, k) => map.delete(k));
  const entries = (data && typeof data === "object" ? data : {}) as Record<string, Record<string, unknown>>;
  for (const [id, row] of Object.entries(entries)) {
    const m = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(row)) {
      if (k === "text") {
        const t = new Y.Text(typeof v === "string" ? v : "");
        m.set(k, t);
      } else m.set(k, v);
    }
    map.set(id, m);
  }
}

export function restorePageSnapshot(doc: Y.Doc, snap: PageSnapshot): void {
  doc.transact(() => {
    restoreStrokes(doc, snap.strokes);
    restoreMap(doc, YKEYS.shapes, snap.shapes);
    restoreMap(doc, YKEYS.notes, snap.notes);
    restoreMap(doc, YKEYS.assets, snap.assets ?? {});
  }, LOCAL_ORIGIN);
}

export function switchPage(doc: Y.Doc, fromId: string, toId: string): void {
  const snaps = getPageSnapshots(doc);
  doc.transact(() => {
    snaps.set(fromId, JSON.stringify(capturePageSnapshot(doc)));
    const raw = snaps.get(toId);
    const snap = raw
      ? (JSON.parse(String(raw)) as PageSnapshot)
      : { strokes: [], shapes: {}, notes: {}, assets: {} };
    restorePageSnapshot(doc, snap);
  }, LOCAL_ORIGIN);
}
