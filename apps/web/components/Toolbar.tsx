"use client";

export type DrawTool = "pen" | "eraser";

const COLORS = ["#0f172a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
const SIZES = [4, 8, 16];

interface Props {
  tool: DrawTool;
  color: string;
  size: number;
  onTool(t: DrawTool): void;
  onColor(c: string): void;
  onSize(s: number): void;
  onUndo(): void;
  onRedo(): void;
  onClear(): void;
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      <button className="tool" aria-pressed={p.tool === "pen"} onClick={() => p.onTool("pen")}>
        ✏️ Pen
      </button>
      <button className="tool" aria-pressed={p.tool === "eraser"} onClick={() => p.onTool("eraser")}>
        🧽 Eraser
      </button>
      <span className="sep" />
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
        <button key={s} className="tool" aria-pressed={p.size === s} onClick={() => p.onSize(s)}>
          {s}px
        </button>
      ))}
      <span className="sep" />
      <button className="tool" onClick={p.onUndo} title="Undo (Ctrl/Cmd+Z)">
        ↶
      </button>
      <button className="tool" onClick={p.onRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
        ↷
      </button>
      <button className="tool" onClick={p.onClear} title="Clear board">
        🗑
      </button>
    </div>
  );
}
