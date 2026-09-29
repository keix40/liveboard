import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createNote, getNoteText, getNotes, readNote } from "./notes";
import { LOCAL_ORIGIN } from "./strokes";

describe("notes", () => {
  it("merges concurrent Y.Text edits deterministically", () => {
    const doc = new Y.Doc();
    const note = createNote(doc, { id: "n1", authorId: "a", x: 0, y: 0, color: "#fef08a", z: 1 });
    const text = getNoteText(note)!;
    doc.transact(() => text.insert(0, "hello"), LOCAL_ORIGIN);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc));
    const note2 = getNotes(doc2).get("n1") as Y.Map<unknown>;
    const text2 = note2.get("text") as Y.Text;
    doc.transact(() => text.insert(5, " world"), LOCAL_ORIGIN);
    doc2.transact(() => text2.insert(5, " there"), LOCAL_ORIGIN);

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc));
    expect(readNote(note).text).toBe(readNote(note2 as typeof note).text);
  });
});
