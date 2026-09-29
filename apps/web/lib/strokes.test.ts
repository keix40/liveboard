import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { writeBoardMeta } from "./board-meta";
import { beginStroke, eraseAt, extendStroke, flatToPoints, getStrokes, LOCAL_ORIGIN, readStroke, strokePath } from "./strokes";

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};

function runConcurrentDraw(order: "ab" | "ba", seed: number): void {
  let rng = seed;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };
  const a = new Y.Doc({ guid: "a" });
  const b = new Y.Doc({ guid: "b" });
  for (const doc of [a, b]) {
    writeBoardMeta(doc, { activePageId: "page-1", pageOrder: ["page-1"] }, LOCAL_ORIGIN);
  }
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

  const first = order === "ab" ? a : b;
  const second = order === "ab" ? b : a;
  const pa = beginStroke(first, {
    id: "s1",
    authorId: "a",
    color: "#f00",
    size: 6,
    first: [0, 0, 0.5],
    pageId: "page-1",
  });
  beginStroke(second, {
    id: "s2",
    authorId: "b",
    color: "#00f",
    size: 6,
    first: [50, 50, 0.5],
    pageId: "page-1",
  });
  const steps: Array<() => void> = [
    () => extendStroke(first, pa, [5, 5, 0.5]),
    () => sync(a, b),
    () => extendStroke(first, pa, [10, 10, 0.5]),
    () => sync(b, a),
  ];
  for (let i = steps.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = steps[i]!;
    steps[i] = steps[j]!;
    steps[j] = tmp;
  }
  for (const step of steps) step();
  sync(a, b);

  const ids = (d: Y.Doc) => getStrokes(d, "page-1").map((s) => readStroke(s).id).sort();
  expect(ids(a)).toEqual(["s1", "s2"]);
  expect(ids(b)).toEqual(ids(a));
  expect(readStroke(getStrokes(b, "page-1").toArray().find((s) => s.get("id") === "s1")!).points.length).toBeGreaterThan(0);
}

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
    for (const order of ["ab", "ba"] as const) {
      for (let seed = 0; seed < 50; seed++) {
        runConcurrentDraw(order, seed + 1);
      }
    }
  });

  it("erases strokes under the pointer", () => {
    const d = new Y.Doc();
    beginStroke(d, { id: "s1", authorId: "a", color: "#000", size: 4, first: [10, 10, 0.5] });
    beginStroke(d, { id: "s2", authorId: "a", color: "#000", size: 4, first: [200, 200, 0.5] });
    expect(eraseAt(d, 12, 12, 5)).toBe(1);
    expect(getStrokes(d).map((s) => s.get("id"))).toEqual(["s2"]);
  });
});
