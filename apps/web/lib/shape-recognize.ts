import type { Point, ShapeKind } from "@liveboard/shared";

export interface RecognizedShape {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

function bounds(points: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function lineScore(points: Point[]): number {
  if (points.length < 4) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const len = Math.hypot(dx, dy);
  if (len < 12) return 0;
  let err = 0;
  for (const [x, y] of points) {
    const t = ((x - first[0]) * dx + (y - first[1]) * dy) / (len * len);
    const qx = first[0] + t * dx;
    const qy = first[1] + t * dy;
    err += Math.hypot(x - qx, y - qy);
  }
  const avg = err / points.length;
  return Math.max(0, 1 - avg / Math.max(8, len * 0.08));
}

function rectScore(points: Point[]): number {
  const b = bounds(points);
  if (b.w < 16 || b.h < 16) return 0;
  let inside = 0;
  for (const [x, y] of points) {
    const nearEdge =
      Math.abs(x - b.minX) < 12 ||
      Math.abs(x - b.maxX) < 12 ||
      Math.abs(y - b.minY) < 12 ||
      Math.abs(y - b.maxY) < 12;
    if (nearEdge) inside++;
  }
  return inside / points.length;
}

/** Recognize a freehand stroke as a primitive shape (line, rect, ellipse, arrow). */
export function recognizeStrokeShape(points: Point[]): RecognizedShape | null {
  if (points.length < 6) return null;
  const b = bounds(points);
  const line = lineScore(points);
  const rect = rectScore(points);
  const closed = Math.hypot(points[0]![0] - points.at(-1)![0], points[0]![1] - points.at(-1)![1]) < Math.max(20, Math.min(b.w, b.h) * 0.25);
  const aspect = b.w / Math.max(1, b.h);

  if (line > 0.82 && !closed) {
    const kind: ShapeKind = aspect > 1.2 || aspect < 0.85 ? "arrow" : "line";
    return {
      kind,
      x: points[0]![0],
      y: points[0]![1],
      w: points.at(-1)![0] - points[0]![0],
      h: points.at(-1)![1] - points[0]![1],
      confidence: line,
    };
  }
  if (rect > 0.55 && closed) {
    const kind: ShapeKind = Math.abs(aspect - 1) < 0.35 ? "ellipse" : "rect";
    return {
      kind,
      x: b.minX,
      y: b.minY,
      w: b.w,
      h: b.h,
      confidence: rect,
    };
  }
  return null;
}
