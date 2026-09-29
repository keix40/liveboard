/**
 * Mint a room token for manual testing (e.g. with websocat or a second browser).
 *   pnpm token -- <roomId|*> [name] [editor|viewer]
 */
import { loadConfig } from "../src/config.js";
import { signRoomToken } from "../src/auth.js";

const [room = "*", name = "cli-user", role = "editor"] = process.argv.slice(2).filter((a) => a !== "--");
const cfg = loadConfig();
const token = await signRoomToken(
  { sub: `cli-${Date.now()}`, name, room, role: role === "viewer" ? "viewer" : "editor" },
  cfg.jwtSecret,
);
console.log(token);
