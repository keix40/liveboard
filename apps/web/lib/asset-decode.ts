import { ASSET_MAX_DECOMPRESSED_BYTES } from "@liveboard/shared";
import { base64ToBytes } from "./base64";

/** Decode gzip-or-raw base64 asset payloads to Blob URLs for canvas drawImage. */

const cache = new Map<string, string>();

export async function assetDataToBlobUrl(dataBase64: string, mime: string): Promise<string> {
  const key = `${mime}:${dataBase64.slice(0, 48)}:${dataBase64.length}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const binary = base64ToBytes(dataBase64);
  let bytes = binary;
  if (binary.length >= 2 && binary[0] === 0x1f && binary[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("gzip assets require DecompressionStream");
    }
    const stream = new Blob([new Uint8Array(binary)]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (bytes.length > ASSET_MAX_DECOMPRESSED_BYTES) {
    throw new Error(`Asset exceeds decompressed limit (${ASSET_MAX_DECOMPRESSED_BYTES} bytes)`);
  }
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  cache.set(key, url);
  return url;
}

export function revokeAssetBlobUrl(url: string): void {
  for (const [k, v] of cache.entries()) {
    if (v === url) {
      cache.delete(k);
      URL.revokeObjectURL(url);
      return;
    }
  }
}
