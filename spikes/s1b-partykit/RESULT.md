# Spike S1b — Result

> Fill this in after running the spike. This becomes source material for the
> revised ADR-002 (sync architecture: PartyKit instead of WebRTC + signaling).

## Setup

- Date tested: _YYYY-MM-DD_
- Browsers tested: _e.g., Chrome 132 + Firefox 134_
- partykit version: _from `npm ls partykit`_
- y-partykit version: _from `npm ls y-partykit`_
- yjs version: 13.6.20

## Test 1 — Round-trip sync between two windows

- Time from Join → `provider status: connected`: _ms_
- Single-stroke round-trip latency: _ms_
- 100-stroke transaction convergence on receiver: _ms_
- Console errors: _none / list_
- Outcome: ☐ pass ☐ fail

## Test 2 — Late joiner receives full state

- Procedure: add 5 strokes in window A → close A → open new window C
- Did window C immediately show 5 strokes? ☐ yes ☐ no
- Did C log a `synced: true` event? ☐ yes ☐ no
- Outcome: ☐ pass ☐ fail

## Test 3 — Server-restart persistence

- Procedure: add strokes → Ctrl+C the server → `npm run dev` again → refresh both windows
- Did strokes survive the restart? ☐ yes ☐ no
- If no, what was lost? _e.g., the snapshot hadn't been written yet_
- Outcome: ☐ pass ☐ fail

## Test 4 — All-clients-gone persistence

- Procedure: close all windows → wait 60s → reopen
- Strokes still there? ☐ yes ☐ no
- Outcome: ☐ pass ☐ fail

## Verdict

☐ **GREEN** — proceed to Phase A scaffold using PartyKit + y-partykit + yjs.
☐ **YELLOW** — works for X, fails for Y. Need to address _____ before Phase A.
☐ **RED** — pivot again. Recommendation: _____.

## Notes / surprises
