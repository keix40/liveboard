import { describe, expect, it } from "vitest";
import { CloseCode, formatAppCloseReason } from "@liveboard/shared";
import { resolveTerminalClose, terminalCloseAction } from "./terminal-close";

describe("terminal close handling", () => {
  it("maps app codes to reconnect actions", () => {
    expect(terminalCloseAction(CloseCode.Unauthorized)).toBe("refresh-token");
    expect(terminalCloseAction(CloseCode.Forbidden)).toBe("unauthorized");
    expect(terminalCloseAction(CloseCode.RateLimited)).toBe("retry-rate-limit");
    expect(terminalCloseAction(CloseCode.RoomFull)).toBe("room-full");
    expect(terminalCloseAction(1001)).toBeNull();
  });

  it("recovers app codes from close reasons when the frame code was stripped", () => {
    const reason = formatAppCloseReason(CloseCode.Forbidden, "wrong room");
    expect(resolveTerminalClose(1006, reason)).toBe(CloseCode.Forbidden);
    expect(terminalCloseAction(resolveTerminalClose(1006, reason)!)).toBe("unauthorized");
  });
});
