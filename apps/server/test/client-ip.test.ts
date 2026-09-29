import { describe, expect, it } from "vitest";
import type http from "node:http";
import { clientIp } from "../src/client-ip.js";

const req = (headers: Record<string, string>, remoteAddress = "127.0.0.1"): http.IncomingMessage =>
  ({ headers, socket: { remoteAddress } }) as unknown as http.IncomingMessage;

describe("clientIp", () => {
  it("prefers Render remote addr header", () => {
    expect(
      clientIp(
        req({
          "x-render-remote-addr": "203.0.113.5",
          "x-forwarded-for": "198.51.100.1, 203.0.113.5",
        }),
      ),
    ).toBe("203.0.113.5");
  });

  it("uses the rightmost X-Forwarded-For hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "spoofed, 198.51.100.2, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to the TCP peer address", () => {
    expect(clientIp(req({}, "10.0.0.8"))).toBe("10.0.0.8");
  });
});
