import type { Camera } from "./camera";
import { readStroke, strokePath, type YStroke } from "./strokes";
import { readShape, type YShape } from "./shapes";
import { readNote, type YNote } from "./notes";
import type { SelectableRef } from "./selection";

export interface RenderBoardOpts {
  camera: Camera;
  dpr: number;
  strokes: YStroke[];
  shapes: Map<string, YShape>;
  notes: Map<string, YNote>;
  selection?: SelectableRef[];
  lassoPath?: { x: number; y: number }[];
  previewShape?: { kind: string; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number };
}

function applyCamera(ctx: CanvasRenderingContext2D, cam: Camera, dpr: number): void {
  ctx.setTransform(cam.zoom * dpr, 0, 0, cam.zoom * dpr, cam.x * dpr, cam.y * dpr);
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, s: ReturnType<typeof readShape>): void {
  ctx.save();
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.strokeWidth;
  ctx.fillStyle = s.fill ?? "transparent";
  const x2 = s.x + s.w;
  const y2 = s.y + s.h;
  switch (s.kind) {
    case "rect":
      if (s.fill) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    case "arrow":
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = s.stroke;
      drawArrowHead(ctx, s.x, s.y, x2, y2, Math.max(8, s.strokeWidth * 3));
      break;
    case "text":
      ctx.font = `${Math.max(14, s.h)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = s.stroke;
      ctx.textBaseline = "top";
      ctx.fillText(s.text ?? "Text", s.x, s.y);
      break;
  }
  ctx.restore();
}

export function renderBoard(canvas: HTMLCanvasElement, opts: RenderBoardOpts): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { camera, dpr, strokes, shapes, notes, selection, lassoPath, previewShape } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.save();
  applyCamera(ctx, camera, dpr);

  // Grid hint in world space
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 / camera.zoom;
  const step = 64;
  const vw = canvas.clientWidth / camera.zoom;
  const vh = canvas.clientHeight / camera.zoom;
  const ox = -camera.x / camera.zoom;
  const oy = -camera.y / camera.zoom;
  for (let x = Math.floor(ox / step) * step; x < ox + vw; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + vh);
    ctx.stroke();
  }
  for (let y = Math.floor(oy / step) * step; y < oy + vh; y += step) {
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + vw, y);
    ctx.stroke();
  }

  const shapeList = [...shapes.values()].map(readShape).sort((a, b) => a.z - b.z);
  for (const sh of shapeList) drawShape(ctx, sh);

  for (const n of [...notes.values()].map(readNote).sort((a, b) => a.z - b.z)) {
    ctx.fillStyle = n.color;
    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 1 / camera.zoom;
    ctx.fillRect(n.x, n.y, n.w, n.h);
    ctx.strokeRect(n.x, n.y, n.w, n.h);
  }

  for (const s of strokes) {
    const { color, size, points, variant } = readStroke(s);
    const d = strokePath(points, size, variant);
    if (!d) continue;
    ctx.globalAlpha = variant === "highlighter" ? 0.35 : 1;
    ctx.fillStyle = color;
    ctx.fill(new Path2D(d));
    ctx.globalAlpha = 1;
  }

  if (previewShape) {
    drawShape(ctx, {
      id: "preview",
      kind: previewShape.kind as "rect",
      x: previewShape.x,
      y: previewShape.y,
      w: previewShape.w,
      h: previewShape.h,
      rotation: 0,
      stroke: previewShape.stroke,
      fill: null,
      strokeWidth: previewShape.strokeWidth,
      z: 0,
      authorId: "",
      createdAt: 0,
    });
  }

  if (lassoPath && lassoPath.length > 1) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
    ctx.beginPath();
    ctx.moveTo(lassoPath[0]!.x, lassoPath[0]!.y);
    for (let i = 1; i < lassoPath.length; i++) ctx.lineTo(lassoPath[i]!.x, lassoPath[i]!.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (selection && selection.length > 0) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / camera.zoom;
    for (const sel of selection) {
      if (sel.kind === "shape") {
        const sh = readShape(shapes.get(sel.id)!);
        ctx.strokeRect(sh.x - 4, sh.y - 4, sh.w + 8, sh.h + 8);
      } else if (sel.kind === "note") {
        const n = readNote(notes.get(sel.id)!);
        ctx.strokeRect(n.x - 4, n.y - 4, n.w + 8, n.h + 8);
      }
    }
  }

  ctx.restore();
}

/** Render full board to an offscreen canvas for export (no UI chrome). */
export function renderBoardToExport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opts: Omit<RenderBoardOpts, "camera" | "dpr" | "selection" | "lassoPath" | "previewShape">,
  padding = 32,
): HTMLCanvasElement {
  const w = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const h = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const cam = { x: padding - bounds.minX, y: padding - bounds.minY, zoom: 1 };
  renderBoard(off, { ...opts, camera: cam, dpr: 1, selection: undefined, lassoPath: undefined, previewShape: undefined });
  return off;
}
