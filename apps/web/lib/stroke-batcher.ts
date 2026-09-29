import type * as Y from "yjs";
import type { Point } from "@liveboard/shared";
import { LOCAL_ORIGIN } from "./strokes";

/** Coalesce freehand point samples to one Yjs transaction per animation frame. */
export class StrokePointBatcher {
  private pending: Point[] = [];
  private rafId = 0;

  constructor(
    private readonly doc: Y.Doc,
    private readonly points: Y.Array<number>,
  ) {}

  push(p: Point): void {
    this.pending.push(p);
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  flush(): void {
    this.rafId = 0;
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    this.doc.transact(() => {
      for (const p of batch) this.points.push(p);
    }, LOCAL_ORIGIN);
  }

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.pending = [];
  }
}
