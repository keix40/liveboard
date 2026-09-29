"use client";

import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { BoardBackground, BoardTemplate, RoomRole } from "@liveboard/shared";
import { writeBoardMeta, type BoardMeta } from "@/lib/board-meta";
import { ensureEmptyPageSnapshot, type PageSnapshot } from "@/lib/pages";
import { pushSnapshot, type HistorySnapshot } from "@/lib/snapshots";
import { applyTemplate } from "@/lib/templates";
import { compressToBase64, upsertAsset } from "@/lib/assets";
import { renderPdfPagesToDataUrls } from "@/lib/pdf-import";
import { addReaction } from "@/lib/reactions";
import { addComment } from "@/lib/comments";
import { LOCAL_ORIGIN } from "@/lib/strokes";

interface Props {
  doc: Y.Doc;
  meta: BoardMeta;
  metaRevision: number;
  onMetaRevision(): void;
  stabilizer: number;
  onStabilizer(v: number): void;
  shapeRecognize: boolean;
  onShapeRecognize(v: boolean): void;
  readOnly: boolean;
  roomRole: RoomRole;
  authorId: string;
  followPresenter: boolean;
  onFollowPresenter(v: boolean): void;
  isPresenter: boolean;
  onPresenter(v: boolean): void;
  className?: string;
  history: HistorySnapshot[];
  onHistoryPreview(snap: PageSnapshot): void;
  onClearHistoryPreview(): void;
  onRestoreSnapshot(snap: PageSnapshot): void;
  onAddFrame(): void;
  onGoToFrame(id: string): void;
  onExportFrame(id: string): void;
  onToggleLockSelection(): void;
  hasSelection: boolean;
  activePageId: string;
  onSwitchPage(nextId: string, fromId: string): void;
}

