import { test, expect } from "@playwright/test";

test("mobile viewport loads board and toolbar", async ({ page }) => {
  const room = `mobile-${Date.now()}`;
  await page.goto(`/board/${room}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  await expect(page.getByRole("toolbar")).toBeVisible();
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerType: "touch",
    button: 0,
    clientX: box.x + 40,
    clientY: box.y + 40,
  });
  await canvas.dispatchEvent("pointerup", { pointerType: "touch", button: 0 });
});
