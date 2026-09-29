const MAX_KEYS = 10_000;

const buckets = new Map<string, { count: number; reset: number }>();

/** Bounded in-memory rate limiter (per IP+room). */
export function tokenRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    const drop = Math.floor(MAX_KEYS / 10);
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= drop) break;
    }
  }
  const row = buckets.get(key);
  if (!row || now > row.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  row.count++;
  return row.count <= max;
}

export function clientIpFromRequest(req: Request): string {
  const vercel = req.headers.get("x-vercel-proxied-for");
  if (vercel) return vercel.split(",")[0]?.trim() ?? "unknown";
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
