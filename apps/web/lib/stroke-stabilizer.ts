import type { Point } from "@liveboard/shared";

/** 0 = off, 1 = maximum smoothing. */
export function stabilizePoint(history: Point[], next: Point, amount: number): Point {
  if (amount <= 0.01 || history.length === 0) return next;
  const prev = history[history.length - 1]!;
  const t = Math.min(0.92, 0.35 + amount * 0.55);
  return [
    prev[0] + (next[0] - prev[0]) * (1 - t),
    prev[1] + (next[1] - prev[1]) * (1 - t),
    next[2],
  ];
}
