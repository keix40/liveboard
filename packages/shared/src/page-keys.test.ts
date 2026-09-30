import { describe, expect, it } from "vitest";
import { pageSocialKey } from "./page-keys.js";

describe("pageSocialKey", () => {
  it("maps page-1 to legacy social keys", () => {
    expect(pageSocialKey("comments", "page-1")).toBe("comments");
    expect(pageSocialKey("reactions", "page-1")).toBe("reactions");
  });

  it("suffixes other pages", () => {
    expect(pageSocialKey("comments", "page-abc")).toBe("comments:page-abc");
  });
});
