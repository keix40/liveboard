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

async function strokeCount(page: Page): Promise<number> {
  return Number(await page.getByTestId("board-canvas").getAttribute("data-stroke-count"));
}

test("new peers joining a room with content do not wipe strokes", async ({ browser }) => {
  const room = `join-wipe-${Date.now()}`;
  const seed = await browser.newContext();
  const seedPage = await seed.newPage();
  await seedPage.goto(`/board/${room}`);
  await expect(seedPage.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
  await drawStroke(seedPage, [30, 30], [160, 120]);
  await expect.poll(() => strokeCount(seedPage)).toBe(1);
  await seed.close();

  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/board/${room}`);
    await expect(page.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
    await expect.poll(() => strokeCount(page), { timeout: 15_000 }).toBe(1);
    await ctx.close();
  }

  const verify = await browser.newContext();
  const verifyPage = await verify.newPage();
  await verifyPage.goto(`/board/${room}`);
  await expect.poll(() => strokeCount(verifyPage), { timeout: 15_000 }).toBe(1);
  await verify.close();
});

test("view-link viewer sees existing board content", async ({ browser }) => {
  const room = `view-content-${Date.now()}`;
  const editor = await browser.newContext();
  const ed = await editor.newPage();
  await ed.goto(`/board/${room}`);
  await expect(ed.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
  await drawStroke(ed, [40, 40], [180, 140]);
  await expect.poll(() => strokeCount(ed)).toBe(1);

  const viewer = await browser.newContext();
  const view = await viewer.newPage();
  await view.goto(`/board/${room}?view=1`);
  await expect(view.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
  await expect(view.getByTestId("room-role")).toHaveText("viewer");
  await expect.poll(() => strokeCount(view), { timeout: 15_000 }).toBe(1);
  await editor.close();
  await viewer.close();
});

test("drawing on page 2 does not touch page 1 for either peer", async ({ browser }) => {
  const room = `page2-${Date.now()}`;
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });
  await expect(b.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });

  await drawStroke(a, [20, 20], [100, 80]);
  await expect.poll(() => strokeCount(a)).toBe(1);
  await expect.poll(() => strokeCount(b), { timeout: 15_000 }).toBe(1);

  await b.getByTestId("page-add").click();
  await b.getByTestId("page-select").selectOption({ index: 1 });
  await drawStroke(b, [50, 50], [200, 160]);
  await expect.poll(() => strokeCount(b)).toBe(1);
  await expect.poll(() => strokeCount(a)).toBe(1);

  await a.getByTestId("page-select").selectOption({ index: 1 });
  await expect.poll(() => strokeCount(a)).toBe(1);
  await a.getByTestId("page-select").selectOption({ index: 0 });
  await expect.poll(() => strokeCount(a)).toBe(1);
  await ctxA.close();
  await ctxB.close();
});
