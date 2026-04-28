/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARTYKIT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __draftPunk?: {
    seed: (n: number) => void;
    clear: () => void;
    getStrokeCount: () => number;
    getMetrics: () => import('./canvas/CanvasEngine').PerfMetrics;
  };
}
