# ADR-0002: Sync via PartyKit + Durable Objects

**Status:** Accepted (supersedes the original peer-to-peer plan)

## Context

The original design (see [docs/DraftPunkImplementation.md](../DraftPunkImplementation.md)) proposed a fully peer-to-peer architecture: WebRTC for data, the Yjs project's public signaling servers for peer discovery, no infrastructure to operate. The headline was "no server required."

Spike S1 (April 2026, see [spikes/s1-webrtc-signaling/RESULT.md](../../spikes/s1-webrtc-signaling/RESULT.md)) verified all three default `y-webrtc` signaling servers are decommissioned. They were all hosted on Heroku, which killed its free tier in November 2022. The Yjs project has not migrated to alternative infrastructure. There is no working public signaling option that ships with `y-webrtc`.

## Options considered

1. **Self-hosted signaling on Fly.io / Render** — preserves WebRTC P2P for the actual stroke data; only peer discovery flows through our server. Pros: keeps the strongest "your data is P2P" framing. Cons: small ops burden; the late-joiner-with-no-online-peers problem is unsolved.
2. **PartyKit + Durable Objects** with `y-partykit` — gives up P2P data; gains snapshot persistence and reliable connection. Free tier on Cloudflare with no card required.
3. **`y-websocket` against a relay** — same trade as #2 with less polish.

## Decision

Option 2. Validated by spike S1b ([RESULT.md](../../spikes/s1b-partykit/RESULT.md), GREEN) which proved round-trip sync, late-joiner state recovery, and server-restart persistence on a single Saturday afternoon's setup.

## Consequences

**Positive**
- Late-joiner state recovery comes for free (Durable Object holds the Y.Doc independent of any client)
- No NAT traversal, no STUN/TURN — Cloudflare endpoints are universally reachable
- Free tier is generously sized, requires no payment method, and doesn't sleep
- Sync server is ~15 lines of TypeScript

**Negative**
- "No server required" is no longer accurate; the README narrative is "static frontend on GitHub Pages, sync layer on Cloudflare's edge"
- Vendor lock to PartyKit / Cloudflare Workers / Durable Objects
- Stroke data passes through Cloudflare. Privacy story is now "transport-encrypted, single-tenant Durable Object" rather than "data never leaves your browser"

## Locks in

- `server/src/server.ts` — the entire sync layer
- `app/src/crdt/provider.ts` — connects to PartyKit, not WebRTC
- `e2e/sync.spec.ts` — late-joiner test passes only because of DO snapshot persistence
- `spikes/s1-webrtc-signaling/RESULT.md` and `spikes/s1b-partykit/RESULT.md` — the evidence trail
