import { useEffect, useState } from 'react';
import type { PerfMetrics } from '../canvas/CanvasEngine';

interface Props {
  getMetrics: () => PerfMetrics;
  strokeCount: number;
  onSeed: (n: number) => void;
  onClear: () => void;
}

export function DebugOverlay({ getMetrics, strokeCount, onSeed, onClear }: Props) {
  const [metrics, setMetrics] = useState<PerfMetrics>(getMetrics);

  useEffect(() => {
    const id = setInterval(() => setMetrics(getMetrics()), 200);
    return () => clearInterval(id);
  }, [getMetrics]);

  const fmt = (n: number) => n.toFixed(1).padStart(5, ' ');
  const warn = (ms: number, threshold: number) => (ms > threshold ? 'warn' : '');

  return (
    <div className="debug-overlay">
      <div className="debug-title">debug</div>
      <div className="debug-row">
        <span>strokes</span>
        <strong>{strokeCount}</strong>
      </div>
      <div className={`debug-row ${warn(metrics.lastMainRenderMs, 50)}`}>
        <span>main render (last)</span>
        <strong>{fmt(metrics.lastMainRenderMs)}ms</strong>
      </div>
      <div className={`debug-row ${warn(metrics.avgMainRenderMs, 16)}`}>
        <span>main render (avg)</span>
        <strong>{fmt(metrics.avgMainRenderMs)}ms</strong>
      </div>
      <div className="debug-row">
        <span>active render</span>
        <strong>{fmt(metrics.lastActiveRenderMs)}ms</strong>
      </div>
      <div className="debug-row">
        <span>main render count</span>
        <strong>{metrics.mainRenderCount}</strong>
      </div>
      <div className="debug-buttons">
        <button type="button" onClick={() => onSeed(100)}>seed 100</button>
        <button type="button" onClick={() => onSeed(1000)}>seed 1000</button>
        <button type="button" onClick={() => onSeed(5000)}>seed 5000</button>
        <button type="button" onClick={onClear}>clear</button>
      </div>
    </div>
  );
}
