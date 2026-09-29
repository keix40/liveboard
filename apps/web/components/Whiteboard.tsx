"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { AUTO_SNAPSHOT_INTERVAL_MS, type Point, type RoomRole, type ShapeKind } from "@liveboard/shared";
import { useRoom } from "@/lib/useRoom";
import {
  beginStroke,
  deleteStrokeById,
  discardProvisionalStroke,
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
import { coalescedPointerPoints, pinchMetrics } from "@/lib/pointer-input";
import { eraseAtWorld } from "@/lib/board-erase";
import {
  createPenSessionState,
  onPenPointerDown,
  onPenPointerUp,
  shouldIgnoreTouchPointer,
} from "@/lib/pointer-session";
import { renderBoardBase, renderBoardOverlay } from "@/lib/render-board";
import { BoardCompositor } from "@/lib/board-compositor";
import {
  eventsAreLocal,
  isStrokePointsOnlyUpdate,
} from "@/lib/yjs-events";
import { getShapes, upsertShape, deleteShape } from "@/lib/shapes";
import { isLineLikeKind, lineLikeLength } from "@/lib/shape-geometry";
import { createNote, deleteNote, getNotes, type YNote } from "@/lib/notes";
import { lassoSelect, pickAt, type SelectableRef } from "@/lib/selection";
import { computeContentBounds } from "@/lib/board-bounds";
import { exportBoardPdf, exportBoardPng } from "@/lib/export-board";
import { NoteLayer } from "./NoteLayer";
import { BoardSidePanel } from "./BoardSidePanel";
import { ensureBoardMeta, readBoardMeta } from "@/lib/board-meta";
import { stabilizePoint } from "@/lib/stroke-stabilizer";
import { recognizeStrokeShape } from "@/lib/shape-recognize";
import { getAssets, readAsset, type BoardAsset } from "@/lib/assets";
import { assetDataToBlobUrl } from "@/lib/asset-decode";
import { cameraForFrame, frameBounds, frameFromViewport } from "@/lib/frames";
import { isLocked, toggleLock } from "@/lib/locking";
import { listHistorySnapshots, pushSnapshot, restoreHistorySnapshot } from "@/lib/snapshots";

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
const TOUCH_STROKE_DELAY_MS = 80;
const TOUCH_STROKE_MOVE_PX = 4;

function isPanGesture(tool: DrawTool, pointerType: string, touchCount: number): boolean {
  if (tool === "pan") return true;
  if (pointerType === "touch" && touchCount >= 2) return true;
  return false;
}

export function Whiteboard({
  roomId,
  requestedRole = "editor",
  boardPassword = null,
}: {
  roomId: string;
  requestedRole?: RoomRole;
  boardPassword?: string | null;
}) {
  const { conn, identity, status, peers, roomRole } = useRoom(roomId, {
    role: requestedRole,
    boardPassword,
  });
  const readOnly = roomRole === "viewer";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceId = useRef(`canvas-${crypto.randomUUID()}`);
  const compositorRef = useRef<BoardCompositor | null>(null);
  const localLiveStrokeIndexRef = useRef<number | null>(null);
  const drawing = useRef<Y.Array<number> | null>(null);
  const pointBatcher = useRef<StrokePointBatcher | null>(null);
  const rafRef = useRef(0);
  const cursorRaf = useRef(0);
  const penSessionRef = useRef(createPenSessionState());
  const strokePointerIdRef = useRef<number | null>(null);
  const gesturePointerIdRef = useRef<number | null>(null);
  const chromeRef = useRef<HTMLElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number; type: string }>());
  const pinchRef = useRef<{ distance: number; zoom: number; midX: number; midY: number } | null>(null);
  const touchStrokePendingRef = useRef<{
    pointerId: number;
    startSx: number;
    startSy: number;
    startWorld: { x: number; y: number };
    pressure: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const panRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewShapeRef = useRef<{
    kind: string;
    x: number;
    y: number;
    w: number;
    h: number;
    stroke: string;
    strokeWidth: number;
  } | null>(null);
  const lassoRef = useRef<{ x: number; y: number }[]>([]);
  const dragSelectionRef = useRef<{ startX: number; startY: number; snapshot: SelectableRef[] } | null>(null);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(8);
  const [strokeCount, setStrokeCount] = useState(0);
  const [shapeCount, setShapeCount] = useState(0);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [selection, setSelection] = useState<SelectableRef[]>([]);
  const [lassoPath, setLassoPath] = useState<{ x: number; y: number }[]>([]);
  const [chromeHeight, setChromeHeight] = useState(120);
  const [compactToolbar, setCompactToolbar] = useState(false);
  const [notesRevision, setNotesRevision] = useState(0);
  const [metaRevision, setMetaRevision] = useState(0);
  const [stabilizer, setStabilizer] = useState(0.35);
  const [shapeRecognize, setShapeRecognize] = useState(true);
  const [followPresenter, setFollowPresenter] = useState(false);
  const [isPresenter, setIsPresenter] = useState(false);
  const [assetImages, setAssetImages] = useState<Map<string, CanvasImageSource>>(new Map());
  const [assetRevision, setAssetRevision] = useState(0);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastAutoSnapshotRef = useRef(0);
  const strokeHistoryRef = useRef<Point[]>([]);
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
  const boardMeta = doc ? readBoardMeta(doc) : null;
  const strokes = useMemo(() => (doc ? getStrokes(doc) : null), [doc]);
  const shapesMap = useMemo(() => (doc ? getShapes(doc) : null), [doc]);
  const notesMap = useMemo(() => (doc ? getNotes(doc) : null), [doc]);
  const assetsMap = useMemo(() => (doc ? getAssets(doc) : null), [doc]);

  const undo = useMemo(() => {
    if (!doc || !strokes || !shapesMap || !notesMap || !assetsMap) return null;
    return new Y.UndoManager([strokes, shapesMap, notesMap, assetsMap], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 300,
    });
  }, [doc, strokes, shapesMap, notesMap, assetsMap]);
  useEffect(() => () => undo?.destroy(), [undo]);

  const beginAction = useCallback(() => {
    undo?.stopCapturing();
  }, [undo]);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChromeHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    setChromeHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => setCompactToolbar(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  const collectAssetsPlain = useCallback((): Map<string, BoardAsset> => {
    const m = new Map<string, BoardAsset>();
    assetsMap?.forEach((v, k) => m.set(k, readAsset(v)));
    return m;
  }, [assetsMap]);

  const collectAssetsY = useCallback(() => {
    const m = new Map<string, Y.Map<unknown>>();
    assetsMap?.forEach((v, k) => m.set(k, v));
    return m;
  }, [assetsMap]);

  const toWorldFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current!;
      const r = canvas.getBoundingClientRect();
      return screenToWorld(camera, clientX - r.left, clientY - r.top);
    },
    [camera],
  );

  const buildRenderOpts = useCallback(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const strokeList = strokes!.toArray();
    return {
      camera,
      dpr,
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
      strokes: strokeList,
      shapes: collectShapes(),
      notes: collectNotes(),
      selection,
      lassoPath,
      previewShape: previewShape ?? undefined,
      liveStrokeIndices:
        localLiveStrokeIndexRef.current != null ? [localLiveStrokeIndexRef.current] : undefined,
      excludeStrokeIndicesFromBase:
        localLiveStrokeIndexRef.current != null ? [localLiveStrokeIndexRef.current] : undefined,
      background: boardMeta?.background ?? "grid",
      darkMode: boardMeta?.darkMode ?? false,
      assets: collectAssetsPlain(),
      assetImages,
    };
  }, [
    camera,
    strokes,
    collectShapes,
    collectNotes,
    collectAssetsPlain,
    assetImages,
    selection,
    lassoPath,
    previewShape,
    boardMeta,
    metaRevision,
    assetRevision,
  ]);

  const paintFrame = useCallback(
    (repaintBase: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas || !strokes || !shapesMap || !notesMap) return;
      if (!compositorRef.current) compositorRef.current = new BoardCompositor(canvas);
      const compositor = compositorRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (compositor.syncSize(canvas.clientWidth, canvas.clientHeight, dpr)) {
        repaintBase = true;
      }
      if (repaintBase) compositor.invalidateBase();
      const opts = buildRenderOpts();
      compositor.paintBase((ctx) => renderBoardBase(ctx, opts));
      compositor.paintOverlay((ctx) => renderBoardOverlay(ctx, opts));
      compositor.composite();
    },
    [buildRenderOpts, strokes, shapesMap, notesMap, assetImages],
  );

  const scheduleFrame = useCallback(
    (repaintBase: boolean) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => paintFrame(repaintBase));
    },
    [paintFrame],
  );

  useEffect(() => {
    if (!strokes || !shapesMap || !notesMap || !assetsMap) return;
    const onStrokesDeep = (events: Y.YEvent<any>[]) => {
      if (
        isStrokePointsOnlyUpdate(events) &&
        eventsAreLocal(events) &&
        localLiveStrokeIndexRef.current != null
      ) {
        scheduleFrame(false);
      } else {
        scheduleFrame(true);
      }
    };
    const onStrokesShallow = () => setStrokeCount(strokes.length);
    const onStructure = () => scheduleFrame(true);
    const onShapesChange = () => {
      setShapeCount(shapesMap.size);
      scheduleFrame(true);
    };
    const onNotesMap = (event: Y.YMapEvent<YNote>) => {
      if (event.changes.keys.size > 0) {
        setNotesRevision((n) => n + 1);
        scheduleFrame(true);
      }
    };
    strokes.observeDeep(onStrokesDeep);
    strokes.observe(onStrokesShallow);
    shapesMap.observe(onStructure);
    shapesMap.observe(onShapesChange);
    notesMap.observe(onNotesMap);
    const onAssets = () => {
      setAssetRevision((n) => n + 1);
      scheduleFrame(true);
    };
    assetsMap.observe(onAssets);
    const metaMap = doc?.getMap("meta");
    const onMeta = () => setMetaRevision((n) => n + 1);
    if (doc && metaMap) {
      metaMap.observe(onMeta);
      ensureBoardMeta(doc, LOCAL_ORIGIN);
    }
    setStrokeCount(strokes.length);
    setShapeCount(shapesMap.size);
    scheduleFrame(true);
    return () => {
      strokes.unobserveDeep(onStrokesDeep);
      strokes.unobserve(onStrokesShallow);
      shapesMap.unobserve(onStructure);
      shapesMap.unobserve(onShapesChange);
      notesMap.unobserve(onNotesMap);
      assetsMap.unobserve(onAssets);
      if (metaMap) metaMap.unobserve(onMeta);
    };
  }, [strokes, shapesMap, notesMap, assetsMap, doc, scheduleFrame]);

  useEffect(() => {
    if (!assetsMap) return;
    let cancelled = false;
    const load = async () => {
      const next = new Map<string, CanvasImageSource>();
      for (const [id, m] of assetsMap.entries()) {
        const a = readAsset(m);
        try {
          const url = await assetDataToBlobUrl(a.dataBase64, a.mime);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("asset load failed"));
            img.src = url;
          });
          if (!cancelled) next.set(id, img);
        } catch {
          /* skip broken asset */
        }
      }
      if (!cancelled) {
        setAssetImages((prev) => {
          if (prev.size === next.size && [...next.keys()].every((k) => prev.get(k) === next.get(k))) return prev;
          return next;
        });
        scheduleFrame(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [assetsMap]);

  useEffect(() => {
    if (!doc || readOnly) return;
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    doc.on("update", bump);
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > AUTO_SNAPSHOT_INTERVAL_MS) return;
      if (now - lastAutoSnapshotRef.current < AUTO_SNAPSHOT_INTERVAL_MS) return;
      lastAutoSnapshotRef.current = now;
      pushSnapshot(doc, `Auto ${new Date().toLocaleTimeString()}`);
    }, 30_000);
    return () => {
      clearInterval(timer);
      doc.off("update", bump);
    };
  }, [doc, readOnly]);

  useEffect(() => {
    scheduleFrame(true);
  }, [camera, selection, lassoPath, previewShape, scheduleFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => scheduleFrame(true));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [scheduleFrame]);

  useEffect(() => {
    const awareness = conn?.provider.awareness;
    if (!awareness) return;
    awareness.setLocalStateField("tool", tool);
  }, [conn, tool]);

  useEffect(() => {
    const awareness = conn?.provider.awareness;
    if (!awareness) return;
    awareness.setLocalStateField("presenter", isPresenter);
    if (isPresenter) awareness.setLocalStateField("camera", camera);
  }, [conn, isPresenter, camera]);

  useEffect(() => {
    if (!followPresenter || !conn) return;
    const presenter = peers.find((p) => p.presenter && p.camera);
    if (presenter?.camera) setCamera(presenter.camera);
  }, [conn, followPresenter, peers]);

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

  const clearTouchStrokePending = useCallback(() => {
    const pending = touchStrokePendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    touchStrokePendingRef.current = null;
  }, []);

  const abandonProvisionalInk = useCallback(() => {
    clearTouchStrokePending();
    if (!doc || !drawing.current) return;
    discardProvisionalStroke(doc, drawing.current);
    pointBatcher.current?.dispose();
    pointBatcher.current = null;
    drawing.current = null;
    strokePointerIdRef.current = null;
    localLiveStrokeIndexRef.current = null;
    scheduleFrame(true);
  }, [clearTouchStrokePending, doc, scheduleFrame]);

  const startPenStroke = useCallback(
    (pointerId: number, world: { x: number; y: number }, pressure: number) => {
      if (!doc || !identity) return;
      clearTouchStrokePending();
      beginAction();
      const points = beginStroke(doc, {
        id: crypto.randomUUID(),
        authorId: identity.id,
        color,
        size,
        variant: tool === "highlighter" ? "highlighter" : "pen",
        first: [world.x, world.y, pressure || 0.5],
      });
      drawing.current = points;
      strokePointerIdRef.current = pointerId;
      localLiveStrokeIndexRef.current = getStrokes(doc).length - 1;
      pointBatcher.current?.dispose();
      pointBatcher.current = new StrokePointBatcher(doc, points);
      scheduleFrame(true);
    },
    [beginAction, clearTouchStrokePending, color, doc, identity, scheduleFrame, size, tool],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!doc || !identity || status === "unauthorized" || status === "connect-failed") return;
    if (readOnly) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const world = screenToWorld(camera, sx, sy);
    const session = penSessionRef.current;

    pointersRef.current.set(e.pointerId, { x: sx, y: sy, type: e.pointerType });
    if (e.pointerType === "pen") onPenPointerDown(session);

    if (shouldIgnoreTouchPointer(e.pointerType, session)) return;

    const touchPointers = [...pointersRef.current.entries()].filter(([, p]) => p.type === "touch");
    const touchCount = touchPointers.length;

    if (touchCount >= 2 && !session.penDown) {
      abandonProvisionalInk();
      const touches = touchPointers.map(([, p]) => p);
      const m = pinchMetrics(touches[0]!, touches[1]!);
      pinchRef.current = { distance: m.distance, zoom: camera.zoom, midX: m.midX, midY: m.midY };
      panRef.current = null;
      return;
    }

    if (isPanGesture(tool, e.pointerType, touchCount)) {
      panRef.current = { lastX: sx, lastY: sy };
      gesturePointerIdRef.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    gesturePointerIdRef.current = e.pointerId;

    if (tool === "select") {
      beginAction();
      const hit = pickAt(strokes!.toArray(), collectShapes(), collectNotes(), world.x, world.y, collectAssetsY());
      if (hit && e.shiftKey) {
        setSelection((sel) => (sel.some((s) => s.id === hit.id) ? sel.filter((s) => s.id !== hit.id) : [...sel, hit]));
      } else if (hit) {
        const inSel = selection.some((s) => s.id === hit.id && s.kind === hit.kind);
        const nextSel = inSel && selection.length > 0 ? selection : [hit];
        setSelection(nextSel);
        dragSelectionRef.current = { startX: world.x, startY: world.y, snapshot: [...nextSel] };
      } else {
        setSelection([]);
        lassoRef.current = [world];
        setLassoPath([world]);
      }
      return;
    }

    if (tool === "eraser") {
      beginAction();
      eraseAtWorld(doc, world.x, world.y, size);
      drawing.current = new Y.Array();
      strokePointerIdRef.current = e.pointerId;
      return;
    }

    if (tool === "note") {
      beginAction();
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
      beginAction();
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
      beginAction();
      shapeStartRef.current = { x: world.x, y: world.y };
      previewShapeRef.current = {
        kind: tool,
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        stroke: color,
        strokeWidth: size,
      };
      setPreviewShape(previewShapeRef.current);
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      if (e.pointerType === "touch") {
        clearTouchStrokePending();
        const timer = setTimeout(() => {
          if (touchStrokePendingRef.current?.pointerId !== e.pointerId) return;
          startPenStroke(e.pointerId, touchStrokePendingRef.current.startWorld, touchStrokePendingRef.current.pressure);
        }, TOUCH_STROKE_DELAY_MS);
        touchStrokePendingRef.current = {
          pointerId: e.pointerId,
          startSx: sx,
          startSy: sy,
          startWorld: world,
          pressure: e.pressure || 0.5,
          timer,
        };
        canvas.setPointerCapture(e.pointerId);
        gesturePointerIdRef.current = e.pointerId;
        return;
      }
      strokeHistoryRef.current = [];
      startPenStroke(e.pointerId, world, e.pressure || 0.5);
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

    const session = penSessionRef.current;
    if (shouldIgnoreTouchPointer(e.pointerType, session)) return;

    const touchPointers = [...pointersRef.current.entries()].filter(([, p]) => p.type === "touch");
    if (touchPointers.length >= 2 && pinchRef.current && !session.penDown) {
      const touches = touchPointers.map(([, p]) => p);
      const m = pinchMetrics(touches[0]!, touches[1]!);
      const scale = m.distance / pinchRef.current.distance;
      const dx = m.midX - pinchRef.current.midX;
      const dy = m.midY - pinchRef.current.midY;
      pinchRef.current = { ...pinchRef.current, midX: m.midX, midY: m.midY };
      setCamera((cam) => panBy(zoomAt(cam, pinchRef.current!.zoom * scale, m.midX, m.midY), dx, dy));
      return;
    }

    if (panRef.current && e.pointerId === gesturePointerIdRef.current) {
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

    const livePreview = previewShapeRef.current;
    if (shapeStartRef.current && livePreview) {
      const x0 = shapeStartRef.current.x;
      const y0 = shapeStartRef.current.y;
      const next = isLineLikeKind(livePreview.kind)
        ? {
            ...livePreview,
            x: x0,
            y: y0,
            w: world.x - x0,
            h: world.y - y0,
          }
        : {
            ...livePreview,
            x: Math.min(x0, world.x),
            y: Math.min(y0, world.y),
            w: Math.abs(world.x - x0),
            h: Math.abs(world.y - y0),
          };
      previewShapeRef.current = next;
      setPreviewShape(next);
      return;
    }

    const pending = touchStrokePendingRef.current;
    if (pending && e.pointerId === pending.pointerId && !drawing.current) {
      const dx = sx - pending.startSx;
      const dy = sy - pending.startSy;
      if (Math.hypot(dx, dy) >= TOUCH_STROKE_MOVE_PX) {
        startPenStroke(pending.pointerId, pending.startWorld, pending.pressure);
      }
    }

    if (e.pointerId !== strokePointerIdRef.current) return;
    if (!drawing.current) return;

    const toLocal = (cx: number, cy: number) => {
      const w = screenToWorld(camera, cx - r.left, cy - r.top);
      return { x: w.x, y: w.y };
    };
    const pts = coalescedPointerPoints(e.nativeEvent, toLocal).map(
      (p): Point => [p[0], p[1], p[2]],
    );

    if (tool === "eraser") {
      for (const p of pts) eraseAtWorld(doc, p[0], p[1], size);
    } else {
      for (const raw of pts) {
        const p = stabilizePoint(strokeHistoryRef.current, raw, stabilizer);
        strokeHistoryRef.current.push(p);
        pointBatcher.current?.push(p);
      }
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointerId = e.pointerId;
    const wasGesture = pointerId === gesturePointerIdRef.current;
    const wasStroke = pointerId === strokePointerIdRef.current;

    pointersRef.current.delete(pointerId);
    if (e.pointerType === "pen" && ![...pointersRef.current.values()].some((p) => p.type === "pen")) {
      onPenPointerUp(penSessionRef.current);
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;

    releaseCapture(e);

    if (shapeStartRef.current && previewShapeRef.current && doc && identity) {
      const canvas = e.currentTarget;
      const r = canvas.getBoundingClientRect();
      const endWorld = screenToWorld(camera, e.clientX - r.left, e.clientY - r.top);
      const x0 = shapeStartRef.current.x;
      const y0 = shapeStartRef.current.y;
      let committedPreview = previewShapeRef.current;
      committedPreview = isLineLikeKind(committedPreview.kind)
        ? { ...committedPreview, x: x0, y: y0, w: endWorld.x - x0, h: endWorld.y - y0 }
        : {
            ...committedPreview,
            x: Math.min(x0, endWorld.x),
            y: Math.min(y0, endWorld.y),
            w: Math.abs(endWorld.x - x0),
            h: Math.abs(endWorld.y - y0),
          };
      const kind = committedPreview.kind as ShapeKind;
      const bigEnough = isLineLikeKind(kind)
        ? lineLikeLength(committedPreview.w, committedPreview.h) > 3
        : committedPreview.w > 2 || committedPreview.h > 2;
      if (bigEnough) {
        upsertShape(doc, {
          id: crypto.randomUUID(),
          kind,
          x: committedPreview.x,
          y: committedPreview.y,
          w: committedPreview.w,
          h: committedPreview.h,
          rotation: 0,
          stroke: committedPreview.stroke,
          fill: kind === "rect" || kind === "ellipse" ? `${committedPreview.stroke}22` : null,
          strokeWidth: committedPreview.strokeWidth,
          z: nextZ(),
          authorId: identity.id,
          createdAt: Date.now(),
        });
      }
      shapeStartRef.current = null;
      previewShapeRef.current = null;
      setPreviewShape(null);
    }

    if (wasGesture) {
      panRef.current = null;
      gesturePointerIdRef.current = null;

      if (tool === "select" && lassoRef.current.length > 2 && strokes && shapesMap && notesMap) {
        const picked = lassoSelect(
          strokes.toArray(),
          collectShapes(),
          collectNotes(),
          lassoRef.current,
          collectAssetsY(),
        );
        setSelection(picked);
      }
      lassoRef.current = [];
      setLassoPath([]);
      dragSelectionRef.current = null;
    }

    if (pointerId === touchStrokePendingRef.current?.pointerId) {
      clearTouchStrokePending();
    }

    if (wasStroke) {
      pointBatcher.current?.flush();
      pointBatcher.current?.dispose();
      pointBatcher.current = null;
      const pointsArr = drawing.current;
      drawing.current = null;
      strokePointerIdRef.current = null;
      localLiveStrokeIndexRef.current = null;
      strokeHistoryRef.current = [];
      if (shapeRecognize && doc && identity && strokes && pointsArr) {
        const last = strokes.get(strokes.length - 1);
        if (last) {
          const s = readStroke(last);
          if (!isLocked(doc, s.id)) {
            const recognized = recognizeStrokeShape(s.points);
            if (recognized && recognized.confidence > 0.75 && s.points.length >= 12) {
              deleteStrokeById(doc, s.id);
              upsertShape(doc, {
                id: crypto.randomUUID(),
                kind: recognized.kind,
                x: recognized.x,
                y: recognized.y,
                w: recognized.w,
                h: recognized.h,
                rotation: 0,
                stroke: color,
                fill: recognized.kind === "rect" || recognized.kind === "ellipse" ? `${color}22` : null,
                strokeWidth: size,
                z: nextZ(),
                authorId: identity.id,
                createdAt: Date.now(),
              });
            }
          }
        }
      }
      scheduleFrame(true);
    }
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
    beginAction();
    doc.transact(() => {
      strokes.delete(0, strokes.length);
      shapesMap?.forEach((_, k) => shapesMap.delete(k));
      notesMap?.forEach((_, k) => notesMap.delete(k));
      assetsMap?.forEach((_, k) => assetsMap.delete(k));
    }, LOCAL_ORIGIN);
    setSelection([]);
  };

  const deleteSelection = () => {
    if (!doc || selection.length === 0) return;
    beginAction();
    doc.transact(() => {
      for (const sel of selection) {
        if (isLocked(doc, sel.id)) continue;
        if (sel.kind === "stroke") deleteStrokeById(doc, sel.id);
        else if (sel.kind === "shape") deleteShape(doc, sel.id);
        else if (sel.kind === "note") deleteNote(doc, sel.id);
        else assetsMap?.delete(sel.id);
      }
    }, LOCAL_ORIGIN);
    setSelection([]);
  };

  const fitToScreen = () => {
    if (!strokes || !shapesMap || !notesMap || !canvasRef.current) return;
    const bounds = computeContentBounds(strokes.toArray(), collectShapes(), collectNotes(), collectAssetsY());
    if (!bounds) return;
    setCamera(
      fitBoundsToViewport(bounds, canvasRef.current.clientWidth, canvasRef.current.clientHeight, 48, {
        top: chromeHeight,
        bottom: 0,
        left: 0,
        right: 0,
      }),
    );
  };

  const exportOpts = () => {
    if (!strokes || !shapesMap || !notesMap) return null;
    const bounds = computeContentBounds(strokes.toArray(), collectShapes(), collectNotes(), collectAssetsY()) ?? {
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
        assets: collectAssetsPlain(),
        assetImages,
        background: boardMeta?.background ?? "grid",
        darkMode: boardMeta?.darkMode ?? false,
      },
    };
  };

  const exportFrame = (frameId: string) => {
    const ex = exportOpts();
    const frame = boardMeta?.frames.find((f) => f.id === frameId);
    if (!ex || !frame) return;
    void exportBoardPng(`liveboard-frame-${frame.name}.png`, frameBounds(frame), ex.renderOpts);
  };

  const goToFrame = (frameId: string) => {
    const frame = boardMeta?.frames.find((f) => f.id === frameId);
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    setCamera(cameraForFrame(frame, canvas.clientWidth, canvas.clientHeight));
  };

  const everyone = identity ? [{ clientId: -1, user: identity }, ...peers] : peers;

  const cursorStyle =
    tool === "eraser" ? "cell" : tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div className={`board${boardMeta?.darkMode ? " dark" : ""}`} data-testid="board-root">
      <header className="board-chrome" ref={chromeRef} data-testid="board-chrome">
        {!compactToolbar ? (
          <div className="board-hud hud">
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
            <button type="button" className="pill" data-testid="copy-link" onClick={() => void navigator.clipboard.writeText(window.location.href)}>
              🔗 Copy link
            </button>
          </div>
        ) : null}
        <Toolbar
          tool={tool}
          color={color}
          size={size}
          zoom={camera.zoom}
          compact={compactToolbar}
          statusChip={
            compactToolbar ? (
              <>
                <span
                  className={`status-chip status-${status}`}
                  data-testid="status"
                  title={STATUS_LABEL[status] ?? status}
                >
                  <span className="sr-only">{STATUS_LABEL[status] ?? status}</span>
                </span>
                <span className="presence-chip" data-testid="presence" title={`${everyone.length} online`}>
                  {everyone.length}
                </span>
              </>
            ) : undefined
          }
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
      </header>
      <div className="board-surface">
        <div className="board-surface-main">
        <canvas
          ref={canvasRef}
          data-testid="board-canvas"
          data-canvas-id={canvasInstanceId.current}
          data-stroke-count={strokeCount}
          data-shape-count={shapeCount}
          data-asset-count={assetsMap?.size ?? 0}
          data-camera={`${camera.x},${camera.y},${camera.zoom}`}
          style={{ cursor: cursorStyle, touchAction: "none" }}
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
            notesRevision={notesRevision}
            notes={collectNotes()}
            selectedIds={new Set(selection.filter((s) => s.kind === "note").map((s) => s.id))}
            onSelect={(id) => setSelection([{ kind: "note", id }])}
          />
        ) : null}
        <Cursors peers={peers} camera={camera} />
        </div>
        {compactToolbar ? (
          <button
            type="button"
            className="side-panel-toggle"
            data-testid="side-panel-toggle"
            aria-expanded={sidePanelOpen}
            onClick={() => setSidePanelOpen((o) => !o)}
          >
            ⚙
          </button>
        ) : null}
        {doc && boardMeta ? (
          <BoardSidePanel
            doc={doc}
            meta={boardMeta}
            metaRevision={metaRevision}
            onMetaRevision={() => setMetaRevision((n) => n + 1)}
            stabilizer={stabilizer}
            onStabilizer={setStabilizer}
            shapeRecognize={shapeRecognize}
            onShapeRecognize={setShapeRecognize}
            readOnly={readOnly}
            roomRole={roomRole}
            authorId={identity?.id ?? ""}
            followPresenter={followPresenter}
            onFollowPresenter={setFollowPresenter}
            isPresenter={isPresenter}
            onPresenter={setIsPresenter}
            className={compactToolbar && !sidePanelOpen ? "collapsed" : undefined}
            history={listHistorySnapshots(doc)}
            onRestoreSnapshot={(snap) => {
              beginAction();
              restoreHistorySnapshot(doc, snap);
              setAssetRevision((n) => n + 1);
            }}
            onAddFrame={() => {
              if (!canvasRef.current) return;
              const name = prompt("Frame name") ?? "Frame";
              frameFromViewport(
                doc,
                camera,
                canvasRef.current.clientWidth,
                canvasRef.current.clientHeight,
                name,
              );
              setMetaRevision((n) => n + 1);
            }}
            onGoToFrame={goToFrame}
            onExportFrame={exportFrame}
            onToggleLockSelection={() => {
              for (const sel of selection) toggleLock(doc, sel.id);
              setMetaRevision((n) => n + 1);
            }}
            hasSelection={selection.length > 0}
          />
        ) : null}
      </div>
    </div>
  );
}

function moveSelection(doc: Y.Doc, selection: SelectableRef[], dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const strokes = getStrokes(doc);
  doc.transact(() => {
    for (const sel of selection) {
      if (isLocked(doc, sel.id)) continue;
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
      } else if (sel.kind === "note") {
        const m = getNotes(doc).get(sel.id);
        if (m instanceof Y.Map) {
          m.set("x", Number(m.get("x") ?? 0) + dx);
          m.set("y", Number(m.get("y") ?? 0) + dy);
        }
      } else {
        const m = getAssets(doc).get(sel.id);
        if (m instanceof Y.Map) {
          m.set("x", Number(m.get("x") ?? 0) + dx);
          m.set("y", Number(m.get("y") ?? 0) + dy);
        }
      }
    }
  }, LOCAL_ORIGIN);
}
