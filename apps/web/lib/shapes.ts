import * as Y from "yjs";
import { type Shape, type ShapeField, type ShapeKind } from "@liveboard/shared";
import { readShapes, writeShapes } from "./page-model";
import {
  arrowHeadLength,
  arrowShaftEnd,
  distanceToSegment,
  isLineLikeKind,
  lineLikeBounds,
} from "./shape-geometry";
import { LOCAL_ORIGIN } from "./strokes";

export type YShape = Y.Map<unknown>;

export function getShapes(doc: Y.Doc, pageId?: string): Y.Map<YShape> {
  return readShapes(doc, pageId) as Y.Map<YShape>;
}

export function readShape(m: YShape): Shape {
  return {
    id: String(m.get("id")),
    kind: m.get("kind") as ShapeKind,
    x: Number(m.get("x") ?? 0),
    y: Number(m.get("y") ?? 0),
    w: Number(m.get("w") ?? 0),
    h: Number(m.get("h") ?? 0),
    rotation: Number(m.get("rotation") ?? 0),
    stroke: String(m.get("stroke") ?? "#0f172a"),
    fill: m.get("fill") == null ? null : String(m.get("fill")),
    strokeWidth: Number(m.get("strokeWidth") ?? 2),
    text: m.get("text") != null ? String(m.get("text")) : undefined,
    z: Number(m.get("z") ?? 0),
    authorId: String(m.get("authorId") ?? ""),
    createdAt: Number(m.get("createdAt") ?? 0),
  };
}

export function upsertShape(doc: Y.Doc, shape: Shape, pageId?: string): YShape {
  let entry!: YShape;
  doc.transact(() => {
    const map = writeShapes(doc, pageId);
    const existing = map.get(shape.id);
    entry = existing instanceof Y.Map ? existing : new Y.Map();
    const fields: [ShapeField, unknown][] = [
      ["id", shape.id],
      ["kind", shape.kind],
      ["x", shape.x],
      ["y", shape.y],
      ["w", shape.w],
      ["h", shape.h],
      ["rotation", shape.rotation],
      ["stroke", shape.stroke],
      ["fill", shape.fill],
      ["strokeWidth", shape.strokeWidth],
      ["z", shape.z],
      ["authorId", shape.authorId],
      ["createdAt", shape.createdAt],
    ];
    if (shape.text !== undefined) fields.push(["text", shape.text]);
    for (const [k, v] of fields) entry.set(k, v);
    map.set(shape.id, entry);
  }, LOCAL_ORIGIN);
  return entry;
}

export function deleteShape(doc: Y.Doc, id: string): void {
  doc.transact(() => getShapes(doc).delete(id), LOCAL_ORIGIN);
}

export function shapeBounds(s: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
  if (isLineLikeKind(s.kind)) return lineLikeBounds(s);
  const xs = [s.x, s.x + s.w];
  const ys = [s.y, s.y + s.h];
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function hitShape(s: Shape, wx: number, wy: number, pad = 6): boolean {
  if (isLineLikeKind(s.kind)) {
    const end = { x: s.x + s.w, y: s.y + s.h };
    const hitWidth = Math.max(pad, s.strokeWidth / 2 + pad);
    if (s.kind === "arrow") {
      const head = arrowHeadLength(s.strokeWidth);
      if (Math.hypot(wx - end.x, wy - end.y) <= head + pad) return true;
      const base = arrowShaftEnd(s.x, s.y, end.x, end.y, head);
      return distanceToSegment(wx, wy, s.x, s.y, base.x, base.y) <= hitWidth;
    }
    return distanceToSegment(wx, wy, s.x, s.y, end.x, end.y) <= hitWidth;
  }
  const b = shapeBounds(s);
  return wx >= b.minX - pad && wx <= b.maxX + pad && wy >= b.minY - pad && wy <= b.maxY + pad;
}
