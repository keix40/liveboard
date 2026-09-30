/** Spiral pin positions so new comments stay separated in world space. */
export function commentPinPosition(seed: { x: number; y: number }, index: number): { x: number; y: number } {
  if (index <= 0) return { x: seed.x, y: seed.y };
  const ring = Math.ceil(index / 6);
  const slot = index % 6;
  const angle = (slot / 6) * Math.PI * 2 + ring * 0.35;
  const radius = 72 + (ring - 1) * 88;
  return {
    x: seed.x + Math.cos(angle) * radius,
    y: seed.y + Math.sin(angle) * radius,
  };
}

export function truncateCommentLabel(text: string, maxLen = 36): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
