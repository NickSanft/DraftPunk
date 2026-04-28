import type { Point, Stroke, StrokeStyle } from '../types/canvas';

export class StrokeBuilder {
  private points: Point[] = [];
  private style: StrokeStyle | null = null;
  private startedAt = 0;

  constructor(private readonly userId: string) {}

  begin(style: StrokeStyle, point: Point): void {
    this.points = [point];
    this.style = style;
    this.startedAt = Date.now();
  }

  extend(point: Point): void {
    if (!this.style) return;
    this.points.push(point);
  }

  isActive(): boolean {
    return this.style !== null;
  }

  preview(): { points: readonly Point[]; style: StrokeStyle } | null {
    if (!this.style || this.points.length === 0) return null;
    return { points: this.points, style: this.style };
  }

  commit(): Stroke | null {
    if (!this.style || this.points.length === 0) {
      this.reset();
      return null;
    }
    const stroke: Stroke = {
      id: crypto.randomUUID().slice(0, 8),
      userId: this.userId,
      points: this.points,
      style: this.style,
      timestamp: this.startedAt,
    };
    this.reset();
    return stroke;
  }

  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.points = [];
    this.style = null;
    this.startedAt = 0;
  }
}
