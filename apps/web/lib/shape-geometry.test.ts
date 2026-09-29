import { describe, expect, it } from "vitest";
import { arrowHeadLength, arrowShaftEnd } from "./shape-geometry";

describe("arrow geometry", () => {
  it("shortens the shaft to the head base", () => {
    const head = arrowHeadLength(8);
    const base = arrowShaftEnd(0, 0, 100, 0, head);
    expect(base.x).toBeCloseTo(100 - head, 5);
    expect(base.y).toBeCloseTo(0, 5);
  });

  it("collapses shaft when shorter than head", () => {
    const head = arrowHeadLength(8);
    const base = arrowShaftEnd(0, 0, 5, 0, head);
    expect(base.x).toBe(0);
    expect(base.y).toBe(0);
  });
});
