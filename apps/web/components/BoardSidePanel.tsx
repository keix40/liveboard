"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  shareLinks?: { editLink: string; viewLink: string } | null;
  editAccessBanner?: string | null;
  comments?: { id: string; text: string; x: number; y: number }[];
  onClosePanel?(): void;
}

export function BoardSidePanel(p: Props) {
  void p.metaRevision;
  const [scrubIndex, setScrubIndex] = useState(0);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState({
    share: true,
    canvas: true,
    pages: true,
    history: true,
    insert: true,
    collaborate: true,
  });

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen((s) => ({ ...s, [key]: !s[key] }));
  };

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
    p.onSwitchPage(id, p.activePageId);
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
      upsertAsset(
        p.doc,
        {
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
        },
        p.activePageId,
      );
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

  const collapsed = p.className?.includes("collapsed");

  return (
    <>
      {!collapsed && p.onClosePanel ? (
        <button
          type="button"
          className="side-panel-backdrop"
          aria-label="Close panel"
          data-testid="side-panel-backdrop"
          onClick={p.onClosePanel}
        />
      ) : null}
      <aside
        className={`board-side-panel${p.className ? ` ${p.className}` : ""}${collapsed ? "" : " sheet-open"}`}
        data-testid="board-side-panel"
      >
        <header className="side-panel-header">
          <h2 className="side-panel-title">Board</h2>
          {p.onClosePanel ? (
            <button type="button" className="side-btn side-btn-ghost" data-testid="side-panel-close" onClick={p.onClosePanel}>
              ✕
            </button>
          ) : null}
        </header>

        {p.editAccessBanner ? (
          <p className="side-banner" data-testid="edit-access-banner">
            {p.editAccessBanner}
          </p>
        ) : null}

        <SideSection
          title="Share"
          open={sectionsOpen.share}
          onToggle={() => toggleSection("share")}
          testId="side-section-share"
        >
          {p.shareLinks ? (
            <div className="side-btn-row share-links" data-testid="share-links">
              <button
                type="button"
                className="side-btn"
                data-testid="copy-edit-link"
                onClick={() => void navigator.clipboard.writeText(p.shareLinks!.editLink)}
              >
                Copy can edit
              </button>
              <button
                type="button"
                className="side-btn"
                data-testid="copy-view-link"
                onClick={() => void navigator.clipboard.writeText(p.shareLinks!.viewLink)}
              >
                Copy view only
              </button>
            </div>
          ) : (
            <p className="side-muted">Share links appear when the room is connected.</p>
          )}
        </SideSection>

        <SideSection
          title="Canvas"
          open={sectionsOpen.canvas}
          onToggle={() => toggleSection("canvas")}
          testId="side-section-canvas"
        >
          <label className="side-field">
            <span className="side-field-label">Stabilizer</span>
            <input
              type="range"
              className="side-range"
              min={0}
              max={100}
              value={Math.round(p.stabilizer * 100)}
              disabled={p.readOnly}
              data-testid="stabilizer-slider"
              onChange={(e) => p.onStabilizer(Number(e.target.value) / 100)}
            />
          </label>
          <label className="side-check">
            <input
              type="checkbox"
              checked={p.shapeRecognize}
              disabled={p.readOnly}
              data-testid="shape-recognize-toggle"
              onChange={(e) => p.onShapeRecognize(e.target.checked)}
            />
            <span>Shape snap</span>
          </label>
          <label className="side-field">
            <span className="side-field-label">Background</span>
            <select
              className="side-select"
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
          </label>
          <label className="side-check">
            <input
              type="checkbox"
              checked={p.meta.darkMode}
              disabled={p.readOnly}
              data-testid="dark-mode-toggle"
              onChange={(e) => patchMeta({ darkMode: e.target.checked })}
            />
            <span>Dark mode</span>
          </label>
          <label className="side-field">
            <span className="side-field-label">Template</span>
            <select
              className="side-select"
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
          </label>
        </SideSection>

        <SideSection
          title="Pages"
          open={sectionsOpen.pages}
          onToggle={() => toggleSection("pages")}
          testId="side-section-pages"
        >
          <div className="side-btn-row">
            <select
              className="side-select side-select-grow"
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
            <button type="button" className="side-btn" data-testid="page-add" disabled={p.readOnly} onClick={addPage}>
              + Page
            </button>
          </div>
          <div className="side-btn-row">
            <button
              type="button"
              className="side-btn"
              data-testid="snapshot-save"
              disabled={p.readOnly}
              onClick={() =>
                pushSnapshot(p.doc, `Snapshot ${new Date().toLocaleTimeString()}`, p.activePageId)
              }
            >
              Snapshot
            </button>
            <button
              type="button"
              className="side-btn"
              data-testid="lock-selection"
              disabled={p.readOnly || !p.hasSelection}
              onClick={p.onToggleLockSelection}
            >
              Lock selection
            </button>
          </div>
        </SideSection>

        <SideSection
          title="History"
          open={sectionsOpen.history}
          onToggle={() => toggleSection("history")}
          testId="side-section-history"
        >
          <label className="side-field history-scrub">
            <span className="side-field-label">Scrub</span>
            <input
              type="range"
              className="side-range"
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
          <div className="side-btn-row">
            <button
              type="button"
              className="side-btn"
              data-testid="history-restore"
              disabled={p.readOnly || p.history.length === 0}
              onClick={() => restoreAt(scrubIndex)}
            >
              Restore
            </button>
            <button
              type="button"
              className="side-btn"
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
              Replay
            </button>
          </div>
          <ul className="side-list history-list" data-testid="history-list">
            {p.history.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="side-list-btn"
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
          <div className="side-btn-row">
            <button type="button" className="side-btn" data-testid="frame-add" disabled={p.readOnly} onClick={p.onAddFrame}>
              + Frame
            </button>
          </div>
          <ul className="side-list frame-list" data-testid="frame-list">
            {p.meta.frames.map((f) => (
              <li key={f.id}>
                <span className="side-list-label">{f.name}</span>
                <button type="button" className="side-btn side-btn-sm" data-testid="frame-go" onClick={() => p.onGoToFrame(f.id)}>
                  Go
                </button>
                <button
                  type="button"
                  className="side-btn side-btn-sm"
                  data-testid="frame-export"
                  onClick={() => p.onExportFrame(f.id)}
                >
                  PNG
                </button>
              </li>
            ))}
          </ul>
        </SideSection>

        <SideSection
          title="Insert"
          open={sectionsOpen.insert}
          onToggle={() => toggleSection("insert")}
          testId="side-section-insert"
        >
          {importError ? (
            <p className="import-error" data-testid="import-error" role="alert">
              {importError}
            </p>
          ) : null}
          <div className="side-btn-row">
            <label className="side-btn side-file">
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
            <label className="side-btn side-file">
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
                        upsertAsset(
                          p.doc,
                          {
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
                          },
                          p.activePageId,
                        );
                      }
                      p.onMetaRevision();
                    } catch (err) {
                      setImportError(err instanceof Error ? err.message : "PDF import failed");
                    }
                  })();
                }}
              />
            </label>
          </div>
        </SideSection>

        <SideSection
          title="Collaborate"
          open={sectionsOpen.collaborate}
          onToggle={() => toggleSection("collaborate")}
          testId="side-section-collaborate"
        >
          <div className="side-btn-row">
            <button
              type="button"
              className="side-btn"
              data-testid="add-reaction"
              disabled={p.readOnly}
              onClick={() =>
                addReaction(p.doc, { emoji: "👍", x: 200, y: 200, authorId: p.authorId }, p.activePageId)
              }
            >
              👍 Reaction
            </button>
            <button
              type="button"
              className="side-btn"
              data-testid="add-comment"
              disabled={p.readOnly}
              onClick={() => {
                const text = prompt("Pinned comment") ?? "Note";
                addComment(
                  p.doc,
                  { x: 240, y: 240, text, pinned: true, authorId: p.authorId },
                  p.activePageId,
                );
              }}
            >
              💬 Comment
            </button>
          </div>
          {p.comments && p.comments.length > 0 ? (
            <ul className="side-list comment-list" data-testid="comment-list">
              {p.comments.map((c) => (
                <li key={c.id}>
                  <strong>{c.text.slice(0, 80)}</strong>
                  <span className="comment-coords">
                    ({Math.round(c.x)}, {Math.round(c.y)})
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="side-collab-footer">
            <span className="role-pill" data-testid="room-role">
              {p.roomRole}
            </span>
            <label className="side-check">
              <input
                type="checkbox"
                checked={p.isPresenter}
                disabled={p.readOnly}
                data-testid="presenter-toggle"
                onChange={(e) => p.onPresenter(e.target.checked)}
              />
              <span>Present</span>
            </label>
            <label className="side-check">
              <input
                type="checkbox"
                checked={p.followPresenter}
                data-testid="follow-presenter-toggle"
                onChange={(e) => p.onFollowPresenter(e.target.checked)}
              />
              <span>Follow</span>
            </label>
          </div>
        </SideSection>
      </aside>
    </>
  );
}

function SideSection(props: {
  title: string;
  open: boolean;
  onToggle(): void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className={`side-section${props.open ? "" : " side-section-collapsed"}`} data-testid={props.testId}>
      <button type="button" className="side-section-heading" onClick={props.onToggle} aria-expanded={props.open}>
        <span>{props.title}</span>
        <span className="side-section-chevron" aria-hidden>
          {props.open ? "▾" : "▸"}
        </span>
      </button>
      {props.open ? <div className="side-section-body">{props.children}</div> : null}
    </section>
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
