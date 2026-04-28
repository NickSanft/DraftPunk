import type { Point, Stroke, StrokeStyle } from '../types/canvas';
import { renderAll, renderStroke } from './Renderer';

export interface PerfMetrics {
  lastMainRenderMs: number;
  lastActiveRenderMs: number;
  maxActiveRenderMs: number;
  activeRenderCount: number;
  avgMainRenderMs: number;
  mainRenderCount: number;
}

const AVG_WINDOW = 30;

export class CanvasEngine {
  private readonly mainCtx: CanvasRenderingContext2D;
  private readonly activeCtx: CanvasRenderingContext2D;
  private dpr = 1;

  private pendingMain: { strokes: readonly Stroke[] } | null = null;
  private pendingActive: { points: readonly Point[] | null; style: StrokeStyle | null } | null = null;
  private rafId: number | null = null;
  private destroyed = false;

  private readonly mainTimings: number[] = [];
  private readonly metrics: PerfMetrics = {
    lastMainRenderMs: 0,
    lastActiveRenderMs: 0,
    maxActiveRenderMs: 0,
    activeRenderCount: 0,
    avgMainRenderMs: 0,
    mainRenderCount: 0,
  };

  constructor(
    private readonly mainCanvas: HTMLCanvasElement,
    private readonly activeCanvas: HTMLCanvasElement,
  ) {
    const mainCtx = mainCanvas.getContext('2d');
    const activeCtx = activeCanvas.getContext('2d');
    if (!mainCtx || !activeCtx) throw new Error('2d context not available');
    this.mainCtx = mainCtx;
    this.activeCtx = activeCtx;
  }

  setSize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.dpr = dpr;
    for (const canvas of [this.mainCanvas, this.activeCanvas]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    this.mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderCommitted(strokes: readonly Stroke[]): void {
    if (this.destroyed) return;
    this.pendingMain = { strokes };
    this.scheduleFlush();
  }

  renderActive(points: readonly Point[] | null, style: StrokeStyle | null): void {
    if (this.destroyed) return;
    this.pendingActive = { points, style };
    this.scheduleFlush();
  }

  getMetrics(): PerfMetrics {
    return this.metrics;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingMain = null;
    this.pendingActive = null;
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }

  private flush(): void {
    if (this.destroyed) return;

    if (this.pendingMain) {
      const t0 = performance.now();
      this.clear(this.mainCtx, this.mainCanvas);
      renderAll(this.mainCtx, this.pendingMain.strokes);
      this.recordMainTiming(performance.now() - t0);
      this.pendingMain = null;
    }

    if (this.pendingActive) {
      const t0 = performance.now();
      this.clear(this.activeCtx, this.activeCanvas);
      const { points, style } = this.pendingActive;
      const hasContent = !!(points && style && points.length > 0);
      if (hasContent) {
        renderStroke(this.activeCtx, points!, style!);
      }
      const dt = performance.now() - t0;
      this.metrics.lastActiveRenderMs = dt;
      // Only count "real" renders (with content) toward max + count, so the
      // post-pointerup cleanup render doesn't dilute the measurement.
      if (hasContent) {
        this.metrics.activeRenderCount++;
        if (dt > this.metrics.maxActiveRenderMs) {
          this.metrics.maxActiveRenderMs = dt;
        }
      }
      this.pendingActive = null;
    }
  }

  private recordMainTiming(ms: number): void {
    this.metrics.lastMainRenderMs = ms;
    this.metrics.mainRenderCount++;
    this.mainTimings.push(ms);
    if (this.mainTimings.length > AVG_WINDOW) this.mainTimings.shift();
    let sum = 0;
    for (const t of this.mainTimings) sum += t;
    this.metrics.avgMainRenderMs = sum / this.mainTimings.length;
  }

  private clear(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
