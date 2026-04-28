import type { Point, StrokeStyle } from '../types/canvas';

// Linear pressure mapping with floor and ceiling: a 0-pressure point still
// produces a thin (30% base width) stroke instead of a 0-width invisible
// segment, and full pressure goes 30% above base for a noticeable peak.
const MIN_FACTOR = 0.3;
const MAX_BOOST = 1.0;

function widthForPressure(pressure: number | undefined, baseWidth: number): number {
  const p = pressure ?? 0.5;
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  return baseWidth * (MIN_FACTOR + clamped * MAX_BOOST);
}

export function renderPressureStroke(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  style: StrokeStyle,
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = style.opacity;

  if (points.length === 1) {
    const p = points[0];
    const w = widthForPressure(p.pressure, style.width);
    ctx.beginPath();
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Render each segment with the average of its endpoints' widths. Slightly
  // lossy at sharp width changes but matches what real drawing apps do at
  // the cheap end of the quality spectrum, and stays well inside the
  // per-frame perf budget.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const wA = widthForPressure(a.pressure, style.width);
    const wB = widthForPressure(b.pressure, style.width);
    ctx.lineWidth = (wA + wB) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}
