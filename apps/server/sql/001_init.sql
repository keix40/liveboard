-- LiveBoard persistence schema (also applied automatically by PostgresPersistence.init()).
-- Strategy: append-only update log + periodic compaction into a single snapshot per room.

CREATE TABLE IF NOT EXISTS liveboard_documents (
  room_id     TEXT PRIMARY KEY,
  snapshot    BYTEA       NOT NULL,          -- Y.encodeStateAsUpdate(doc) after compaction
  compacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liveboard_updates (
  id          BIGSERIAL   PRIMARY KEY,
  room_id     TEXT        NOT NULL,
  update      BYTEA       NOT NULL,          -- raw Yjs v1 update from a client
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS liveboard_updates_room_id_id ON liveboard_updates (room_id, id);
