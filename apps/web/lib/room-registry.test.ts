import { describe, expect, it, beforeEach } from "vitest";
import {
  clearMemoryRegistry,
  createRoomRecord,
  getRoomRecord,
  verifyEditCapability,
  generateRoomEditSecret,
} from "./room-registry";
import { viewCapability } from "./capabilities-server";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("room-registry", () => {
  beforeEach(() => {
    clearMemoryRegistry();
  });

  it("legacy room has no registry row", async () => {
    expect(await getRoomRecord("legacy-x")).toBeNull();
  });

  it("registered room uses random edit secret hashed in storage", async () => {
    const room = "claimed";
    const { editCap } = (await createRoomRecord(room)) as { editCap: string };
    const row = await getRoomRecord(room);
    expect(row).not.toBeNull();
    expect(editCap).not.toEqual(generateRoomEditSecret());
    expect(verifyEditCapability(editCap, row!.editCapHash)).toBe(true);
    expect(verifyEditCapability("wrong", row!.editCapHash)).toBe(false);
  });

  it("view cap does not grant edit capability", () => {
    const room = "r1";
    const view = viewCapability(room, SECRET);
    expect(view.length).toBeGreaterThan(10);
  });
});
