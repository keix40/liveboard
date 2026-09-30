/** Display-only ink color (stored stroke color in Yjs is unchanged). */
const NEAR_BLACK = new Set([
  "#0f172a",
  "#111",
  "#111111",
  "#000",
  "#000000",
  "black",
  "rgb(0, 0, 0)",
  "rgb(15, 23, 42)",
]);

export function inkOnCanvas(stored: string, darkMode: boolean): string {
  if (!darkMode) return stored;
  const n = stored.trim().toLowerCase();
  if (NEAR_BLACK.has(n)) return "#f8fafc";
  return stored;
}

/** Display-only shape fill (preserves 8-digit hex alpha suffix). */
export function inkOnCanvasFill(stored: string | null, darkMode: boolean): string | null {
  if (stored == null) return null;
  if (!darkMode) return stored;
  const nine = stored.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  if (nine) {
    return inkOnCanvas(`#${nine[1]!}`, true) + nine[2]!.toLowerCase();
  }
  return inkOnCanvas(stored, darkMode);
}
