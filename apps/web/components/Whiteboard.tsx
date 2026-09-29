"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { Point, ShapeKind } from "@liveboard/shared";
import { useRoom } from "@/lib/useRoom";
import {
  beginStroke,
  deleteStrokeById,
  eraseAt,
  getStrokes,
  LOCAL_ORIGIN,
  readStroke,
} from "@/lib/strokes";
import { Cursors } from "./Cursors";
import { Toolbar, type DrawTool } from "./Toolbar";
import { StrokePointBatcher } from "@/lib/stroke-batcher";
import {
  DEFAULT_CAMERA,
  fitBoundsToViewport,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
} from "@/lib/camera";
import { coalescedPointerPoints, pinchMetrics, shouldDrawWithPointer } from "@/lib/pointer-input";
import { renderBoard } from "@/lib/render-board";
import { getShapes, hitShape, readShape, upsertShape, deleteShape } from "@/lib/shapes";
import { createNote, deleteNote, getNotes, hitNote, readNote } from "@/lib/notes";
import { lassoSelect, pickAt, type SelectableRef } from "@/lib/selection";
import { computeContentBounds } from "@/lib/board-bounds";
import { exportBoardPdf, exportBoardPng } from "@/lib/export-board";
import { NoteLayer } from "./NoteLayer";

const STATUS_LABEL: Record<string, string> = {
  connected: "● Connected",
  connecting: "● Connecting…",
  disconnected: "● Reconnecting…",
  offline: "● Offline — changes saved locally",
  "room-full": "Room is full",
  unauthorized: "Access denied",
  "connect-failed": "Couldn't connect — check link or try again",
};

const SHAPE_TOOLS = new Set<DrawTool>(["rect", "ellipse", "line", "arrow"]);

