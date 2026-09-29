import type { BoardFrame } from "@liveboard/shared";
import type { Camera } from "./camera";
import { readBoardMeta, writeBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";
import type * as Y from "yjs";

export function listFrames(doc: Y.Doc): BoardFrame[] {
  return readBoardMeta(doc).frames;
}

export function addFrame(
  doc: Y.Doc,
  frame: Omit<BoardFrame, "id"> & { id?: string },
  origin: symbol,
): BoardFrame {
  const meta = readBoardMeta(doc);
  const entry: BoardFrame = {
    id: frame.id ?? crypto.randomUUID(),
    name: frame.name,
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
  };
  writeBoardMeta(doc, { frames: [...meta.frames, entry] }, origin);
  return entry;
}

export function frameFromViewport(
  doc: Y.Doc,
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
  name: string,
): BoardFrame {
  const w = cssWidth / camera.zoom;
  const h = cssHeight / camera.zoom;
  const x = -camera.x / camera.zoom;
  const y = -camera.y / camera.zoom;
  return addFrame(doc, { name, x, y, w, h }, LOCAL_ORIGIN);
}

export function cameraForFrame(frame: BoardFrame, cssWidth: number, cssHeight: number): Camera {
  const zoom = Math.min(cssWidth / frame.w, cssHeight / frame.h) * 0.92;
  return {
    x: -frame.x * zoom + (cssWidth - frame.w * zoom) / 2,
    y: -frame.y * zoom + (cssHeight - frame.h * zoom) / 2,
    zoom,
  };
}

export function frameBounds(frame: BoardFrame) {
  return { minX: frame.x, minY: frame.y, maxX: frame.x + frame.w, maxY: frame.y + frame.h };
}
