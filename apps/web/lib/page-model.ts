import * as Y from "yjs";
import {
  YKEYS,
  DEFAULT_PAGE_ID,
  pageContentKey,
} from "@liveboard/shared";
import { readBoardMeta } from "./board-meta";

/** Read-only placeholders — never attached to a Y.Doc. */
const EMPTY_STROKES = new Y.Array<Y.Map<unknown>>();
const EMPTY_ENTITY_MAP = new Y.Map<Y.Map<unknown>>();

export function resolvePageId(doc: Y.Doc, pageId?: string): string {
  if (pageId) return pageId;
  const meta = readBoardMeta(doc);
  return meta?.activePageId ?? DEFAULT_PAGE_ID;
}

function peekArray(doc: Y.Doc, key: string): Y.Array<Y.Map<unknown>> {
  if (!doc.share.has(key)) return EMPTY_STROKES;
  return doc.getArray(key);
}

function peekMap(doc: Y.Doc, key: string): Y.Map<Y.Map<unknown>> {
  if (!doc.share.has(key)) return EMPTY_ENTITY_MAP;
  return doc.getMap(key);
}

export function readStrokes(doc: Y.Doc, pageId?: string): Y.Array<Y.Map<unknown>> {
  return peekArray(doc, pageContentKey("strokes", resolvePageId(doc, pageId)));
}

export function readShapes(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return peekMap(doc, pageContentKey("shapes", resolvePageId(doc, pageId)));
}

export function readNotes(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return peekMap(doc, pageContentKey("notes", resolvePageId(doc, pageId)));
}

export function readAssets(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return peekMap(doc, pageContentKey("assets", resolvePageId(doc, pageId)));
}

export function writeStrokes(doc: Y.Doc, pageId?: string): Y.Array<Y.Map<unknown>> {
  return doc.getArray(pageContentKey("strokes", resolvePageId(doc, pageId)));
}

export function writeShapes(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(pageContentKey("shapes", resolvePageId(doc, pageId)));
}

export function writeNotes(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(pageContentKey("notes", resolvePageId(doc, pageId)));
}

export function writeAssets(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(pageContentKey("assets", resolvePageId(doc, pageId)));
}

/** Page metadata only — call when the user adds a page (not on read). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBoundToDoc(doc: Y.Doc, type: Y.AbstractType<any> | null | undefined): type is Y.AbstractType<any> {
  return type != null && type.doc === doc;
}

export function readStrokeCount(doc: Y.Doc, pageId?: string): number {
  const key = pageContentKey("strokes", resolvePageId(doc, pageId));
  if (!doc.share.has(key)) return 0;
  return doc.getArray(key).length;
}

/** Top-level page content types for UndoManager scope (getArray/getMap is safe for merge). */
export function pageUndoScopeTypes(doc: Y.Doc, pageId: string): Y.AbstractType<any>[] {
  return [
    doc.getArray(pageContentKey("strokes", pageId)),
    doc.getMap(pageContentKey("shapes", pageId)),
    doc.getMap(pageContentKey("notes", pageId)),
    doc.getMap(pageContentKey("assets", pageId)),
  ];
}

export function addPageToUndoScope(undo: Y.UndoManager, doc: Y.Doc, pageId: string): void {
  undo.addToScope(pageUndoScopeTypes(doc, pageId));
}

export function writePageMetadata(doc: Y.Doc, pageId: string, name?: string): void {
  const pages = doc.getMap(YKEYS.pages);
  if (pages.has(pageId)) return;
  const meta = new Y.Map<unknown>();
  meta.set("id", pageId);
  meta.set("name", name ?? pageId);
  pages.set(pageId, meta);
}
