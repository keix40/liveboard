import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncWatchdog } from "./sync-watchdog";

describe("createSyncWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries until maxAttempts then gives up", () => {
    const onRetry = vi.fn();
    const onGiveUp = vi.fn();
    const wd = createSyncWatchdog({ timeoutMs: 5_000, maxAttempts: 3, onRetry, onGiveUp });

    wd.armConnecting();
    vi.advanceTimersByTime(5_000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(onRetry).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5_000);
    expect(onRetry).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(5_000);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it("clears when sync succeeds", () => {
    const onGiveUp = vi.fn();
    const wd = createSyncWatchdog({ timeoutMs: 5_000, maxAttempts: 3, onRetry: () => {}, onGiveUp });
    wd.armConnecting();
    wd.notifySynced();
    vi.advanceTimersByTime(20_000);
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});
