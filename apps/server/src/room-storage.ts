import * as Y from "yjs";
import { ROOM_MAX_SINGLE_UPDATE_BYTES, ROOM_MAX_STORED_BYTES } from "@liveboard/shared";

export interface RoomStorageState {
  /** Current merged Y.Doc size (encodeStateAsUpdate), rebased on load and after applies. */
  storedBytes: number;
}

export const ROOM_STORAGE_REMEASURE_THROTTLE_MS = 5000;

export function measureDocBytes(doc: Y.Doc): number {
  return Y.encodeStateAsUpdate(doc).byteLength;
}

export function rebaseRoomStorage(state: RoomStorageState, doc: Y.Doc): void {
  state.storedBytes = measureDocBytes(doc);
}

export interface IncomingUpdateGateOptions {
  doc: Y.Doc;
  nowMs: number;
  lastCapRemeasureMs: number;
}

export type IncomingUpdateGateResult =
  | { ok: true; lastCapRemeasureMs?: number }
  | { ok: false; reason: "message_too_large" | "room_storage_cap"; lastCapRemeasureMs?: number };

/** Budget check: rebased doc size + incoming update (rebase on load / compaction). */
export function incomingUpdateAllowed(
  state: RoomStorageState,
  updateByteLength: number,
  opts?: IncomingUpdateGateOptions,
): IncomingUpdateGateResult {
  if (updateByteLength > ROOM_MAX_SINGLE_UPDATE_BYTES) {
    return { ok: false, reason: "message_too_large" };
  }
  if (state.storedBytes + updateByteLength <= ROOM_MAX_STORED_BYTES) {
    return { ok: true };
  }
  if (
    opts &&
    opts.nowMs - opts.lastCapRemeasureMs >= ROOM_STORAGE_REMEASURE_THROTTLE_MS
  ) {
    rebaseRoomStorage(state, opts.doc);
    const lastCapRemeasureMs = opts.nowMs;
    if (state.storedBytes + updateByteLength <= ROOM_MAX_STORED_BYTES) {
      return { ok: true, lastCapRemeasureMs };
    }
    return { ok: false, reason: "room_storage_cap", lastCapRemeasureMs };
  }
  return { ok: false, reason: "room_storage_cap" };
}

/** Track applied update payload size without re-encoding the full doc. */
export function recordAppliedUpdate(state: RoomStorageState, updateByteLength: number): void {
  state.storedBytes += updateByteLength;
}
