import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { CanvasEngine, type PerfMetrics } from '../canvas/CanvasEngine';
import { fromPointerEvent } from '../input/PointerInputState';
import { StrokeBuilder } from '../crdt/strokeBuilder';
import { StrokeSubscription } from '../crdt/subscription';
import { getStrokes, strokeToY } from '../crdt/document';
import { clearStrokes, seedStrokes } from '../crdt/seed';
import type { StrokeStyle } from '../types/canvas';
import { DebugOverlay } from './DebugOverlay';

interface Props {
  doc: Y.Doc;
  userId: string;
  debug?: boolean;
}

const DEFAULT_STYLE: StrokeStyle = {
  color: '#18181b',
  width: 3,
  opacity: 1,
  lineCap: 'round',
};

const EMPTY_METRICS: PerfMetrics = {
  lastMainRenderMs: 0,
  lastActiveRenderMs: 0,
  avgMainRenderMs: 0,
  mainRenderCount: 0,
};

export function CanvasView({ doc, userId, debug }: Props) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  const yStrokes = useMemo(() => getStrokes(doc), [doc]);

  useEffect(() => {
    const mainCanvas = mainRef.current;
    const activeCanvas = activeRef.current;
    if (!mainCanvas || !activeCanvas) return;

    const engine = new CanvasEngine(mainCanvas, activeCanvas);
    engineRef.current = engine;
    const builder = new StrokeBuilder(userId);
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
      setStrokeCount(strokes.length);
    });

    const onPointerDown = (e: PointerEvent) => {
      activeCanvas.setPointerCapture(e.pointerId);
      const input = fromPointerEvent(e, activeCanvas);
      builder.begin(DEFAULT_STYLE, {
        x: input.x,
        y: input.y,
        pressure: input.pressure,
        tiltX: input.tiltX,
        tiltY: input.tiltY,
        timestamp: performance.now(),
      });
      const preview = builder.preview();
      if (preview) engine.renderActive(preview.points, preview.style);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!builder.isActive()) return;
      const input = fromPointerEvent(e, activeCanvas);
      builder.extend({
        x: input.x,
        y: input.y,
        pressure: input.pressure,
        tiltX: input.tiltX,
        tiltY: input.tiltY,
        timestamp: performance.now(),
      });
      const preview = builder.preview();
      if (preview) engine.renderActive(preview.points, preview.style);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!builder.isActive()) return;
      try {
        activeCanvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer may already be released
      }
      const stroke = builder.commit();
      engine.renderActive(null, null);
      if (stroke) {
        yStrokes.push([strokeToY(stroke)]);
      }
    };

    const onPointerCancel = () => {
      builder.cancel();
      engine.renderActive(null, null);
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
    };
  }, [doc, userId, yStrokes]);

  return (
    <>
      <div className="canvas-stack">
        <canvas ref={mainRef} className="canvas-layer committed" />
        <canvas ref={activeRef} className="canvas-layer active" />
      </div>
      {debug && (
        <DebugOverlay
          getMetrics={() => engineRef.current?.getMetrics() ?? EMPTY_METRICS}
          strokeCount={strokeCount}
          onSeed={(n) => seedStrokes(yStrokes, doc, n)}
          onClear={() => clearStrokes(yStrokes, doc)}
        />
      )}
    </>
  );
}
