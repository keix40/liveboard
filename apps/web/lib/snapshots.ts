import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { capturePageSnapshot, type PageSnapshot } from "./pages";
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

export function pushSnapshot(doc: Y.Doc, label: string): void {
  doc.transact(() => {
    const arr = getSnapshots(doc);
    const entry = new Y.Map<unknown>();
    entry.set("id", crypto.randomUUID());
    entry.set("label", label);
    entry.set("createdAt", Date.now());
    entry.set("page", capturePageSnapshot(doc));
    arr.push([entry]);
    while (arr.length > MAX_SNAPSHOTS) arr.delete(0, 1);
  }, LOCAL_ORIGIN);
}

export function readSnapshot(m: Y.Map<unknown>): HistorySnapshot {
  return {
    id: String(m.get("id")),
    label: String(m.get("label") ?? "Snapshot"),
    createdAt: Number(m.get("createdAt") ?? 0),
    page: m.get("page") as PageSnapshot,
  };
}
