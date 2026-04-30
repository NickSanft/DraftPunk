# Architecture Decision Records

Each ADR documents a load-bearing design decision: the context, the choice, the consequences, and what code or tests lock it in. They're worth reading when:

- You're confused why something is the way it is
- You're about to change something and want to know if there's a reason it works that way
- You want to understand the project's architectural shape without reading every file

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-crdt-over-ot.md) | CRDT over Operational Transform | Accepted |
| [0002](0002-sync-architecture.md) | Sync via PartyKit + Durable Objects | Accepted (supersedes the original P2P plan) |
| [0003](0003-persistence.md) | Persistence via Durable Object snapshot | Accepted |
| [0004](0004-stroke-as-atom.md) | Stroke as the atomic unit of collaboration | Accepted |
| [0005](0005-multi-canvas-rendering.md) | Three stacked canvases for rendering | Accepted |
| [0006](0006-accessibility-scope.md) | Accessibility scope: state-changes, not stroke navigation | Accepted |
| [0007](0007-pointer-input-abstraction.md) | Unified `PointerInputState` for all input devices | Accepted |
| [0008](0008-hard-delete-strokes.md) | Hard delete for the eraser, not soft-delete flag | Accepted |
| [0009](0009-active-stroke-buffering.md) | In-progress strokes buffered locally; one CRDT op at pointerup | Accepted |

## Format

Each record uses the lightweight Michael Nygard format:

- **Context** — the problem and the constraints
- **Decision** — what we did
- **Consequences** — what follows from it (positive AND negative)
- **Locks in** — the code paths and tests that depend on the decision standing

ADRs are append-only. If we change our minds, we add a new ADR that supersedes the old one and update the old one's status. The original [docs/DraftPunkImplementation.md](../DraftPunkImplementation.md) is the original 9-phase design spec; ADRs cover where we agreed with it, where we diverged, and why.
