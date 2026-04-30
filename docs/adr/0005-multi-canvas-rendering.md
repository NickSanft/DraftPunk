# ADR-0005: Three stacked canvases for rendering

**Status:** Accepted

## Context

Three rendering frequencies coexist in this app:

- **Committed strokes** — change rarely. Only on local stroke commit or remote stroke arrival.
- **Active in-progress stroke** — updates every frame during a drag (60–120Hz from the input device).
- **Remote cursors** — update at the rate awareness messages arrive (potentially many per second from many users).

Naive single-canvas rendering would mean redrawing 1000 committed strokes 60 times per second during a drag. Wasteful, and likely to drop frames at higher stroke counts.

## Decision

Three stacked HTML5 canvases, all the same size, positioned absolutely on top of each other:

| z-index | Canvas | When it redraws | Pointer events |
|---------|--------|-----------------|----------------|
| 1 | Committed | When the CRDT changes | `aria-hidden`, decorative |
| 2 | Active stroke | While a drag is in progress (60Hz max) | Captures pointer events; this is the focus target |
| 3 | Cursor overlay | When awareness changes | `pointer-events: none` |

All three render through `CanvasEngine.flush()`, which is RAF-batched. Multiple `renderCommitted` / `renderActive` / `renderCursors` calls within the same frame collapse to one paint each.

## Consequences

**Positive**
- Committed canvas redraws only on actual changes — measured at 1.5ms for 1000 strokes (Phase B perf test), 33× headroom against the 50ms acceptance budget
- Active stroke can redraw freely without touching committed work
- Cursors can disappear cleanly when a peer leaves (clear the cursor canvas; committed canvas untouched)
- Each layer can have independent alpha / composite operations (useful for future highlighter / eraser preview features)

**Negative**
- 3× memory for canvas backing stores. At 1920×1080 with DPR 2, that's ~25MB total for backing pixels — manageable on every device worth supporting
- Active canvas has to capture pointer events; cursor canvas needs `pointer-events: none` CSS or it would steal them
- The committed canvas is `aria-hidden` — its visual content is opaque to screen readers regardless. See [ADR-0006](0006-accessibility-scope.md) for the honest framing.

## Locks in

- `app/src/canvas/CanvasEngine.ts` — three contexts, RAF flush
- `app/src/components/CanvasView.tsx` — three `<canvas>` elements, layout via `.canvas-layer.{committed,active,cursors}`
- `e2e/perf.spec.ts` — 1000-stroke main render < 50ms; active stroke during drag < 16ms
- `app/src/styles.css` — `pointer-events: none` on `.cursors`
