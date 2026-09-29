# Sharing and capabilities

## Edit vs view

- **View link:** `/board/<roomId>?view=1&viewCap=<hmac>` — mints a JWT with `role: viewer` only.
- **Edit link:** `/board/<roomId>?edit=<cap>` — required to obtain an editor JWT for **registered** rooms.

Capabilities are HMAC-SHA256 over `"<roomId>:edit"` or `"<roomId>:view"` using `LIVEBOARD_JWT_SECRET`.

## Server-owned room registry

New boards call `POST /api/rooms/create` once; the response includes the **edit capability** (store it — it is not shown again). The server stores `edit_cap_hash` in `liveboard_rooms` (Postgres when `DATABASE_URL` is set, in-memory otherwise).

`/api/token` decides access from that table only — **never** from client `legacyOpen`.

| Registry row | Editor token | Viewer token |
|--------------|--------------|--------------|
| Missing | Allowed (legacy open-edit) | Allowed with optional view cap |
| Present | Requires valid edit cap | Allowed; **no** edit cap in response |

JWT `sub` is assigned by the server on each mint. Display name comes from the token body; identity is not client-chosen for auth.

## Locks (client-only)

`meta.lockedIds` and per-asset `locked` are **soft locks**: the web app skips them for eraser, lasso move, Clear, Undo, and delete. They prevent accidents, not malicious editors. Real write control is the **edit capability** plus JWT role on the sync server.

## Board password

Send passwords in the **POST body** to `/api/token`. A `403` with `code: "password"` shows the password prompt in the UI.

## Sync server policy

The sync server enforces **JWT role** (viewers cannot write), rate limits, and an **O(1) per-room byte budget** on incoming update sizes. It does not decode Yjs or enforce locks.
