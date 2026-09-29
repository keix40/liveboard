# Sharing and capabilities

## Edit vs view links

- **View link:** `/board/<roomId>?view=1&viewCap=<hmac>` — mints a JWT with `role: viewer`.
- **Edit link:** `/board/<roomId>?edit=<hmac>` — required to obtain an editor JWT once a board is **claimed**.

Capabilities are HMAC-SHA256 over `"<roomId>:edit"` or `"<roomId>:view"` using `LIVEBOARD_JWT_SECRET`.

## Legacy open-edit boards

Boards with no `meta.ownerId` in the Yjs document remain **open-edit**: the web client requests tokens with `legacyOpen: true` and no edit capability. To claim a board, open with `?claim=1` as the first editor; the client writes `meta.ownerId` and future edits require the edit link capability.

## Board password

Passwords are sent in the **POST body** to `/api/token`, never in the URL. Viewers and editors must supply the password when configured (`BOARD_PASSWORD` or `BOARD_PASSWORD_<roomId>`).
