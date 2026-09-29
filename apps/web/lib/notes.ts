import * as Y from "yjs";
import { type NoteField, type StickyNote } from "@liveboard/shared";
import { getPageContent } from "./page-model";
import { LOCAL_ORIGIN } from "./strokes";

export type YNote = Y.Map<unknown>;

export function getNotes(doc: Y.Doc, pageId?: string): Y.Map<YNote> {
  return getPageContent(doc, pageId).notes as Y.Map<YNote>;
}

export function readNote(m: YNote): StickyNote {
  const textField = m.get("text");
  const text =
    textField instanceof Y.Text ? textField.toString() : textField != null ? String(textField) : "";
  return {
    id: String(m.get("id")),
    x: Number(m.get("x") ?? 0),
    y: Number(m.get("y") ?? 0),
    w: Number(m.get("w") ?? 160),
    h: Number(m.get("h") ?? 120),
    color: String(m.get("color") ?? "#fef08a"),
    text,
    z: Number(m.get("z") ?? 0),
    authorId: String(m.get("authorId") ?? ""),
    createdAt: Number(m.get("createdAt") ?? 0),
  };
}

export function createNote(
  doc: Y.Doc,
  opts: { id: string; authorId: string; x: number; y: number; color: string; z: number },
  pageId?: string,
): YNote {
  const note = new Y.Map<unknown>();
  const yText = new Y.Text();
  doc.transact(() => {
    const fields: [NoteField, unknown][] = [
      ["id", opts.id],
      ["x", opts.x],
      ["y", opts.y],
      ["w", 160],
      ["h", 120],
      ["color", opts.color],
      ["text", yText],
      ["z", opts.z],
      ["authorId", opts.authorId],
      ["createdAt", Date.now()],
    ];
    for (const [k, v] of fields) note.set(k, v);
    getNotes(doc, pageId).set(opts.id, note);
  }, LOCAL_ORIGIN);
  return note;
}

export function getNoteText(note: YNote): Y.Text | null {
  const t = note.get("text");
  return t instanceof Y.Text ? t : null;
}

export function updateNoteRect(doc: Y.Doc, id: string, patch: Partial<Pick<StickyNote, "x" | "y" | "w" | "h">>): void {
  const m = getNotes(doc).get(id);
  if (!(m instanceof Y.Map)) return;
  doc.transact(() => {
    if (patch.x != null) m.set("x", patch.x);
    if (patch.y != null) m.set("y", patch.y);
    if (patch.w != null) m.set("w", patch.w);
    if (patch.h != null) m.set("h", patch.h);
  }, LOCAL_ORIGIN);
}

export function deleteNote(doc: Y.Doc, id: string): void {
  doc.transact(() => getNotes(doc).delete(id), LOCAL_ORIGIN);
}

export function hitNote(n: StickyNote, wx: number, wy: number): boolean {
  return wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h;
}
