import type * as Y from 'yjs';
import type { CanvasEngine } from '../canvas/CanvasEngine';
import type { YStrokes } from '../crdt/document';
import type { PointerInputState } from '../input/PointerInputState';

export type ToolType = 'pen' | 'eraser';

export interface ToolContext {
  doc: Y.Doc;
  yStrokes: YStrokes;
  userId: string;
  engine: CanvasEngine;
}

export interface Tool {
  readonly name: ToolType;
  readonly cursor: string;
  onPointerDown(input: PointerInputState, ctx: ToolContext): void;
  onPointerMove(input: PointerInputState, ctx: ToolContext): void;
  onPointerUp(input: PointerInputState, ctx: ToolContext): void;
  onPointerCancel(ctx: ToolContext): void;
}
