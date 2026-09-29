/** Double-buffered base + overlay compositor — avoids visible full-frame clears on the display canvas. */

export class BoardCompositor {
  private readonly base: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  readonly display: HTMLCanvasElement;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private baseDirty = true;

  constructor(display: HTMLCanvasElement) {
    this.display = display;
    this.base = document.createElement("canvas");
    this.overlay = document.createElement("canvas");
  }

  markBaseDirty(): void {
    this.baseDirty = true;
  }

  /** Resize backing stores only when CSS size or DPR actually changes. */
  syncSize(cssWidth: number, cssHeight: number, dpr: number): boolean {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    const changed = w !== this.base.width || h !== this.base.height || dpr !== this.dpr;
    if (!changed) return false;
    this.cssW = cssWidth;
    this.cssH = cssHeight;
    this.dpr = dpr;
    for (const c of [this.base, this.overlay, this.display]) {
      c.width = w;
      c.height = h;
    }
    this.baseDirty = true;
    return true;
  }

  paintBase(
    paint: (ctx: CanvasRenderingContext2D, dpr: number) => void,
    backgroundCss = "#f8fafc",
  ): void {
    if (!this.baseDirty) return;
    const ctx = this.base.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = backgroundCss;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    paint(ctx, this.dpr);
    this.baseDirty = false;
  }

  /** Force base repaint on next composite (camera move, structural doc changes). */
  invalidateBase(): void {
    this.baseDirty = true;
  }

  paintOverlay(paint: (ctx: CanvasRenderingContext2D, dpr: number) => void): void {
    const ctx = this.overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paint(ctx, this.dpr);
  }

  /** Copy base then overlay to the visible canvas (no intermediate blank frame). */
  composite(): void {
    const ctx = this.display.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);
  }
}
