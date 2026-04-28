import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { CanvasEngine } from '../canvas/CanvasEngine';
import { fromPointerEvent } from '../input/PointerInputState';
import { StrokeSubscription } from '../crdt/subscription';
import { getStrokes } from '../crdt/document';
import { createTool } from '../tools/createTool';
import type { Tool, ToolContext, ToolType } from '../tools/Tool';

interface Props {
  doc: Y.Doc;
  userId: string;
  toolType: ToolType;
  onEngineReady?: (engine: CanvasEngine | null) => void;
}

export function CanvasView({ doc, userId, toolType, onEngineReady }: Props) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const toolRef = useRef<Tool | null>(null);
  const ctxRef = useRef<ToolContext | null>(null);

  const yStrokes = useMemo(() => getStrokes(doc), [doc]);

  // Set up the canvas engine + subscription. One-time per (doc, userId).
  useEffect(() => {
    const mainCanvas = mainRef.current;
    const activeCanvas = activeRef.current;
    if (!mainCanvas || !activeCanvas) return;

    const engine = new CanvasEngine(mainCanvas, activeCanvas);
    engineRef.current = engine;
    onEngineReady?.(engine);

    const subscription = new StrokeSubscription(yStrokes);

    const fitToParent = () => {
      const parent = mainCanvas.parentElement;
      if (!parent) return;
      engine.setSize(parent.clientWidth, parent.clientHeight);
      engine.renderCommitted(subscription.getStrokes());
    };
    fitToParent();
    window.addEventListener('resize', fitToParent);

    const unsubscribe = subscription.subscribe((strokes) => {
      engine.renderCommitted(strokes);
    });

    ctxRef.current = { doc, yStrokes, userId, engine };

    const onPointerDown = (e: PointerEvent) => {
      if (!toolRef.current || !ctxRef.current) return;
      activeCanvas.setPointerCapture(e.pointerId);
      toolRef.current.onPointerDown(fromPointerEvent(e, activeCanvas), ctxRef.current);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!toolRef.current || !ctxRef.current) return;
      toolRef.current.onPointerMove(fromPointerEvent(e, activeCanvas), ctxRef.current);
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

    activeCanvas.addEventListener('pointerdown', onPointerDown);
    activeCanvas.addEventListener('pointermove', onPointerMove);
    activeCanvas.addEventListener('pointerup', onPointerUp);
    activeCanvas.addEventListener('pointercancel', onPointerCancel);

    return () => {
      window.removeEventListener('resize', fitToParent);
      unsubscribe();
      subscription.destroy();
      activeCanvas.removeEventListener('pointerdown', onPointerDown);
      activeCanvas.removeEventListener('pointermove', onPointerMove);
      activeCanvas.removeEventListener('pointerup', onPointerUp);
      activeCanvas.removeEventListener('pointercancel', onPointerCancel);
      engine.destroy();
      engineRef.current = null;
      ctxRef.current = null;
      onEngineReady?.(null);
    };
  }, [doc, userId, yStrokes, onEngineReady]);

  // Swap the active tool when toolType changes. Cancel any in-progress
  // stroke from the outgoing tool so the active canvas isn't left stale.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (toolRef.current) {
      toolRef.current.onPointerCancel(ctx);
    }
    toolRef.current = createTool(toolType, userId);
    ctx.engine.renderActive(null, null);
  }, [toolType, userId]);

  const cursor = toolRef.current?.cursor ?? 'crosshair';

  return (
    <div className="canvas-stack">
      <canvas ref={mainRef} className="canvas-layer committed" />
      <canvas ref={activeRef} className="canvas-layer active" style={{ cursor }} />
    </div>
  );
}
