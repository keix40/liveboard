import { describe, expect, it } from "vitest";
import { stabilizePoint } from "./stroke-stabilizer";

describe("stroke-stabilizer", () => {
  it("returns raw point when smoothing is off", () => {
    const next: [number, number, number] = [10, 20, 0.5];
    expect(stabilizePoint([], next, 0)).toEqual(next);
  });

  it("smooths but caller can append true pen-up separately", () => {
    const history: [number, number, number][] = [[0, 0, 0.5]];
    const end: [number, number, number] = [100, 0, 0.5];
    const smoothed = stabilizePoint(history, end, 0.8);
    expect(smoothed[0]).toBeLessThan(100);
    expect(end[0]).toBe(100);
  });
});
