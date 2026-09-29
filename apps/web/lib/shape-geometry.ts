import type { Shape, ShapeKind } from "@liveboard/shared";

export function isLineLikeKind(kind: ShapeKind | string): boolean {
  return kind === "line" || kind === "arrow";
}

export function shapeEndPoint(s: Pick<Shape, "x" | "y" | "w" | "h">): { x: number; y: number } {
  return { x: s.x + s.w, y: s.y + s.h };
}

export function lineLikeLength(w: number, h: number): number {
  return Math.hypot(w, h);
}

/** Distance from (px, py) to segment (x0,y0)-(x1,y1). */
export function distanceToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

export function lineLikeBounds(s: Pick<Shape, "x" | "y" | "w" | "h">): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const end = shapeEndPoint(s);
  return {
    minX: Math.min(s.x, end.x),
    minY: Math.min(s.y, end.y),
    maxX: Math.max(s.x, end.x),
    maxY: Math.max(s.y, end.y),
  };
}
