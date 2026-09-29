import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { isValidRoomId, JWT_AUDIENCE, JWT_ISSUER } from "@liveboard/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_SEC = 60 * 60;

/**
 * POST /api/token  { room, userId, name }  ->  { token, expiresAt }
 *
 * Guest mode: any visitor gets an editor token for the room they ask for.
 * Swap this for your real auth (NextAuth/Clerk/etc.) + a room ACL lookup before going public.
 */
export async function POST(req: Request) {
  const secret = process.env.LIVEBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "LIVEBOARD_JWT_SECRET is not configured" }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as { room?: unknown; userId?: unknown; name?: unknown } | null;
  const room = typeof body?.room === "string" ? body.room : "";
  const userId = typeof body?.userId === "string" ? body.userId.slice(0, 64) : "";
  const name = typeof body?.name === "string" ? body.name.slice(0, 32) : "Guest";
  if (!isValidRoomId(room) || !userId) {
    return NextResponse.json({ error: "invalid room or userId" }, { status: 400 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const token = await new SignJWT({ name, room, role: "editor" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, expiresAt }, { headers: { "cache-control": "no-store" } });
}
