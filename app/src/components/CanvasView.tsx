import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { fromPointerEvent } from '../input/PointerInputState';
import { StrokeSubscription } from '../crdt/subscription';
import { getStrokes } from '../crdt/document';
import { getRemoteAwareness } from '../crdt/awareness';
import { createTool } from '../tools/createTool';
import { EraserTool } from '../tools/EraserTool';
import { PenTool } from '../tools/PenTool';
import type { Tool, ToolContext, ToolType } from '../tools/Tool';
import type { StrokeStyle } from '../types/canvas';

interface Props {
  doc: Y.Doc;
  awareness: Awareness | null;
  userId: string;
  toolType: ToolType;
  penStyle: StrokeStyle;
  onEngineReady?: (engine: CanvasEngine | null) => void;
}

const CURSOR_PUBLISH_INTERVAL_MS = 16;

function isPenEraser(e: PointerEvent): boolean {
  if (e.pointerType !== 'pen') return false;
  if (e.button === 5) return true;
  if ((e.buttons & 32) === 32 && (e.buttons & 1) === 0) return true;
  return false;
}

const CANVAS_ARIA_LABEL =
  'Collaborative drawing canvas. Use the toolbar to choose tools, colors, and brush size. ' +
  'Drawing requires a pointer device. Stroke contents are visible only to sighted users; ' +
  'tool changes, undo, and connection updates are announced.';

export function CanvasView({ doc, awareness, userId, toolType, penStyle, onEngineReady }: Props) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const toolRef = useRef<Tool | null>(null);
  const eraserToolRef = useRef<EraserTool>(new EraserTool());
  const activeGestureToolRef = useRef<Tool | null>(null);
  const ctxRef = useRef<ToolContext | null>(null);
  const lastCursorPublishRef = useRef(0);

  const yStrokes = useMemo(() => getStrokes(doc), [doc]);

  useEffect(() => {
    const mainCanvas = mainRef.current;
    const activeCanvas = activeRef.current;
    const cursorCanvas = cursorRef.current;
    if (!mainCanvas || !activeCanvas || !cursorCanvas) return;

    const engine = new CanvasEngine(mainCanvas, activeCanvas, cursorCanvas);
    engineRef.current = engine;
    onEngineReady?.(engine);

    const subscription = new StrokeSubscription(yStrokes);

    const fitToParent = () => {
      const parent = mainCanvas.parentElement;
      if (!parent) return;
      engine.setSize(parent.clientWidth, parent.clientHeight);
      engine.renderCommitted(subscription.getStrokes());
      if (awareness) engine.renderCursors(getRemoteAwareness(awareness));
    };
    fitToParent();
    window.addEventListener('resize', fitToParent);

    const unsubscribe = subscription.subscribe((strokes) => {
      engine.renderCommitted(strokes);
    });

    ctxRef.current = { doc, yStrokes, userId, engine };

    const publishCursor = (x: number | null, y: number | null) => {
      if (!awareness) return;
      const now = performance.now();
      if (x !== null && y !== null && now - lastCursorPublishRef.current < CURSOR_PUBLISH_INTERVAL_MS) {
        return;
      }
      lastCursorPublishRef.current = now;
      awareness.setLocalStateField('cursor', x === null || y === null ? null : { x, y });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!ctxRef.current) return;
      try {
        activeCanvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events with non-active pointerIds can throw.
      }
      const input = fromPointerEvent(e, activeCanvas);
      publishCursor(input.x, input.y);
      const tool = isPenEraser(e) ? eraserToolRef.current : toolRef.current;
      activeGestureToolRef.current = tool;
      tool?.onPointerDown(input, ctxRef.current);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!ctxRef.current) return;
      const input = fromPointerEvent(e, activeCanvas);
      publishCursor(input.x, input.y);
      activeGestureToolRef.current?.onPointerMove(input, ctxRef.current);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!ctxRef.current) return;
      try {
        activeCanvas.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      activeGestureToolRef.current?.onPointerUp(fromPointerEvent(e, activeCanvas), ctxRef.current);
      activeGestureToolRef.current = null;
    };

    const onPointerCancel = () => {
      if (!ctxRef.current) return;
      activeGestureToolRef.current?.onPointerCancel(ctxRef.current);
      activeGestureToolRef.current = null;
    };

    const onPointerLeave = () => {
      publishCursor(null, null);
    };

    activeCanvas.addEventListener('pointerdown', onPointerDown);
    activeCanvas.addEventListener('pointermove', onPointerMove);
    activeCanvas.addEventListener('pointerup', onPointerUp);
    activeCanvas.addEventListener('pointercancel', onPointerCancel);
    activeCanvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      window.removeEventListener('resize', fitToParent);
      unsubscribe();
      subscription.destroy();
      activeCanvas.removeEventListener('pointerdown', onPointerDown);
      activeCanvas.removeEventListener('pointermove', onPointerMove);
      activeCanvas.removeEventListener('pointerup', onPointerUp);
      activeCanvas.removeEventListener('pointercancel', onPointerCancel);
      activeCanvas.removeEventListener('pointerleave', onPointerLeave);
      engine.destroy();
      engineRef.current = null;
      ctxRef.current = null;
      activeGestureToolRef.current = null;
      onEngineReady?.(null);
    };
  }, [doc, userId, yStrokes, awareness, onEngineReady]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!awareness || !engine) return;
    const update = () => {
      engine.renderCursors(getRemoteAwareness(awareness));
    };
    awareness.on('change', update);
    update();
    return () => awareness.off('change', update);
  }, [awareness]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (toolRef.current) {
      toolRef.current.onPointerCancel(ctx);
    }
    const tool = createTool(toolType, userId);
    if (tool instanceof PenTool) {
      tool.setStyle(penStyle);
    }
    toolRef.current = tool;
    ctx.engine.renderActive(null, null);
  }, [toolType, userId, penStyle]);

  useEffect(() => {
    if (toolRef.current instanceof PenTool) {
      toolRef.current.setStyle(penStyle);
    }
  }, [penStyle]);

  const cursor = toolRef.current?.cursor ?? 'crosshair';

  return (
    <div
      className="canvas-stack"
      id="draft-punk-canvas"
      tabIndex={-1}
      role="region"
      aria-label="Drawing area"
    >
      <canvas ref={mainRef} className="canvas-layer committed" aria-hidden />
      <canvas
        ref={activeRef}
        className="canvas-layer active"
        style={{ cursor }}
        tabIndex={0}
        aria-label={CANVAS_ARIA_LABEL}
      />
      <canvas ref={cursorRef} className="canvas-layer cursors" aria-hidden />
    </div>
  );
}
