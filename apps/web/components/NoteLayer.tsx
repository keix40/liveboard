"use client";

import * as Y from "yjs";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/camera";
import { getNoteText, readNote, type YNote } from "@/lib/notes";
import { LOCAL_ORIGIN } from "@/lib/strokes";

interface Props {
  doc: Y.Doc;
  camera: Camera;
  notes: Map<string, YNote>;
  selectedIds: Set<string>;
  onSelect(id: string): void;
}

export function NoteLayer({ doc, camera, notes, selectedIds, onSelect }: Props) {
  return (
    <div className="note-layer" aria-hidden={false}>
      {[...notes.entries()].map(([id, m]) => {
        const n = readNote(m);
        const screen = worldToScreen(camera, n.x, n.y);
        const w = n.w * camera.zoom;
        const h = n.h * camera.zoom;
        const yText = getNoteText(m);
        return (
          <div
            key={id}
            className={`sticky-note${selectedIds.has(id) ? " selected" : ""}`}
            style={{
              transform: `translate(${screen.x}px, ${screen.y}px)`,
              width: w,
              height: h,
              background: n.color,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
          >
            <textarea
              className="sticky-text"
              defaultValue={n.text}
              onChange={(e) => {
                if (!yText) return;
                doc.transact(() => {
                  yText.delete(0, yText.length);
                  yText.insert(0, e.target.value);
                }, LOCAL_ORIGIN);
              }}
              style={{ fontSize: Math.max(12, 14 * camera.zoom) }}
            />
          </div>
        );
      })}
    </div>
  );
}
