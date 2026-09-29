"use client";

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/camera";
import { getNoteText, readNote, type YNote } from "@/lib/notes";
import { LOCAL_ORIGIN } from "@/lib/strokes";

interface Props {
  doc: Y.Doc;
  camera: Camera;
  notesRevision: number;
  notes: Map<string, YNote>;
  selectedIds: Set<string>;
  onSelect(id: string): void;
}

function StickyNote({
  doc,
  camera,
  noteMap,
  selected,
  onSelect,
}: {
  doc: Y.Doc;
  camera: Camera;
  noteMap: YNote;
  selected: boolean;
  onSelect(): void;
}) {
  const n = readNote(noteMap);
  const screen = worldToScreen(camera, n.x, n.y);
  const w = n.w * camera.zoom;
  const h = n.h * camera.zoom;
  const yText = getNoteText(noteMap);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!yText) return;
    const syncFromRemote = () => {
      const el = textareaRef.current;
      if (!el) return;
      const remote = yText.toString();
      if (document.activeElement !== el) {
        if (el.value !== remote) el.value = remote;
        return;
      }
      if (el.value === remote) return;
      const start = el.selectionStart ?? remote.length;
      const end = el.selectionEnd ?? start;
      el.value = remote;
      const len = remote.length;
      el.setSelectionRange(Math.min(start, len), Math.min(end, len));
    };
    syncFromRemote();
    yText.observe(syncFromRemote);
    return () => yText.unobserve(syncFromRemote);
  }, [yText]);

  return (
    <div
      className={`sticky-note${selected ? " selected" : ""}`}
      style={{
        transform: `translate(${screen.x}px, ${screen.y}px)`,
        width: w,
        height: h,
        background: n.color,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <textarea
        ref={textareaRef}
        className="sticky-text"
        data-testid={`note-text-${n.id}`}
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
}

export function NoteLayer({ doc, camera, notesRevision, notes, selectedIds, onSelect }: Props) {
  return (
    <div className="note-layer" aria-hidden={false} data-notes-revision={notesRevision}>
      {[...notes.entries()].map(([id, m]) => (
        <StickyNote
          key={id}
          doc={doc}
          camera={camera}
          noteMap={m}
          selected={selectedIds.has(id)}
          onSelect={() => onSelect(id)}
        />
      ))}
    </div>
  );
}
