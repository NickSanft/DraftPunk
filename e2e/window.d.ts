// Mirrors the declaration in app/src/vite-env.d.ts so the e2e tests can
// reference window.__draftPunk without importing app source code directly.
declare global {
  interface Window {
    __draftPunk?: {
      seed: (n: number) => void;
      clear: () => void;
      getStrokeCount: () => number;
      getMetrics: () => import('../app/src/canvas/CanvasEngine').PerfMetrics;
      undo: () => void;
      redo: () => void;
      canUndo: () => boolean;
      canRedo: () => boolean;
      deleteStroke: (idx: number) => void;
      setTool: (t: import('../app/src/tools/Tool').ToolType) => void;
      getTool: () => import('../app/src/tools/Tool').ToolType;
    };
  }
}
export {};
