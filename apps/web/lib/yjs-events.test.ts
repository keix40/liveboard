import { describe, expect, it } from "vitest";
import { isStrokePointsOnlyUpdate } from "./yjs-events";

describe("yjs-events", () => {
  it("detects points-only deep updates", () => {
    const events = [{ path: [2, "points"] }, { path: [2, "points"] }] as never;
    expect(isStrokePointsOnlyUpdate(events)).toBe(true);
    const mixed = [{ path: [2, "points"] }, { path: [3, "color"] }] as never;
    expect(isStrokePointsOnlyUpdate(mixed)).toBe(false);
  });
});
