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

export type PointerType = 'mouse' | 'pen' | 'touch';

export interface Stroke {
  id: string;
  userId: string;
  points: Point[];
  style: StrokeStyle;
  timestamp: number;
  // Captured at pointerdown so the renderer can pick variable-width
  // (pen/touch) vs constant-width (mouse). Optional for backwards
  // compatibility with strokes produced before Phase F1.
  pointerType?: PointerType;
}
