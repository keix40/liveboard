import { describe, expect, it } from "vitest";
import { recognizeStrokeShape } from "./shape-recognize";

describe("recognizeStrokeShape", () => {
  it("recognizes a straight line as arrow/line", () => {
    const points = Array.from({ length: 20 }, (_, i) => [i * 10, i * 2, 0.5] as const);
    const r = recognizeStrokeShape([...points]);
    expect(r).not.toBeNull();
    expect(r!.confidence).toBeGreaterThan(0.7);
    expect(["line", "arrow"]).toContain(r!.kind);
  });
});
