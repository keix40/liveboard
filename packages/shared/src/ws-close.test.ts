import { describe, expect, it } from "vitest";
import { CloseCode } from "./index.js";
import { formatAppCloseReason, isAppTerminalCloseCode, parseAppCloseCode } from "./ws-close.js";

describe("ws-close helpers", () => {
  it("formats and parses embedded app close codes", () => {
    const reason = formatAppCloseReason(CloseCode.Forbidden, "wrong room");
    expect(reason.startsWith("lb:4403:")).toBe(true);
    expect(parseAppCloseCode(1006, reason)).toBe(CloseCode.Forbidden);
    expect(parseAppCloseCode(1000, reason)).toBe(CloseCode.Forbidden);
  });

  it("keeps native app codes when the proxy forwards them", () => {
    expect(parseAppCloseCode(CloseCode.Unauthorized, formatAppCloseReason(CloseCode.Unauthorized, "bad jwt"))).toBe(
      CloseCode.Unauthorized,
    );
  });

  it("classifies the app-private close range", () => {
    expect(isAppTerminalCloseCode(CloseCode.RateLimited)).toBe(true);
    expect(isAppTerminalCloseCode(1001)).toBe(false);
  });
});
