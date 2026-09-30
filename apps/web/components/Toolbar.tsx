"use client";

import type { ReactNode } from "react";
import type { Tool } from "@liveboard/shared";
import { inkOnCanvas } from "@/lib/ink-display";

export type DrawTool = Tool;

const COLORS = ["#0f172a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#fef08a"];
const SIZES = [2, 4, 8, 16, 24];

interface Props {
  tool: DrawTool;
  color: string;
  size: number;
  zoom: number;
  compact?: boolean;
  darkMode?: boolean;
  readOnly?: boolean;
  statusChip?: ReactNode;
  onTool(t: DrawTool): void;
  onColor(c: string): void;
  onSize(s: number): void;
  onUndo(): void;
  onRedo(): void;
  onClear(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  onExportPng(): void;
  onExportPdf(): void;
  onDeleteSelection(): void;
}

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pen", label: "✏️" },
  { id: "highlighter", label: "🖍" },
  { id: "eraser", label: "🧽" },
  { id: "pan", label: "✋" },
  { id: "select", label: "⬚" },
  { id: "rect", label: "▭" },
  { id: "ellipse", label: "◯" },
  { id: "line", label: "／" },
  { id: "arrow", label: "➤" },
  { id: "text", label: "T" },
  { id: "note", label: "📝" },
];

export function Toolbar(p: Props) {
  const ro = p.readOnly === true;
  const dark = p.darkMode === true;
  return (
    <div className={`toolbar-scroll${p.compact ? " compact" : ""}`} data-testid="toolbar-scroll">
      <div className="toolbar" role="toolbar" aria-label="Drawing tools">
        {p.statusChip ? (
          <>
            <span className="toolbar-status">{p.statusChip}</span>
            <span className="sep" aria-hidden />
          </>
        ) : null}
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tool"
            data-testid={`tool-${t.id}`}
            title={t.id}
            aria-pressed={p.tool === t.id}
            disabled={ro}
            onClick={() => p.onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="sep" aria-hidden />
        <label className="color-picker-wrap" title="Custom color">
          <input
            type="color"
            data-testid="tool-color-picker"
            value={p.color.startsWith("#") && p.color.length >= 7 ? p.color.slice(0, 7) : "#0f172a"}
            disabled={ro}
            onChange={(e) => p.onColor(e.target.value)}
            aria-label="Pick color"
          />
        </label>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="swatch"
            data-testid={`swatch-${c}`}
            style={{ background: inkOnCanvas(c, dark) }}
            aria-label={`Color ${c}`}
            aria-pressed={p.color === c}
            disabled={ro}
            onClick={() => p.onColor(c)}
          />
        ))}
        <span className="sep" aria-hidden />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className="tool size-btn"
            data-testid={`size-${s}`}
            aria-pressed={p.size === s}
            disabled={ro}
            onClick={() => p.onSize(s)}
          >
            {s}
          </button>
        ))}
        <span className="sep" aria-hidden />
        <button type="button" className="tool" data-testid="tool-undo" disabled={ro} onClick={p.onUndo} title="Undo (Ctrl/Cmd+Z)">
          ↶
        </button>
        <button type="button" className="tool" data-testid="tool-redo" disabled={ro} onClick={p.onRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
          ↷
        </button>
        <button type="button" className="tool" data-testid="tool-delete" disabled={ro} onClick={p.onDeleteSelection} title="Delete selection">
          ⌫
        </button>
        <button type="button" className="tool" data-testid="tool-clear" disabled={ro} onClick={p.onClear} title="Clear board">
          🗑
        </button>
        <span className="sep" aria-hidden />
        <button type="button" className="tool" data-testid="tool-zoom-out" onClick={p.onZoomOut} title="Zoom out">
          −
        </button>
        <span className="zoom-label" data-testid="zoom-label">
          {Math.round(p.zoom * 100)}%
        </span>
        <button type="button" className="tool" data-testid="tool-zoom-in" onClick={p.onZoomIn} title="Zoom in">
          +
        </button>
        <button type="button" className="tool" data-testid="tool-fit" onClick={p.onFit} title="Fit to screen">
          ⊡
        </button>
        <span className="sep" aria-hidden />
        <button type="button" className="tool" data-testid="tool-export-png" onClick={p.onExportPng} title="Export PNG">
          PNG
        </button>
        <button type="button" className="tool" data-testid="tool-export-pdf" onClick={p.onExportPdf} title="Export PDF">
          PDF
        </button>
      </div>
    </div>
  );
}

/** All toolbar controls that must stay tappable (used by layout regression tests). */
export const TOOLBAR_HIT_TEST_IDS = [
  ...TOOLS.map((t) => `tool-${t.id}`),
  "tool-color-picker",
  ...COLORS.map((c) => `swatch-${c}`),
  ...SIZES.map((s) => `size-${s}`),
  "tool-undo",
  "tool-redo",
  "tool-delete",
  "tool-clear",
  "tool-zoom-out",
  "tool-zoom-in",
  "tool-fit",
  "tool-export-png",
  "tool-export-pdf",
] as const;
