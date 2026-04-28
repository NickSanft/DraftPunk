import * as Y from 'yjs';
import type { Point, Stroke } from '../types/canvas';
import { strokeToY, type YStrokes } from './document';

export function seedStrokes(
  yStrokes: YStrokes,
  doc: Y.Doc,
  count: number,
  width = 1200,
  height = 800,
): void {
  doc.transact(() => {
    for (let i = 0; i < count; i++) {
      const stroke: Stroke = {
        id: crypto.randomUUID().slice(0, 8),
        userId: 'seed',
        points: generateStrokePoints(width, height),
        style: {
          color: `hsl(${(i * 137.5) % 360}, 60%, 45%)`,
          width: 1 + Math.random() * 3,
          opacity: 0.75,
          lineCap: 'round',
        },
        timestamp: Date.now() + i,
      };
      yStrokes.push([strokeToY(stroke)]);
    }
  });
}

export function clearStrokes(yStrokes: YStrokes, doc: Y.Doc): void {
  doc.transact(() => {
    yStrokes.delete(0, yStrokes.length);
  });
}

function generateStrokePoints(width: number, height: number): Point[] {
  const points: Point[] = [];
  const length = 20 + Math.floor(Math.random() * 40);
  let x = Math.random() * width;
  let y = Math.random() * height;
  let angle = Math.random() * Math.PI * 2;
  for (let i = 0; i < length; i++) {
    points.push({ x, y });
    angle += (Math.random() - 0.5) * 0.6;
    const step = 3 + Math.random() * 5;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
  }
  return points;
}
