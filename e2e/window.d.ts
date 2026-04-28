// Mirrors the declaration in app/src/vite-env.d.ts so the e2e tests can
// reference window.__draftPunk without importing app source code directly.
declare global {
  interface Window {
    __draftPunk?: {
      seed: (n: number) => void;
      clear: () => void;
      getStrokeCount: () => number;
      getMetrics: () => import('../app/src/canvas/CanvasEngine').PerfMetrics;
    };
  }
}
export {};
