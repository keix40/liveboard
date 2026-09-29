import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("imported image renders, syncs, and appears in export bounds", async ({ browser }) => {
  const room = `assets-${Date.now()}`;
  const pngPath = path.join(fixturesDir, "tiny.png");

  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);

  await a.getByTestId("import-image").setInputFiles(pngPath);
  await expect(a.getByTestId("board-canvas")).toHaveAttribute("data-asset-count", "1", { timeout: 15_000 });
  await expect(b.getByTestId("board-canvas")).toHaveAttribute("data-asset-count", "1", { timeout: 15_000 });

  const inkA = await a.evaluate(() => {
    const c = document.querySelector('[data-testid="board-canvas"]') as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 8) n++;
    return n;
  });
  expect(inkA).toBeGreaterThan(1000);
});

test("manual snapshot restore brings back removed strokes", async ({ page }) => {
  await page.goto(`/board/history-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await page.getByTestId("shape-recognize-toggle").uncheck();

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
    clientY: box.y + 120,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 200,
    clientY: box.y + 120,
  });
  await expect(canvas).toHaveAttribute("data-stroke-count", "1");

  await page.getByTestId("snapshot-save").click();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("tool-clear").click();
  await expect(canvas).toHaveAttribute("data-stroke-count", "0", { timeout: 10_000 });

  await page.getByTestId("history-restore").click();
  await expect(canvas).toHaveAttribute("data-stroke-count", "1", { timeout: 10_000 });
});

test("frame navigation updates camera", async ({ page }) => {
  await page.goto(`/board/frames-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  const canvas = page.getByTestId("board-canvas");
  const before = await canvas.getAttribute("data-camera");
  await page.getByTestId("frame-add").click();
  page.once("dialog", (d) => d.accept("Test frame"));
  await page.getByTestId("frame-go").click();
  await expect(canvas).not.toHaveAttribute("data-camera", before!);
});
