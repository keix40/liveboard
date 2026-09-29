/** Pen vs touch: palm rejection and stroke pointer ownership. */

export const PEN_TOUCH_COOLDOWN_MS = 450;

export interface PenSessionState {
  penDown: boolean;
  touchBlockedUntil: number;
}

export function createPenSessionState(): PenSessionState {
  return { penDown: false, touchBlockedUntil: 0 };
}

export function onPenPointerDown(state: PenSessionState): void {
  state.penDown = true;
}

export function onPenPointerUp(state: PenSessionState, now = Date.now()): void {
  state.penDown = false;
  state.touchBlockedUntil = now + PEN_TOUCH_COOLDOWN_MS;
}

/** While pen is down or shortly after, ignore every touch pointer for drawing/pan. */
export function isTouchBlocked(state: PenSessionState, now = Date.now()): boolean {
  return state.penDown || now < state.touchBlockedUntil;
}

export function shouldIgnoreTouchPointer(
  pointerType: string,
  state: PenSessionState,
  now = Date.now(),
): boolean {
  return pointerType === "touch" && isTouchBlocked(state, now);
}
