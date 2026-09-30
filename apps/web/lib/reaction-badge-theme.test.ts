import { describe, expect, it } from "vitest";
import { contrastRatio, reactionCountBadgeStyle } from "./reaction-badge-theme";

describe("reactionCountBadgeStyle", () => {
  it("meets WCAG AA contrast in light and dark board themes", () => {
    for (const darkMode of [false, true]) {
      const { pillBg, pillText } = reactionCountBadgeStyle(darkMode);
      expect(contrastRatio(pillText, pillBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
