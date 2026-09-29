# Sync server write policy

The liveboard sync server (`apps/server`) enforces collaboration rules **before** Yjs updates are applied to the room document.

## View-only (JWT `role: "viewer"`)

- During the initial Yjs handshake, viewers may send **one sync step 2** reply (required by the y-websocket protocol after the server's step 1).
- After that, **sync step 2**, **sync updates**, and any other document writes are rejected with WebSocket close code **4403 (Forbidden)** and the client is disconnected.
- Awareness updates are still allowed so viewers can show cursors if the client sends them.

## Editors — storage budget only

Editors may send Yjs updates subject to:

1. **Per-message size** — single update frames larger than `ROOM_MAX_SINGLE_UPDATE_BYTES` (512 KiB) are rejected.
2. **Room storage budget** — before each update is applied, the server rebases an O(1) counter to `Y.encodeStateAsUpdate(doc).byteLength` and rejects the update if `storedBytes + update.byteLength` would exceed `ROOM_MAX_STORED_BYTES` (8 MiB).

Rejected updates are **not** applied. The offending client is closed with **4410 (Room storage cap)** or **1009 (Message too big)** and an `lb:<code>:<reason>` close reason. Other clients continue editing.

There is **no** server-side lock enforcement, shadow-document trial, or byte-search meta detection. `meta.lockedIds` is a **client-only** accident guard; see `docs/SHARING.md`.

## Rate limits

- Per-connection message rate limiting (token bucket).
- HTTP WebSocket upgrade rate limit per IP.

## Access control

Edit vs view is decided by `/api/token` from `liveboard_rooms` and capability secrets, not by the sync server. The sync server trusts only JWT `role` and `sub` minted by the web app.
