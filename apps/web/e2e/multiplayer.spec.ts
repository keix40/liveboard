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
  const x1 = box.x + to[0];
  const y1 = box.y + to[1];
  await canvas.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", button: 0, clientX: x1, clientY: y1 });
}

test("a stroke drawn in one browser appears in another", async ({ browser }) => {
  const room = `e2e-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);
  await expect(b.getByTestId("status")).toHaveText(/connected/i);

  await drawStroke(a, [100, 100], [300, 200]);

  await expect(b.getByTestId("board-canvas")).toHaveAttribute("data-stroke-count", "1");
  await expect(b.getByTestId("presence")).toContainText("2 online");
});
