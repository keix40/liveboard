import { test, expect, type Page } from "@playwright/test";

async function drawArrow(
  page: Page,
  from: [number, number],
  to: [number, number],
  pointerType: "mouse" | "pen" | "touch" = "mouse",
  pointerId = 1,
) {
  await page.getByTestId("tool-arrow").scrollIntoViewIfNeeded();
  await page.getByTestId("tool-arrow").click();
  await expect(page.getByTestId("tool-arrow")).toHaveAttribute("aria-pressed", "true");
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", {
    pointerId,
    pointerType,
    button: 0,
    pressure: pointerType === "pen" ? 0.7 : undefined,
    clientX: x0,
    clientY: y0,
  });
  for (let i = 1; i <= 10; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 10;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 10;
    await canvas.dispatchEvent("pointermove", {
      pointerId,
      pointerType,
      pressure: pointerType === "pen" ? 0.8 : undefined,
      clientX: x,
      clientY: y,
    });
  }
  await canvas.dispatchEvent("pointerup", {
    pointerId,
    pointerType,
    button: 0,
    clientX: box.x + to[0],
    clientY: box.y + to[1],
  });
}

test("arrow tool renders shaft and head (desktop mouse)", async ({ page }) => {
  const room = `arrow-${Date.now()}`;
  await page.goto(`/board/${room}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await drawArrow(page, [80, 120], [280, 80]);
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-shape-count", "1");
});

test("arrow tool works on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/arrow-touch-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await page.getByTestId("tool-arrow").scrollIntoViewIfNeeded();
  await page.getByTestId("tool-arrow").click({ force: true });
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 260);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-shape-count", "1");
});

test("arrow syncs, persists on reload, undo, and export", async ({ browser, page }) => {
  const room = `arrow-full-${Date.now()}`;
  const peer = await (await browser.newContext()).newPage();
  await page.goto(`/board/${room}`);
  await peer.goto(`/board/${room}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await drawArrow(page, [100, 140], [320, 140]);
  await expect(peer.getByTestId("board-canvas")).toHaveAttribute("data-shape-count", "1", { timeout: 15_000 });

  await page.getByTestId("tool-undo").click();
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-shape-count", "0");

  await drawArrow(page, [100, 140], [320, 140]);
  await page.reload();
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await expect(page.getByTestId("board-canvas")).toHaveAttribute("data-shape-count", "1", { timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("tool-export-png").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
});
