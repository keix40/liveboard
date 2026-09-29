import type { Bounds } from "./camera";
import { readNote, type YNote } from "./notes";
import { readShape, type YShape } from "./shapes";
import { readStroke, type YStroke } from "./strokes";
import { readAsset, type YAsset } from "./assets";

/** Content bounding box for fit-to-screen and export. */
export function computeContentBounds(
  strokes: YStroke[],
  shapes: Map<string, YShape>,
  notes: Map<string, YNote>,
  assets?: Map<string, YAsset>,
): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const s of strokes) {
    for (const [x, y] of readStroke(s).points) grow(x, y);
  }
  for (const m of shapes.values()) {
    const sh = readShape(m);
    grow(sh.x, sh.y);
    grow(sh.x + sh.w, sh.y + sh.h);
  }
  for (const m of notes.values()) {
    const n = readNote(m);
    grow(n.x, n.y);
    grow(n.x + n.w, n.y + n.h);
  }
  if (assets) {
    for (const m of assets.values()) {
      const a = readAsset(m);
      grow(a.x, a.y);
      grow(a.x + a.w, a.y + a.h);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}
