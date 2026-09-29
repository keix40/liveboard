import type { Shape } from "@liveboard/shared";
import type { StickyNote } from "@liveboard/shared";
import { readStroke, type YStroke } from "./strokes";
import { isLineLikeKind, lineLikeBounds } from "./shape-geometry";
import { hitShape, readShape, type YShape } from "./shapes";
import { hitNote, readNote, type YNote } from "./notes";
import { hitAsset, readAsset, type YAsset } from "./assets";

export type SelectableKind = "stroke" | "shape" | "note" | "asset";

export interface SelectableRef {
  kind: SelectableKind;
  id: string;
}

/** Axis-aligned marquee in world space. */
export function marqueeSelect(
  strokes: YStroke[],
  shapes: Map<string, YShape> | Iterable<[string, YShape]>,
  notes: Map<string, YNote> | Iterable<[string, YNote]>,
  box: { x1: number; y1: number; x2: number; y2: number },
  assets?: Map<string, YAsset> | Iterable<[string, YAsset]>,
): SelectableRef[] {
  const minX = Math.min(box.x1, box.x2);
  const maxX = Math.max(box.x1, box.x2);
  const minY = Math.min(box.y1, box.y2);
  const maxY = Math.max(box.y1, box.y2);
  const hits: SelectableRef[] = [];

  for (let i = 0; i < strokes.length; i++) {
    const s = readStroke(strokes[i]!);
    if (s.points.some(([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY)) {
      hits.push({ kind: "stroke", id: s.id });
    }
  }
  for (const [id, m] of shapes) {
    const sh = readShape(m);
    const b = isLineLikeKind(sh.kind) ? lineLikeBounds(sh) : { minX: sh.x, minY: sh.y, maxX: sh.x + sh.w, maxY: sh.y + sh.h };
    if (b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) hits.push({ kind: "shape", id });
  }
  for (const [id, m] of notes) {
    const n = readNote(m);
    if (n.x + n.w >= minX && n.x <= maxX && n.y + n.h >= minY && n.y <= maxY) hits.push({ kind: "note", id });
  }
  if (assets) {
    for (const [id, m] of assets) {
      const a = readAsset(m);
      if (a.x + a.w >= minX && a.x <= maxX && a.y + a.h >= minY && a.y <= maxY) hits.push({ kind: "asset", id });
    }
  }
  return hits;
}

/** Freeform lasso: point-in-polygon test for each object's anchor. */
export function lassoSelect(
  strokes: YStroke[],
  shapes: Map<string, YShape> | Iterable<[string, YShape]>,
  notes: Map<string, YNote> | Iterable<[string, YNote]>,
  polygon: { x: number; y: number }[],
  assets?: Map<string, YAsset> | Iterable<[string, YAsset]>,
): SelectableRef[] {
  if (polygon.length < 3) return [];
  const hits: SelectableRef[] = [];
  const inside = (x: number, y: number) => pointInPolygon(x, y, polygon);

  for (let i = 0; i < strokes.length; i++) {
    const s = readStroke(strokes[i]!);
    if (s.points.some(([x, y]) => inside(x, y))) hits.push({ kind: "stroke", id: s.id });
  }
  for (const [id, m] of shapes) {
    const sh = readShape(m);
    const cx = isLineLikeKind(sh.kind) ? (sh.x + (sh.x + sh.w)) / 2 : sh.x + sh.w / 2;
    const cy = isLineLikeKind(sh.kind) ? (sh.y + (sh.y + sh.h)) / 2 : sh.y + sh.h / 2;
    if (inside(cx, cy)) hits.push({ kind: "shape", id });
  }
  for (const [id, m] of notes) {
    const n = readNote(m);
    if (inside(n.x + n.w / 2, n.y + n.h / 2)) hits.push({ kind: "note", id });
  }
  if (assets) {
    for (const [id, m] of assets) {
      const a = readAsset(m);
      if (inside(a.x + a.w / 2, a.y + a.h / 2)) hits.push({ kind: "asset", id });
    }
  }
  return hits;
}

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pickAt(
  strokes: YStroke[],
  shapes: Map<string, YShape>,
  notes: Map<string, YNote>,
  wx: number,
  wy: number,
  assets?: Map<string, YAsset>,
): SelectableRef | null {
  for (const [id, m] of [...notes.entries()].reverse()) {
    if (hitNote(readNote(m), wx, wy)) return { kind: "note", id };
  }
  for (const [id, m] of [...shapes.entries()].reverse()) {
    if (hitShape(readShape(m), wx, wy)) return { kind: "shape", id };
  }
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = readStroke(strokes[i]!);
    const r = s.size / 2 + 4;
    if (s.points.some(([px, py]) => (px - wx) ** 2 + (py - wy) ** 2 <= r * r)) {
      return { kind: "stroke", id: s.id };
    }
  }
  if (assets) {
    for (const [id, m] of [...assets.entries()].reverse()) {
      if (hitAsset(readAsset(m), wx, wy)) return { kind: "asset", id };
    }
  }
  return null;
}

export function unionBounds(
  selection: SelectableRef[],
  strokesById: Map<string, ReturnType<typeof readStroke>>,
  shapes: Map<string, Shape>,
  notes: Map<string, StickyNote>,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const sel of selection) {
    if (sel.kind === "stroke") {
      const s = strokesById.get(sel.id);
      if (!s) continue;
      for (const [x, y] of s.points) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    } else if (sel.kind === "shape") {
      const sh = shapes.get(sel.id);
      if (!sh) continue;
      minX = Math.min(minX, sh.x, sh.x + sh.w);
      minY = Math.min(minY, sh.y, sh.y + sh.h);
      maxX = Math.max(maxX, sh.x, sh.x + sh.w);
      maxY = Math.max(maxY, sh.y, sh.y + sh.h);
    } else {
      const n = notes.get(sel.id);
      if (!n) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
