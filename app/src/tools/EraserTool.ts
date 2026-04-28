import { yToStroke } from '../crdt/document';
import { strokeHit } from '../canvas/HitTest';
import type { PointerInputState } from '../input/PointerInputState';
import type { Tool, ToolContext } from './Tool';

const DEFAULT_RADIUS = 12;

export class EraserTool implements Tool {
  readonly name = 'eraser' as const;
  readonly cursor = 'crosshair';
  private active = false;
  private radius = DEFAULT_RADIUS;

  onPointerDown(input: PointerInputState, ctx: ToolContext): void {
    this.active = true;
    this.eraseAt(input, ctx);
  }

  onPointerMove(input: PointerInputState, ctx: ToolContext): void {
    if (!this.active) return;
    this.eraseAt(input, ctx);
  }

  onPointerUp(): void {
    this.active = false;
  }

  onPointerCancel(): void {
    this.active = false;
  }

  setRadius(r: number): void {
    this.radius = r;
  }

  getRadius(): number {
    return this.radius;
  }

  private eraseAt(input: PointerInputState, ctx: ToolContext): void {
    const point = { x: input.x, y: input.y };
    const toDelete: number[] = [];
    for (let i = 0; i < ctx.yStrokes.length; i++) {
      const stroke = yToStroke(ctx.yStrokes.get(i));
      if (strokeHit(stroke, point, this.radius)) {
        toDelete.push(i);
      }
    }
    if (toDelete.length === 0) return;
    ctx.doc.transact(() => {
      for (let i = toDelete.length - 1; i >= 0; i--) {
        ctx.yStrokes.delete(toDelete[i], 1);
      }
    }, ctx.doc.clientID);
  }
}
