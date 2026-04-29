import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import type YPartyKitProvider from 'y-partykit/provider';
import type { CanvasEngine, PerfMetrics } from './canvas/CanvasEngine';
import { connect } from './crdt/provider';
import { getStrokes, yToStroke } from './crdt/document';
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
import { Announcer, EMPTY_MESSAGE, type AnnouncerMessage } from './components/Announcer';
import { SkipLink } from './components/SkipLink';
import { colorForUser, nameForUser } from './utils/colors';
import {
  applyProjectUpdate,
  downloadBlob,
  encodeProject,
  timestampSuffix,
} from './utils/export';
import type { ToolType } from './tools/Tool';
import type { StrokeStyle } from './types/canvas';

const PARTYKIT_HOST_RAW = import.meta.env.VITE_PARTYKIT_HOST?.trim();
const PARTYKIT_HOST = PARTYKIT_HOST_RAW || 'localhost:1999';

if (
  !PARTYKIT_HOST_RAW &&
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) {
  // eslint-disable-next-line no-console
  console.error(
    '[draft-punk] VITE_PARTYKIT_HOST is not set in this build. Sync will fail. ' +
      'In GitHub: Settings → Secrets and variables → Actions → Variables → VITE_PARTYKIT_HOST',
  );
}

const EMPTY_METRICS: PerfMetrics = {
  lastMainRenderMs: 0,
  lastActiveRenderMs: 0,
  maxActiveRenderMs: 0,
  activeRenderCount: 0,
  avgMainRenderMs: 0,
  mainRenderCount: 0,
};

const DEFAULT_PEN_STYLE: StrokeStyle = {
  color: '#18181b',
  width: 3,
  opacity: 1,
  lineCap: 'round',
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
  const [penStyle, setPenStyle] = useState<StrokeStyle>(DEFAULT_PEN_STYLE);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [users, setUsers] = useState<UserAwareness[]>([]);

  const [politeMessage, setPoliteMessage] = useState<AnnouncerMessage>(EMPTY_MESSAGE);
  const [assertiveMessage, setAssertiveMessage] = useState<AnnouncerMessage>(EMPTY_MESSAGE);
  const announce = useCallback(
    (msg: string, priority: 'polite' | 'assertive' = 'polite') => {
      const setter = priority === 'assertive' ? setAssertiveMessage : setPoliteMessage;
      setter((prev) => ({ msg, tick: prev.tick + 1 }));
    },
    [],
  );

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

  useEffect(() => {
    if (!provider) return;
    provider.awareness.setLocalStateField('tool', toolType);
  }, [provider, toolType]);

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

  // ===== a11y announcements =====

  // Skip the first render — we don't want a "Tool: pen" announcement on load.
  const isFirstToolRender = useRef(true);
  useEffect(() => {
    if (isFirstToolRender.current) {
      isFirstToolRender.current = false;
      return;
    }
    announce(`Tool: ${toolType}`);
  }, [toolType, announce]);

  const isFirstStatusRender = useRef(true);
  useEffect(() => {
    if (isFirstStatusRender.current) {
      isFirstStatusRender.current = false;
      return;
    }
    if (status === 'connected') announce('Connected to room', 'assertive');
    else if (status === 'disconnected') announce('Disconnected', 'assertive');
    else if (status === 'connecting') announce('Reconnecting');
  }, [status, announce]);

  const prevUsersRef = useRef<UserAwareness[]>([]);
  useEffect(() => {
    const prev = prevUsersRef.current;
    for (const u of users) {
      if (u.userId === userId) continue;
      if (!prev.find((p) => p.userId === u.userId)) {
        announce(`${u.name} joined`);
      }
    }
    for (const u of prev) {
      if (u.userId === userId) continue;
      if (!users.find((c) => c.userId === u.userId)) {
        announce(`${u.name} left`);
      }
    }
    prevUsersRef.current = users;
  }, [users, userId, announce]);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            undoManager?.redo();
            announce('Redid last edit');
          } else {
            undoManager?.undo();
            announce('Undid last edit');
          }
        } else if (key === 'y') {
          e.preventDefault();
          undoManager?.redo();
          announce('Redid last edit');
        }
        return;
      }

      if (e.key === 'b' || e.key === 'B') setToolType('pen');
      else if (e.key === 'e' || e.key === 'E') setToolType('eraser');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoManager, announce]);

  const handleColorChange = useCallback(
    (color: string) => setPenStyle((s) => ({ ...s, color })),
    [],
  );
  const handleWidthChange = useCallback(
    (width: number) => setPenStyle((s) => ({ ...s, width })),
    [],
  );

  const handleExportPng = useCallback(async () => {
    if (!engine) return;
    try {
      const blob = await engine.exportPng();
      downloadBlob(blob, `draft-punk-${room}-${timestampSuffix()}.png`);
      announce('Canvas exported as PNG');
    } catch {
      announce('Export failed', 'assertive');
    }
  }, [engine, room, announce]);

  const handleSaveProject = useCallback(() => {
    if (!doc) return;
    const bytes = encodeProject(doc);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: 'application/octet-stream' });
    downloadBlob(blob, `draft-punk-${room}-${timestampSuffix()}.draftpunk`);
    announce('Project saved');
  }, [doc, room, announce]);

  const handleLoadProject = useCallback(
    (bytes: Uint8Array) => {
      if (!doc) return;
      applyProjectUpdate(doc, bytes);
      announce('Project loaded');
    },
    [doc, announce],
  );

  // Debug API (window.__draftPunk) — gated behind ?debug=1.
  useEffect(() => {
    if (!debug || !doc || !yStrokes || !undoManager || !provider) return;
    window.__draftPunk = {
      seed: (n) => seedStrokes(yStrokes, doc, n),
      clear: () => clearStrokes(yStrokes, doc),
      getStrokeCount: () => yStrokes.length,
      getStrokes: () => yStrokes.toArray().map(yToStroke),
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
      exportProject: () => encodeProject(doc),
      importProject: (bytes) => applyProjectUpdate(doc, bytes),
    };
    return () => {
      delete window.__draftPunk;
    };
  }, [debug, doc, yStrokes, undoManager, engine, provider, toolType]);

  return (
    <div className="app">
      <SkipLink targetId="draft-punk-canvas" />
      <header className="app-header" role="banner">
        <span className="app-name">Draft Punk</span>
        <Toolbar
          active={toolType}
          onChange={setToolType}
          onUndo={() => undoManager?.undo()}
          onRedo={() => undoManager?.redo()}
          canUndo={canUndo}
          canRedo={canRedo}
          color={penStyle.color}
          width={penStyle.width}
          onColorChange={handleColorChange}
          onWidthChange={handleWidthChange}
          onExportPng={handleExportPng}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
        />
        <div className="app-header-right">
          <UserList users={users} selfUserId={userId} />
          <ShareButton />
        </div>
      </header>
      <main className="app-canvas" id="main">
        {doc && (
          <CanvasView
            doc={doc}
            awareness={provider?.awareness ?? null}
            userId={userId}
            toolType={toolType}
            penStyle={penStyle}
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
        <div className={`app-status ${status}`} aria-hidden>{status}</div>
      </main>
      <Announcer politeMessage={politeMessage} assertiveMessage={assertiveMessage} />
    </div>
  );
}
