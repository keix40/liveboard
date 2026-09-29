import * as Y from "yjs";
import {
  YKEYS,
  type BoardBackground,
  type BoardFrame,
  type BoardTemplate,
  DOC_SCHEMA_VERSION,
} from "@liveboard/shared";

export interface BoardMeta {
  schemaVersion: number;
  background: BoardBackground;
  darkMode: boolean;
  template: BoardTemplate;
  activePageId: string;
  pageOrder: string[];
  boardPassword: string | null;
  lockedIds: string[];
  frames: BoardFrame[];
}

const DEFAULT: BoardMeta = {
  schemaVersion: DOC_SCHEMA_VERSION,
  background: "grid",
  darkMode: false,
  template: "none",
  activePageId: "page-1",
  pageOrder: ["page-1"],
  boardPassword: null,
  lockedIds: [],
  frames: [],
};

export function getMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(YKEYS.meta);
}

export function readBoardMeta(doc: Y.Doc): BoardMeta {
  const m = getMetaMap(doc);
  const pageOrderRaw = m.get("pageOrder");
  return {
    schemaVersion: Number(m.get("schemaVersion") ?? DOC_SCHEMA_VERSION),
    background: (m.get("background") as BoardBackground) ?? DEFAULT.background,
    darkMode: Boolean(m.get("darkMode")),
    template: (m.get("template") as BoardTemplate) ?? DEFAULT.template,
    activePageId: String(m.get("activePageId") ?? DEFAULT.activePageId),
    pageOrder: Array.isArray(pageOrderRaw) ? (pageOrderRaw as string[]) : [...DEFAULT.pageOrder],
    boardPassword: m.get("boardPassword") != null ? String(m.get("boardPassword")) : null,
    lockedIds: Array.isArray(m.get("lockedIds")) ? (m.get("lockedIds") as string[]) : [],
    frames: Array.isArray(m.get("frames")) ? (m.get("frames") as BoardFrame[]) : [],
  };
}

export function writeBoardMeta(doc: Y.Doc, patch: Partial<BoardMeta>, origin: symbol): void {
  doc.transact(() => {
    const m = getMetaMap(doc);
    if (patch.schemaVersion != null) m.set("schemaVersion", patch.schemaVersion);
    if (patch.background != null) m.set("background", patch.background);
    if (patch.darkMode != null) m.set("darkMode", patch.darkMode);
    if (patch.template != null) m.set("template", patch.template);
    if (patch.activePageId != null) m.set("activePageId", patch.activePageId);
    if (patch.pageOrder != null) m.set("pageOrder", patch.pageOrder);
    if (patch.boardPassword !== undefined) {
      if (patch.boardPassword) m.set("boardPassword", patch.boardPassword);
      else m.delete("boardPassword");
    }
    if (patch.lockedIds != null) m.set("lockedIds", patch.lockedIds);
    if (patch.frames != null) m.set("frames", patch.frames);
  }, origin);
}

export function ensureBoardMeta(doc: Y.Doc, origin: symbol): void {
  const m = getMetaMap(doc);
  if (m.size > 0) return;
  writeBoardMeta(doc, DEFAULT, origin);
}
