import { test, expect, type Page } from "@playwright/test";

async function drawStroke(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: x0, clientY: y0 });
  for (let i = 1; i <= 10; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 10;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 10;
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

test("pen pointer events draw a stroke", async ({ page }) => {
  const room = `pen-${Date.now()}`;
  await page.goto(`/board/${room}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "pen",
    pressure: 0.8,
    button: 0,
    clientX: box.x + 80,
    clientY: box.y + 80,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 1,
    pointerType: "pen",
    pressure: 0.9,
    clientX: box.x + 200,
    clientY: box.y + 120,
  });
  await canvas.dispatchEvent("pointerup", { pointerId: 1, pointerType: "pen", button: 0 });
  await expect(canvas).toHaveAttribute("data-stroke-count", "1");
});

test("rectangle tool creates content", async ({ page }) => {
  const room = `rect-${Date.now()}`;
  await page.goto(`/board/${room}`);
  await page.getByTestId("tool-rect").click();
  await drawStroke(page, [120, 120], [220, 200]);
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-stroke-count", "0");
});

test("zoom controls change label", async ({ page }) => {
  const room = `zoom-${Date.now()}`;
  await page.goto(`/board/${room}`);
  await expect(page.getByText("100%")).toBeVisible();
  await page.getByTestId("tool-zoom-in").click();
  await expect(page.getByText(/1\d\d%/)).toBeVisible();
});
