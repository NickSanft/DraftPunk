import type { Point, Stroke } from '../types/canvas';

export function strokeHit(stroke: Stroke, point: Point, radius: number): boolean {
  const widthMargin = stroke.style.width / 2;
  const reach = radius + widthMargin;
  const reachSq = reach * reach;

  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    return distanceSquared(pts[0], point) <= reachSq;
  }

  for (let i = 1; i < pts.length; i++) {
    if (distancePointToSegmentSquared(point, pts[i - 1], pts[i]) <= reachSq) {
      return true;
    }
  }
  return false;
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distancePointToSegmentSquared(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distanceSquared(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;
  return ex * ex + ey * ey;
}
