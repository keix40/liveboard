import { NextResponse } from "next/server";
import { viewCapability } from "@/lib/capabilities-server";
import { roomHasPersistedContent } from "@/lib/room-content";
import { generateRoomId } from "@/lib/room-ids";
import { clientIpFromRequest, tokenRateLimit } from "@/lib/token-rate-limit";
import { createRoomRecord, initRoomRegistrySchema } from "@/lib/room-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/rooms/create — mint a new room id and edit secret once. Body ignored (no client-chosen id). */
export async function POST(req: Request) {
  const secret = process.env.LIVEBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "LIVEBOARD_JWT_SECRET is not configured" }, { status: 500 });
  }
  await initRoomRegistrySchema();

  const ip = clientIpFromRequest(req);
  if (!tokenRateLimit(`create:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const room = generateRoomId();
  if (await roomHasPersistedContent(room)) {
    return NextResponse.json({ error: "room already has content" }, { status: 409 });
  }

  const created = await createRoomRecord(room);
  if ("error" in created) {
    return NextResponse.json({ error: "room already registered" }, { status: 409 });
  }

  const viewCap = viewCapability(room, secret);
  const origin = new URL(req.url).origin;
  const editLink = `${origin}/board/${room}#edit=${encodeURIComponent(created.editCap)}`;
  const viewLink = `${origin}/board/${room}?view=1&viewCap=${encodeURIComponent(viewCap)}`;

  return NextResponse.json(
    {
      room,
      editCap: created.editCap,
      viewCap,
      editLink,
      viewLink,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
