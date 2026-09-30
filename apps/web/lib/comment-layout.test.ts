import { describe, expect, it } from "vitest";
import {
  commentPinPosition,
  layoutPinnedCommentLabels,
  truncateCommentLabel,
  viewportCommentSeed,
} from "./comment-layout";

describe("comment layout", () => {
  it("spirals pin positions away from the seed", () => {
    const seed = { x: 100, y: 200 };
    const a = commentPinPosition(seed, 0);
    const b = commentPinPosition(seed, 1);
    expect(a).toEqual(seed);
    expect(Math.hypot(b.x - seed.x, b.y - seed.y)).toBeGreaterThan(50);
  });

  it("truncates long labels", () => {
    expect(truncateCommentLabel("short")).toBe("short");
    expect(truncateCommentLabel("x".repeat(40)).length).toBeLessThanOrEqual(36);
  });

  it("viewportCommentSeed avoids origin when canvas size is zero", () => {
    const seed = viewportCommentSeed({ x: 0, y: 0, zoom: 1 }, 0, 0);
    expect(seed.x).not.toBe(0);
    expect(seed.y).not.toBe(0);
  });

  it("keeps labels near pins and separates overlapping label boxes", () => {
    const zoom = 1;
    const layouts = layoutPinnedCommentLabels(
      [
        { id: "a", x: 10, y: 10, text: "First long comment text here", pinned: true },
        { id: "b", x: 12, y: 10, text: "Second long comment text here", pinned: true },
      ],
      zoom,
    );
    const a = layouts.get("a")!;
    const b = layouts.get("b")!;
    expect(a.labelY).toBeGreaterThanOrEqual(10 + 22 / zoom);
    expect(b.labelY).toBeGreaterThan(a.labelY);
    expect(b.showLeader).toBe(true);
  });
});
