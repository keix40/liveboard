/** Decode gzip-or-raw base64 asset payloads to Blob URLs for canvas drawImage. */

const cache = new Map<string, string>();

export async function assetDataToBlobUrl(dataBase64: string, mime: string): Promise<string> {
  const key = `${mime}:${dataBase64.slice(0, 48)}:${dataBase64.length}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const binary = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  let bytes = binary;
  if (binary.length >= 2 && binary[0] === 0x1f && binary[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("gzip assets require DecompressionStream");
    }
    const stream = new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
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
