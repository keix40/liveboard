/** Shape snap: fire after the pointer stays down without meaningful movement. */
export const SHAPE_SNAP_HOLD_MS = 500;

export interface StrokeHoldSession {
  arm(): void;
  onMove(moved: boolean): void;
  /** Whether the hold timer has fired (does not clear state). */
  isReady(): boolean;
  finish(): boolean;
  dispose(): void;
}

export function createStrokeHoldSession(holdMs = SHAPE_SNAP_HOLD_MS): StrokeHoldSession {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let held = false;

  const disarm = () => {
    if (timer != null) clearTimeout(timer);
    timer = null;
  };

  return {
    arm() {
      disarm();
      held = false;
      timer = setTimeout(() => {
        held = true;
      }, holdMs);
    },
    onMove(moved: boolean) {
      if (moved) this.arm();
    },
    isReady() {
      return held;
    },
    finish() {
      const result = held;
      disarm();
      held = false;
      return result;
    },
    dispose() {
      disarm();
      held = false;
    },
  };
}
