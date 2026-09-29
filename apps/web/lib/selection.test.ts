import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { beginStroke, getStrokes } from "./strokes";
import { upsertShape, getShapes } from "./shapes";
import { lassoSelect, pickAt } from "./selection";

describe("selection", () => {
  it("picks topmost stroke", () => {
    const doc = new Y.Doc();
    beginStroke(doc, {
      id: "s1",
      authorId: "u",
      color: "#000",
      size: 8,
      first: [10, 10, 0.5],
    });
    const strokes = getStrokes(doc);
    const hit = pickAt(strokes.toArray(), getShapes(doc), new Map(), 10, 10);
    expect(hit).toEqual({ kind: "stroke", id: "s1" });
  });

  it("lasso selects stroke inside polygon", () => {
    const doc = new Y.Doc();
    beginStroke(doc, {
      id: "s1",
      authorId: "u",
      color: "#000",
      size: 8,
      first: [50, 50, 0.5],
    });
    upsertShape(doc, {
      id: "sh1",
      kind: "rect",
      x: 200,
      y: 200,
      w: 10,
      h: 10,
      rotation: 0,
      stroke: "#000",
      fill: null,
      strokeWidth: 2,
      z: 1,
      authorId: "u",
      createdAt: 1,
    });
    const poly = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const hits = lassoSelect(getStrokes(doc).toArray(), getShapes(doc), new Map(), poly);
    expect(hits).toContainEqual({ kind: "stroke", id: "s1" });
    expect(hits.find((h) => h.id === "sh1")).toBeUndefined();
  });
});
