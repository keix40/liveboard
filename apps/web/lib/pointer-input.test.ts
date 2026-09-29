import { describe, expect, it } from "vitest";
import { pinchMetrics } from "./pointer-input";

describe("pointer-input", () => {

  it("computes pinch distance", () => {
    const m = pinchMetrics({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(m.distance).toBe(5);
    expect(m.midX).toBe(1.5);
    expect(m.midY).toBe(2);
  });
});
