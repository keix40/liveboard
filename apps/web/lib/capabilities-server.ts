import { createHmac, timingSafeEqual } from "node:crypto";

export function editCapability(roomId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${roomId}:edit`).digest("base64url");
}

export function viewCapability(roomId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${roomId}:view`).digest("base64url");
}

export function verifyCapability(roomId: string, secret: string, cap: string, kind: "edit" | "view"): boolean {
  const expected = kind === "edit" ? editCapability(roomId, secret) : viewCapability(roomId, secret);
  if (cap.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cap), Buffer.from(expected));
  } catch {
    return false;
  }
}
