import type { StrokeStyle } from '../types/canvas';
import { strokeToY } from '../crdt/document';
import { StrokeBuilder } from '../crdt/strokeBuilder';
import type { PointerInputState } from '../input/PointerInputState';
import type { Tool, ToolContext } from './Tool';

const DEFAULT_PEN_STYLE: StrokeStyle = {
  color: '#18181b',
  width: 3,
  opacity: 1,
  lineCap: 'round',
};

export class PenTool implements Tool {
  readonly name = 'pen' as const;
  readonly cursor = 'crosshair';
  private readonly builder: StrokeBuilder;
  private style: StrokeStyle = DEFAULT_PEN_STYLE;

  constructor(userId: string) {
    this.builder = new StrokeBuilder(userId);
  }

  onPointerDown(input: PointerInputState, ctx: ToolContext): void {
    this.builder.begin(this.style, this.toPoint(input));
    this.flushPreview(ctx);
  }

  onPointerMove(input: PointerInputState, ctx: ToolContext): void {
    if (!this.builder.isActive()) return;
    this.builder.extend(this.toPoint(input));
    this.flushPreview(ctx);
  }

  onPointerUp(_input: PointerInputState, ctx: ToolContext): void {
    if (!this.builder.isActive()) return;
    const stroke = this.builder.commit();
    ctx.engine.renderActive(null, null);
    if (stroke) {
      ctx.doc.transact(() => {
        ctx.yStrokes.push([strokeToY(stroke)]);
      }, ctx.doc.clientID);
    }
  }

  onPointerCancel(ctx: ToolContext): void {
    this.builder.cancel();
    ctx.engine.renderActive(null, null);
  }

  setStyle(style: StrokeStyle): void {
    this.style = style;
  }

  getStyle(): StrokeStyle {
    return this.style;
  }

  private toPoint(input: PointerInputState) {
    return {
      x: input.x,
      y: input.y,
      pressure: input.pressure,
      tiltX: input.tiltX,
      tiltY: input.tiltY,
      timestamp: performance.now(),
    };
  }

  private flushPreview(ctx: ToolContext): void {
    const preview = this.builder.preview();
    if (preview) ctx.engine.renderActive(preview.points, preview.style);
  }
}
