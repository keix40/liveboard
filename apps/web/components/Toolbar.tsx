"use client";

import type { Tool } from "@liveboard/shared";

export type DrawTool = Tool;

const COLORS = ["#0f172a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#fef08a"];
const SIZES = [2, 4, 8, 16, 24];

interface Props {
  tool: DrawTool;
  color: string;
  size: number;
  zoom: number;
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
  { id: "select", label: "⬚" },
  { id: "rect", label: "▭" },
  { id: "ellipse", label: "◯" },
  { id: "line", label: "／" },
  { id: "arrow", label: "➤" },
  { id: "text", label: "T" },
  { id: "note", label: "📝" },
];

export function Toolbar(p: Props) {
  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className="tool"
            title={t.id}
            aria-pressed={p.tool === t.id}
            onClick={() => p.onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="sep" />
        <label className="color-picker-wrap" title="Custom color">
          <input
            type="color"
            value={p.color.startsWith("#") && p.color.length >= 7 ? p.color.slice(0, 7) : "#0f172a"}
            onChange={(e) => p.onColor(e.target.value)}
            aria-label="Pick color"
          />
        </label>
        {COLORS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            aria-label={`Color ${c}`}
            aria-pressed={p.color === c}
            onClick={() => p.onColor(c)}
          />
        ))}
        <span className="sep" />
        {SIZES.map((s) => (
          <button key={s} className="tool size-btn" aria-pressed={p.size === s} onClick={() => p.onSize(s)}>
            {s}
          </button>
        ))}
        <span className="sep" />
        <button className="tool" onClick={p.onUndo} title="Undo (Ctrl/Cmd+Z)">
          ↶
        </button>
        <button className="tool" onClick={p.onRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
          ↷
        </button>
        <button className="tool" onClick={p.onDeleteSelection} title="Delete selection">
          ⌫
        </button>
        <button className="tool" onClick={p.onClear} title="Clear board">
          🗑
        </button>
        <span className="sep" />
        <button className="tool" onClick={p.onZoomOut} title="Zoom out">
          −
        </button>
        <span className="zoom-label">{Math.round(p.zoom * 100)}%</span>
        <button className="tool" onClick={p.onZoomIn} title="Zoom in">
          +
        </button>
        <button className="tool" onClick={p.onFit} title="Fit to screen">
          ⊡
        </button>
        <span className="sep" />
        <button className="tool" onClick={p.onExportPng} title="Export PNG">
          PNG
        </button>
        <button className="tool" onClick={p.onExportPdf} title="Export PDF">
          PDF
        </button>
      </div>
    </div>
  );
}
