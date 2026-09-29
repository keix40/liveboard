import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { MAX_LOCKED_IDS, YKEYS } from "@liveboard/shared";
import { LockGuard } from "../src/lock-guard.js";
import { enforceLockedIdsCap, validateLockedUpdate } from "../src/yjs-policy.js";

describe("lock guard performance", () => {
  it("validates pen updates under 5ms with 5k strokes and 20 locked items", () => {
    const live = new Y.Doc({ gc: true });
    const shadow = new Y.Doc({ gc: true });
    const strokes = live.getArray(YKEYS.strokes);
    const locked: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const m = new Y.Map<unknown>();
      const id = `s-${i}`;
      m.set("id", id);
      m.set("points", new Y.Array());
      strokes.push([m]);
      if (i < 20) locked.push(id);
    }
    live.getMap(YKEYS.meta).set("lockedIds", locked);
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(live));
    const guard = new LockGuard(live);

    const beforeSv = Y.encodeStateVector(live);
    const row = strokes.get(4999)! as Y.Map<unknown>;
    const pts = row.get("points") as Y.Array<number>;
    pts.push([1, 1, 0.5]);
    const update = Y.encodeStateAsUpdate(live, beforeSv);

    for (let i = 0; i < 5; i++) {
      expect(validateLockedUpdate(live, shadow, update, guard, 500)).toBe(true);
    }
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      validateLockedUpdate(live, shadow, update, guard, 500);
    }
    const per = (performance.now() - t0) / 20;
    const limitMs = process.env.CI ? 20 : 5;
    expect(per).toBeLessThan(limitMs);
  });

  it("rejects lockedIds above cap", () => {
    const doc = new Y.Doc();
    const ids = Array.from({ length: MAX_LOCKED_IDS + 1 }, (_, i) => `x-${i}`);
    doc.getMap(YKEYS.meta).set("lockedIds", ids);
    expect(enforceLockedIdsCap(doc)).toBe(false);
  });
});
