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

export interface ViewportInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Fit content bounds into the visible viewport (screen px), respecting chrome insets. */
export function fitBoundsToViewport(
  bounds: Bounds,
  viewportW: number,
  viewportH: number,
  padding = 48,
  insets: ViewportInsets = { top: 0, bottom: 0, left: 0, right: 0 },
): Camera {
  const innerW = Math.max(1, viewportW - insets.left - insets.right - padding * 2);
  const innerH = Math.max(1, viewportH - insets.top - insets.bottom - padding * 2);
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clampZoom(Math.min(innerW / bw, innerH / bh));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const visibleCx = insets.left + (viewportW - insets.left - insets.right) / 2;
  const visibleCy = insets.top + (viewportH - insets.top - insets.bottom) / 2;
  return {
    zoom,
    x: visibleCx - cx * zoom,
    y: visibleCy - cy * zoom,
  };
}
