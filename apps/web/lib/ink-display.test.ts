import { describe, expect, it } from "vitest";
import { inkOnCanvas } from "./ink-display";

describe("inkOnCanvas", () => {
  it("maps near-black ink to light in dark mode only", () => {
    expect(inkOnCanvas("#0f172a", false)).toBe("#0f172a");
    expect(inkOnCanvas("#0f172a", true)).toBe("#f8fafc");
    expect(inkOnCanvas("#ef4444", true)).toBe("#ef4444");
  });
});
