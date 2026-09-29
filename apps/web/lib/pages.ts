import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { getAssets, readAsset } from "./assets";
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
  const assetLayouts: Record<string, unknown> = {};
  getAssets(doc).forEach((m, id) => {
    const a = readAsset(m);
    assetLayouts[id] = {
      id: a.id,
      x: a.x,
      y: a.y,
      w: a.w,
      h: a.h,
      locked: a.locked,
      z: a.z,
      authorId: a.authorId,
      mime: a.mime,
    };
  });
  return {
    strokes: getStrokes(doc).toJSON(),
    shapes: getShapes(doc).toJSON(),
    notes: getNotes(doc).toJSON(),
    assets: assetLayouts,
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
    if (key === YKEYS.assets) {
      const assetMap = map as Y.Map<Y.Map<unknown>>;
      const existing = assetMap.get(id);
      const m = existing instanceof Y.Map ? existing : new Y.Map<unknown>();
      for (const [k, v] of Object.entries(row)) {
        if (k !== "dataBase64") m.set(k, v);
      }
      if (!existing) assetMap.set(id, m);
      continue;
    }
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

/** Saves current page to shared snapshots and loads another (syncs to all peers). */
export function switchPage(doc: Y.Doc, fromId: string, toId: string): void {
  const snaps = getPageSnapshots(doc);
  doc.transact(() => {
    snaps.set(fromId, JSON.stringify(capturePageSnapshot(doc)));
    loadPageContent(doc, toId);
  }, LOCAL_ORIGIN);
}

/** Loads a page snapshot locally without writing the current page back (per-user navigation). */
export function switchPageLocal(doc: Y.Doc, toId: string): void {
  doc.transact(() => loadPageContent(doc, toId), LOCAL_ORIGIN);
}

export function ensureEmptyPageSnapshot(doc: Y.Doc, pageId: string): void {
  const snaps = getPageSnapshots(doc);
  if (snaps.has(pageId)) return;
  snaps.set(
    pageId,
    JSON.stringify({ strokes: [], shapes: {}, notes: {}, assets: {} } satisfies PageSnapshot),
  );
}

function loadPageContent(doc: Y.Doc, toId: string): void {
  const raw = getPageSnapshots(doc).get(toId);
  const snap = raw
    ? (JSON.parse(String(raw)) as PageSnapshot)
    : { strokes: [], shapes: {}, notes: {}, assets: {} };
  restorePageSnapshot(doc, snap);
}