export function Whiteboard({ roomId }: { roomId: string }) {
  const { conn, identity, status, peers } = useRoom(roomId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Y.Array<number> | null>(null);
  const pointBatcher = useRef<StrokePointBatcher | null>(null);
  const rafRef = useRef(0);
  const cursorRaf = useRef(0);
  const penActiveRef = useRef(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number; type: string }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lassoRef = useRef<{ x: number; y: number }[]>([]);
  const dragSelectionRef = useRef<{ startX: number; startY: number; snapshot: SelectableRef[] } | null>(null);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(8);
  const [renderTick, setRenderTick] = useState(0);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [selection, setSelection] = useState<SelectableRef[]>([]);
  const [lassoPath, setLassoPath] = useState<{ x: number; y: number }[]>([]);
  const [previewShape, setPreviewShape] = useState<{
    kind: string;
    x: number;
    y: number;
    w: number;
    h: number;
    stroke: string;
    strokeWidth: number;
  } | null>(null);

  const doc = conn?.doc;
  const strokes = useMemo(() => (doc ? getStrokes(doc) : null), [doc]);
  const shapesMap = useMemo(() => (doc ? getShapes(doc) : null), [doc]);
  const notesMap = useMemo(() => (doc ? getNotes(doc) : null), [doc]);

  const undo = useMemo(() => {
    if (!doc || !strokes || !shapesMap || !notesMap) return null;
    return new Y.UndoManager([strokes, shapesMap, notesMap], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 60_000,
    });
  }, [doc, strokes, shapesMap, notesMap]);
  useEffect(() => () => undo?.destroy(), [undo]);

  const collectShapes = useCallback(() => {
    const m = new Map<string, Y.Map<unknown>>();
    shapesMap?.forEach((v, k) => m.set(k, v));
    return m;
  }, [shapesMap]);

  const collectNotes = useCallback(() => {
    const m = new Map<string, Y.Map<unknown>>();
    notesMap?.forEach((v, k) => m.set(k, v));
    return m;
  }, [notesMap]);

  const toWorldFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current!;
      const r = canvas.getBoundingClientRect();
      return screenToWorld(camera, clientX - r.left, clientY - r.top);
    },
    [camera],
  );

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas || !strokes || !shapesMap || !notesMap) return;
      const dpr = window.devicePixelRatio || 1;
      renderBoard(canvas, {
        camera,
        dpr,
        strokes: strokes.toArray(),
        shapes: collectShapes(),
        notes: collectNotes(),
        selection,
        lassoPath,
        previewShape: previewShape ?? undefined,
      });
    });
  }, [camera, strokes, shapesMap, notesMap, collectShapes, collectNotes, selection, lassoPath, previewShape]);

  useEffect(() => {
    if (!strokes || !shapesMap || !notesMap) return;
    const bump = () => {
      setRenderTick((t) => t + 1);
      scheduleRender();
    };
    strokes.observeDeep(bump);
    shapesMap.observe(bump);
    notesMap.observeDeep(bump);
    scheduleRender();
    return () => {
      strokes.unobserveDeep(bump);
      shapesMap.unobserve(bump);
      notesMap.unobserveDeep(bump);
    };
  }, [strokes, shapesMap, notesMap, scheduleRender]);

  useEffect(() => {
    scheduleRender();
  }, [camera, selection, lassoPath, previewShape, renderTick, scheduleRender]);

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

  useEffect(() => {
    const awareness = conn?.provider.awareness;
    if (!awareness) return;
    awareness.setLocalStateField("tool", tool);
  }, [conn, tool]);

  const setCursorWorld = (world: { x: number; y: number } | null) => {
    const awareness = conn?.provider.awareness;
    if (!awareness) return;
    cancelAnimationFrame(cursorRaf.current);
    cursorRaf.current = requestAnimationFrame(() => awareness.setLocalStateField("cursor", world));
  };

  const releaseCapture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* already released */
    }
  };

  const nextZ = () => Date.now();

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!doc || !identity || status === "unauthorized" || status === "connect-failed") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const world = screenToWorld(camera, sx, sy);

    pointersRef.current.set(e.pointerId, { x: sx, y: sy, type: e.pointerType });
    if (e.pointerType === "pen") penActiveRef.current = true;

    const touchCount = [...pointersRef.current.values()].filter((p) => p.type === "touch").length;
    if (touchCount >= 2) {
      const touches = [...pointersRef.current.values()].filter((p) => p.type === "touch");
      if (touches.length >= 2) {
        const m = pinchMetrics(touches[0]!, touches[1]!);
        pinchRef.current = { distance: m.distance, zoom: camera.zoom };
        panRef.current = null;
        drawing.current = null;
        return;
      }
    }

    if (e.pointerType === "touch" && touchCount === 1 && tool !== "select" && !SHAPE_TOOLS.has(tool)) {
      panRef.current = { lastX: sx, lastY: sy };
      return;
    }

    if (!shouldDrawWithPointer(e.pointerType, penActiveRef.current)) return;

    canvas.setPointerCapture(e.pointerId);

    if (tool === "select") {
      const hit = pickAt(strokes!.toArray(), collectShapes(), collectNotes(), world.x, world.y);
      if (hit && e.shiftKey) {
        setSelection((sel) => (sel.some((s) => s.id === hit.id) ? sel.filter((s) => s.id !== hit.id) : [...sel, hit]));
      } else if (hit) {
        setSelection([hit]);
        dragSelectionRef.current = { startX: world.x, startY: world.y, snapshot: [hit] };
      } else {
        setSelection([]);
        lassoRef.current = [world];
        setLassoPath([world]);
      }
      return;
    }

    if (tool === "eraser") {
      eraseAt(doc, world.x, world.y, size);
      eraseShapesAndNotes(doc, world.x, world.y, size);
      drawing.current = new Y.Array();
      return;
    }

    if (tool === "note") {
      undo?.stopCapturing();
      createNote(doc, {
        id: crypto.randomUUID(),
        authorId: identity.id,
        x: world.x,
        y: world.y,
        color: color === "#0f172a" ? "#fef08a" : color,
        z: nextZ(),
      });
      return;
    }

    if (tool === "text") {
      undo?.stopCapturing();
      const text = prompt("Enter text") ?? "Text";
      upsertShape(doc, {
        id: crypto.randomUUID(),
        kind: "text",
        x: world.x,
        y: world.y,
        w: 200,
        h: 24,
        rotation: 0,
        stroke: color,
        fill: null,
        strokeWidth: size,
        text,
        z: nextZ(),
        authorId: identity.id,
        createdAt: Date.now(),
      });
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      shapeStartRef.current = { x: world.x, y: world.y };
      setPreviewShape({
        kind: tool,
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        stroke: color,
        strokeWidth: size,
      });
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      undo?.stopCapturing();
      const points = beginStroke(doc, {
        id: crypto.randomUUID(),
        authorId: identity.id,
        color,
        size,
        variant: tool === "highlighter" ? "highlighter" : "pen",
        first: [world.x, world.y, e.pressure || 0.5],
      });
      drawing.current = points;
      pointBatcher.current?.dispose();
      pointBatcher.current = new StrokePointBatcher(doc, points);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const world = screenToWorld(camera, sx, sy);

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: sx, y: sy, type: e.pointerType });
    }

    setCursorWorld({ x: world.x, y: world.y });

    const touches = [...pointersRef.current.values()].filter((p) => p.type === "touch");
    if (touches.length >= 2 && pinchRef.current) {
      const m = pinchMetrics(touches[0]!, touches[1]!);
      const scale = m.distance / pinchRef.current.distance;
      setCamera((cam) => zoomAt(cam, pinchRef.current!.zoom * scale, m.midX, m.midY));
      return;
    }

    if (panRef.current && e.pointerType === "touch") {
      const dx = sx - panRef.current.lastX;
      const dy = sy - panRef.current.lastY;
      panRef.current = { lastX: sx, lastY: sy };
      setCamera((cam) => panBy(cam, dx, dy));
      return;
    }

    if (!doc) return;

    if (tool === "select" && lassoRef.current.length > 0) {
      lassoRef.current.push(world);
      setLassoPath([...lassoRef.current]);
      return;
    }

    if (tool === "select" && dragSelectionRef.current) {
      const dx = world.x - dragSelectionRef.current.startX;
      const dy = world.y - dragSelectionRef.current.startY;
      moveSelection(doc, dragSelectionRef.current.snapshot, dx, dy);
      dragSelectionRef.current.startX = world.x;
      dragSelectionRef.current.startY = world.y;
      return;
    }

    if (shapeStartRef.current && previewShape) {
      const x0 = shapeStartRef.current.x;
      const y0 = shapeStartRef.current.y;
      setPreviewShape({
        ...previewShape,
        x: Math.min(x0, world.x),
        y: Math.min(y0, world.y),
        w: Math.abs(world.x - x0),
        h: Math.abs(world.y - y0),
      });
      return;
    }

    if (!drawing.current) return;
    if (!shouldDrawWithPointer(e.pointerType, penActiveRef.current)) return;

    const toLocal = (cx: number, cy: number) => {
      const w = screenToWorld(camera, cx - r.left, cy - r.top);
      return { x: w.x, y: w.y };
    };
    const pts = coalescedPointerPoints(e.nativeEvent, toLocal).map(
      (p): Point => [p[0], p[1], p[2]],
    );

    if (tool === "eraser") {
      for (const p of pts) {
        eraseAt(doc, p[0], p[1], size);
        eraseShapesAndNotes(doc, p[0], p[1], size);
      }
    } else {
      for (const p of pts) pointBatcher.current?.push(p);
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (e.pointerType === "pen" && ![...pointersRef.current.values()].some((p) => p.type === "pen")) {
      penActiveRef.current = false;
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;

    releaseCapture(e);

    if (tool === "select" && lassoRef.current.length > 2 && strokes && shapesMap && notesMap) {
      const picked = lassoSelect(strokes.toArray(), collectShapes(), collectNotes(), lassoRef.current);
      setSelection(picked);
    }
    lassoRef.current = [];
    setLassoPath([]);
    dragSelectionRef.current = null;

    if (shapeStartRef.current && previewShape && doc && identity) {
      const kind = previewShape.kind as ShapeKind;
      if (previewShape.w > 2 || previewShape.h > 2) {
        undo?.stopCapturing();
        upsertShape(doc, {
          id: crypto.randomUUID(),
          kind,
          x: previewShape.x,
          y: previewShape.y,
          w: previewShape.w,
          h: previewShape.h,
          rotation: 0,
          stroke: previewShape.stroke,
          fill: kind === "rect" || kind === "ellipse" ? `${previewShape.stroke}22` : null,
          strokeWidth: previewShape.strokeWidth,
          z: nextZ(),
          authorId: identity.id,
          createdAt: Date.now(),
        });
      }
    }
    shapeStartRef.current = null;
    setPreviewShape(null);

    pointBatcher.current?.flush();
    pointBatcher.current?.dispose();
    pointBatcher.current = null;
    drawing.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = ev.clientX - r.left;
      const sy = ev.clientY - r.top;
      if (ev.ctrlKey || ev.metaKey) {
        const factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
        setCamera((cam) => zoomAt(cam, cam.zoom * factor, sx, sy));
      } else {
        setCamera((cam) => panBy(cam, -ev.deltaX, -ev.deltaY));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

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
    if (!doc || !strokes) return;
    if (!confirm("Clear the board for everyone? (Undo restores it)")) return;
    undo?.stopCapturing();
    doc.transact(() => {
      strokes.delete(0, strokes.length);
      shapesMap?.forEach((_, k) => shapesMap.delete(k));
      notesMap?.forEach((_, k) => notesMap.delete(k));
    }, LOCAL_ORIGIN);
    setSelection([]);
  };

  const deleteSelection = () => {
    if (!doc || selection.length === 0) return;
    undo?.stopCapturing();
    doc.transact(() => {
      for (const sel of selection) {
        if (sel.kind === "stroke") deleteStrokeById(doc, sel.id);
        else if (sel.kind === "shape") deleteShape(doc, sel.id);
        else deleteNote(doc, sel.id);
      }
    }, LOCAL_ORIGIN);
    setSelection([]);
  };

  const fitToScreen = () => {
    if (!strokes || !shapesMap || !notesMap || !canvasRef.current) return;
    const bounds = computeContentBounds(strokes.toArray(), collectShapes(), collectNotes());
    if (!bounds) return;
    setCamera(
      fitBoundsToViewport(bounds, canvasRef.current.clientWidth, canvasRef.current.clientHeight),
    );
  };

  const exportOpts = () => {
    if (!strokes || !shapesMap || !notesMap) return null;
    const bounds = computeContentBounds(strokes.toArray(), collectShapes(), collectNotes()) ?? {
      minX: 0,
      minY: 0,
      maxX: 800,
      maxY: 600,
    };
    return {
      bounds,
      renderOpts: {
        strokes: strokes.toArray(),
        shapes: collectShapes(),
        notes: collectNotes(),
      },
    };
  };

  const everyone = identity ? [{ clientId: -1, user: identity }, ...peers] : peers;

  return (
    <div className="board">
      <canvas
        ref={canvasRef}
        data-testid="board-canvas"
        data-stroke-count={strokes?.length ?? 0}
        style={{
          cursor: tool === "eraser" ? "cell" : tool === "select" ? "default" : "crosshair",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={() => setCursorWorld(null)}
      />
      {doc ? (
        <NoteLayer
          doc={doc}
          camera={camera}
          notes={collectNotes()}
          selectedIds={new Set(selection.filter((s) => s.kind === "note").map((s) => s.id))}
          onSelect={(id) => setSelection([{ kind: "note", id }])}
        />
      ) : null}
      <Cursors peers={peers} camera={camera} />
      <Toolbar
        tool={tool}
        color={color}
        size={size}
        zoom={camera.zoom}
        onTool={setTool}
        onColor={setColor}
        onSize={setSize}
        onUndo={() => undo?.undo()}
        onRedo={() => undo?.redo()}
        onClear={clear}
        onZoomIn={() =>
          setCamera((cam) =>
            zoomAt(cam, cam.zoom * 1.2, canvasRef.current!.clientWidth / 2, canvasRef.current!.clientHeight / 2),
          )
        }
        onZoomOut={() =>
          setCamera((cam) =>
            zoomAt(cam, cam.zoom / 1.2, canvasRef.current!.clientWidth / 2, canvasRef.current!.clientHeight / 2),
          )
        }
        onFit={fitToScreen}
        onExportPng={() => {
          const ex = exportOpts();
          if (ex) void exportBoardPng(`liveboard-${roomId}.png`, ex.bounds, ex.renderOpts);
        }}
        onExportPdf={() => {
          const ex = exportOpts();
          if (ex) void exportBoardPdf(`liveboard-${roomId}.pdf`, ex.bounds, ex.renderOpts);
        }}
        onDeleteSelection={deleteSelection}
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

function eraseShapesAndNotes(doc: Y.Doc, x: number, y: number, radius: number): void {
  const shapes = getShapes(doc);
  const notes = getNotes(doc);
  doc.transact(() => {
    shapes.forEach((m, id) => {
      if (hitShape(readShape(m), x, y, radius)) shapes.delete(id);
    });
    notes.forEach((m, id) => {
      if (hitNote(readNote(m), x, y)) notes.delete(id);
    });
  }, LOCAL_ORIGIN);
}

function moveSelection(doc: Y.Doc, selection: SelectableRef[], dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const strokes = getStrokes(doc);
  doc.transact(() => {
    for (const sel of selection) {
      if (sel.kind === "stroke") {
        for (let i = 0; i < strokes.length; i++) {
          const s = strokes.get(i)!;
          if (readStroke(s).id !== sel.id) continue;
          const pts = s.get("points");
          if (!(pts instanceof Y.Array)) break;
          const arr = pts.toArray() as number[];
          for (let j = 0; j + 2 < arr.length; j += 3) {
            arr[j] = (arr[j] ?? 0) + dx;
            arr[j + 1] = (arr[j + 1] ?? 0) + dy;
          }
          pts.delete(0, pts.length);
          pts.push(arr);
          break;
        }
      } else if (sel.kind === "shape") {
        const m = getShapes(doc).get(sel.id);
        if (m instanceof Y.Map) {
          m.set("x", Number(m.get("x") ?? 0) + dx);
          m.set("y", Number(m.get("y") ?? 0) + dy);
        }
      } else {
        const m = getNotes(doc).get(sel.id);
        if (m instanceof Y.Map) {
          m.set("x", Number(m.get("x") ?? 0) + dx);
          m.set("y", Number(m.get("y") ?? 0) + dy);
        }
      }
    }
  }, LOCAL_ORIGIN);
}
