import { randomBytes } from "node:crypto";
import { isValidRoomId } from "@liveboard/shared";

/** Cryptographically random room id (server-only minting for new boards). */
export function generateRoomId(): string {
  for (let i = 0; i < 8; i++) {
    const id = randomBytes(9).toString("base64url").slice(0, 12);
    if (isValidRoomId(id)) return id;
  }
  return randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9_-]/g, "x").slice(0, 12);
}
