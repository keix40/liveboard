import { timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { isValidRoomId, JWT_AUDIENCE, JWT_ISSUER } from "@liveboard/shared";
import { verifyCapability } from "@/lib/capabilities-server";
import { clientIpFromRequest, tokenRateLimit } from "@/lib/token-rate-limit";
import { getRoomRecord, initRoomRegistrySchema, verifyEditCapability } from "@/lib/room-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_SEC = 60 * 60;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function boardPasswordForRoom(room: string): string {
  return process.env[`BOARD_PASSWORD_${room}`] ?? process.env.BOARD_PASSWORD ?? "";
}

/**
 * POST /api/token
 * Body: { room, name, role?, password?, editCap?, viewCap? }
 *
 * Server assigns JWT `sub`. Editor tokens require a valid edit capability when the room
 * is registered in liveboard_rooms. Unregistered rooms remain legacy open-edit (server-side).
 */
export async function POST(req: Request) {
  const secret = process.env.LIVEBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "LIVEBOARD_JWT_SECRET is not configured" }, { status: 500 });
  }
  await initRoomRegistrySchema();

  const ip = clientIpFromRequest(req);
  const body = (await req.json().catch(() => null)) as {
    room?: unknown;
    name?: unknown;
    role?: unknown;
    password?: unknown;
    editCap?: unknown;
    viewCap?: unknown;
  } | null;
  const room = typeof body?.room === "string" ? body.room : "";
  const name = typeof body?.name === "string" ? body.name.slice(0, 32) : "Guest";
  const requestedRole = body?.role === "viewer" ? "viewer" : "editor";
  const password = typeof body?.password === "string" ? body.password : "";
  const editCap = typeof body?.editCap === "string" ? body.editCap : "";
  const viewCap = typeof body?.viewCap === "string" ? body.viewCap : "";

  if (!isValidRoomId(room)) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }
  if (!tokenRateLimit(`${ip}:${room}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const expectedPw = boardPasswordForRoom(room);
  if (expectedPw && !safeEqual(password, expectedPw)) {
    return NextResponse.json({ error: "invalid board password", code: "password" }, { status: 403 });
  }

  const record = await getRoomRecord(room);
  const legacyOpen = record === null;

  let role: "editor" | "viewer" = requestedRole;
  if (role === "viewer") {
    if (viewCap && !verifyCapability(room, secret, viewCap, "view")) {
      return NextResponse.json({ error: "invalid view capability" }, { status: 403 });
    }
  } else if (!legacyOpen) {
    if (!record || !editCap || !verifyEditCapability(room, secret, editCap, record.editCapHash)) {
      return NextResponse.json({ error: "edit capability required" }, { status: 403 });
    }
  }

  const sub = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const token = await new SignJWT({ name, room, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json(
    { token, expiresAt, role, userId: sub, legacyOpen },
    { headers: { "cache-control": "no-store" } },
  );
}
