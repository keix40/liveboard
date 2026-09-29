import { describe, expect, it } from "vitest";
import { PerTurnTokenBucket, TokenBucket } from "../src/rate-limit.js";

describe("PerTurnTokenBucket", () => {
  it("charges at most one token per event-loop turn", async () => {
    const bucket = new TokenBucket(60, 1);
    const limiter = new PerTurnTokenBucket(bucket);
    const client = { rateLimitTurn: -1 };

    expect(limiter.take(client)).toBe(true);
    expect(limiter.take(client)).toBe(true);

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(limiter.take(client)).toBe(false);
  });
});
