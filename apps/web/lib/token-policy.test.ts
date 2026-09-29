import { describe, expect, it, beforeEach } from "vitest";
import { evaluateTokenAccess } from "./token-policy";
import {
  clearMemoryRegistry,
  createRoomRecord,
  getRoomRecord,
} from "./room-registry";
import { editCapability, viewCapability } from "./capabilities-server";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("evaluateTokenAccess", () => {
  beforeEach(() => {
    clearMemoryRegistry();
  });

  it("legacy room allows editor without edit cap (server-derived legacyOpen)", async () => {
    const room = "legacy-open";
    expect(await getRoomRecord(room)).toBeNull();
    const result = evaluateTokenAccess({
      record: null,
      requestedRole: "editor",
      room,
      jwtSecret: SECRET,
      editCap: "",
      viewCap: "",
    });
    expect(result).toEqual({ ok: true, role: "editor", legacyOpen: true });
  });

  it("claimed room rejects stranger without edit cap", async () => {
    const room = "claimed";
    await createRoomRecord(room, SECRET);
    const record = await getRoomRecord(room);
    const result = evaluateTokenAccess({
      record,
      requestedRole: "editor",
      room,
      jwtSecret: SECRET,
      editCap: "",
      viewCap: "",
    });
    expect(result).toEqual({ ok: false, error: "edit capability required" });
  });

  it("claimed room accepts holder of edit cap", async () => {
    const room = "owned";
    const { editCap } = (await createRoomRecord(room, SECRET)) as { editCap: string };
    const record = await getRoomRecord(room);
    const result = evaluateTokenAccess({
      record,
      requestedRole: "editor",
      room,
      jwtSecret: SECRET,
      editCap,
      viewCap: "",
    });
    expect(result).toEqual({ ok: true, role: "editor", legacyOpen: false });
  });

  it("view link mints viewer only; view cap cannot escalate to edit on claimed room", async () => {
    const room = "view-only";
    await createRoomRecord(room, SECRET);
    const record = await getRoomRecord(room);
    const viewCap = viewCapability(room, SECRET);
    const viewer = evaluateTokenAccess({
      record,
      requestedRole: "viewer",
      room,
      jwtSecret: SECRET,
      editCap: "",
      viewCap,
    });
    expect(viewer).toEqual({ ok: true, role: "viewer", legacyOpen: false });

    const escalate = evaluateTokenAccess({
      record,
      requestedRole: "editor",
      room,
      jwtSecret: SECRET,
      editCap: viewCap,
      viewCap: "",
    });
    expect(escalate).toEqual({ ok: false, error: "edit capability required" });
  });

  it("claimed room stays protected even if client would claim legacyOpen", async () => {
    const room = "not-legacy";
    await createRoomRecord(room, SECRET);
    const record = await getRoomRecord(room);
    const result = evaluateTokenAccess({
      record,
      requestedRole: "editor",
      room,
      jwtSecret: SECRET,
      editCap: editCapability(room, SECRET),
      viewCap: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.legacyOpen).toBe(false);
  });
});
