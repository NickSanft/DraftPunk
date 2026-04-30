# ADR-0003: Persistence via Durable Object snapshot

**Status:** Accepted

## Context

The canvas state needs to survive: page refreshes, browser restarts, server restarts, and the all-clients-disconnected case where nobody is around to hold state.

The original design proposed three layers:
1. `y-indexeddb` for local browser persistence
2. Project file export (`.draftpunk` binary) for sharing
3. URL room name for ephemeral session continuity

The "no server" framing meant the all-clients-gone case had no good answer — if the last peer closed their tab, the canvas was gone. Documented as a limitation.

[ADR-0002](0002-sync-architecture.md) gave us a server-side state holder. The persistence story has to be revisited.

## Decision

- **Primary persistence: Durable Object snapshot mode.** `onConnect(conn, party, { persist: { mode: "snapshot" } })` in the PartyKit server. The DO writes a snapshot of the Y.Doc state on a debounce; on the next connection (from any client), the snapshot is loaded and the connecting client receives it as the initial sync.
- **Secondary: project file export/import.** For users who want a portable, offline copy or who want to seed a new room from an existing canvas. Implemented via `Y.encodeStateAsUpdate` / `Y.applyUpdate`.
- **Removed: `y-indexeddb`.** Made redundant by DO persistence and the early stages of the project never needed it (the DO has been the source of truth from spike S1b onward).

## Consequences

**Positive**
- State survives every failure mode the design originally listed as a limitation
- Late-joiners get the canvas instantly without an "import a backup" UX
- No client-side storage = nothing to manage on the user's machine
- Project files are still useful — they let you share state across rooms / users / accounts

**Negative**
- **Single-client offline editing isn't supported.** A user with no network connection cannot draw — the WebSocket can't establish, and changes aren't queued anywhere. Re-adding `y-indexeddb` plus a sync-on-reconnect step would solve it but isn't currently a goal.
- Persistence is implicit. There's no UI for "save as" — the DO just keeps state. A "fork this room" feature would need to be built explicitly.
- DO snapshot has a debounce (~seconds). A crash within that window can lose the most recent strokes. Acceptable for a sketching app; would matter more for, say, a financial editor.

## Locks in

- `server/src/server.ts` — `persist: { mode: "snapshot" }`
- `e2e/sync.spec.ts` — "a late joiner receives strokes from the durable object snapshot"
- `e2e/export.spec.ts` — "imported strokes persist via the durable object snapshot"
- `app/src/utils/export.ts` — project-file encoding/decoding
