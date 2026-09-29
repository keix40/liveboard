/** 2D camera: pan (x,y) and uniform zoom. Board content lives in world space. */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 8;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Screen (CSS px) → world coordinates. */
export function screenToWorld(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom };
}

/** World → screen (CSS px). */
export function worldToScreen(cam: Camera, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * cam.zoom + cam.x, y: wy * cam.zoom + cam.y };
}

/** Zoom toward a screen anchor point (pinch center, wheel cursor, buttons). */
export function zoomAt(cam: Camera, nextZoom: number, anchorSx: number, anchorSy: number): Camera {
  const z = clampZoom(nextZoom);
  const before = screenToWorld(cam, anchorSx, anchorSy);
  const x = anchorSx - before.x * z;
  const y = anchorSy - before.y * z;
  return { x, y, zoom: z };
}

export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsFromPoints(points: { x: number; y: number }[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Fit content bounds into viewport with padding (screen px). */
export function fitBoundsToViewport(
  bounds: Bounds,
  viewportW: number,
  viewportH: number,
  padding = 48,
): Camera {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clampZoom(Math.min((viewportW - padding * 2) / bw, (viewportH - padding * 2) / bh));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    x: viewportW / 2 - cx * zoom,
    y: viewportH / 2 - cy * zoom,
  };
}
