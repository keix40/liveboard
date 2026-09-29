import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { readBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";

export type PageContentMaps = {
  strokes: Y.Array<Y.Map<unknown>>;
  shapes: Y.Map<Y.Map<unknown>>;
  notes: Y.Map<Y.Map<unknown>>;
  assets: Y.Map<Y.Map<unknown>>;
};

function legacyHasContent(doc: Y.Doc): boolean {
  return (
    doc.getArray(YKEYS.strokes).length > 0 ||
    doc.getMap(YKEYS.shapes).size > 0 ||
    doc.getMap(YKEYS.notes).size > 0 ||
    doc.getMap(YKEYS.assets).size > 0
  );
}

function cloneStrokeRow(row: Y.Map<unknown>): Y.Map<unknown> {
  const stroke = new Y.Map<unknown>();
  row.forEach((v, k) => {
    if (k === "points" && v instanceof Y.Array) {
      const pts = new Y.Array<number>();
      pts.push(v.toArray() as number[]);
      stroke.set(k, pts);
    } else stroke.set(k, v);
  });
  return stroke;
}

function cloneEntityMap(source: Y.Map<Y.Map<unknown>>): Y.Map<Y.Map<unknown>> {
  const out = new Y.Map<Y.Map<unknown>>();
  source.forEach((row, id) => {
    const m = new Y.Map<unknown>();
    row.forEach((v, k) => {
      if (k === "text" && v instanceof Y.Text) m.set(k, new Y.Text(v.toString()));
      else m.set(k, v);
    });
    out.set(id, m);
  });
  return out;
}

function emptyPageContent(): PageContentMaps {
  return {
    strokes: new Y.Array(),
    shapes: new Y.Map(),
    notes: new Y.Map(),
    assets: new Y.Map(),
  };
}

function attachPageContent(page: Y.Map<unknown>, content: PageContentMaps): void {
  page.set("strokes", content.strokes);
  page.set("shapes", content.shapes);
  page.set("notes", content.notes);
  page.set("assets", content.assets);
}

/** Migrate legacy top-level strokes/shapes/notes/assets into pages.page-1. Idempotent. */
export function ensurePageModel(doc: Y.Doc): void {
  const pages = doc.getMap(YKEYS.pages);
  if (pages.size > 0) return;

  doc.transact(() => {
    const content = emptyPageContent();
    if (legacyHasContent(doc)) {
      const legacyStrokes = doc.getArray(YKEYS.strokes);
      for (let i = 0; i < legacyStrokes.length; i++) {
        const row = legacyStrokes.get(i);
        if (row instanceof Y.Map) content.strokes.push([cloneStrokeRow(row)]);
      }
      content.shapes = cloneEntityMap(doc.getMap(YKEYS.shapes) as Y.Map<Y.Map<unknown>>);
      content.notes = cloneEntityMap(doc.getMap(YKEYS.notes) as Y.Map<Y.Map<unknown>>);
      content.assets = cloneEntityMap(doc.getMap(YKEYS.assets) as Y.Map<Y.Map<unknown>>);
      legacyStrokes.delete(0, legacyStrokes.length);
      doc.getMap(YKEYS.shapes).forEach((_, k) => doc.getMap(YKEYS.shapes).delete(k));
      doc.getMap(YKEYS.notes).forEach((_, k) => doc.getMap(YKEYS.notes).delete(k));
      doc.getMap(YKEYS.assets).forEach((_, k) => doc.getMap(YKEYS.assets).delete(k));
    }
    const page = new Y.Map<unknown>();
    attachPageContent(page, content);
    pages.set("page-1", page);
  }, LOCAL_ORIGIN);
}

export function ensurePage(doc: Y.Doc, pageId: string): PageContentMaps {
  ensurePageModel(doc);
  const pages = doc.getMap(YKEYS.pages);
  let raw = pages.get(pageId);
  if (!(raw instanceof Y.Map)) {
    const page = new Y.Map<unknown>();
    attachPageContent(page, emptyPageContent());
    pages.set(pageId, page);
    raw = page;
  }
  const page = raw as Y.Map<unknown>;
  return {
    strokes: page.get("strokes") as Y.Array<Y.Map<unknown>>,
    shapes: page.get("shapes") as Y.Map<Y.Map<unknown>>,
    notes: page.get("notes") as Y.Map<Y.Map<unknown>>,
    assets: page.get("assets") as Y.Map<Y.Map<unknown>>,
  };
}

export function resolvePageId(doc: Y.Doc, pageId?: string): string {
  if (pageId) return pageId;
  const meta = readBoardMeta(doc);
  return meta?.activePageId ?? "page-1";
}

export function getPageContent(doc: Y.Doc, pageId?: string): PageContentMaps {
  return ensurePage(doc, resolvePageId(doc, pageId));
}
