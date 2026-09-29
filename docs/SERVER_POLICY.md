# Sync server write policy

The liveboard sync server (`apps/server`) enforces collaboration rules **before** Yjs updates are applied to the room document.

## View-only (JWT `role: "viewer"`)

- During the initial Yjs handshake, viewers may send **one sync step 2** reply (required by the y-websocket protocol after the server's step 1).
- After that, **sync step 2**, **sync updates**, and any other document writes are rejected with WebSocket close code **4403 (Forbidden)** and the client is disconnected.
- Awareness updates are still allowed so viewers can show cursors if the client sends them.

This is stricter than silently ignoring writes: viewers cannot mutate shared CRDT state at all.

## Locked items (`meta.lockedIds`)

Editors may edit the board freely except for objects whose ids appear in `meta.lockedIds` (strokes, shapes, sticky notes, and imported assets).

For each incoming Yjs update from an editor:

1. Clone the current document state into a temporary `Y.Doc`.
2. Apply the update on the clone.
3. Compare JSON fingerprints of every locked id before vs after.
4. If any locked entity changed or was deleted, reject the update and close the connection with **4403**.

Lock toggles are stored in `meta`; changing `lockedIds` itself is allowed when the locked entities' content is unchanged in the same update batch.

## Client-side mirrors

The web app also checks `isLocked()` before moves, erases, and edits for responsiveness. **Server enforcement is authoritative** for multi-user security.
