import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen, zoomAt, fitBoundsToViewport } from "./camera";

describe("camera", () => {
  it("round-trips screen and world coordinates", () => {
    const cam = { x: 100, y: 50, zoom: 2 };
    const w = screenToWorld(cam, 300, 250);
    expect(w).toEqual({ x: 100, y: 100 });
    const s = worldToScreen(cam, w.x, w.y);
    expect(s).toEqual({ x: 300, y: 250 });
  });

  it("zooms toward anchor", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const next = zoomAt(cam, 2, 100, 100);
    expect(next.zoom).toBe(2);
    const anchorWorld = screenToWorld(next, 100, 100);
    expect(anchorWorld.x).toBeCloseTo(100);
    expect(anchorWorld.y).toBeCloseTo(100);
  });

  it("fits bounds in viewport", () => {
    const cam = fitBoundsToViewport({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 800, 600, 0);
    expect(cam.zoom).toBeLessThan(1);
    const mid = screenToWorld(cam, 400, 300);
    expect(mid.x).toBeCloseTo(500, 0);
    expect(mid.y).toBeCloseTo(250, 0);
  });
});
