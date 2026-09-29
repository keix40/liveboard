import { NextResponse } from "next/server";
import { isValidRoomId } from "@liveboard/shared";
import { createRoomRecord, initRoomRegistrySchema } from "@/lib/room-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/rooms/create — register a new room; returns edit capability once. */
export async function POST(req: Request) {
  const secret = process.env.LIVEBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "LIVEBOARD_JWT_SECRET is not configured" }, { status: 500 });
  }
  await initRoomRegistrySchema();
  const body = (await req.json().catch(() => null)) as { room?: unknown } | null;
  const room = typeof body?.room === "string" ? body.room : "";
  if (!isValidRoomId(room)) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }
  const created = await createRoomRecord(room, secret);
  if ("error" in created) {
    return NextResponse.json({ error: "room already registered" }, { status: 409 });
  }
  return NextResponse.json(
    { room, editCap: created.editCap },
    { headers: { "cache-control": "no-store" } },
  );
}
