import * as Y from 'yjs';
import type { Point, Stroke, StrokeStyle } from '../types/canvas';

export type YStroke = Y.Map<unknown>;
export type YStrokes = Y.Array<YStroke>;

export const STROKES_KEY = 'strokes';

export function getStrokes(doc: Y.Doc): YStrokes {
  return doc.getArray<YStroke>(STROKES_KEY);
}

export function strokeToY(stroke: Stroke): YStroke {
  const m = new Y.Map<unknown>();
  m.set('id', stroke.id);
  m.set('userId', stroke.userId);
  m.set('points', stroke.points);
  m.set('style', stroke.style);
  m.set('timestamp', stroke.timestamp);
  return m;
}

export function yToStroke(y: YStroke): Stroke {
  return {
    id: y.get('id') as string,
    userId: y.get('userId') as string,
    points: y.get('points') as Point[],
    style: y.get('style') as StrokeStyle,
    timestamp: y.get('timestamp') as number,
  };
}
