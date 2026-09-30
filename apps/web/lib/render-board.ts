import type { Camera } from "./camera";
import { readStroke, strokePath, type YStroke } from "./strokes";
import { readShape, type YShape } from "./shapes";
import { readNote, type YNote } from "./notes";
import type { BoardBackground } from "@liveboard/shared";
import type { SelectableRef } from "./selection";
import type { BoardAsset } from "./assets";
import type { BoardReaction } from "./reactions";
import type { PinnedComment } from "./comments";
import { arrowHeadLength, arrowShaftEnd } from "./shape-geometry";

export interface RenderBoardOpts {
  camera: Camera;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
  strokes: YStroke[];
  shapes: Map<string, YShape>;
  notes: Map<string, YNote>;
  selection?: SelectableRef[];
  lassoPath?: { x: number; y: number }[];
  previewShape?: { kind: string; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number };
  /** Stroke indices to draw on the overlay (live ink); omitted from base when base excludes them. */
  liveStrokeIndices?: number[];
  excludeStrokeIndicesFromBase?: number[];
  background?: BoardBackground;
  darkMode?: boolean;
  assets?: Map<string, BoardAsset>;
  assetImages?: Map<string, CanvasImageSource>;
  reactions?: BoardReaction[];
  comments?: PinnedComment[];
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
    case "arrow": {
      const headLen = arrowHeadLength(s.strokeWidth);
      const base = arrowShaftEnd(s.x, s.y, x2, y2, headLen);
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(base.x, base.y);
      ctx.stroke();
      ctx.fillStyle = s.stroke;
      drawArrowHead(ctx, s.x, s.y, x2, y2, headLen);
      break;
    }
    case "text":
      ctx.font = `${Math.max(14, s.h)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = s.stroke;
      ctx.textBaseline = "top";
      ctx.fillText(s.text ?? "Text", s.x, s.y);
      break;
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
  background: BoardBackground,
  darkMode: boolean,
): void {
  const line = darkMode ? "#334155" : "#e2e8f0";
  const dot = darkMode ? "#475569" : "#cbd5e1";
  ctx.strokeStyle = line;
  ctx.fillStyle = dot;
  ctx.lineWidth = 1 / camera.zoom;
  const step = 64;
  const vw = cssWidth / camera.zoom;
  const vh = cssHeight / camera.zoom;
  const ox = -camera.x / camera.zoom;
  const oy = -camera.y / camera.zoom;
  if (background === "blank") {
    if (darkMode) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(ox, oy, vw, vh);
    }
    return;
  }
  if (background === "dots") {
    for (let x = Math.floor(ox / step) * step; x < ox + vw; x += step) {
      for (let y = Math.floor(oy / step) * step; y < oy + vh; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  if (background === "lined") {
    for (let y = Math.floor(oy / step) * step; y < oy + vh; y += step) {
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + vw, y);
      ctx.stroke();
    }
    return;
  }
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
}

function drawStrokeAt(ctx: CanvasRenderingContext2D, s: YStroke): void {
  const { color, size, points, variant } = readStroke(s);
  const d = strokePath(points, size, variant);
  if (!d) return;
  ctx.globalAlpha = variant === "highlighter" ? 0.35 : 1;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d));
  ctx.globalAlpha = 1;
}

/** Committed board content (grid, shapes, notes, strokes). */
export function renderBoardBase(ctx: CanvasRenderingContext2D, opts: RenderBoardOpts): void {
  const {
    camera,
    dpr,
    cssWidth,
    cssHeight,
    strokes,
    shapes,
    notes,
    excludeStrokeIndicesFromBase,
    background = "grid",
    darkMode = false,
    assets,
    assetImages,
  } = opts;
  const skip = new Set(excludeStrokeIndicesFromBase ?? []);
  ctx.save();
  applyCamera(ctx, camera, dpr);
  drawBackground(ctx, camera, cssWidth, cssHeight, background, darkMode);

  if (assets && assetImages) {
    const assetList = [...assets.values()].sort((a, b) => a.z - b.z);
    for (const a of assetList) {
      const img = assetImages.get(a.id);
      if (!img) continue;
      ctx.drawImage(img, a.x, a.y, a.w, a.h);
      if (a.locked) {
        ctx.strokeStyle = "rgb(100 116 139 / 0.55)";
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(a.x, a.y, a.w, a.h);
        ctx.setLineDash([]);
      }
    }
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

  strokes.forEach((s, i) => {
    if (!skip.has(i)) drawStrokeAt(ctx, s);
  });
  ctx.restore();
}

/** Ephemeral UI ink (live strokes, selection, lasso, shape preview). */
export function renderBoardOverlay(ctx: CanvasRenderingContext2D, opts: RenderBoardOpts): void {
  const { camera, dpr, strokes, shapes, notes, selection, lassoPath, previewShape, liveStrokeIndices } = opts;
  ctx.save();
  applyCamera(ctx, camera, dpr);

  if (liveStrokeIndices && liveStrokeIndices.length > 0) {
    for (const i of liveStrokeIndices) {
      const s = strokes[i];
      if (s) drawStrokeAt(ctx, s);
    }
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

  if (opts.reactions?.length) {
    ctx.font = `${16 / camera.zoom}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of opts.reactions) {
      const count = r.count ?? 1;
      if (count > 1) {
        ctx.fillText(r.emoji, r.x, r.y);
        ctx.font = `${10 / camera.zoom}px system-ui, sans-serif`;
        ctx.fillText(String(count), r.x + 10 / camera.zoom, r.y - 8 / camera.zoom);
        ctx.font = `${16 / camera.zoom}px system-ui, sans-serif`;
      } else {
        ctx.fillText(r.emoji, r.x, r.y);
      }
    }
  }
  if (opts.comments?.length) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = opts.darkMode ? "#f8fafc" : "#0f172a";
    for (const c of opts.comments) {
      if (!c.pinned) continue;
      ctx.fillStyle = opts.darkMode ? "#1e293b" : "#ffffff";
      ctx.strokeStyle = opts.darkMode ? "#64748b" : "#94a3b8";
      ctx.lineWidth = 1 / camera.zoom;
      const w = 28 / camera.zoom;
      const h = 22 / camera.zoom;
      ctx.fillRect(c.x, c.y, w, h);
      ctx.strokeRect(c.x, c.y, w, h);
      ctx.fillStyle = opts.darkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = `${10 / camera.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("💬", c.x + w / 2, c.y + h / 2);
      const label = c.text.length > 48 ? `${c.text.slice(0, 45)}…` : c.text;
      ctx.textAlign = "left";
      ctx.font = `${11 / camera.zoom}px system-ui, sans-serif`;
      ctx.fillStyle = opts.darkMode ? "#e2e8f0" : "#334155";
      ctx.fillText(label, c.x, c.y + h + 14 / camera.zoom);
    }
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
      } else if (sel.kind === "asset" && opts.assets) {
        const a = opts.assets.get(sel.id);
        if (a) ctx.strokeRect(a.x - 4, a.y - 4, a.w + 8, a.h + 8);
      }
    }
  }

  ctx.restore();
}

/** Full single-canvas render (export / tests). */
export function renderBoard(canvas: HTMLCanvasElement, opts: Omit<RenderBoardOpts, "cssWidth" | "cssHeight"> & { cssWidth?: number; cssHeight?: number }): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cssWidth = opts.cssWidth ?? canvas.clientWidth;
  const cssHeight = opts.cssHeight ?? canvas.clientHeight;
  const full: RenderBoardOpts = { ...opts, cssWidth, cssHeight };
  ctx.setTransform(opts.dpr, 0, 0, opts.dpr, 0, 0);
  ctx.fillStyle = full.darkMode ? "#0f172a" : "#f8fafc";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  renderBoardBase(ctx, full);
  renderBoardOverlay(ctx, full);
}

/** Render full board to an offscreen canvas for export (no UI chrome). */
export function renderBoardToExport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  opts: Omit<RenderBoardOpts, "camera" | "dpr" | "cssWidth" | "cssHeight" | "selection" | "lassoPath" | "previewShape">,
  padding = 32,
): HTMLCanvasElement {
  const w = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const h = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const cam = { x: padding - bounds.minX, y: padding - bounds.minY, zoom: 1 };
  renderBoard(off, { ...opts, camera: cam, dpr: 1, cssWidth: w, cssHeight: h, selection: undefined, lassoPath: undefined, previewShape: undefined });
  return off;
}
