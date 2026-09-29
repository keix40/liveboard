import { verifyCapability } from "./capabilities-server";
import { verifyEditCapability, type RoomRegistryRow } from "./room-registry";

export type TokenAccessResult =
  | { ok: true; role: "editor" | "viewer"; legacyOpen: boolean }
  | { ok: false; error: string; code?: string };

/**
 * Server-side token mint policy. Ignores any client `legacyOpen` hint; legacy is derived
 * only from whether the room has a registry row.
 */
export function evaluateTokenAccess(params: {
  record: RoomRegistryRow | null;
  requestedRole: "editor" | "viewer";
  room: string;
  jwtSecret: string;
  editCap: string;
  viewCap: string;
}): TokenAccessResult {
  const { record, requestedRole, room, jwtSecret, editCap, viewCap } = params;
  const legacyOpen = record === null;

  if (requestedRole === "viewer") {
    if (viewCap && !verifyCapability(room, jwtSecret, viewCap, "view")) {
      return { ok: false, error: "invalid view capability" };
    }
    return { ok: true, role: "viewer", legacyOpen };
  }

  if (!legacyOpen) {
    if (!record || !editCap || !verifyEditCapability(room, jwtSecret, editCap, record.editCapHash)) {
      return { ok: false, error: "edit capability required" };
    }
  }

  return { ok: true, role: "editor", legacyOpen };
}
