import { ASSET_MAX_DECOMPRESSED_BYTES } from "@liveboard/shared";
import { base64ToBytes } from "./base64";

const cache = new Map<string, string>();

async function gunzipLimited(input: Uint8Array, maxOut: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("gzip assets require DecompressionStream");
  }
  const reader = new Blob([new Uint8Array(input)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxOut) {
      await reader.cancel();
      throw new Error(`Asset exceeds decompressed limit (${maxOut} bytes)`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function assetDataToBlobUrl(dataBase64: string, mime: string): Promise<string> {
  const key = `${mime}:${dataBase64.slice(0, 48)}:${dataBase64.length}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const binary = base64ToBytes(dataBase64);
  let bytes = binary;
  if (binary.length >= 2 && binary[0] === 0x1f && binary[1] === 0x8b) {
    bytes = await gunzipLimited(binary, ASSET_MAX_DECOMPRESSED_BYTES);
  } else if (bytes.length > ASSET_MAX_DECOMPRESSED_BYTES) {
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
