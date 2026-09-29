import * as Y from "yjs";
import { getStroke } from "perfect-freehand";
import { YKEYS, type Point, type StrokeField, type StrokeVariant } from "@liveboard/shared";

/**
 * Freehand strokes live in doc.getArray("strokes") as Y.Map entries:
 *   { id, authorId, color, size, createdAt, points: Y.Array<number> (flat x,y,p,x,y,p,...) }
 * Points are a nested Y.Array so a stroke streams to peers *while* it is being drawn.
 */
export type YStroke = Y.Map<unknown>;

/** Transaction origin for local edits (tracked by the UndoManager, ignored for remote). */
export const LOCAL_ORIGIN = Symbol("local");

/** Discarded touch ink (not tracked by UndoManager). */
export const PROVISIONAL_ORIGIN = Symbol("provisional");

export function getStrokes(doc: Y.Doc): Y.Array<YStroke> {
  return doc.getArray<YStroke>(YKEYS.strokes);
}

export function flatToPoints(flat: ArrayLike<number>): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
  return out;
}

export function beginStroke(
  doc: Y.Doc,
  opts: {
    id: string;
    authorId: string;
    color: string;
    size: number;
    variant?: StrokeVariant;
    first: Point;
  },
): Y.Array<number> {
  const points = new Y.Array<number>();
  const stroke = new Y.Map<unknown>();
  doc.transact(() => {
    const fields: [StrokeField, unknown][] = [
      ["id", opts.id],
      ["authorId", opts.authorId],
      ["color", opts.color],
      ["size", opts.size],
      ["variant", opts.variant ?? "pen"],
      ["createdAt", Date.now()],
      ["points", points],
    ];
    for (const [k, v] of fields) stroke.set(k, v);
    points.push(opts.first);
    getStrokes(doc).push([stroke]);
  }, LOCAL_ORIGIN);
  return points;
}

export function extendStroke(doc: Y.Doc, points: Y.Array<number>, p: Point): void {
  doc.transact(() => points.push(p), LOCAL_ORIGIN);
}

export function readStroke(s: YStroke) {
  const pts = s.get("points");
  const variantRaw = s.get("variant");
  return {
    id: String(s.get("id")),
    color: String(s.get("color") ?? "#0f172a"),
    size: Number(s.get("size") ?? 6),
    variant: (variantRaw === "highlighter" ? "highlighter" : "pen") as StrokeVariant,
    points: pts instanceof Y.Array ? flatToPoints(pts.toArray() as number[]) : [],
  };
}

/** perfect-freehand outline -> SVG path data (usable with new Path2D(d)). */
export function strokePath(points: Point[], size: number, variant: StrokeVariant = "pen"): string {
  const outline = getStroke(points, {
    size: variant === "highlighter" ? size * 1.4 : size,
    thinning: variant === "highlighter" ? 0.2 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: points.every((p) => p[2] === 0.5),
  });
  return svgPathFromOutline(outline);
}

/** The helper recommended by perfect-freehand's README (quadratic curves through midpoints). */
function svgPathFromOutline(pts: number[][]): string {
  if (pts.length < 4) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  const f = (n: number) => n.toFixed(2);
  let a = pts[0]!;
  let b = pts[1]!;
  const c = pts[2]!;
  let d = `M${f(a[0]!)},${f(a[1]!)} Q${f(b[0]!)},${f(b[1]!)} ${f(avg(b[0]!, c[0]!))},${f(avg(b[1]!, c[1]!))} T`;
  for (let i = 2; i < pts.length - 1; i++) {
    a = pts[i]!;
    b = pts[i + 1]!;
    d += `${f(avg(a[0]!, b[0]!))},${f(avg(a[1]!, b[1]!))} `;
  }
  return d + "Z";
}

/** True if (x, y) is within `radius` of any sampled point of the stroke. */
export function hitStroke(points: Point[], x: number, y: number, radius: number): boolean {
  const r2 = radius * radius;
  return points.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= r2);
}

/** Delete every stroke under the eraser. Returns the number of strokes removed. */
export function eraseAt(doc: Y.Doc, x: number, y: number, radius: number): number {
  const strokes = getStrokes(doc);
  let removed = 0;
  doc.transact(() => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = readStroke(strokes.get(i)!);
      if (hitStroke(s.points, x, y, radius + s.size / 2)) {
        strokes.delete(i, 1);
        removed++;
      }
    }
  }, LOCAL_ORIGIN);
  return removed;
}

/** Remove the stroke whose `points` array matches (e.g. cancelled touch-down before pan). */
export function discardProvisionalStroke(doc: Y.Doc, points: Y.Array<number>): void {
  const strokes = getStrokes(doc);
  doc.transact(() => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes.get(i)!;
      if (s.get("points") === points) {
        strokes.delete(i, 1);
        break;
      }
    }
  }, PROVISIONAL_ORIGIN);
}

export function deleteStrokeById(doc: Y.Doc, id: string): void {
  const strokes = getStrokes(doc);
  doc.transact(() => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (readStroke(strokes.get(i)!).id === id) strokes.delete(i, 1);
    }
  }, LOCAL_ORIGIN);
}
