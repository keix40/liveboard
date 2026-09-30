import { test, expect } from "@playwright/test";

test("phone side sheet scrolls to reach all sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/sheet-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);

  await page.getByTestId("side-panel-toggle").click();
  const panel = page.getByTestId("board-side-panel");
  await expect(panel).toBeVisible();

  for (const id of [
    "side-section-share",
    "side-section-canvas",
    "side-section-pages",
    "side-section-history",
    "side-section-insert",
    "side-section-collaborate",
  ]) {
    const section = page.getByTestId(id);
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(40);
  }

  await page.getByTestId("side-section-history").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("history-scrub")).toBeVisible();
  await expect(page.getByTestId("history-restore")).toBeVisible();
});
