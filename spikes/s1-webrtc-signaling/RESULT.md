# Spike S1 — Result

> Fill this in after running the spike. This becomes source material for ADR-002 (P2P over client-server).

## Setup

- Date tested: _YYYY-MM-DD_
- Browser A: _e.g., Chrome 132 (normal window)_
- Browser B: _e.g., Firefox 134 (private window) / Chrome incognito / Safari_
- y-webrtc version: 10.3.0
- yjs version: 13.6.20
- Signaling server(s) tested: `wss://signaling.yjs.dev`

## Test 1 — Same machine, different browser sessions (LAN baseline)

- Time from Join → `connected=true`: _ms_
- WebRTC peers after Join: _N_
- BC peers after Join: _N_ (should be 0 if browsers truly isolated)
- Single-stroke round-trip latency: _ms_
- 100-stroke transaction convergence: _ms on receiver_
- Console errors: _none / list_
- Outcome: ☐ pass ☐ fail

## Test 2 — Same machine, two networks (one tethered to phone hotspot)

- Network A: _e.g., home wifi 192.168.1.x_
- Network B: _e.g., phone hotspot 4G/5G_
- Time from Join → `connected=true`: _ms_
- WebRTC peers after Join: _N_ ← **critical: must be ≥ 1**
- Single-stroke round-trip latency: _ms_
- Console errors: _none / list_
- Outcome: ☐ pass ☐ fail

## Test 3 — Two physical machines, two networks (if available)

- Machine A: _e.g., laptop on home wifi_
- Machine B: _e.g., another laptop on phone hotspot or remote network_
- Time from Join → `connected=true`: _ms_
- WebRTC peers after Join: _N_
- Single-stroke round-trip latency: _ms_
- Outcome: ☐ pass ☐ fail

## Verdict

☐ **GREEN** — proceed to Phase A. Public signaling works across NATs.
☐ **YELLOW** — works on most networks but failed on _X_. Document limitation, proceed with caveat.
☐ **RED** — architecture must change. Recommendation: _y-websocket relay / self-host TURN / scope reduction_.

## Notes / surprises

_Anything unexpected — connection drops, weird peer counts, BC vs WebRTC mismatches, signaling fallback behavior._
