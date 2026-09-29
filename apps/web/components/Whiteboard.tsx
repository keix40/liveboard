"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { Point } from "@liveboard/shared";
import { useRoom } from "@/lib/useRoom";
import {
  beginStroke,
  eraseAt,
  extendStroke,
  getStrokes,
  LOCAL_ORIGIN,
  readStroke,
  strokePath,
} from "@/lib/strokes";
import { Cursors } from "./Cursors";
import { Toolbar, type DrawTool } from "./Toolbar";

const STATUS_LABEL: Record<string, string> = {
  connected: "● Connected",
  connecting: "● Connecting…",
  disconnected: "● Reconnecting…",
  offline: "● Offline — changes saved locally",
  "room-full": "Room is full",
  unauthorized: "Access denied",
};

export function Whiteboard({ roomId }: { roomId: string }) {
  const { conn, identity, status, peers } = useRoom(roomId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Y.Array<number> | null>(null);
  const rafRef = useRef(0);
  const cursorRaf = useRef(0);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(8);
  const [strokeCount, setStrokeCount] = useState(0);

  const doc = conn?.doc;
  const strokes = useMemo(() => (doc ? getStrokes(doc) : null), [doc]);
  const undo = useMemo(
    () =>
      strokes
        ? new Y.UndoManager(strokes, { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 60_000 })
        : null,
    [strokes],
  );
  useEffect(() => () => undo?.destroy(), [undo]);

  // ─── Rendering ──────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !strokes) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      const { color, size, points } = readStroke(s);
      const d = strokePath(points, size);
      if (!d) continue;
      ctx.fillStyle = color;
      ctx.fill(new Path2D(d));
    }
  }, [strokes]);

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    if (!strokes) return;
    const onChange = () => {
      setStrokeCount(strokes.length);
      scheduleRender();
    };
    strokes.observeDeep(onChange);
    onChange();
    return () => strokes.unobserveDeep(onChange);
  }, [strokes, scheduleRender]);

  // Keep the backing store in sync with CSS size * devicePixelRatio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      scheduleRender();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [scheduleRender]);

  // ─── Input ──────────────────────────────────────────────────────────────
  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    // Mouse reports pressure 0.5 while pressed; pens report real pressure.
    return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
  };

  const setCursor = (cursor: { x: number; y: number } | null) => {
    const awareness = conn?.provider.awareness;
    if (!awareness) return;
    cancelAnimationFrame(cursorRaf.current);
    cursorRaf.current = requestAnimationFrame(() => awareness.setLocalStateField("cursor", cursor));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!doc || !identity || status === "unauthorized") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    if (tool === "eraser") {
      eraseAt(doc, p[0], p[1], 10);
      drawing.current = new Y.Array(); // marker: eraser is active
      return;
    }
    undo?.stopCapturing(); // each stroke = one undo step
    drawing.current = beginStroke(doc, {
      id: crypto.randomUUID(),
      authorId: identity.id,
      color,
      size,
      first: p,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toPoint(e);
    setCursor({ x: p[0], y: p[1] });
    if (!doc || !drawing.current) return;
    if (tool === "eraser") eraseAt(doc, p[0], p[1], 10);
    else extendStroke(doc, drawing.current, p);
  };

  const endStroke = () => {
    drawing.current = null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) undo?.redo();
      else undo?.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const clear = () => {
    if (!doc || !strokes || strokes.length === 0) return;
    if (!confirm("Clear the board for everyone? (Undo restores it)")) return;
    undo?.stopCapturing();
    doc.transact(() => strokes.delete(0, strokes.length), LOCAL_ORIGIN);
  };

  const everyone = identity ? [{ clientId: -1, user: identity }, ...peers] : peers;

  return (
    <div className="board">
      <canvas
        ref={canvasRef}
        data-testid="board-canvas"
        data-stroke-count={strokeCount}
        style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => setCursor(null)}
      />
      <Cursors peers={peers} />
      <Toolbar
        tool={tool}
        color={color}
        size={size}
        onTool={setTool}
        onColor={setColor}
        onSize={setSize}
        onUndo={() => undo?.undo()}
        onRedo={() => undo?.redo()}
        onClear={clear}
      />
      <div className="hud">
        <span className={`pill status-${status}`} data-testid="status">
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className="pill" data-testid="presence">
          {everyone.length} online
        </span>
        <div className="avatars">
          {everyone.slice(0, 6).map((p) => (
            <span key={p.clientId} className="avatar" style={{ background: p.user.color }} title={p.user.name}>
              {p.user.name.slice(0, 1)}
            </span>
          ))}
        </div>
        <button className="pill" onClick={() => void navigator.clipboard.writeText(window.location.href)}>
          🔗 Copy link
        </button>
      </div>
    </div>
  );
}
