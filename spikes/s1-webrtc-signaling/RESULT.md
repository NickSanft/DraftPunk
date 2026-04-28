# Spike S1 — Result

## Setup

- Date tested: 2026-04-27
- Browser: Chrome (normal + incognito)
- y-webrtc version: 10.3.0
- yjs version: 13.6.20
- Signaling servers tested: all three y-webrtc defaults

## What we found

**All three default y-webrtc signaling servers are decommissioned Heroku apps.**

| URL | DNS resolves to | HTTPS | WebSocket |
|-----|-----------------|-------|-----------|
| `wss://signaling.yjs.dev` | CNAME → `perpendicular-constrictor-qg52f4r55o2ig7gewnfh7542.herokudns.com` | Heroku 404 | fails ~1.8s |
| `wss://y-webrtc-signaling-eu.herokuapp.com` | `va05.ingress.herokuapp.com` (Heroku ingress) | Heroku 404 (`Server: heroku-router`) | fails ~3s |
| `wss://y-webrtc-signaling-us.herokuapp.com` | `va01.ingress.herokuapp.com` (Heroku ingress) | Heroku 404 (`Server: heroku-router`) | fails ~4.4s |

Heroku discontinued the free tier in November 2022. The DNS records still exist (CNAMEs to Heroku endpoints), but the apps behind them no longer exist. Heroku's router responds with HTTP 404 to any request, which the browser surfaces as a generic "WebSocket connection failed."

In-app behavior:
- y-webrtc's `status` event still fires `connected: true` (it reflects provider initialization, not actual signaling reachability — misleading)
- Both windows show 0 WebRTC peers (signaling never delivered SDP exchange)
- Both windows show 0 BC peers (incognito + normal are isolated for BroadcastChannel)
- Browser console: `WebSocket connection to 'wss://signaling.yjs.dev/' failed`

## Verdict

**RED — architecture must change.**

The "deploy to GitHub Pages with no infrastructure required" headline cannot be honored using y-webrtc's bundled signaling defaults. The Yjs project hasn't migrated its public signaling to maintained infrastructure since Heroku's shutdown.

Even if one server comes back, building on community-run free signaling with no uptime guarantee is not viable for a portfolio project.

## Pivot options (decision pending)

1. **Self-hosted signaling on a free tier (Fly.io / Render).** Keeps WebRTC P2P for stroke data; signaling relay only handles peer discovery. README narrative stays mostly intact: "Strokes are P2P over WebRTC; a tiny self-hosted signaling relay helps peers discover each other but never sees your drawings."
2. **PartyKit (Cloudflare Durable Objects) with `y-partykit`.** Drops P2P framing — all data flows through Cloudflare. Gains: late-joiner state persistence for free, zero ops, reliable. Narrative shifts to "edge-deployed CRDT sync."
3. **`y-websocket` against a free relay.** Same trade as 2 but without PartyKit's polish. Not recommended over option 2.

## What we proved despite the failure

- y-webrtc + yjs work correctly in the browser (provider initializes, observers fire, `Y.Map` and `Y.Array` mutate as expected)
- The CRDT model from the design doc (`Y.Array<Y.Map>` with nested `Y.Array` of points) round-trips fine in a single peer
- BroadcastChannel sync would work for same-browser-profile tabs (verified by isolation behavior)
- The kill criterion mechanism works — we caught a foundational architecture issue in one session
