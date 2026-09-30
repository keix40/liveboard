import { test, expect } from "@playwright/test";

test("first comment on a fresh board is not placed at world origin", async ({ page }) => {
  await page.goto(`/board/fresh-comment-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i, { timeout: 20_000 });

  page.once("dialog", (d) => void d.accept("first-pin"));
  await page.getByTestId("add-comment").click();
  await expect(page.getByTestId("comment-list")).toContainText("first-pin");

  const coords = await page.locator(".comment-coords").first().textContent();
  expect(coords).toMatch(/\(([-\d.]+),\s*([-\d.]+)\)/);
  const m = coords!.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
  const x = Number(m![1]);
  const y = Number(m![2]);
  expect(Math.hypot(x, y)).toBeGreaterThan(20);
});
