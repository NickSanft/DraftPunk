import type { Point, PointerType, Stroke, StrokeStyle } from '../types/canvas';
import { renderPressureStroke } from './PressureRenderer';

export function renderConstantStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  style: StrokeStyle,
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineCap = style.lineCap;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = style.opacity;

  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, style.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  style: StrokeStyle,
  pointerType?: PointerType,
): void {
  if (pointerType === 'pen' || pointerType === 'touch') {
    renderPressureStroke(ctx, points, style);
  } else {
    renderConstantStroke(ctx, points, style);
  }
}

export function renderAll(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
): void {
  for (const stroke of strokes) {
    renderStroke(ctx, stroke.points, stroke.style, stroke.pointerType);
  }
}
