import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { capturePageSnapshot, restorePageSnapshot, type PageSnapshot } from "./pages";
import { LOCAL_ORIGIN } from "./strokes";

export const MAX_SNAPSHOTS = 20;

export interface HistorySnapshot {
  id: string;
  label: string;
  createdAt: number;
  page: PageSnapshot;
}

export function getSnapshots(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray(YKEYS.snapshots);
}

export function pushSnapshot(doc: Y.Doc, label: string, pageId?: string): void {
  doc.transact(() => {
    const arr = getSnapshots(doc);
    const entry = new Y.Map<unknown>();
    entry.set("id", crypto.randomUUID());
    entry.set("label", label);
    entry.set("createdAt", Date.now());
    entry.set("page", JSON.stringify(capturePageSnapshot(doc, pageId)));
    arr.push([entry]);
    while (arr.length > MAX_SNAPSHOTS) arr.delete(0, 1);
  }, LOCAL_ORIGIN);
}

export function readSnapshot(m: Y.Map<unknown>): HistorySnapshot {
  const raw = m.get("page");
  const page =
    typeof raw === "string"
      ? (JSON.parse(raw) as PageSnapshot)
      : ((raw as PageSnapshot | undefined) ?? { strokes: [], shapes: {}, notes: {}, assets: {} });
  return {
    id: String(m.get("id")),
    label: String(m.get("label") ?? "Snapshot"),
    createdAt: Number(m.get("createdAt") ?? 0),
    page: { ...page, assets: page.assets ?? {} },
  };
}

/** Restore board content from a history entry (undoable, syncs to peers). */
export function restoreHistorySnapshot(doc: Y.Doc, snap: PageSnapshot, pageId?: string): void {
  restorePageSnapshot(doc, snap, pageId);
}

export function listHistorySnapshots(doc: Y.Doc): HistorySnapshot[] {
  return getSnapshots(doc)
    .toArray()
    .filter((m): m is Y.Map<unknown> => m instanceof Y.Map)
    .map(readSnapshot);
}
