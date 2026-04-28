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
    getStrokes: () => import('./types/canvas').Stroke[];
    getMetrics: () => import('./canvas/CanvasEngine').PerfMetrics;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    deleteStroke: (idx: number) => void;
    setTool: (t: import('./tools/Tool').ToolType) => void;
    getTool: () => import('./tools/Tool').ToolType;
    getAwarenessStates: () => import('./crdt/awareness').UserAwareness[];
    setCursor: (c: { x: number; y: number } | null) => void;
    exportProject: () => Uint8Array;
    importProject: (bytes: Uint8Array) => void;
  };
}
