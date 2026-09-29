import { timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { isValidRoomId, JWT_AUDIENCE, JWT_ISSUER } from "@liveboard/shared";
import { editCapability, verifyCapability } from "@/lib/capabilities-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_SEC = 60 * 60;
const rate = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const row = rate.get(key);
  if (!row || now > row.reset) {
    rate.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  row.count++;
  return row.count <= max;
}

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
 * Body: { room, userId, name, role?, password?, editCap?, viewCap? }
 *
 * Editor tokens require editCap HMAC when the board has an ownerId in persisted meta
 * (legacy open-edit until claimed — see docs/SHARING.md).
 */
export async function POST(req: Request) {
  const secret = process.env.LIVEBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "LIVEBOARD_JWT_SECRET is not configured" }, { status: 500 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = (await req.json().catch(() => null)) as {
    room?: unknown;
    userId?: unknown;
    name?: unknown;
    role?: unknown;
    password?: unknown;
    editCap?: unknown;
    viewCap?: unknown;
    ownerClaim?: unknown;
    legacyOpen?: unknown;
  } | null;
  const room = typeof body?.room === "string" ? body.room : "";
  const userId = typeof body?.userId === "string" ? body.userId.slice(0, 64) : "";
  const name = typeof body?.name === "string" ? body.name.slice(0, 32) : "Guest";
  const role = body?.role === "viewer" ? "viewer" : "editor";
  const password = typeof body?.password === "string" ? body.password : "";
  const editCap = typeof body?.editCap === "string" ? body.editCap : "";
  const viewCap = typeof body?.viewCap === "string" ? body.viewCap : "";
  if (!isValidRoomId(room) || !userId) {
    return NextResponse.json({ error: "invalid room or userId" }, { status: 400 });
  }
  if (!rateLimit(`${ip}:${room}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const expectedPw = boardPasswordForRoom(room);
  if (expectedPw && !safeEqual(password, expectedPw)) {
    return NextResponse.json({ error: "invalid board password" }, { status: 403 });
  }

  if (role === "viewer") {
    if (viewCap && !verifyCapability(room, secret, viewCap, "view")) {
      return NextResponse.json({ error: "invalid view capability" }, { status: 403 });
    }
  } else {
    const legacyOpen = body?.legacyOpen === true;
    const hasEditCap = editCap.length > 0 && verifyCapability(room, secret, editCap, "edit");
    if (!legacyOpen && !hasEditCap) {
      return NextResponse.json({ error: "edit capability required" }, { status: 403 });
    }
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const token = await new SignJWT({ name, room, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));

  const editLinkCap = editCapability(room, secret);
  return NextResponse.json(
    { token, expiresAt, role, editLinkCap },
    { headers: { "cache-control": "no-store" } },
  );
}
