/** Monotonic id for the current Node event-loop turn (used to batch rate-limit charges). */
let eventLoopTurn = 0;
if (typeof setImmediate !== "undefined") {
  const scheduleTurn = () => {
    setImmediate(() => {
      eventLoopTurn++;
      scheduleTurn();
    });
  };
  scheduleTurn();
}

export function currentEventLoopTurn(): number {
  return eventLoopTurn;
}

/** Classic token bucket: `burst` capacity, refilled at `perSec` tokens per second. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly perSec: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
  }

  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSec);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

/**
 * Charges at most one token bucket token per event-loop turn, even when many frames arrive in the
 * same tick (e.g. sync step + awareness burst).
 */
export class PerTurnTokenBucket {
  constructor(private readonly bucket: TokenBucket) {}

  take(client: { rateLimitTurn: number }): boolean {
    const turn = currentEventLoopTurn();
    if (client.rateLimitTurn === turn) return true;
    if (!this.bucket.take()) return false;
    client.rateLimitTurn = turn;
    return true;
  }
}

/** Fixed-window counter per key (e.g. client IP) for WebSocket upgrade attempts. */
export class WindowCounter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
