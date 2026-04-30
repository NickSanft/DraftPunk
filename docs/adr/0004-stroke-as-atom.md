# ADR-0004: Stroke as the atomic unit of collaboration

**Status:** Accepted

## Context

A drawing canvas has many possible CRDT granularities:

- **Pixel-level** — every pixel is a CRDT cell. Easily hundreds of thousands of cells; an unrealistic amount of CRDT overhead per frame.
- **Path-segment** — each curve segment of each stroke. Allows partial-stroke editing, but quintuples the data model complexity for unclear product value.
- **Stroke-level** — each user drag is one atomic unit. Natural alignment with how users think about the canvas.
- **Layer-level** — a layer is one CRDT object. Too coarse; defeats real-time co-drawing.

Stroke-level wins on simplicity and product fit. Within stroke-level, the original design proposed `Y.Array<Y.Map>` where each stroke's `points` is itself a `Y.Array<Y.Map>` so individual point properties can be mutated post-hoc. The justification was "moving strokes by editing point offsets, changing color after the fact, soft-deleting via a flag."

I pushed back on this in the build plan. The per-point mutability use cases are speculative; per-point CRDT writes during a drag are extremely chatty (one Yjs update + WebSocket packet per point — a 200-point stroke at 120Hz would saturate the network).

## Decision

- The stroke list is `Y.Array<Y.Map>`.
- Each stroke is a `Y.Map` with fields: `id`, `userId`, `points`, `style`, `timestamp`, `pointerType`.
- **`points` is a plain JavaScript array of plain objects, stored as one `Y.Map` value.** Not a nested `Y.Array`.
- Strokes are atomic: created once at `pointerup` with all points already populated; never updated thereafter (with one foreseeable exception — adding a `deleted: true` flag was the alternative we rejected in [ADR-0008](0008-hard-delete-strokes.md)).
- The `Y.Map` wrapper is preserved (rather than serialising the whole stroke to JSON) so that future per-property mutations remain *possible* (eg style changes) without rewriting the data model.

## Consequences

**Positive**
- One CRDT update per stroke, regardless of point count → sync is constant-time per drag
- Renderer subscription fires once per stroke commit, not 200 times per drag
- Wire format is small and predictable
- Clear conceptual mapping: one drag = one stroke = one CRDT op

**Negative**
- Strokes can't be partially edited. Moving 100 strokes means rewriting all their points. We don't currently have a move tool, so this isn't a real cost yet.
- The renderer's subscription rebuilds the full `Stroke[]` cache on any change. Phase B verified this stays under 50ms even at 1000 strokes, so we accept it.

## Locks in

- `app/src/types/canvas.ts` — `Stroke` interface with `points: Point[]` (not `Y.Array<Point>`)
- `app/src/crdt/document.ts` — `strokeToY` / `yToStroke` serialisation
- `app/src/crdt/strokeBuilder.ts` — buffers points locally, commits one Y.Map (see [ADR-0009](0009-active-stroke-buffering.md))
