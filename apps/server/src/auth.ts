import { jwtVerify, SignJWT } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER, type RoomTokenClaims } from "@liveboard/shared";

const enc = new TextEncoder();

export class AuthError extends Error {
  constructor(
    message: string,
    readonly kind: "unauthorized" | "forbidden",
  ) {
    super(message);
  }
}

/**
 * Verify a room token (HS256) and check it grants access to `roomId`.
 * Tokens are minted by apps/web (/api/token) with the same shared secret.
 */
export async function verifyRoomToken(
  token: string | null,
  roomId: string,
  secret: string,
): Promise<RoomTokenClaims> {
  if (!token) throw new AuthError("missing token", "unauthorized");
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, enc.encode(secret), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: 5,
    }));
  } catch (err) {
    throw new AuthError(`invalid token: ${(err as Error).message}`, "unauthorized");
  }
  const { sub, name, room, role } = payload;
  if (typeof sub !== "string" || typeof room !== "string") {
    throw new AuthError("malformed claims", "unauthorized");
  }
  if (room !== "*" && room !== roomId) throw new AuthError("token not valid for room", "forbidden");
  return {
    sub,
    room,
    name: typeof name === "string" ? name.slice(0, 64) : "Anonymous",
    role: role === "viewer" ? "viewer" : "editor",
  };
}

/** Used by tests and scripts/mint-token.ts. apps/web has its own copy in app/api/token. */
export async function signRoomToken(
  claims: Omit<RoomTokenClaims, "iat" | "exp">,
  secret: string,
  ttl = "1h",
): Promise<string> {
  return new SignJWT({ name: claims.name, room: claims.room, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(enc.encode(secret));
}
