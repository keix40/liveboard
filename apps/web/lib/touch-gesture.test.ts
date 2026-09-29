import { describe, expect, it } from "vitest";
import type { Tool } from "@liveboard/shared";

function isPanGesture(tool: Tool, pointerType: string, touchCount: number): boolean {
  if (tool === "pan") return true;
  if (pointerType === "touch" && touchCount >= 2) return true;
  return false;
}

describe("touch gestures", () => {
  it("single touch with pen tool draws (does not pan)", () => {
    expect(isPanGesture("pen", "touch", 1)).toBe(false);
    expect(isPanGesture("highlighter", "touch", 1)).toBe(false);
  });

  it("two-finger touch always pans/zooms", () => {
    expect(isPanGesture("pen", "touch", 2)).toBe(true);
  });

  it("pan tool pans with one pointer", () => {
    expect(isPanGesture("pan", "mouse", 1)).toBe(true);
    expect(isPanGesture("pan", "touch", 1)).toBe(true);
  });
});
