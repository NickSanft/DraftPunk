# Spike S1b — Result

## Setup

- Date tested: 2026-04-27
- Browsers: cross-window (no incognito requirement, unlike S1)
- partykit: 0.0.115
- y-partykit: 0.0.33
- yjs: 13.6.30

## Results

| Test | Outcome |
|------|---------|
| Round-trip sync between two windows | ✅ pass |
| Late joiner receives full state | ✅ pass |
| Server-restart persistence | ✅ pass |

The three tests that justified pivoting away from y-webrtc all pass. The
late-joiner case in particular — which y-webrtc fundamentally cannot solve
without an always-online peer — works on the first try with
`persist: { mode: "snapshot" }` because the Durable Object holds the Y.Doc
state independently of any connected client.

## Verdict

**GREEN — proceed to Phase A using PartyKit + y-partykit + yjs.**

## Architectural decisions confirmed by this spike

- **Sync layer:** PartyKit (Cloudflare Durable Objects) via `y-partykit`.
- **Persistence:** Durable Object snapshot mode. No separate database needed.
  Replaces both the "y-indexeddb for local survival" and "export file for
  sharing" mitigations from the original design — state just lives on the
  edge.
- **No more signaling/discovery problem:** clients connect directly to a
  named room on a known PartyKit URL. The "share a URL" UX still works
  (room name in the URL hash), but there's no peer-discovery dance.

## What's lost from the original design

- "Pure peer-to-peer, no server" framing. Stroke data flows through
  Cloudflare's edge, not directly between browsers. Privacy story shifts
  from "the server can't see your data" to "all data is encrypted in transit
  and stored only in a Durable Object you control."
- The original ADR-002 ("P2P over client-server") needs to be rewritten.
- The "no infrastructure" bullet on the README needs to be rewritten —
  there IS infrastructure now, just trivial and free.

## What's gained

- Late-joiner state recovery for free (eliminates a real product problem).
- Reliable connection — no flaky community signaling servers.
- Cross-network just works (no NAT traversal, no STUN/TURN).
- Single deployment surface for the sync layer.
- Simpler client code — no signaling URL list, no peer discovery, no
  awareness fallback to BroadcastChannel.
