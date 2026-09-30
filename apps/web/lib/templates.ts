import type * as Y from "yjs";
import type { BoardTemplate } from "@liveboard/shared";
import { createNote } from "./notes";
import { upsertShape } from "./shapes";
import { LOCAL_ORIGIN } from "./strokes";

function templateLabel(
  doc: Y.Doc,
  text: string,
  x: number,
  y: number,
  authorId: string,
  z: number,
): void {
  upsertShape(doc, {
    id: crypto.randomUUID(),
    kind: "text",
    x,
    y,
    w: 220,
    h: 28,
    rotation: 0,
    stroke: "#64748b",
    fill: null,
    strokeWidth: 1,
    text,
    z,
    authorId,
    createdAt: Date.now(),
  });
}

/** Seed template content into the active page (does not clear existing ink). */
export function applyTemplate(doc: Y.Doc, template: BoardTemplate, authorId: string): void {
  if (template === "none") return;
  doc.transact(() => {
    const z = Date.now();
    if (template === "kanban") {
      const titles = ["To do", "Doing", "Done"];
      for (let i = 0; i < 3; i++) {
        templateLabel(doc, titles[i]!, 80 + i * 280, 48, authorId, z + i);
        upsertShape(doc, {
          id: crypto.randomUUID(),
          kind: "rect",
          x: 80 + i * 280,
          y: 80,
          w: 240,
          h: 480,
          rotation: 0,
          stroke: "#64748b",
          fill: "#f1f5f922",
          strokeWidth: 2,
          z: z + i,
          authorId,
          createdAt: Date.now(),
        });
      }
    } else if (template === "mindmap") {
      templateLabel(doc, "Central idea", 300, 200, authorId, z);
      upsertShape(doc, {
        id: crypto.randomUUID(),
        kind: "ellipse",
        x: 320,
        y: 240,
        w: 160,
        h: 100,
        rotation: 0,
        stroke: "#3b82f6",
        fill: "#3b82f622",
        strokeWidth: 2,
        z: z,
        authorId,
        createdAt: Date.now(),
      });
    } else if (template === "wireframe") {
      templateLabel(doc, "Screen", 120, 72, authorId, z);
      upsertShape(doc, {
        id: crypto.randomUUID(),
        kind: "rect",
        x: 120,
        y: 100,
        w: 520,
        h: 360,
        rotation: 0,
        stroke: "#0f172a",
        fill: null,
        strokeWidth: 2,
        z: z,
        authorId,
        createdAt: Date.now(),
      });
    } else if (template === "retro") {
      const titles = ["Went well", "To improve", "Action items"];
      const colors = ["#fef08a", "#bbf7d0", "#fecaca"];
      for (let i = 0; i < 3; i++) {
        templateLabel(doc, titles[i]!, 100 + i * 220, 64, authorId, z + i);
        createNote(doc, {
          id: crypto.randomUUID(),
          authorId,
          x: 100 + i * 220,
          y: 100,
          color: colors[i]!,
          z: z + i,
        });
      }
    }
  }, LOCAL_ORIGIN);
}
