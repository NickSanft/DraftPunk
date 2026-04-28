import type { Point, Stroke, StrokeStyle } from '../types/canvas';
import { renderAll, renderStroke } from './Renderer';

export class CanvasEngine {
  private readonly mainCtx: CanvasRenderingContext2D;
  private readonly activeCtx: CanvasRenderingContext2D;
  private dpr = 1;

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
    this.clear(this.mainCtx, this.mainCanvas);
    renderAll(this.mainCtx, strokes);
  }

  renderActive(points: readonly Point[] | null, style: StrokeStyle | null): void {
    this.clear(this.activeCtx, this.activeCanvas);
    if (points && style && points.length > 0) {
      renderStroke(this.activeCtx, points, style);
    }
  }

  private clear(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
