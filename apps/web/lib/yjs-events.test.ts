import { describe, expect, it } from "vitest";
import { eventsAreLocal, isStrokePointsOnlyUpdate } from "./yjs-events";

describe("yjs-events", () => {
  it("detects points-only deep updates", () => {
    const events = [{ path: [2, "points"] }, { path: [2, "points"] }] as never;
    expect(isStrokePointsOnlyUpdate(events)).toBe(true);
    const mixed = [{ path: [2, "points"] }, { path: [3, "color"] }] as never;
    expect(isStrokePointsOnlyUpdate(mixed)).toBe(false);
  });

  it("detects local-only transactions", () => {
    const local = [{ transaction: { local: true } }, { transaction: { local: true } }] as never;
    const remote = [{ transaction: { local: false } }] as never;
    expect(eventsAreLocal(local)).toBe(true);
    expect(eventsAreLocal(remote)).toBe(false);
  });
});
