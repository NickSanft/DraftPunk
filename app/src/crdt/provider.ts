import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';

export interface SyncHandle {
  doc: Y.Doc;
  provider: YPartyKitProvider;
  destroy(): void;
}

export function connect(host: string, room: string): SyncHandle {
  const doc = new Y.Doc();
  const provider = new YPartyKitProvider(host, room, doc);
  return {
    doc,
    provider,
    destroy() {
      provider.disconnect();
      provider.destroy();
      doc.destroy();
    },
  };
}
