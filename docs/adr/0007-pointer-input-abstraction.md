# ADR-0007: Unified `PointerInputState` for all input devices

**Status:** Accepted

## Context

Mouse, pen, and touch each historically had their own DOM event types with overlapping but inconsistent properties. The Pointer Events API unifies them, but `PointerEvent` has 25+ properties, only a handful of which any given tool cares about. Tools that consume raw `PointerEvent` end up duplicating coordinate-conversion logic and per-device branching.

We also need to capture some derived state at gesture start that the raw event doesn't expose (canvas-local coordinates, mouse-pressure-default, calibration of tilt sensitivity, etc.).

## Decision

Define a single `PointerInputState` interface that flows through the entire input pipeline:

```typescript
interface PointerInputState {
  pointerType: 'mouse' | 'pen' | 'touch';
  x: number;             // canvas-local CSS pixels
  y: number;
  pressure: number;      // 0-1; mouse defaults to 0.5 (see below)
  tiltX: number;
  tiltY: number;
  isPrimary: boolean;
  button: number;
  buttons: number;
  pointerId: number;
}
```

Produced by `fromPointerEvent(e, canvas)`. Tools take `PointerInputState`, not raw `PointerEvent`.

Mouse pressure is stamped at `0.5`, not `1.0`. Reason: when [Phase F1](../../app/src/canvas/PressureRenderer.ts) introduced variable-width rendering, a mouse stamped at `1.0` (full pressure) would render mouse strokes at full thickness while pen strokes vary — visually inconsistent. `0.5` gives mouse strokes the base width of their `style.width` setting, matching what users expect.

## Consequences

**Positive**
- Tools don't carry per-device branches. PenTool reads `input.pressure` whether it's a real pen, a mouse, or a touchscreen.
- New input sources can produce a `PointerInputState` from outside the DOM event pipeline (eg keyboard pan emulating a pointer, future Bluetooth stylus integration) without changing tool code
- Mouse strokes render correctly under variable-width pressure rendering — no special-case in the renderer
- Captures canvas-local coordinates once at the boundary, not at every consumer

**Negative**
- Adds an indirection between DOM events and tool logic — slightly harder to debug a "wrong coordinate" bug because there are two layers of mapping (DOM → state, state → CRDT)
- Loses some PointerEvent properties (eg `width`, `twist`) that we don't currently use. Cheap to add later; not a real cost.

## Locks in

- `app/src/input/PointerInputState.ts` — interface and `fromPointerEvent`
- `app/src/tools/Tool.ts` — `Tool` interface methods take `PointerInputState`
- All `Tool` implementations (PenTool, EraserTool) consume `PointerInputState`
- `e2e/pressure.spec.ts` — verifies mouse default-0.5 and pen actual-pressure flow through the pipeline correctly
