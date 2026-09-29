import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { LockGuard } from "../src/lock-guard.js";
import {
  entityFingerprint,
  enforceLockedIdsCap,
  lockMetaChangesAuthorized,
  policyAllowsUpdate,
  validateLockedUpdate,
} from "../src/yjs-policy.js";

describe("yjs-policy", () => {
  it("allows updates when nothing is locked", () => {
    const live = new Y.Doc();
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(live));
    const guard = new LockGuard(live);
    const update = new Y.Doc();
    update.getArray(YKEYS.strokes).push([2]);
    const delta = Y.encodeStateAsUpdate(update);
    expect(policyAllowsUpdate(live, shadow, delta, guard)).toBe(true);
  });

  it("rejects updates that mutate a locked shape", () => {
    const doc = new Y.Doc();
    const shapes = doc.getMap(YKEYS.shapes);
    const shape = new Y.Map<unknown>();
    shape.set("id", "shape-1");
    shape.set("x", 10);
    shapes.set("shape-1", shape);
    doc.getMap(YKEYS.meta).set("lockedIds", ["shape-1"]);

    const trial = new Y.Doc();
    Y.applyUpdate(trial, Y.encodeStateAsUpdate(doc));
    const row = trial.getMap(YKEYS.shapes).get("shape-1");
    if (row instanceof Y.Map) row.set("x", 99);
    const bad = Y.encodeStateAsUpdate(trial, Y.encodeStateVector(doc));
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(doc));
    const guard = new LockGuard(doc);
    expect(validateLockedUpdate(doc, shadow, bad, guard)).toBe(false);
  });

  it("rejects meta updates that exceed lockedIds cap", () => {
    const live = new Y.Doc();
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(live));
    const guard = new LockGuard(live);
    const trial = new Y.Doc();
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    trial.getMap(YKEYS.meta).set("lockedIds", ids);
    const bad = Y.encodeStateAsUpdate(trial);
    expect(policyAllowsUpdate(live, shadow, bad, guard)).toBe(false);
  });

  it("rejects unlock by non-owner locker", () => {
    const live = new Y.Doc();
    live.getMap(YKEYS.meta).set("lockedIds", ["a"]);
    live.getMap(YKEYS.meta).set("lockOwners", { a: "user-a" });
    live.getMap(YKEYS.meta).set("ownerId", "owner-1");
    const shadow = new Y.Doc();
    Y.applyUpdate(shadow, Y.encodeStateAsUpdate(live));
    const guard = new LockGuard(live);
    const trial = new Y.Doc();
    Y.applyUpdate(trial, Y.encodeStateAsUpdate(live));
    trial.getMap(YKEYS.meta).set("lockedIds", []);
    trial.getMap(YKEYS.meta).set("lockOwners", {});
    const bad = Y.encodeStateAsUpdate(trial, Y.encodeStateVector(live));
    expect(validateLockedUpdate(live, shadow, bad, guard, 50, "user-b")).toBe(false);
    expect(lockMetaChangesAuthorized(guard.snapshot(), new LockGuard(trial), "user-a", "owner-1")).toBe(true);
  });

  it("fingerprints entities consistently", () => {
    const doc = new Y.Doc();
    const shape = new Y.Map<unknown>();
    shape.set("id", "a");
    shape.set("x", 1);
    doc.getMap(YKEYS.shapes).set("a", shape);
    expect(entityFingerprint(doc, "a")).toContain('"x":1');
  });
});
