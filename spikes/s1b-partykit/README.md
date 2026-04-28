# Spike S1b — y-partykit (Cloudflare Durable Objects)

**Question:** Does y-partykit reliably sync Y.Doc updates between browsers, and does its Durable Object persistence solve the late-joiner and server-restart problems that S1 couldn't?

**Why we're here:** S1 confirmed all 3 of y-webrtc's default signaling servers are decommissioned Heroku apps. We've pivoted to PartyKit (Cloudflare Workers + Durable Objects) as the sync layer. This spike validates that decision before we touch production code.

## Run it

From this directory:

```bash
npm install         # ~30s, installs partykit + y-partykit + yjs
npm run dev         # starts PartyKit dev server on http://localhost:1999
```

PartyKit's dev server serves `public/index.html` at the root AND hosts the WebSocket sync layer on the same port — single command, single port, no separate static server.

Open `http://localhost:1999/` in **two browser windows** (any combination — no incognito requirement; PartyKit doesn't use BroadcastChannel). Click **Join** in both.

## What success looks like

| Test | Pass criterion |
|------|----------------|
| Round-trip sync | Click "Add stroke" in window A; appears in window B within ~200ms. |
| Late joiner | Add 5 strokes in window A. Close window A. Open NEW window C. C immediately receives all 5 strokes via the synced event. |
| Server-restart persistence | Add strokes, stop server (Ctrl+C), restart, refresh both windows. Strokes still there. |
| All-clients-gone persistence | Close all windows. Wait 60s (lets the Durable Object snapshot). Reopen one window. Strokes still there. |
| Throughput | Add 100 strokes (transaction). Both windows converge in under 1s. |

## What this would invalidate

- If late-joiner doesn't work with `persist: { mode: "snapshot" }` → may need to switch to `mode: "history"` or a custom load/store callback. Cheap fix.
- If WebSocket connection is flaky on local dev → likely a partykit version issue. Try pinning versions.
- If two windows can't sync at all → fundamental misuse of the API; investigate before pivoting again.

## Record results in `RESULT.md`

After testing, fill in `RESULT.md` with which tests passed and any unexpected behavior.

## Production note (for later)

To deploy to actual Cloudflare edge: `npm run deploy`. Requires a Cloudflare account (free). The static `public/` directory and the server both deploy together. The deployed URL becomes something like `https://draft-punk-spike-s1b.<your-username>.partykit.dev/`.

We are NOT deploying in this spike. Local dev is sufficient to validate the architecture.
