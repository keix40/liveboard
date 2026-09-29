import type * as Y from "yjs";

/** True when every Yjs event only touched a stroke's nested `points` array (live ink). */
export function isStrokePointsOnlyUpdate(events: Y.YEvent<any>[]): boolean {
  if (events.length === 0) return false;
  return events.every((ev) => {
    const path = ev.path;
    return path.length >= 2 && path[path.length - 1] === "points";
  });
}

/** Stroke indices in the top-level strokes Y.Array that received point updates. */
export function strokeIndicesFromPointEvents(events: Y.YEvent<any>[]): number[] {
  const indices = new Set<number>();
  for (const ev of events) {
    if (ev.path.length >= 2 && ev.path[ev.path.length - 1] === "points" && typeof ev.path[0] === "number") {
      indices.add(ev.path[0]);
    }
  }
  return [...indices];
}

/** True when every event belongs to a local transaction (this client authored the edit). */
export function eventsAreLocal(events: Y.YEvent<any>[]): boolean {
  return events.length > 0 && events.every((ev) => ev.transaction.local);
}

/** Any stroke row touched (insert, delete, field change). */
export function strokeIndicesTouched(events: Y.YEvent<any>[]): number[] {
  const indices = new Set<number>();
  for (const ev of events) {
    if (typeof ev.path[0] === "number") indices.add(ev.path[0]);
  }
  return [...indices];
}
