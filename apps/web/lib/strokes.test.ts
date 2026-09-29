import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { beginStroke, eraseAt, extendStroke, flatToPoints, getStrokes, readStroke, strokePath } from "./strokes";

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};

describe("strokes", () => {
  it("unflattens x,y,p triples", () => {
    expect(flatToPoints([1, 2, 0.5, 3, 4, 0.7, 9])).toEqual([
      [1, 2, 0.5],
      [3, 4, 0.7],
    ]);
  });

  it("builds a closed SVG path", () => {
    const d = strokePath(
      [
        [0, 0, 0.5],
        [10, 10, 0.5],
        [20, 5, 0.5],
      ],
      8,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("converges when two peers draw concurrently (CRDT)", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const pa = beginStroke(a, { id: "s1", authorId: "a", color: "#f00", size: 6, first: [0, 0, 0.5] });
    beginStroke(b, { id: "s2", authorId: "b", color: "#00f", size: 6, first: [50, 50, 0.5] });
    extendStroke(a, pa, [5, 5, 0.5]);
    sync(a, b);
    const ids = (d: Y.Doc) => getStrokes(d).map((s) => readStroke(s).id).sort();
    expect(ids(a)).toEqual(["s1", "s2"]);
    expect(ids(b)).toEqual(ids(a));
    expect(readStroke(getStrokes(b).toArray().find((s) => s.get("id") === "s1")!).points).toHaveLength(2);
  });

  it("erases strokes under the pointer", () => {
    const d = new Y.Doc();
    beginStroke(d, { id: "s1", authorId: "a", color: "#000", size: 4, first: [10, 10, 0.5] });
    beginStroke(d, { id: "s2", authorId: "a", color: "#000", size: 4, first: [200, 200, 0.5] });
    expect(eraseAt(d, 12, 12, 5)).toBe(1);
    expect(getStrokes(d).map((s) => s.get("id"))).toEqual(["s2"]);
  });
});
