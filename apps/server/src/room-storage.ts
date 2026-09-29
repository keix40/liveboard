import { ROOM_MAX_SINGLE_UPDATE_BYTES, ROOM_MAX_STORED_BYTES } from "@liveboard/shared";

export interface RoomStorageState {
  /** Approximate persisted + applied update payload bytes for this room. */
  storedBytes: number;
}

/** O(1) checks only — no Yjs decode or doc clone. */
export function incomingUpdateAllowed(
  state: RoomStorageState,
  updateByteLength: number,
): { ok: true } | { ok: false; reason: "message_too_large" | "room_storage_cap" } {
  if (updateByteLength > ROOM_MAX_SINGLE_UPDATE_BYTES) {
    return { ok: false, reason: "message_too_large" };
  }
  if (state.storedBytes + updateByteLength > ROOM_MAX_STORED_BYTES) {
    return { ok: false, reason: "room_storage_cap" };
  }
  return { ok: true };
}

export function recordAppliedUpdate(state: RoomStorageState, updateByteLength: number): void {
  state.storedBytes += updateByteLength;
}
