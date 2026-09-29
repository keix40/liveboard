import { describe, expect, it } from "vitest";
import { incomingUpdateAllowed, recordAppliedUpdate } from "../src/room-storage.js";
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

  it("tracks applied bytes in O(1)", () => {
    const state = { storedBytes: 100 };
    recordAppliedUpdate(state, 50);
    expect(state.storedBytes).toBe(150);
  });
});
