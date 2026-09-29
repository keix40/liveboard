import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { incomingUpdateAllowed, rebaseRoomStorage, measureDocBytes } from "../src/room-storage.js";
import { ROOM_MAX_SINGLE_UPDATE_BYTES, ROOM_MAX_STORED_BYTES } from "@liveboard/shared";

describe("room-storage", () => {
  it("rejects oversize single updates before apply", () => {
    const state = { storedBytes: 0 };
    const gate = incomingUpdateAllowed(state, ROOM_MAX_SINGLE_UPDATE_BYTES + 1);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("message_too_large");
  });

  it("rejects when room cap would be exceeded", () => {
    const state = { storedBytes: ROOM_MAX_STORED_BYTES - 10 };
    expect(incomingUpdateAllowed(state, 20).ok).toBe(false);
    expect(incomingUpdateAllowed(state, 5).ok).toBe(true);
  });

  it("rebase tracks encodeStateAsUpdate size after deletes", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray("strokes");
    doc.transact(() => {
      for (let i = 0; i < 100; i++) arr.push([i]);
    });
    const state = { storedBytes: 0 };
    rebaseRoomStorage(state, doc);
    const big = state.storedBytes;
    doc.transact(() => arr.delete(0, 95));
    rebaseRoomStorage(state, doc);
    expect(state.storedBytes).toBeLessThan(big);
    expect(measureDocBytes(doc)).toBe(state.storedBytes);
  });
});
