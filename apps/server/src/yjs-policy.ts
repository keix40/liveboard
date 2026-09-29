import * as Y from "yjs";
import { MAX_LOCKED_IDS, YKEYS } from "@liveboard/shared";
import { LockGuard, type LockGuardState } from "./lock-guard.js";

export const POLICY_CHECK_BUDGET_MS = 5;

/** Stable JSON fingerprint for a board object id (stroke, shape, note, or asset). */
export function entityFingerprint(doc: Y.Doc, id: string): string | null {
  const strokes = doc.getArray(YKEYS.strokes);
  for (let i = 0; i < strokes.length; i++) {
    const row = strokes.get(i);
    if (row instanceof Y.Map && String(row.get("id")) === id) {
      return JSON.stringify(row.toJSON());
    }
  }
  for (const key of [YKEYS.shapes, YKEYS.notes, YKEYS.assets] as const) {
    const row = doc.getMap(key).get(id);
    if (row instanceof Y.Map) return JSON.stringify(row.toJSON());
  }
  return null;
}

export function enforceLockedIdsCap(doc: Y.Doc): boolean {
  const raw = doc.getMap(YKEYS.meta).get("lockedIds");
  return !(Array.isArray(raw) && raw.length > MAX_LOCKED_IDS);
}

/** Unlocking requires the original locker or board owner (ownerId in meta). */
export function lockMetaChangesAuthorized(
  before: LockGuardState,
  after: LockGuard,
  actorId: string,
  ownerId: string | null,
): boolean {
  for (const id of before.lockedIds) {
    if (!after.lockedIds.has(id)) {
      const locker = before.lockOwners.get(id);
      if (locker && locker !== actorId && ownerId !== actorId) return false;
    }
  }
  return true;
}

function readOwnerId(doc: Y.Doc): string | null {
  const o = doc.getMap(YKEYS.meta).get("ownerId");
  return o != null ? String(o) : null;
}

/**
 * Validate update against locked entities using shadow doc + O(locked) fingerprints.
 * Does not mutate `liveDoc`.
 */
export function validateLockedUpdate(
  liveDoc: Y.Doc,
  shadowDoc: Y.Doc,
  update: Uint8Array,
  guard: LockGuard,
  budgetMs = POLICY_CHECK_BUDGET_MS,
  actorId?: string,
): boolean {
  const started = performance.now();
  const text = Buffer.from(update).toString("latin1");
  const touchesMeta =
    text.includes(YKEYS.meta) ||
    text.includes("lockedIds") ||
    text.includes("lockOwners") ||
    (update.length < 512 && !text.includes(YKEYS.strokes));

  if (guard.lockedIds.size === 0 && !touchesMeta) return true;

  const before = guard.snapshot();
  Y.applyUpdate(shadowDoc, update);
  const revertShadow = () => {
    Y.applyUpdate(shadowDoc, Y.encodeStateAsUpdate(liveDoc, Y.encodeStateVector(shadowDoc)));
  };

  if (performance.now() - started > budgetMs) {
    revertShadow();
    return false;
  }

  const trialGuard = new LockGuard(shadowDoc);
  if (trialGuard.lockedIdsOverflowInMeta()) {
    revertShadow();
    return false;
  }

  if (actorId && !lockMetaChangesAuthorized(before, trialGuard, actorId, readOwnerId(liveDoc))) {
    revertShadow();
    return false;
  }

  const violated = guard.lockedIds.size > 0 ? trialGuard.lockedMutationDetected(before) : false;
  revertShadow();
  if (performance.now() - started > budgetMs) return false;
  return !violated;
}

export function policyAllowsUpdate(
  liveDoc: Y.Doc,
  shadowDoc: Y.Doc,
  update: Uint8Array,
  guard: LockGuard,
  actorId?: string,
): boolean {
  if (!enforceLockedIdsCap(liveDoc)) return false;
  return validateLockedUpdate(liveDoc, shadowDoc, update, guard, POLICY_CHECK_BUDGET_MS, actorId);
}
