export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  timestamp?: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: 'round' | 'square' | 'butt';
}

export interface Stroke {
  id: string;
  userId: string;
  points: Point[];
  style: StrokeStyle;
  timestamp: number;
}
