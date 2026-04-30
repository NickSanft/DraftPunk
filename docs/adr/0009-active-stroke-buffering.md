# ADR-0009: In-progress strokes buffered locally; one CRDT op at pointerup

**Status:** Accepted

## Context

A pen drag fires `pointermove` between 60 and 240 times per second depending on hardware. Each move adds a point to the in-progress stroke. The naïve implementation — write each point to the CRDT as it arrives — would produce one Yjs update, one WebSocket packet, and one observe-event-driven render *per peer* for every move. A 200-point stroke at 120Hz would saturate the network in ways that have nothing to do with the actual collaborative work.

This pattern was not in the original design doc. The build plan called it out as the **most critical architectural seam** in the system, and named the missing module: `strokeBuilder.ts`.

## Decision

A `StrokeBuilder` class holds the in-progress stroke as plain JavaScript memory. No Yjs involvement during the drag.

While drawing:
- `pointerdown` → `builder.begin(style, point, pointerType)` — captures style/pointerType *at gesture start* so mid-stroke setting changes don't disturb the current stroke
- `pointermove` → `builder.extend(point)` → renderer paints the buffer to the active-stroke canvas (zero CRDT touches)
- `pointerup` → `builder.commit()` returns a fully populated `Stroke` → wrapped in `ydoc.transact(fn, clientID)` and pushed as a single `Y.Map` to the `yStrokes` array

Other peers see one observe event with the entire completed stroke. Their subscriptions fire once. Their renderers paint once.

## Consequences

**Positive**
- One CRDT update per stroke, regardless of point count
- Network traffic is independent of pen sample rate
- Other peers see strokes appear atomically — no flicker of a partial stroke that gets continuously updated
- Style and pointerType captured at gesture start means a tool/color change mid-drag doesn't corrupt the current stroke
- Active-stroke rendering is pure: it reads from in-memory state, no CRDT subscription on the hot path

**Negative**
- **Local-only previews while drawing.** The drawer sees their own stroke in real time; remote users don't see anything until `pointerup`. Intentional; partial strokes broadcast at 120Hz across many users would be visually noisy and racy. Could be revisited if a "live drawing presence" feature is ever desired (would likely use awareness, not the CRDT).
- If a user crashes mid-stroke, the in-progress stroke is lost. Acceptable — pen strokes are short, no data is at risk.
- The renderer subscribes to two state sources (committed via Yjs, active via `StrokeBuilder` preview). The `CanvasView` component coordinates both. This is the trickiest control-flow boundary in the project; it's worth understanding before changing anything in `CanvasView.tsx`.

## Locks in

- `app/src/crdt/strokeBuilder.ts` — the buffer, including `begin` / `extend` / `preview` / `commit` / `cancel`
- `app/src/tools/PenTool.ts` — uses the builder; commits in a `clientID`-origin transaction
- `app/src/components/CanvasView.tsx` — coordinates the two state sources
- `e2e/perf.spec.ts` — "active stroke renders stay within frame budget during a drag" depends on this pattern (renders the local buffer, not the CRDT)
