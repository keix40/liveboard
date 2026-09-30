import { test, expect } from "@playwright/test";

test("board session does not spam Yjs invalid-access warnings", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" && msg.text().includes("Invalid access")) {
      warnings.push(msg.text());
    }
  });

  await page.goto(`/board/console-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);

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

  page.once("dialog", (d) => void d.accept("hello"));
  await page.getByTestId("add-comment").click();
  await expect(page.getByTestId("comment-list")).toContainText("hello");

  await page.waitForTimeout(500);
  expect(warnings.length).toBe(0);
});
