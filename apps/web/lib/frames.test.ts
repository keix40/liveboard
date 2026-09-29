import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cameraForFrame, frameFromViewport } from "./frames";
import { ensureBoardMeta } from "./board-meta";
import { LOCAL_ORIGIN } from "./strokes";

describe("frames", () => {
  it("creates a frame from the current viewport", () => {
    const doc = new Y.Doc();
    ensureBoardMeta(doc, LOCAL_ORIGIN);
    const frame = frameFromViewport(doc, { x: -100, y: -50, zoom: 2 }, 800, 600, "Main");
    expect(frame.name).toBe("Main");
    expect(frame.w).toBe(400);
    expect(frame.h).toBe(300);
  });

  it("computes camera that frames the region", () => {
    const cam = cameraForFrame({ id: "f", name: "F", x: 0, y: 0, w: 400, h: 300 }, 800, 600);
    expect(cam.zoom).toBeGreaterThan(1);
  });
});
