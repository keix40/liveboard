import type http from "node:http";

/**
 * Client IP for rate limiting. Prefer the hop Render adds (rightmost `X-Forwarded-For` entry)
 * instead of the leftmost value, which clients can spoof before the request reaches us.
 *
 * @see https://render.com/docs/web-services#request-headers
 */
export function clientIp(req: http.IncomingMessage): string {
  const render = req.headers["x-render-remote-addr"];
  if (typeof render === "string" && render.trim()) return render.trim();

  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const parts = (Array.isArray(fwd) ? fwd.join(",") : fwd)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  const trueClient = req.headers["true-client-ip"];
  if (typeof trueClient === "string" && trueClient.trim()) return trueClient.trim();

  return req.socket.remoteAddress || "unknown";
}
