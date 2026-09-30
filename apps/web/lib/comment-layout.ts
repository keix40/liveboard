import type { Camera } from "./camera";
import { screenToWorld } from "./camera";

/** Spiral pin positions so new comments stay separated in world space. */
export function commentPinPosition(seed: { x: number; y: number }, index: number): { x: number; y: number } {
  if (index <= 0) return { x: seed.x, y: seed.y };
  const ring = Math.ceil(index / 6);
  const slot = index % 6;
  const angle = (slot / 6) * Math.PI * 2 + ring * 0.35;
  const radius = 96 + (ring - 1) * 104;
  return {
    x: seed.x + Math.cos(angle) * radius,
    y: seed.y + Math.sin(angle) * radius,
  };
}

export const COMMENT_VIEWPORT_FALLBACK_CSS = { width: 960, height: 640 };

/** World point at viewport center; uses fallback CSS size when canvas is not laid out yet. */
export function viewportCommentSeed(
  camera: Camera,
  canvasCssWidth: number,
  canvasCssHeight: number,
): { x: number; y: number } {
  const w = canvasCssWidth > 0 ? canvasCssWidth : COMMENT_VIEWPORT_FALLBACK_CSS.width;
  const h = canvasCssHeight > 0 ? canvasCssHeight : COMMENT_VIEWPORT_FALLBACK_CSS.height;
  return screenToWorld(camera, w / 2, h / 2);
}

export function truncateCommentLabel(text: string, maxLen = 36): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export interface PinnedCommentForLayout {
  id: string;
  x: number;
  y: number;
  text: string;
  pinned: boolean;
}

export interface CommentLabelLayout {
  labelX: number;
  labelY: number;
  anchorX: number;
  anchorY: number;
  showLeader: boolean;
  labelW: number;
  labelH: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/** Label stays beside its pin; nudge down on collision and draw a leader when offset. */
export function layoutPinnedCommentLabels(
  comments: PinnedCommentForLayout[],
  zoom: number,
): Map<string, CommentLabelLayout> {
  const out = new Map<string, CommentLabelLayout>();
  const placed: Rect[] = [];
  const pinW = 28 / zoom;
  const pinH = 22 / zoom;
  const gap = 6 / zoom;
  const lineH = 14 / zoom;
  const charW = 6.2 / zoom;

  const sorted = [...comments].filter((c) => c.pinned).sort((a, b) => a.y - b.y || a.x - b.x);

  for (const c of sorted) {
    const label = truncateCommentLabel(c.text, 28);
    const labelW = Math.max(24 / zoom, label.length * charW);
    const labelH = lineH;
    const anchorX = c.x + pinW / 2;
    const anchorY = c.y + pinH;
    let labelX = c.x;
    let labelY = c.y + pinH + gap;
    let showLeader = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      const rect: Rect = { x: labelX, y: labelY, w: labelW, h: labelH };
      if (!placed.some((p) => rectsOverlap(rect, p, gap))) {
        placed.push(rect);
        break;
      }
      labelY += labelH + gap;
      showLeader = true;
    }

    out.set(c.id, {
      labelX,
      labelY,
      anchorX,
      anchorY,
      showLeader,
      labelW,
      labelH,
    });
  }

  return out;
}
