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
