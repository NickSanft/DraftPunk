import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import type YPartyKitProvider from 'y-partykit/provider';
import type { CanvasEngine, PerfMetrics } from './canvas/CanvasEngine';
import { connect } from './crdt/provider';
import { getStrokes } from './crdt/document';
import { clearStrokes, seedStrokes } from './crdt/seed';
import { createUndoManager } from './crdt/undoManager';
import {
  getAllAwareness,
  type UserAwareness,
} from './crdt/awareness';
import { CanvasView } from './components/CanvasView';
import { DebugOverlay } from './components/DebugOverlay';
import { Toolbar } from './components/Toolbar';
import { UserList } from './components/UserList';
import { ShareButton } from './components/ShareButton';
import { colorForUser, nameForUser } from './utils/colors';
import type { ToolType } from './tools/Tool';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';

const EMPTY_METRICS: PerfMetrics = {
  lastMainRenderMs: 0,
  lastActiveRenderMs: 0,
  maxActiveRenderMs: 0,
  activeRenderCount: 0,
  avgMainRenderMs: 0,
  mainRenderCount: 0,
};

function getRoomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? 'draft-punk-default';
}

function getOrCreateUserId(): string {
  const existing = localStorage.getItem('draft-punk-userId');
  if (existing) return existing;
  const id = 'user-' + crypto.randomUUID().slice(0, 6);
  localStorage.setItem('draft-punk-userId', id);
  return id;
}

function isDebugMode(): boolean {
  return new URLSearchParams(window.location.search).has('debug');
}

type Status = 'connecting' | 'connected' | 'disconnected';

export function App() {
  const [room] = useState(getRoomFromUrl);
  const [userId] = useState(getOrCreateUserId);
  const [debug] = useState(isDebugMode);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<YPartyKitProvider | null>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [toolType, setToolType] = useState<ToolType>('pen');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [users, setUsers] = useState<UserAwareness[]>([]);

  useEffect(() => {
    const handle = connect(PARTYKIT_HOST, room);
    setDoc(handle.doc);
    setProvider(handle.provider);
    return () => {
      handle.destroy();
      setDoc(null);
      setProvider(null);
    };
  }, [room]);

  useEffect(() => {
    if (!provider) return;
    const onStatus = (e: { status: Status }) => setStatus(e.status);
    provider.on('status', onStatus);
    return () => {
      provider.off('status', onStatus);
    };
  }, [provider]);

  // Initial awareness state for self.
  useEffect(() => {
    if (!provider) return;
    provider.awareness.setLocalState({
      userId,
      name: nameForUser(userId),
      color: colorForUser(userId),
      cursor: null,
      tool: 'pen',
    });
    return () => {
      provider.awareness.setLocalState(null);
    };
  }, [provider, userId]);

  // Sync tool changes to awareness.
  useEffect(() => {
    if (!provider) return;
    provider.awareness.setLocalStateField('tool', toolType);
  }, [provider, toolType]);

  // Subscribe to awareness changes for the user list.
  useEffect(() => {
    if (!provider) return;
    const update = () => setUsers(getAllAwareness(provider.awareness));
    provider.awareness.on('change', update);
    update();
    return () => provider.awareness.off('change', update);
  }, [provider]);

  const yStrokes = useMemo(() => (doc ? getStrokes(doc) : null), [doc]);

  const undoManager = useMemo(() => {
    if (!doc || !yStrokes) return null;
    return createUndoManager(doc, yStrokes);
  }, [doc, yStrokes]);

  useEffect(() => {
    if (!undoManager) return;
    const update = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };
    undoManager.on('stack-item-added', update);
    undoManager.on('stack-item-popped', update);
    update();
    return () => {
      undoManager.off('stack-item-added', update);
      undoManager.off('stack-item-popped', update);
      undoManager.destroy();
    };
  }, [undoManager]);

  useEffect(() => {
    if (!yStrokes) return;
    const update = () => setStrokeCount(yStrokes.length);
    yStrokes.observe(update);
    update();
    return () => yStrokes.unobserve(update);
  }, [yStrokes]);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) undoManager?.redo();
          else undoManager?.undo();
        } else if (key === 'y') {
          e.preventDefault();
          undoManager?.redo();
        }
        return;
      }

      if (e.key === 'b' || e.key === 'B') setToolType('pen');
      else if (e.key === 'e' || e.key === 'E') setToolType('eraser');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoManager]);

  // Debug API (window.__draftPunk) — gated behind ?debug=1.
  useEffect(() => {
    if (!debug || !doc || !yStrokes || !undoManager || !provider) return;
    window.__draftPunk = {
      seed: (n) => seedStrokes(yStrokes, doc, n),
      clear: () => clearStrokes(yStrokes, doc),
      getStrokeCount: () => yStrokes.length,
      getMetrics: () => engine?.getMetrics() ?? EMPTY_METRICS,
      undo: () => undoManager.undo(),
      redo: () => undoManager.redo(),
      canUndo: () => undoManager.undoStack.length > 0,
      canRedo: () => undoManager.redoStack.length > 0,
      deleteStroke: (idx) =>
        doc.transact(() => {
          if (idx >= 0 && idx < yStrokes.length) {
            yStrokes.delete(idx, 1);
          }
        }, doc.clientID),
      setTool: (t) => setToolType(t),
      getTool: () => toolType,
      getAwarenessStates: () => getAllAwareness(provider.awareness),
      setCursor: (cursor) =>
        provider.awareness.setLocalStateField('cursor', cursor),
    };
    return () => {
      delete window.__draftPunk;
    };
  }, [debug, doc, yStrokes, undoManager, engine, provider, toolType]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Draft Punk</span>
        <Toolbar
          active={toolType}
          onChange={setToolType}
          onUndo={() => undoManager?.undo()}
          onRedo={() => undoManager?.redo()}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <div className="app-header-right">
          <UserList users={users} selfUserId={userId} />
          <ShareButton />
        </div>
      </header>
      <main className="app-canvas">
        {doc && (
          <CanvasView
            doc={doc}
            awareness={provider?.awareness ?? null}
            userId={userId}
            toolType={toolType}
            onEngineReady={setEngine}
          />
        )}
        {debug && engine && (
          <DebugOverlay
            getMetrics={() => engine.getMetrics()}
            strokeCount={strokeCount}
            onSeed={(n) => yStrokes && doc && seedStrokes(yStrokes, doc, n)}
            onClear={() => yStrokes && doc && clearStrokes(yStrokes, doc)}
          />
        )}
        <div className={`app-status ${status}`}>{status}</div>
      </main>
    </div>
  );
}
