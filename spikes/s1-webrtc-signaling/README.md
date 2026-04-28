# Spike S1 — y-webrtc + public signaling

**Question:** Does the public Yjs signaling server (`wss://signaling.yjs.dev`) reliably enable WebRTC peer connections between browsers on different networks, in 2026?

**Why it matters:** the entire "no server required, deploy to GitHub Pages" architecture rests on this. If WebRTC + public signaling doesn't work, we either self-host a TURN server (kills the GitHub Pages story), switch to `y-websocket` against a free relay, or accept "same network only" as a documented limitation.

## Run it

Zero install — just a static file using esm.sh imports. From the repo root:

```bash
npx http-server spikes/s1-webrtc-signaling -c-1 -p 8000
```

(or any other static server on port 8000)

Open `http://localhost:8000` in:

1. **One normal browser window**
2. **One incognito window** (or a different browser entirely)

> Two normal tabs in the same browser will sync via BroadcastChannel and won't actually test WebRTC — `BC peers` will be 1 and `WebRTC peers` will be 0. The success metric is `WebRTC peers ≥ 1`.

Click **Join** in both windows (the room name in the URL hash will be auto-shared once you paste the URL into the second window). Then click **Add 1 stroke** — it should appear in the other window in under a second.

## The hard test (the one that actually matters)

LAN is the easy case. The real test is across NATs:

1. Run on two physically separate machines, OR
2. Same machine but tether one window's browser to a phone hotspot

If `WebRTC peers ≥ 1` and strokes propagate across networks within ~1 second, the architecture is viable.

## Record results in `RESULT.md`

After testing, fill in `RESULT.md` with:

- LAN test outcome (peers, latency, stroke count converged?)
- Cross-network test outcome
- Any errors in the browser console
- Time-to-first-peer-connection
- Whether the spike is **GREEN** (proceed to Phase A) or **RED** (revise architecture)

## Kill criterion

If WebRTC fails to connect across networks (different NATs, no shared LAN), we stop and reconsider before writing production code.
