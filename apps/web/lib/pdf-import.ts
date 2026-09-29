import { ASSET_MAX_IMAGE_DIMENSION, PDF_MAX_BYTES, PDF_MAX_PAGES } from "@liveboard/shared";

/** Render up to PDF_MAX_PAGES PDF pages to PNG data URLs (pdf.js). */
export async function renderPdfPagesToDataUrls(file: File): Promise<string[]> {
  if (file.size > PDF_MAX_BYTES) {
    throw new Error(`PDF exceeds ${PDF_MAX_BYTES} bytes`);
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const limit = Math.min(doc.numPages, PDF_MAX_PAGES);
  const out: string[] = [];
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    if (viewport.width > ASSET_MAX_IMAGE_DIMENSION || viewport.height > ASSET_MAX_IMAGE_DIMENSION) {
      throw new Error(`PDF page exceeds ${ASSET_MAX_IMAGE_DIMENSION}px`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL("image/png"));
  }
  return out;
}
