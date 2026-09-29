import { jsPDF } from "jspdf";
import type { Bounds } from "./camera";
import { renderBoardToExport, type RenderBoardOpts } from "./render-board";

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportBoardPng(filename: string, bounds: Bounds, renderOpts: Omit<RenderBoardOpts, "camera" | "dpr">): Promise<void> {
  const canvas = renderBoardToExport(bounds, renderOpts);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (blob) downloadBlob(filename, blob);
}

export async function exportBoardPdf(filename: string, bounds: Bounds, renderOpts: Omit<RenderBoardOpts, "camera" | "dpr">): Promise<void> {
  const canvas = renderBoardToExport(bounds, renderOpts);
  const dataUrl = canvas.toDataURL("image/png");
  const w = canvas.width;
  const h = canvas.height;
  const orientation = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  pdf.save(filename);
}
