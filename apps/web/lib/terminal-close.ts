import { CloseCode, isAppTerminalCloseCode, parseAppCloseCode } from "@liveboard/shared";

export type TerminalCloseAction =
  | "refresh-token"
  | "retry-rate-limit"
  | "room-full"
  | "unauthorized"
  | "room-storage-cap";

/** Map a resolved app close code to the client reconnect / UI action. */
export function terminalCloseAction(code: number): TerminalCloseAction | null {
  if (code === CloseCode.Unauthorized) return "refresh-token";
  if (code === CloseCode.RateLimited) return "retry-rate-limit";
  if (code === CloseCode.RoomFull) return "room-full";
  if (code === CloseCode.Forbidden) return "unauthorized";
  if (code === CloseCode.RoomStorageCap) return "room-storage-cap";
  if (code === CloseCode.MessageTooBig) return "room-storage-cap";
  return null;
}

/**
 * Resolve the effective terminal code from a browser CloseEvent.
 * Handles proxies that strip 440x down to 1000/1006 while preserving the `lb:<code>:` reason.
 */
export function resolveTerminalClose(code: number, reason?: string | null): number | null {
  const effective = parseAppCloseCode(code, reason);
  if (effective === CloseCode.MessageTooBig && reason?.includes("room_storage_cap")) {
    return CloseCode.RoomStorageCap;
  }
  if (!isAppTerminalCloseCode(effective) && effective !== CloseCode.MessageTooBig) return null;
  if (effective === CloseCode.MessageTooBig) return CloseCode.MessageTooBig;
  return effective;
}
