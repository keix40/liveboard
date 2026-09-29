import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { YKEYS } from "@liveboard/shared";
import { entityFingerprint, policyAllowsUpdate } from "../src/yjs-policy.js";

describe("yjs-policy", () => {
  it("allows updates when nothing is locked", () => {
    const doc = new Y.Doc();
    doc.getArray(YKEYS.strokes).push([1]);
    const update = new Y.Doc();
    update.getArray(YKEYS.strokes).push([2]);
    const delta = Y.encodeStateAsUpdate(update);
    expect(policyAllowsUpdate(doc, delta)).toBe(true);
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
    expect(policyAllowsUpdate(doc, bad)).toBe(false);
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
