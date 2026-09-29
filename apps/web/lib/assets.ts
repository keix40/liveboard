import * as Y from "yjs";
import { ASSET_MAX_BYTES, ASSET_ROOM_MAX_BYTES } from "@liveboard/shared";
import { bytesToBase64 } from "./base64";
import { readAssets, writeAssets } from "./page-model";
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

export function getAssets(doc: Y.Doc, pageId?: string): Y.Map<Y.Map<unknown>> {
  return readAssets(doc, pageId);
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
  if (bytes.length > ASSET_MAX_BYTES) {
    throw new Error(`File exceeds ${ASSET_MAX_BYTES} byte limit`);
  }
  if (typeof CompressionStream === "undefined") {
    return bytesToBase64(bytes);
  }
  const copy = new Uint8Array(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64(buf);
}

export type YAsset = Y.Map<unknown>;

export function readAsset(m: YAsset): BoardAsset {
  return {
    id: String(m.get("id")),
    mime: String(m.get("mime") ?? "image/png"),
    dataBase64: String(m.get("dataBase64") ?? ""),
    x: Number(m.get("x") ?? 0),
    y: Number(m.get("y") ?? 0),
    w: Number(m.get("w") ?? 100),
    h: Number(m.get("h") ?? 100),
    locked: Boolean(m.get("locked")),
    z: Number(m.get("z") ?? 0),
    authorId: String(m.get("authorId") ?? ""),
  };
}

export function updateAssetRect(doc: Y.Doc, id: string, patch: Partial<Pick<BoardAsset, "x" | "y" | "w" | "h">>): void {
  const m = getAssets(doc).get(id);
  if (!(m instanceof Y.Map)) return;
  doc.transact(() => {
    if (patch.x != null) m.set("x", patch.x);
    if (patch.y != null) m.set("y", patch.y);
    if (patch.w != null) m.set("w", patch.w);
    if (patch.h != null) m.set("h", patch.h);
  }, LOCAL_ORIGIN);
}

export function setAssetLocked(doc: Y.Doc, id: string, locked: boolean): void {
  const m = getAssets(doc).get(id);
  if (!(m instanceof Y.Map)) return;
  doc.transact(() => m.set("locked", locked), LOCAL_ORIGIN);
}

export function hitAsset(asset: BoardAsset, wx: number, wy: number): boolean {
  return wx >= asset.x && wx <= asset.x + asset.w && wy >= asset.y && wy <= asset.y + asset.h;
}

export function upsertAsset(doc: Y.Doc, asset: BoardAsset, pageId?: string): void {
  const payloadBytes = Math.ceil((asset.dataBase64.length * 3) / 4);
  if (payloadBytes > ASSET_MAX_BYTES) {
    throw new Error(`Asset exceeds ${ASSET_MAX_BYTES} bytes`);
  }
  const map = getAssets(doc, pageId);
  const nextTotal = assetBytes(map) + payloadBytes;
  if (nextTotal > ASSET_ROOM_MAX_BYTES) {
    throw new Error(`Room asset budget exceeded (${ASSET_ROOM_MAX_BYTES} bytes)`);
  }
  doc.transact(() => {
    const writeMap = writeAssets(doc, pageId);
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
    writeMap.set(asset.id, m);
  }, LOCAL_ORIGIN);
}
