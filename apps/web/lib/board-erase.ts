import * as Y from "yjs";
import { hitNote, readNote, getNotes } from "./notes";
import { hitShape, readShape, getShapes } from "./shapes";
import { eraseAt, LOCAL_ORIGIN, readStroke, getStrokes, hitStroke } from "./strokes";

/** One undo step: erase strokes, shapes, and notes under the cursor. */
export function eraseAtWorld(doc: Y.Doc, x: number, y: number, radius: number): void {
  doc.transact(() => {
    const strokes = getStrokes(doc);
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = readStroke(strokes.get(i)!);
      if (hitStroke(s.points, x, y, radius + s.size / 2)) strokes.delete(i, 1);
    }
    const shapes = getShapes(doc);
    shapes.forEach((m, id) => {
      if (hitShape(readShape(m), x, y, radius)) shapes.delete(id);
    });
    const notes = getNotes(doc);
    notes.forEach((m, id) => {
      if (hitNote(readNote(m), x, y)) notes.delete(id);
    });
  }, LOCAL_ORIGIN);
}
