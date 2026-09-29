import { test, expect, type Page } from "@playwright/test";

async function drawStroke(page: Page) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 80,
    clientY: box.y + 80,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 1,
    pointerType: "mouse",
    clientX: box.x + 200,
    clientY: box.y + 140,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 200,
    clientY: box.y + 140,
  });
}

test("canvas element identity and backing size stay stable when adding a stroke", async ({ page }) => {
  await page.goto(`/board/canvas-stable-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  const before = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="board-canvas"]') as HTMLCanvasElement;
    return { id: c.dataset.canvasId ?? "", width: c.width, height: c.height };
  });
  expect(before.width).toBeGreaterThan(0);
  expect(before.height).toBeGreaterThan(0);

  await drawStroke(page);
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-stroke-count", "1");

  const after = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="board-canvas"]') as HTMLCanvasElement;
    return { id: c.dataset.canvasId ?? "", width: c.width, height: c.height };
  });
  expect(after.id).toBe(before.id);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});
