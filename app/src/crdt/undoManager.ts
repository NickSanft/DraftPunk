import * as Y from 'yjs';
import type { YStrokes } from './document';

/**
 * Collaborative undo: tracks ONLY operations whose origin matches the local
 * client. Remote peers' edits arrive with their own origin and are skipped.
 *
 * For this to work, every local mutation must use ydoc.transact(fn, clientID)
 * so the origin propagates through the CRDT update pipeline.
 */
export function createUndoManager(doc: Y.Doc, yStrokes: YStrokes): Y.UndoManager {
  return new Y.UndoManager(yStrokes, {
    trackedOrigins: new Set([doc.clientID]),
  });
}
