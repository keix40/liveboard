import { describe, expect, it, beforeEach } from "vitest";
import {
  clearMemoryRegistry,
  createRoomRecord,
  getRoomRecord,
  verifyEditCapability,
} from "./room-registry";
import { editCapability, viewCapability, verifyCapability } from "./capabilities-server";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("room-registry", () => {
  beforeEach(() => {
    clearMemoryRegistry();
  });

  it("legacy room has no registry row", async () => {
    expect(await getRoomRecord("legacy-x")).toBeNull();
  });

  it("registered room requires matching edit cap", async () => {
    const room = "claimed";
    const { editCap } = (await createRoomRecord(room, SECRET)) as { editCap: string };
    const row = await getRoomRecord(room);
    expect(row).not.toBeNull();
    expect(verifyEditCapability(room, SECRET, editCap, row!.editCapHash)).toBe(true);
    expect(verifyEditCapability(room, SECRET, "wrong", row!.editCapHash)).toBe(false);
  });

  it("view cap does not grant edit capability", () => {
    const room = "r1";
    const view = viewCapability(room, SECRET);
    const edit = editCapability(room, SECRET);
    expect(verifyCapability(room, SECRET, view, "view")).toBe(true);
    expect(verifyCapability(room, SECRET, view, "edit")).toBe(false);
    expect(verifyCapability(room, SECRET, edit, "edit")).toBe(true);
  });
});
