import type * as Y from "yjs";
import type { BoardTemplate } from "@liveboard/shared";
import { createNote } from "./notes";
import { upsertShape } from "./shapes";
import { LOCAL_ORIGIN } from "./strokes";

/** Seed template content into the active page (does not clear existing ink). */
export function applyTemplate(doc: Y.Doc, template: BoardTemplate, authorId: string): void {
  if (template === "none") return;
  doc.transact(() => {
    const z = Date.now();
    if (template === "kanban") {
      for (let i = 0; i < 3; i++) {
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
      createNote(doc, {
        id: crypto.randomUUID(),
        authorId,
        x: 100,
        y: 100,
        color: "#fef08a",
        z: z,
      });
      createNote(doc, {
        id: crypto.randomUUID(),
        authorId,
        x: 320,
        y: 100,
        color: "#bbf7d0",
        z: z + 1,
      });
      createNote(doc, {
        id: crypto.randomUUID(),
        authorId,
        x: 540,
        y: 100,
        color: "#fecaca",
        z: z + 2,
      });
    }
  }, LOCAL_ORIGIN);
}