export function BoardSidePanel(p: Props) {
  void p.metaRevision;
  const [scrubIndex, setScrubIndex] = useState(0);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (p.history.length === 0) setScrubIndex(0);
    else setScrubIndex((i) => Math.min(i, p.history.length - 1));
  }, [p.history.length]);

  useEffect(
    () => () => {
      if (playRef.current) clearInterval(playRef.current);
    },
    [],
  );
  const patchMeta = (patch: Partial<BoardMeta>) => {
    writeBoardMeta(p.doc, patch, LOCAL_ORIGIN);
    p.onMetaRevision();
  };

  const addPage = () => {
    const id = `page-${crypto.randomUUID().slice(0, 8)}`;
    const order = [...p.meta.pageOrder, id];
    p.doc.transact(() => ensureEmptyPageSnapshot(p.doc, id), LOCAL_ORIGIN);
    patchMeta({ pageOrder: order });
    if (p.isPresenter) {
      p.onSwitchPage(id, p.activePageId);
    }
  };

  const importImage = async (file: File) => {
    setImportError(null);
    try {
      const dims = await readImageDimensions(file);
      if (dims.w > 8192 || dims.h > 8192) {
        throw new Error("Image exceeds 8192px on one side");
      }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataBase64 = await compressToBase64(bytes);
    upsertAsset(p.doc, {
      id: crypto.randomUUID(),
      mime: file.type || "image/png",
      dataBase64,
      x: 120,
      y: 120,
      w: 480,
      h: 320,
      locked: false,
      z: Date.now(),
      authorId: p.authorId,
    });
    p.onMetaRevision();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const previewAt = (index: number) => {
    const snap = p.history[index];
    if (!snap) return;
    p.onHistoryPreview(snap.page);
  };

  const restoreAt = (index: number) => {
    const snap = p.history[index];
    if (!snap) return;
    p.onClearHistoryPreview();
    p.onRestoreSnapshot(snap.page);
  };

  return (
    <aside
      className={`board-side-panel${p.className ? ` ${p.className}` : ""}`}
      data-testid="board-side-panel"
    >
      <div className="side-row">
        <label>
          Stabilizer
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(p.stabilizer * 100)}
            disabled={p.readOnly}
            data-testid="stabilizer-slider"
            onChange={(e) => p.onStabilizer(Number(e.target.value) / 100)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={p.shapeRecognize}
            disabled={p.readOnly}
            data-testid="shape-recognize-toggle"
            onChange={(e) => p.onShapeRecognize(e.target.checked)}
          />
          Shape snap
        </label>
      </div>
      <div className="side-row">
        <select
          data-testid="background-select"
          value={p.meta.background}
          disabled={p.readOnly}
          onChange={(e) => patchMeta({ background: e.target.value as BoardBackground })}
        >
          <option value="blank">Blank</option>
          <option value="grid">Grid</option>
          <option value="dots">Dots</option>
          <option value="lined">Lined</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={p.meta.darkMode}
            disabled={p.readOnly}
            data-testid="dark-mode-toggle"
            onChange={(e) => patchMeta({ darkMode: e.target.checked })}
          />
          Dark
        </label>
        <select
          data-testid="template-select"
          disabled={p.readOnly}
          value={p.meta.template}
          onChange={(e) => {
            const template = e.target.value as BoardTemplate;
            patchMeta({ template });
            applyTemplate(p.doc, template, p.authorId);
            p.onMetaRevision();
          }}
        >
          <option value="none">No template</option>
          <option value="kanban">Kanban</option>
          <option value="mindmap">Mind map</option>
          <option value="wireframe">Wireframe</option>
          <option value="retro">Retro</option>
        </select>
      </div>
      <div className="side-row">
        <select
          data-testid="page-select"
          value={p.activePageId}
          onChange={(e) => {
            const next = e.target.value;
            p.onSwitchPage(next, p.activePageId);
          }}
        >
          {p.meta.pageOrder.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button type="button" data-testid="page-add" disabled={p.readOnly} onClick={addPage}>
          + Page
        </button>
        <button
          type="button"
          data-testid="snapshot-save"
          disabled={p.readOnly}
          onClick={() => pushSnapshot(p.doc, `Snapshot ${new Date().toLocaleTimeString()}`)}
        >
          Snapshot
        </button>
        <button
          type="button"
          data-testid="lock-selection"
          disabled={p.readOnly || !p.hasSelection}
          onClick={p.onToggleLockSelection}
        >
          🔒 Lock
        </button>
      </div>
      <div className="side-row side-history">
        <label className="history-scrub">
          History
          <input
            type="range"
            min={0}
            max={Math.max(0, p.history.length - 1)}
            value={scrubIndex}
            disabled={p.history.length === 0}
            data-testid="history-scrub"
            onChange={(e) => {
              const idx = Number(e.target.value);
              setScrubIndex(idx);
              previewAt(idx);
            }}
          />
        </label>
        <button
          type="button"
          data-testid="history-restore"
          disabled={p.readOnly || p.history.length === 0}
          onClick={() => restoreAt(scrubIndex)}
        >
          Restore
        </button>
        <button
          type="button"
          data-testid="history-play"
          disabled={p.history.length < 2}
          onClick={() => {
            if (playRef.current) {
              clearInterval(playRef.current);
              playRef.current = null;
              p.onClearHistoryPreview();
              return;
            }
            let idx = 0;
            playRef.current = setInterval(() => {
              previewAt(idx);
              setScrubIndex(idx);
              idx = (idx + 1) % p.history.length;
            }, 600);
          }}
        >
          ▶ Replay
        </button>
      </div>
      <ul className="history-list" data-testid="history-list">
        {p.history.map((h, i) => (
          <li key={h.id}>
            <button
              type="button"
              data-testid="history-item"
              disabled={p.readOnly}
              onClick={() => {
                setScrubIndex(i);
                previewAt(i);
              }}
            >
              {h.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="side-row">
        <button type="button" data-testid="frame-add" disabled={p.readOnly} onClick={p.onAddFrame}>
          + Frame
        </button>
      </div>
      <ul className="frame-list" data-testid="frame-list">
        {p.meta.frames.map((f) => (
          <li key={f.id}>
            <span>{f.name}</span>
            <button type="button" data-testid="frame-go" onClick={() => p.onGoToFrame(f.id)}>
              Go
            </button>
            <button type="button" data-testid="frame-export" onClick={() => p.onExportFrame(f.id)}>
              PNG
            </button>
          </li>
        ))}
      </ul>
      {importError ? (
        <p className="import-error" data-testid="import-error" role="alert">
          {importError}
        </p>
      ) : null}
      <div className="side-row">
        <label className="file-btn">
          Image
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={p.readOnly}
            data-testid="import-image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importImage(f);
            }}
          />
        </label>
        <label className="file-btn">
          PDF
          <input
            type="file"
            accept="application/pdf"
            hidden
            disabled={p.readOnly}
            data-testid="import-pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void (async () => {
                setImportError(null);
                try {
                  const pages = await renderPdfPagesToDataUrls(f);
                  for (let i = 0; i < pages.length; i++) {
                    const dataUrl = pages[i]!;
                    const bin = Uint8Array.from(atob(dataUrl.split(",")[1]!), (c) => c.charCodeAt(0));
                    upsertAsset(p.doc, {
                      id: crypto.randomUUID(),
                      mime: "image/png",
                      dataBase64: await compressToBase64(bin),
                      x: 80,
                      y: 80 + i * 520,
                      w: 640,
                      h: 480,
                      locked: true,
                      z: Date.now() + i,
                      authorId: p.authorId,
                    });
                  }
                  p.onMetaRevision();
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : "PDF import failed");
                }
              })();
            }}
          />
        </label>
        <button
          type="button"
          data-testid="add-reaction"
          disabled={p.readOnly}
          onClick={() => addReaction(p.doc, { emoji: "👍", x: 200, y: 200, authorId: p.authorId })}
        >
          👍
        </button>
        <button
          type="button"
          data-testid="add-comment"
          disabled={p.readOnly}
          onClick={() => {
            const text = prompt("Pinned comment") ?? "Note";
            addComment(p.doc, { x: 240, y: 240, text, pinned: true, authorId: p.authorId });
          }}
        >
          💬
        </button>
      </div>
      <div className="side-row">
        <span className="role-pill" data-testid="room-role">
          {p.roomRole}
        </span>
        <label>
          <input
            type="checkbox"
            checked={p.isPresenter}
            disabled={p.readOnly}
            data-testid="presenter-toggle"
            onChange={(e) => p.onPresenter(e.target.checked)}
          />
          Present
        </label>
        <label>
          <input
            type="checkbox"
            checked={p.followPresenter}
            data-testid="follow-presenter-toggle"
            onChange={(e) => p.onFollowPresenter(e.target.checked)}
          />
          Follow
        </label>
      </div>
    </aside>
  );
}

function readImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
