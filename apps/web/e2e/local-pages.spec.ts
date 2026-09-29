import { test, expect, type Page } from "@playwright/test";

async function drawStroke(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: x0, clientY: y0 });
  for (let i = 1; i <= 6; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 6;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 6;
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

test("page switches are local unless presenter mode", async ({ browser }) => {
  const roomId = `pages-${Date.now()}`;
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(`/board/${roomId}`);
  await b.goto(`/board/${roomId}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
  await expect(b.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });

  await drawStroke(a, [40, 40], [120, 100]);
  await expect.poll(async () => Number(await a.getByTestId("board-canvas").getAttribute("data-stroke-count"))).toBe(1);

  await b.getByTestId("page-add").click();
  await expect.poll(async () => Number(await a.getByTestId("board-canvas").getAttribute("data-stroke-count"))).toBe(1);
  await b.getByTestId("page-select").selectOption({ index: 1 });
  await drawStroke(b, [50, 50], [130, 110]);
  await drawStroke(b, [140, 60], [220, 130]);
  await expect.poll(async () => Number(await b.getByTestId("board-canvas").getAttribute("data-stroke-count"))).toBe(2);
  await expect.poll(async () => Number(await a.getByTestId("board-canvas").getAttribute("data-stroke-count"))).toBe(1);
  await a.getByTestId("page-select").selectOption({ index: 1 });
  await expect.poll(async () => Number(await a.getByTestId("board-canvas").getAttribute("data-stroke-count"))).toBe(2);

  await ctxA.close();
  await ctxB.close();
});
