import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { beginStroke, getStrokes, LOCAL_ORIGIN } from "./strokes";
import { eraseAtWorld } from "./board-erase";
import { upsertShape, getShapes } from "./shapes";

describe("undo stack", () => {
  it("undo after erasing one stroke restores both strokes", () => {
    const doc = new Y.Doc();
    const strokes = getStrokes(doc);
    const undo = new Y.UndoManager(strokes, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 300,
    });

    undo.stopCapturing();
    beginStroke(doc, { id: "a", authorId: "u", color: "#000", size: 4, first: [0, 0, 0.5] });
    undo.stopCapturing();
    beginStroke(doc, { id: "b", authorId: "u", color: "#000", size: 4, first: [10, 10, 0.5] });
    expect(strokes.length).toBe(2);

    undo.stopCapturing();
    eraseAtWorld(doc, 10, 10, 8);
    expect(strokes.length).toBe(1);

    undo.undo();
    expect(strokes.length).toBe(2);
  });

  it("undoing shape creation removes the map entry entirely", () => {
    const doc = new Y.Doc();
    const shapes = getShapes(doc);
    const undo = new Y.UndoManager(shapes, { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 300 });
    undo.stopCapturing();
    upsertShape(doc, {
      id: "s1",
      kind: "rect",
      x: 0,
      y: 0,
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
    expect(shapes.size).toBe(1);
    undo.undo();
    expect(shapes.size).toBe(0);
  });
});
