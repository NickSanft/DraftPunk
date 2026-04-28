# Draft Punk

Real-time collaborative drawing canvas. Static frontend, edge-deployed sync layer, no traditional backend.

- **Frontend** (`app/`) — Vite + React + TypeScript, deploys to GitHub Pages.
- **Sync** (`server/`) — PartyKit (Cloudflare Durable Objects) + `y-partykit`. ~10 lines of server code; persists state in a Durable Object so late joiners get the full canvas for free.
- **CRDT** — Yjs. Strokes are atomic `Y.Map`s in a `Y.Array`.

## Status

Phase A scaffold — two browsers can draw freehand pen strokes that sync via PartyKit. No tools panel, no undo, no presence — those are subsequent phases.

## Run locally

Two terminals (or use `npm run dev:both` if you've added `concurrently`):

```bash
# Terminal 1 — sync server on http://localhost:1999
npm run dev --prefix server

# Terminal 2 — frontend on http://localhost:5173
npm run dev --prefix app
```

Open `http://localhost:5173/?room=demo` in two browser windows. Draw in either; the other receives the strokes.

## Layout

```
DraftPunk/
├── app/                          # frontend (deploys to GitHub Pages)
│   └── src/
│       ├── types/canvas.ts       # Stroke, Point, StrokeStyle (load-bearing types)
│       ├── crdt/
│       │   ├── document.ts       # Y.Doc shape, Y.Map↔Stroke conversion
│       │   ├── provider.ts       # YPartyKitProvider lifecycle
│       │   ├── strokeBuilder.ts  # active-stroke buffer (commit at pointerup)
│       │   └── subscription.ts   # CRDT→renderer bridge
│       ├── input/                # unified pointer event handling
│       ├── canvas/               # CanvasEngine + Renderer (multi-canvas)
│       └── components/CanvasView.tsx
├── server/                       # PartyKit server (deploys to Cloudflare)
│   └── src/server.ts
├── spikes/                       # throwaway de-risking spikes
└── docs/                         # design spec, ADRs (TODO)
```

## Documentation

- [Design spec](docs/DraftPunkImplementation.md) — the original 9-phase implementation plan
- [Spike S1 — y-webrtc](spikes/s1-webrtc-signaling/RESULT.md) — RED, default signaling servers are dead Heroku apps
- [Spike S1b — y-partykit](spikes/s1b-partykit/RESULT.md) — GREEN, current sync architecture
