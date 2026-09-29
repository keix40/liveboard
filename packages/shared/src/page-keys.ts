/** Top-level Yjs keys for page content (page-1 uses legacy names for rollout compatibility). */

export const DEFAULT_PAGE_ID = "page-1";

export type PageContentKind = "strokes" | "shapes" | "notes" | "assets";

const LEGACY: Record<PageContentKind, string> = {
  strokes: "strokes",
  shapes: "shapes",
  notes: "notes",
  assets: "assets",
};

export function pageContentKey(kind: PageContentKind, pageId: string): string {
  if (pageId === DEFAULT_PAGE_ID) return LEGACY[kind];
  return `${kind}:${pageId}`;
}

/** All content keys present on the doc (for scans / fingerprints). */
export function allPageContentKeys(docShareKeys: Iterable<string>): string[] {
  const keys = new Set<string>();
  for (const k of docShareKeys) {
    if (k === LEGACY.strokes || k === LEGACY.shapes || k === LEGACY.notes || k === LEGACY.assets) {
      keys.add(k);
    } else if (/^(strokes|shapes|notes|assets):/.test(k)) {
      keys.add(k);
    }
  }
  return [...keys];
}

export function pageIdFromContentKey(key: string, kind: PageContentKind): string | null {
  if (key === LEGACY[kind]) return DEFAULT_PAGE_ID;
  const prefix = `${kind}:`;
  if (key.startsWith(prefix)) return key.slice(prefix.length);
  return null;
}
