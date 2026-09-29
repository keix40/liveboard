import { describe, expect, it } from "vitest";
import { hitShape } from "./shapes";

describe("shapes", () => {
  it("hits line-like shapes along the segment, not the bounding box diagonal", () => {
    const arrow = {
      id: "a",
      kind: "arrow" as const,
      x: 100,
      y: 100,
      w: 120,
      h: -40,
      rotation: 0,
      stroke: "#000",
      fill: null,
      strokeWidth: 4,
      z: 0,
      authorId: "",
      createdAt: 0,
    };
    expect(hitShape(arrow, 160, 80, 4)).toBe(true);
    expect(hitShape(arrow, 100, 100, 4)).toBe(true);
    expect(hitShape(arrow, 220, 60, 4)).toBe(true);
    expect(hitShape(arrow, 160, 120, 4)).toBe(false);
  });
});
