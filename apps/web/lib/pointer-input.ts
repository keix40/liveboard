import type { Point } from "@liveboard/shared";

export type InputKind = "draw" | "pan" | "pinch" | "ignore";

/** Whether this pointer should participate in drawing (palm rejection when pen is active). */
export function shouldDrawWithPointer(
  pointerType: string,
  penActive: boolean,
): boolean {
  if (pointerType === "pen") return true;
  if (penActive && pointerType === "touch") return false;
  return pointerType === "mouse" || pointerType === "touch";
}

export function pressureFromEvent(e: { pressure: number; pointerType: string; buttons: number }): number {
  if (e.pointerType === "mouse") return e.buttons ? 0.5 : 0;
  if (e.pressure > 0) return e.pressure;
  return 0.5;
}

/** Collect coalesced + current event samples in order (Pointer Events spec). */
export function coalescedPointerPoints(
  e: PointerEvent,
  toLocal: (clientX: number, clientY: number) => { x: number; y: number },
): Point[] {
  const events =
    typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];
  const out: Point[] = [];
  for (const ev of events) {
    const { x, y } = toLocal(ev.clientX, ev.clientY);
    out.push([x, y, pressureFromEvent(ev)]);
  }
  return out;
}

/** Two-finger pinch: distance and midpoint in screen space. */
export function pinchMetrics(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { distance: number; midX: number; midY: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { distance: Math.hypot(dx, dy), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
}
