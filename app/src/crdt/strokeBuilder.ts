import type { Point, PointerType, Stroke, StrokeStyle } from '../types/canvas';

export interface StrokePreview {
  points: readonly Point[];
  style: StrokeStyle;
  pointerType?: PointerType;
}

export class StrokeBuilder {
  private points: Point[] = [];
  private style: StrokeStyle | null = null;
  private pointerType: PointerType | undefined;
  private startedAt = 0;

  constructor(private readonly userId: string) {}

  begin(style: StrokeStyle, point: Point, pointerType?: PointerType): void {
    this.points = [point];
    this.style = style;
    this.pointerType = pointerType;
    this.startedAt = Date.now();
  }

  extend(point: Point): void {
    if (!this.style) return;
    this.points.push(point);
  }

  isActive(): boolean {
    return this.style !== null;
  }

  preview(): StrokePreview | null {
    if (!this.style || this.points.length === 0) return null;
    return { points: this.points, style: this.style, pointerType: this.pointerType };
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
      pointerType: this.pointerType,
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
    this.pointerType = undefined;
    this.startedAt = 0;
  }
}
