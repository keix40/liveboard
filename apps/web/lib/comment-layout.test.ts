import { describe, expect, it } from "vitest";
import { commentPinPosition, truncateCommentLabel } from "./comment-layout";

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
});
