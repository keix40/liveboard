import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { StrokePointBatcher } from "./stroke-batcher";

describe("StrokePointBatcher", () => {
  it("coalesces multiple samples into one Yjs update per animation frame", () => {
    let rafCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    const doc = new Y.Doc();
    const points = new Y.Array<number>();
    doc.getArray("strokes").push([new Y.Map([["points", points]])]);
    let updateCount = 0;
    doc.on("update", () => updateCount++);

    const batcher = new StrokePointBatcher(doc, points);
    batcher.push([1, 2, 0.5]);
    batcher.push([3, 4, 0.7]);
    batcher.push([5, 6, 0.5]);
    expect(points.length).toBe(0);
    rafCb?.(0);

    expect(points.toArray()).toEqual([1, 2, 0.5, 3, 4, 0.7, 5, 6, 0.5]);
    expect(updateCount).toBe(1);
    batcher.dispose();
    vi.unstubAllGlobals();
  });
});
