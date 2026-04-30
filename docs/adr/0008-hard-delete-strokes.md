# ADR-0008: Hard delete for the eraser, not soft-delete flag

**Status:** Accepted

## Context

The eraser tool needs to remove strokes from the canvas. Two natural CRDT-level options:

**Soft delete** (proposed in the original design doc): set `deleted: true` on the stroke's `Y.Map`. The renderer filters out flagged strokes. Undo trivially un-flags.

**Hard delete:** `yStrokes.delete(idx, 1)`. The stroke is removed from the array. Undo must re-insert.

The build plan flagged this as needing an explicit decision — the design doc waved it away with "tombstones for deleted strokes are manageable for a drawing canvas." Math check: with 100-point strokes plus full pressure/tilt, each stroke is ~5KB of CRDT update bytes. 1000 deleted strokes = 5MB carried in the document forever. That's the IndexedDB blob loaded on every session, plus the full state sync sent to every late joiner. Not "manageable" once a room sees real use.

## Decision

**Hard delete.** `EraserTool` collects hit indices, then deletes them from the `Y.Array` in reverse-index order (so deletes don't shift the iterator), all inside `ydoc.transact(fn, doc.clientID)`. The `clientID` origin lets the [collaborative undo manager](0009-active-stroke-buffering.md) track and reverse the deletion.

Yjs `UndoManager` re-inserts the deleted stroke back into the array on undo. We rely on that — and tested it.

## Consequences

**Positive**
- Document size stays bounded by visible content. A canvas with 100 strokes uses roughly 100 strokes' worth of memory regardless of erase history.
- Renderer doesn't need a `if (!stroke.deleted) render(...)` branch
- Yjs internally tracks tombstones for the array slots; that's the level of monotonic growth we accept (still much smaller than soft-delete with full stroke data preserved)
- Undo + redo round-trips cleanly via `Yjs.UndoManager`

**Negative**
- Cross-peer concurrent edits to the same stroke + erase: the array slot disappears via "last-writer-wins" semantics. Acceptable for a sketching app; would matter more in something like a financial editor.
- An old delete undone after many subsequent operations may re-insert at a different visual position. The stroke comes back semantically; its z-order may not match what a user expects. Acceptable.
- "Show deleted strokes" / "view history" features would need to be re-architected (eg by storing strokes in an append-only `Y.Array<Y.Map>` with a separate `Y.Set<id>` of deletion tombstones). Not currently a goal.

## Locks in

- `app/src/tools/EraserTool.ts` — reverse-index `yStrokes.delete` inside a `clientID`-origin transaction
- `app/src/canvas/HitTest.ts` — point-to-segment-squared distance for stroke hit detection
- `e2e/tools.spec.ts` — "deleteStroke removes a stroke; undo restores it; redo deletes again"
