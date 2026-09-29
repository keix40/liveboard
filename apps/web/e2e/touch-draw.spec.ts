import { test, expect, type Page } from "@playwright/test";

async function drawStroke(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: x0, clientY: y0 });
  for (let i = 1; i <= 8; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 8;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 8;
    await canvas.dispatchEvent("pointermove", { pointerId: 1, pointerType: "mouse", clientX: x, clientY: y });
  }
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + to[0],
    clientY: box.y + to[1],
  });
}

/** Regression: pen tool must draw (not pan) with a single pointer on phone-sized viewports. */
test("one finger draws with pen tool on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/touch-draw-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await drawStroke(page, [40, 40], [140, 120]);
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-stroke-count", "1");
});

test("pan tool uses single pointer to pan on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/touch-pan-${Date.now()}`);
  await page.getByTestId("tool-pan").click();
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 80,
    clientY: box.y + 200,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 2,
    pointerType: "mouse",
    clientX: box.x + 140,
    clientY: box.y + 260,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 2,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 140,
    clientY: box.y + 260,
  });
  await expect(canvas).toHaveAttribute("data-stroke-count", "0");
});
