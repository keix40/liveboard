/** Canvas reaction count badge (WCAG AA: ≥4.5:1 text on pill). */
export interface ReactionCountBadgeStyle {
  pillBg: string;
  pillText: string;
}

export function reactionCountBadgeStyle(darkMode: boolean): ReactionCountBadgeStyle {
  return darkMode
    ? { pillBg: "#f1f5f9", pillText: "#0f172a" }
    : { pillBg: "#1e293b", pillText: "#f8fafc" };
}

/** sRGB relative luminance (WCAG 2.x). */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const channels = [0, 2, 4].map((i) => {
    const c = Number.parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
