export interface PointerInputState {
  pointerType: 'mouse' | 'pen' | 'touch';
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  isPrimary: boolean;
  buttons: number;
  pointerId: number;
}

export function fromPointerEvent(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
): PointerInputState {
  const rect = canvas.getBoundingClientRect();
  const pointerType = (e.pointerType || 'mouse') as 'mouse' | 'pen' | 'touch';
  return {
    pointerType,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: pointerType === 'mouse' ? 0.5 : e.pressure,
    tiltX: e.tiltX || 0,
    tiltY: e.tiltY || 0,
    isPrimary: e.isPrimary,
    buttons: e.buttons,
    pointerId: e.pointerId,
  };
}
