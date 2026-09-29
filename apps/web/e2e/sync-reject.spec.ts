import { test, expect, type Page } from "@playwright/test";
import WebSocket from "ws";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { MessageType } from "@liveboard/shared";

async function drawStroke(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByTestId("board-canvas");
  const box = (await canvas.boundingBox())!;
  const x0 = box.x + from[0];
  const y0 = box.y + from[1];
  await canvas.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: x0, clientY: y0 });
  for (let i = 1; i <= 8; i++) {
    const x = box.x + from[0] + ((to[0] - from[0]) * i) / 8;
    const y = box.y + from[1] + ((to[1] - from[1]) * i) / 8;
    await canvas.dispatchEvent("pointermove", { pointerId: 1, pointerType: "mouse", clientX: x, clientY: y });
  }
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + to[0],
    clientY: box.y + to[1],
  });
}

function sendOversizeUpdate(wsUrl: string, room: string, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}/${room}?token=${encodeURIComponent(token)}`);
    const huge = new Uint8Array(600 * 1024);
    huge[0] = 1;
    ws.on("open", () => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MessageType.Sync);
      encoding.writeVarUint(enc, syncProtocol.messageYjsUpdate);
      encoding.writeVarUint8Array(enc, huge);
      ws.send(encoding.toUint8Array(enc), { binary: true });
    });
    ws.on("close", () => resolve());
    ws.on("error", reject);
    setTimeout(() => {
      ws.terminate();
      resolve();
    }, 3000);
  });
}

test("rejected oversize sync update leaves other editors writable", async ({ browser, request }) => {
  const room = `reject-e2e-${Date.now()}`;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(`/board/${room}`);
  await expect(b.getByTestId("status")).toHaveText(/connected/i, { timeout: 15_000 });

  await drawStroke(b, [50, 50], [140, 120]);
  await expect.poll(async () => Number(await b.getByTestId("board-canvas").getAttribute("data-stroke-count")), {
    timeout: 15_000,
  }).toBe(1);

  const tokenRes = await request.post("/api/token", {
    data: { room, name: "bad-sender", role: "editor" },
  });
  expect(tokenRes.ok()).toBeTruthy();
  const { token } = (await tokenRes.json()) as { token: string };
  await sendOversizeUpdate(wsUrl, room, token);

  await expect(b.getByTestId("status")).toHaveText(/connected/i, { timeout: 5_000 });
  await drawStroke(b, [160, 60], [260, 140]);
  await expect.poll(async () => Number(await b.getByTestId("board-canvas").getAttribute("data-stroke-count")), {
    timeout: 15_000,
  }).toBe(2);

  await ctxB.close();
});
