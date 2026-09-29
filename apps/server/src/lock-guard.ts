import * as Y from "yjs";
import { MAX_LOCKED_IDS, YKEYS } from "@liveboard/shared";
import { entityFingerprint } from "./yjs-policy.js";

export interface LockGuardState {
  lockedIds: Set<string>;
  fingerprints: Map<string, string | null>;
  lockOwners: Map<string, string>;
}

/** Incremental locked-entity index (fingerprints only for locked ids). */
export class LockGuard {
  readonly lockedIds = new Set<string>();
  readonly fingerprints = new Map<string, string | null>();
  readonly lockOwners = new Map<string, string>();
  private readonly doc: Y.Doc;

  constructor(doc: Y.Doc) {
    this.doc = doc;
    this.refreshFromDoc();
  }

  refreshFromDoc(): void {
    const meta = this.doc.getMap(YKEYS.meta);
    const raw = meta.get("lockedIds");
    const fromMeta = Array.isArray(raw) ? (raw as string[]).slice(0, MAX_LOCKED_IDS) : [];
    const ownersRaw = meta.get("lockOwners");
    const owners =
      ownersRaw && typeof ownersRaw === "object" ? (ownersRaw as Record<string, string>) : {};
    this.lockedIds.clear();
    this.lockOwners.clear();
    for (const id of fromMeta) {
      this.lockedIds.add(id);
      const o = owners[id];
      if (o) this.lockOwners.set(id, o);
    }
    this.doc.getMap(YKEYS.assets).forEach((row, id) => {
      if (row instanceof Y.Map && row.get("locked") === true) this.lockedIds.add(id);
    });
    this.fingerprints.clear();
    const strokes = this.doc.getArray(YKEYS.strokes);
    const pending = new Set(this.lockedIds);
    for (let i = 0; i < strokes.length && pending.size > 0; i++) {
      const row = strokes.get(i);
      if (!(row instanceof Y.Map)) continue;
      const sid = String(row.get("id") ?? "");
      if (!pending.has(sid)) continue;
      pending.delete(sid);
      this.fingerprints.set(sid, JSON.stringify(row.toJSON()));
    }
    for (const id of pending) {
      this.fingerprints.set(id, entityFingerprint(this.doc, id));
    }
  }

  snapshot(): LockGuardState {
    return {
      lockedIds: new Set(this.lockedIds),
      fingerprints: new Map(this.fingerprints),
      lockOwners: new Map(this.lockOwners),
    };
  }

  /** True if any locked entity fingerprint changed vs `before`. */
  lockedMutationDetected(before: LockGuardState): boolean {
    const pending = new Set(before.lockedIds);
    const strokes = this.doc.getArray(YKEYS.strokes);
    for (let i = 0; i < strokes.length && pending.size > 0; i++) {
      const row = strokes.get(i);
      if (!(row instanceof Y.Map)) continue;
      const sid = String(row.get("id") ?? "");
      if (!pending.has(sid)) continue;
      pending.delete(sid);
      const now = JSON.stringify(row.toJSON());
      if (before.fingerprints.get(sid) !== now) return true;
    }
    for (const id of pending) {
      const now = entityFingerprint(this.doc, id);
      if (before.fingerprints.get(id) !== now) return true;
    }
    return false;
  }

  lockedIdsOverflowInMeta(): boolean {
    const raw = this.doc.getMap(YKEYS.meta).get("lockedIds");
    return Array.isArray(raw) && raw.length > MAX_LOCKED_IDS;
  }
}
