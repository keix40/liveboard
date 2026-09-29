import { test, expect } from "@playwright/test";
import { TOOLBAR_HIT_TEST_IDS } from "../components/Toolbar";

const VIEWPORTS = [
  { width: 390, height: 844, name: "iphone" },
  { width: 820, height: 1180, name: "ipad-portrait" },
  { width: 1180, height: 820, name: "ipad-landscape" },
  { width: 1280, height: 800, name: "laptop" },
  { width: 1920, height: 1080, name: "desktop" },
] as const;

for (const vp of VIEWPORTS) {
  test(`toolbar controls are tappable at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`/board/layout-${vp.name}-${Date.now()}`);
    await expect(page.getByTestId("status")).toHaveText(/connected/i);
    const chrome = page.getByTestId("board-chrome");
    await expect(chrome).toBeVisible();
    const chromeBox = (await chrome.boundingBox())!;

    for (const id of TOOLBAR_HIT_TEST_IDS) {
      const el = page.getByTestId(id);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
      const box = (await el.boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      expect(box.y).toBeGreaterThanOrEqual(chromeBox.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(chromeBox.y + chromeBox.height + 1);
      const top = await page.evaluate(
        ({ x, y }) => {
          const hit = document.elementFromPoint(x, y);
          return hit?.closest("[data-testid]")?.getAttribute("data-testid") ?? hit?.tagName ?? null;
        },
        { x: cx, y: cy },
      );
      expect(top).toBe(id);
    }
  });
}

test("HUD does not overlap toolbar tools", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/hud-${Date.now()}`);
  await expect(page.getByTestId("status")).toBeVisible();
  const statusBox = (await page.getByTestId("status").boundingBox())!;
  const pen = page.getByTestId("tool-pen");
  const penBox = (await pen.boundingBox())!;
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(penBox.y + 2);
});
