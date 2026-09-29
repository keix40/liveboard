import * as Y from "yjs";
import { ASSET_MAX_BYTES, ASSET_ROOM_MAX_BYTES, YKEYS } from "@liveboard/shared";
import { LOCAL_ORIGIN } from "./strokes";

export interface BoardAsset {
  id: string;
  mime: string;
  dataBase64: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
  z: number;
  authorId: string;
}

export function getAssets(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(YKEYS.assets);
}

function assetBytes(map: Y.Map<Y.Map<unknown>>): number {
  let total = 0;
  map.forEach((m) => {
    const d = m.get("dataBase64");
    if (typeof d === "string") total += Math.ceil((d.length * 3) / 4);
  });
  return total;
}

export async function compressToBase64(bytes: Uint8Array): Promise<string> {
  if (typeof CompressionStream === "undefined") {
    return btoa(String.fromCharCode(...bytes));
  }
  const copy = new Uint8Array(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...buf));
}

export function upsertAsset(doc: Y.Doc, asset: BoardAsset): void {
  const payloadBytes = Math.ceil((asset.dataBase64.length * 3) / 4);
  if (payloadBytes > ASSET_MAX_BYTES) {
    throw new Error(`Asset exceeds ${ASSET_MAX_BYTES} bytes`);
  }
  const map = getAssets(doc);
  const nextTotal = assetBytes(map) + payloadBytes;
  if (nextTotal > ASSET_ROOM_MAX_BYTES) {
    throw new Error(`Room asset budget exceeded (${ASSET_ROOM_MAX_BYTES} bytes)`);
  }
  doc.transact(() => {
    const m = new Y.Map<unknown>();
    m.set("id", asset.id);
    m.set("mime", asset.mime);
    m.set("dataBase64", asset.dataBase64);
    m.set("x", asset.x);
    m.set("y", asset.y);
    m.set("w", asset.w);
    m.set("h", asset.h);
    m.set("locked", asset.locked);
    m.set("z", asset.z);
    m.set("authorId", asset.authorId);
    map.set(asset.id, m);
  }, LOCAL_ORIGIN);
}
