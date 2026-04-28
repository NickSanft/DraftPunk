import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import type YPartyKitProvider from 'y-partykit/provider';
import { connect } from './crdt/provider';
import { CanvasView } from './components/CanvasView';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';

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

type Status = 'connecting' | 'connected' | 'disconnected';

export function App() {
  const [room] = useState(getRoomFromUrl);
  const [userId] = useState(getOrCreateUserId);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<YPartyKitProvider | null>(null);
  const [status, setStatus] = useState<Status>('connecting');

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

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Draft Punk</span>
        <span className="app-meta">
          <span>room: <code>{room}</code></span>
          <span>you: <code>{userId}</code></span>
        </span>
      </header>
      <main className="app-canvas">
        {doc && <CanvasView doc={doc} userId={userId} />}
        <div className={`app-status ${status}`}>{status}</div>
      </main>
    </div>
  );
}
