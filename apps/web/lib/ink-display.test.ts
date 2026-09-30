import { describe, expect, it } from "vitest";
import { inkOnCanvas, inkOnCanvasFill } from "./ink-display";

describe("inkOnCanvas", () => {
  it("maps near-black ink to light in dark mode only", () => {
    expect(inkOnCanvas("#0f172a", false)).toBe("#0f172a");
    expect(inkOnCanvas("#0f172a", true)).toBe("#f8fafc");
    expect(inkOnCanvas("#ef4444", true)).toBe("#ef4444");
  });

  it("maps near-black shape fills including alpha suffix", () => {
    expect(inkOnCanvasFill("#0f172a22", false)).toBe("#0f172a22");
    expect(inkOnCanvasFill("#0f172a22", true)).toBe("#f8fafc22");
    expect(inkOnCanvasFill(null, true)).toBe(null);
  });
});
