import { test, expect } from "@playwright/test";

test("first comment appears in side panel for poster and peer on page 1 and page 2", async ({ browser }) => {
  const room = `comments-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  const addComment = async (page: typeof a, text: string) => {
    page.once("dialog", (d) => void d.accept(text));
    await page.getByTestId("add-comment").click();
    await expect(page.getByTestId("comment-list")).toContainText(text);
  };

  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);
  await expect(b.getByTestId("status")).toHaveText(/connected/i);

  await addComment(a, "p1-first");
  await expect(b.getByTestId("comment-list")).toContainText("p1-first", { timeout: 15_000 });

  await a.getByTestId("page-add").click();
  await a.getByTestId("page-select").selectOption({ index: 1 });
  await addComment(a, "p2-first");
  await expect(a.getByTestId("comment-list")).toContainText("p2-first");
  await expect(b.getByTestId("comment-list")).not.toContainText("p2-first");

  await b.getByTestId("page-select").selectOption({ index: 1 });
  await expect(b.getByTestId("comment-list")).toContainText("p2-first", { timeout: 15_000 });
});
