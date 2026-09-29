/** Prefix embedded in the WebSocket close reason when proxies strip custom close codes. */
export const APP_CLOSE_PREFIX = "lb:";

/** RFC 6455 limits close reasons to 123 UTF-8 bytes; keep the embedded code parseable. */
export function formatAppCloseReason(code: number, detail: string): string {
  const reason = `${APP_CLOSE_PREFIX}${code}:${detail}`;
  return reason.length <= 123 ? reason : reason.slice(0, 123);
}

/**
 * Resolve the app close code from the frame the browser reported.
 * When a reverse proxy normalizes an app code to 1000/1006, the reason still carries `lb:<code>:`.
 */
export function parseAppCloseCode(code: number, reason?: string | null): number {
  if (code >= 4400 && code < 4500) return code;
  if (!reason) return code;
  const match = reason.match(/^lb:(\d{4}):/);
  if (!match) return code;
  const parsed = Number(match[1]);
  return parsed >= 4400 && parsed < 4500 ? parsed : code;
}

export function isAppTerminalCloseCode(code: number): boolean {
  return code >= 4400 && code < 4500;
}
