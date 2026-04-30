# ADR-0001: CRDT over Operational Transform

**Status:** Accepted

## Context

Multiple users need to edit a shared canvas concurrently. Conflicts must resolve correctly without coordination, even when users go offline and reconnect. Two well-known approaches:

- **Operational Transform (OT)** — operations are transformed against each other before being applied. Battle-tested in Google Docs. Requires a central authority to order operations and rebroadcast transformed versions.
- **CRDTs** — data structures designed to merge identical regardless of operation order. No central authority needed.

The design originally aimed for a no-server architecture (see [ADR-0002](0002-sync-architecture.md)), which OT cannot satisfy. Even after pivoting to PartyKit, the CRDT properties remain valuable — peers can edit offline and converge later, and the server is a state holder rather than an arbiter.

## Decision

Use [Yjs](https://github.com/yjs/yjs) as the CRDT layer. Strokes live in a `Y.Array<Y.Map>` (see [ADR-0004](0004-stroke-as-atom.md)). All state mutations go through Yjs primitives.

## Consequences

**Positive**
- Eventual consistency by construction — no coordination logic to write
- Yjs is mature (1M+ weekly npm downloads) and well-documented
- Offline edits merge cleanly when reconnecting
- A peer with no network connectivity can still draw locally; the CRDT will reconcile when sync resumes

**Negative**
- CRDTs grow monotonically (tombstones for deleted items). Mitigated by [ADR-0008](0008-hard-delete-strokes.md).
- Yjs's binary update format is opaque without a Yjs runtime — no `grep`-able operation logs
- Library lock-in is real; switching CRDT engines later would require rewriting the data layer

## Locks in

- All state mutations in `app/src/crdt/` use Yjs primitives
- All e2e tests rely on Yjs's eventual consistency (eg `e2e/sync.spec.ts`, `e2e/tools.spec.ts`)
