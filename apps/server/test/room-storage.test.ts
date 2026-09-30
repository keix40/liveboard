import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  incomingUpdateAllowed,
  rebaseRoomStorage,
  measureDocBytes,
  recordAppliedUpdate,
  ROOM_STORAGE_REMEASURE_THROTTLE_MS,
} from "../src/room-storage.js";
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

  it("remeasures on cap edge and accepts updates after import/delete cycles", () => {
    const doc = new Y.Doc({ gc: true });
    const assets = doc.getMap("assets");
    const payload = "A".repeat(190_000);
    const state = { storedBytes: 0 };
    rebaseRoomStorage(state, doc);

    for (let i = 0; i < 45; i++) {
      doc.transact(() => {
        const m = new Y.Map();
        m.set("dataBase64", payload);
        assets.set(`asset-${i}`, m);
      });
      recordAppliedUpdate(state, 190_000);
      doc.transact(() => assets.delete(`asset-${i}`));
      recordAppliedUpdate(state, 4_000);
    }

    expect(state.storedBytes).toBeGreaterThan(ROOM_MAX_STORED_BYTES - 50_000);
    expect(measureDocBytes(doc)).toBeLessThan(ROOM_MAX_STORED_BYTES / 2);

    const strokeUpdateSize = 120;
    const withoutRemeasure = incomingUpdateAllowed(state, strokeUpdateSize);
    expect(withoutRemeasure.ok).toBe(false);

    const now = 10_000;
    const withRemeasure = incomingUpdateAllowed(state, strokeUpdateSize, {
      doc,
      nowMs: now,
      lastCapRemeasureMs: now - ROOM_STORAGE_REMEASURE_THROTTLE_MS,
    });
    expect(withRemeasure.ok).toBe(true);
    if (withRemeasure.ok) expect(withRemeasure.lastCapRemeasureMs).toBe(now);

    for (let s = 0; s < 50; s++) {
      const gate = incomingUpdateAllowed(state, strokeUpdateSize, {
        doc,
        nowMs: now + s,
        lastCapRemeasureMs: now,
      });
      expect(gate.ok).toBe(true);
      recordAppliedUpdate(state, strokeUpdateSize);
      doc.transact(() => {
        const strokes = doc.getArray("strokes");
        const m = new Y.Map();
        m.set("id", `stroke-${s}`);
        strokes.push([m]);
      });
    }
    expect(doc.getArray("strokes").length).toBe(50);
  });
});
