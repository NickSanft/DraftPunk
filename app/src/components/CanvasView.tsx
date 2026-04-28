import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { fromPointerEvent } from '../input/PointerInputState';
import { StrokeSubscription } from '../crdt/subscription';
import { getStrokes } from '../crdt/document';
import { getRemoteAwareness } from '../crdt/awareness';
import { createTool } from '../tools/createTool';
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

const CURSOR_PUBLISH_INTERVAL_MS = 16; // ~60Hz cap

export function CanvasView({ doc, awareness, userId, toolType, penStyle, onEngineReady }: Props) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const toolRef = useRef<Tool | null>(null);
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
      if (!toolRef.current || !ctxRef.current) return;
      activeCanvas.setPointerCapture(e.pointerId);
      const input = fromPointerEvent(e, activeCanvas);
      publishCursor(input.x, input.y);
      toolRef.current.onPointerDown(input, ctxRef.current);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!toolRef.current || !ctxRef.current) return;
      const input = fromPointerEvent(e, activeCanvas);
      publishCursor(input.x, input.y);
      toolRef.current.onPointerMove(input, ctxRef.current);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!toolRef.current || !ctxRef.current) return;
      try {
        activeCanvas.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      toolRef.current.onPointerUp(fromPointerEvent(e, activeCanvas), ctxRef.current);
    };

    const onPointerCancel = () => {
      if (!toolRef.current || !ctxRef.current) return;
      toolRef.current.onPointerCancel(ctxRef.current);
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
      onEngineReady?.(null);
    };
  }, [doc, userId, yStrokes, awareness, onEngineReady]);

  // Render remote cursors when awareness changes.
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

  // Swap the active tool when toolType changes.
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

  // Apply pen style changes without recreating the tool — preserves any
  // in-progress stroke (StrokeBuilder captures style at begin time, so a
  // mid-stroke style change doesn't disturb the current stroke).
  useEffect(() => {
    if (toolRef.current instanceof PenTool) {
      toolRef.current.setStyle(penStyle);
    }
  }, [penStyle]);

  const cursor = toolRef.current?.cursor ?? 'crosshair';

  return (
    <div className="canvas-stack">
      <canvas ref={mainRef} className="canvas-layer committed" />
      <canvas ref={activeRef} className="canvas-layer active" style={{ cursor }} />
      <canvas ref={cursorRef} className="canvas-layer cursors" />
    </div>
  );
}
