import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createStrokeHoldSession, SHAPE_SNAP_HOLD_MS } from "./stroke-hold";

describe("stroke hold (shape snap)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires hold without pointermove after arm", () => {
    const session = createStrokeHoldSession(500);
    session.arm();
    vi.advanceTimersByTime(SHAPE_SNAP_HOLD_MS);
    expect(session.finish()).toBe(true);
  });

  it("resets hold timer when the pointer moves", () => {
    const session = createStrokeHoldSession(500);
    session.arm();
    vi.advanceTimersByTime(400);
    session.onMove(true);
    vi.advanceTimersByTime(499);
    expect(session.isReady()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(session.finish()).toBe(true);
  });
});
