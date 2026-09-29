import * as Y from "yjs";
import { ASSET_MAX_BYTES, ASSET_ROOM_MAX_BYTES, YKEYS } from "@liveboard/shared";

function payloadBytes(dataBase64: string): number {
  return Math.ceil((dataBase64.length * 3) / 4);
}

export function roomAssetBytes(doc: Y.Doc): number {
  let total = 0;
  doc.getMap(YKEYS.assets).forEach((m) => {
    if (m instanceof Y.Map) {
      const d = m.get("dataBase64");
      if (typeof d === "string") total += payloadBytes(d);
    }
  });
  return total;
}

/** Reject updates that exceed asset budgets (counts snapshot/page refs once via assets map). */
export function assetBudgetOk(doc: Y.Doc): boolean {
  return roomAssetBytes(doc) <= ASSET_ROOM_MAX_BYTES;
}

export function assetBudgetOkAfterUpdate(doc: Y.Doc, update: Uint8Array): boolean {
  const trial = new Y.Doc({ gc: true });
  Y.applyUpdate(trial, Y.encodeStateAsUpdate(doc));
  Y.applyUpdate(trial, update);
  return assetBudgetOk(trial);
}

export function singleAssetOk(dataBase64: string): boolean {
  return payloadBytes(dataBase64) <= ASSET_MAX_BYTES;
}
