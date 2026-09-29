import { test, expect } from "@playwright/test";

test("view-only link exposes viewer role in side panel", async ({ page }) => {
  await page.goto(`/board/view-only-${Date.now()}?view=1`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await expect(page.getByTestId("room-role")).toHaveText("viewer");
});

test("stabilizer and background controls are present", async ({ page }) => {
  await page.goto(`/board/advanced-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await expect(page.getByTestId("stabilizer-slider")).toBeVisible();
  await expect(page.getByTestId("background-select")).toBeVisible();
  await page.getByTestId("dark-mode-toggle").check();
  await expect(page.getByTestId("board-root")).toHaveClass(/dark/);
});
