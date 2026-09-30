import { test, expect } from "@playwright/test";

test("peer sees aggregated reaction count without moving the mouse", async ({ browser }) => {
  const room = `react-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);
  await expect(b.getByTestId("status")).toHaveText(/connected/i);

  for (let i = 0; i < 3; i++) {
    await a.getByTestId("add-reaction").click();
  }
  await expect(a.getByTestId("board-canvas")).toHaveAttribute("data-max-reaction-count", "3");

  await expect(b.getByTestId("board-canvas")).toHaveAttribute("data-max-reaction-count", "3", {
    timeout: 15_000,
  });
});
