import * as Y from "yjs";
import { ROOM_MAX_SINGLE_UPDATE_BYTES, ROOM_MAX_STORED_BYTES } from "@liveboard/shared";

export interface RoomStorageState {
  /** Current merged Y.Doc size (encodeStateAsUpdate), rebased on load and after applies. */
  storedBytes: number;
}

export function measureDocBytes(doc: Y.Doc): number {
  return Y.encodeStateAsUpdate(doc).byteLength;
}

export function rebaseRoomStorage(state: RoomStorageState, doc: Y.Doc): void {
  state.storedBytes = measureDocBytes(doc);
}

/** O(1) checks — budget uses rebased doc size + incoming update upper bound. */
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
