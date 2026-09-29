import { describe, expect, it } from "vitest";
import {
  createPenSessionState,
  onPenPointerDown,
  onPenPointerUp,
  shouldIgnoreTouchPointer,
  PEN_TOUCH_COOLDOWN_MS,
} from "./pointer-session";

describe("pointer-session", () => {
  it("blocks touch while pen is down and during cooldown", () => {
    const s = createPenSessionState();
    onPenPointerDown(s);
    expect(shouldIgnoreTouchPointer("touch", s)).toBe(true);
    onPenPointerUp(s, 1000);
    expect(shouldIgnoreTouchPointer("touch", s, 1000)).toBe(true);
    expect(shouldIgnoreTouchPointer("touch", s, 1000 + PEN_TOUCH_COOLDOWN_MS)).toBe(false);
  });

  it("does not block pen or mouse", () => {
    const s = createPenSessionState();
    onPenPointerDown(s);
    expect(shouldIgnoreTouchPointer("pen", s)).toBe(false);
    expect(shouldIgnoreTouchPointer("mouse", s)).toBe(false);
  });
});
