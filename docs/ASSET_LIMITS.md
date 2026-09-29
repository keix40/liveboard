# Asset storage limits (free-tier Yjs path)

Imported **images** and **PDF pages** are stored in the Yjs `assets` map as **gzip-compressed, base64-encoded** payloads (no separate object store).

| Limit | Value |
|--------|--------|
| Max size per asset (after compression) | **200 KB** (`ASSET_MAX_BYTES`) |
| Max total assets per room | **600 KB** (`ASSET_ROOM_MAX_BYTES`) |
| Max PDF pages imported at once | **5** |
| Max snapshots in timeline | **20** |

Exceeding a limit rejects the import with an error in the UI. For production boards with large media, use an external object store and store only URLs in Yjs (not implemented in this MVP).
