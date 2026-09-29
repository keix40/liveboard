import { describe, expect, it } from "vitest";
import { editCapability, verifyCapability, viewCapability } from "./capabilities-server";

describe("capabilities-server", () => {
  const secret = "x".repeat(32);
  const room = "demo-room";

  it("mints and verifies edit and view caps", () => {
    const edit = editCapability(room, secret);
    const view = viewCapability(room, secret);
    expect(verifyCapability(room, secret, edit, "edit")).toBe(true);
    expect(verifyCapability(room, secret, view, "view")).toBe(true);
    expect(verifyCapability(room, secret, view, "edit")).toBe(false);
  });
});
