import * as Y from "yjs";
import { hitNote, readNote, getNotes } from "./notes";
import { hitShape, readShape, getShapes } from "./shapes";
import { LOCAL_ORIGIN, readStroke, getStrokes, hitStroke } from "./strokes";
import { getAssets, readAsset } from "./assets";
import { isLocked } from "./locking";

/** One undo step: erase strokes, shapes, and notes under the cursor. */
export function eraseAtWorld(doc: Y.Doc, x: number, y: number, radius: number): void {
  doc.transact(() => {
    const strokes = getStrokes(doc);
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = readStroke(strokes.get(i)!);
      if (isLocked(doc, s.id)) continue;
      if (hitStroke(s.points, x, y, radius + s.size / 2)) strokes.delete(i, 1);
    }
    const shapes = getShapes(doc);
    shapes.forEach((m, id) => {
      if (isLocked(doc, id)) return;
      if (hitShape(readShape(m), x, y, radius)) shapes.delete(id);
    });
    const notes = getNotes(doc);
    notes.forEach((m, id) => {
      if (isLocked(doc, id)) return;
      if (hitNote(readNote(m), x, y)) notes.delete(id);
    });
    const assets = getAssets(doc);
    assets.forEach((m, id) => {
      if (isLocked(doc, id) || readAsset(m).locked) return;
      const a = readAsset(m);
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) assets.delete(id);
    });
  }, LOCAL_ORIGIN);
}
