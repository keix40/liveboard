import { test, expect, type Page } from "@playwright/test";

async function drawStroke(page: Page, from: [number, number], to: [number, number], pointerId = 1) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", button: 0, clientX: x0, clientY: y0 });
  for (let i = 1; i <= 12; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 12;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 12;
    await canvas.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", clientX: x, clientY: y });
  }
  await canvas.dispatchEvent("pointerup", {
    pointerId,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + to[0],
    clientY: box.y + to[1],
  });
}

async function inkPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="board-canvas"]') as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i]!;
      const g = img[i + 1]!;
      const b = img[i + 2]!;
      const a = img[i + 3]!;
      if (a < 8) continue;
      if (r < 235 || g < 235 || b < 235) n++;
    }
    return n;
  });
}

async function waitForInkAtLeast(page: Page, target: number, toleranceRatio = 0.22) {
  const lo = Math.floor(target * (1 - toleranceRatio));
  await expect.poll(async () => inkPixels(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(lo);
}

test("remote viewer keeps prior strokes visible while new strokes stream in", async ({ browser }) => {
  const room = `reg-a-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);
  await expect(b.getByTestId("status")).toHaveText(/connected/i);

  const strokes: [number, number][][] = [
    [
      [80, 120],
      [280, 120],
    ],
    [
      [80, 160],
      [280, 160],
    ],
    [
      [80, 200],
      [280, 200],
    ],
  ];

  let prevB = 0;
  for (let i = 0; i < strokes.length; i++) {
    const [from, to] = strokes[i]!;
    await drawStroke(a, from, to);
    await expect(b.getByTestId("board-canvas")).toHaveAttribute("data-stroke-count", String(i + 1), {
      timeout: 15_000,
    });
    const inkA = await inkPixels(a);
    expect(inkA).toBeGreaterThan(500);
    await waitForInkAtLeast(b, inkA);
    const inkB = await inkPixels(b);
    expect(inkB).toBeGreaterThanOrEqual(prevB * 0.85);
    prevB = inkB;
  }
});

test("sticky notes appear on load and when added remotely to an idle peer", async ({ browser }) => {
  const room = `reg-notes-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);

  await a.getByTestId("tool-note").click();
  const canvasA = a.getByTestId("board-canvas");
  const boxA = (await canvasA.boundingBox())!;
  await canvasA.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: boxA.x + 120,
    clientY: boxA.y + 140,
  });
  await canvasA.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: boxA.x + 120,
    clientY: boxA.y + 140,
  });

  await b.goto(`/board/${room}`);
  await expect(b.getByTestId("status")).toHaveText(/connected/i);
  await expect(b.locator(".sticky-note")).toHaveCount(1, { timeout: 15_000 });

  await a.getByTestId("tool-note").click();
  await canvasA.click({ position: { x: 40, y: 320 } });
  await expect(b.locator(".sticky-note")).toHaveCount(2, { timeout: 15_000 });
});

test("remote Y.Text edits sync to a peer with the note focused", async ({ browser }) => {
  const room = `reg-ytext-${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(`/board/${room}`);
  await b.goto(`/board/${room}`);
  await expect(a.getByTestId("status")).toHaveText(/connected/i);

  await a.getByTestId("tool-note").click();
  const canvas = a.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 100,
    clientY: box.y + 100,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + 100,
    clientY: box.y + 100,
  });

  await expect(b.locator(".sticky-note textarea")).toHaveCount(1, { timeout: 15_000 });
  const noteA = a.locator(".sticky-note textarea");
  const noteB = b.locator(".sticky-note textarea");
  await noteA.click();
  await noteA.fill("hello from A");
  await expect(noteB).toHaveValue("hello from A", { timeout: 15_000 });

  await noteB.click();
  await noteB.fill("hello from B");
  await expect(noteA).toHaveValue("hello from B", { timeout: 15_000 });
});

test("two-finger midpoint pan moves camera without changing zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/pinch-pan-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);

  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const readCam = () =>
    canvas.getAttribute("data-camera").then((v) => {
      const [x, y, z] = (v ?? "0,0,1").split(",").map(Number);
      return { x, y, z };
    });

  const before = await readCam();
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 10,
    pointerType: "touch",
    button: 0,
    clientX: cx - 40,
    clientY: cy - 20,
  });
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "touch",
    button: 0,
    clientX: cx + 40,
    clientY: cy + 20,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 10,
    pointerType: "touch",
    clientX: cx - 40 - 80,
    clientY: cy - 20 - 40,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 11,
    pointerType: "touch",
    clientX: cx + 40 - 80,
    clientY: cy + 20 - 40,
  });
  await canvas.dispatchEvent("pointerup", { pointerId: 10, pointerType: "touch", clientX: cx - 120, clientY: cy - 60 });
  await canvas.dispatchEvent("pointerup", { pointerId: 11, pointerType: "touch", clientX: cx - 40, clientY: cy - 20 });

  const after = await readCam();
  expect(after.z).toBeCloseTo(before.z, 5);
  expect(after.x - before.x).toBeCloseTo(-80, 0);
  expect(after.y - before.y).toBeCloseTo(-40, 0);
});

test("two-finger gesture does not leave a stray stroke", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/board/pinch-dot-${Date.now()}`);
  await expect(page.getByTestId("status")).toHaveText(/connected/i);
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await canvas.dispatchEvent("pointerdown", {
    pointerId: 20,
    pointerType: "touch",
    button: 0,
    clientX: cx,
    clientY: cy,
  });
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 21,
    pointerType: "touch",
    button: 0,
    clientX: cx + 60,
    clientY: cy,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 20,
    pointerType: "touch",
    clientX: cx + 20,
    clientY: cy + 10,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 21,
    pointerType: "touch",
    clientX: cx + 80,
    clientY: cy + 10,
  });
  await canvas.dispatchEvent("pointerup", { pointerId: 20, pointerType: "touch", clientX: cx + 20, clientY: cy + 10 });
  await canvas.dispatchEvent("pointerup", { pointerId: 21, pointerType: "touch", clientX: cx + 80, clientY: cy + 10 });

  await expect(canvas).toHaveAttribute("data-stroke-count", "0");
});
