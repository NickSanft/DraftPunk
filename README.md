# Draft Punk

A real-time collaborative drawing canvas built on CRDTs. Static frontend, edge-deployed sync layer, no traditional backend.

```
                            ┌────────────────────┐
                            │  draft-punk        │
                            │  PartyKit /        │
                            │  Cloudflare        │
                            │  Durable Object    │  ← single source of truth, snapshot-persisted
                            └─────────┬──────────┘
                                      │ wss
                  ┌───────────────────┼───────────────────┐
                  │                   │                   │
              ┌───┴────┐         ┌────┴───┐         ┌─────┴───┐
              │ peer A │         │ peer B │         │  peer C │  ← static GitHub Pages bundle
              │  Yjs   │         │  Yjs   │         │   Yjs   │
              └────────┘         └────────┘         └─────────┘
```

- **Frontend** (`app/`) — Vite + React 19 + TypeScript, deployed to GitHub Pages
- **Sync** (`server/`) — `y-partykit` on Cloudflare Durable Objects (~15 LOC). Snapshot persistence means late joiners get the full canvas immediately, even if every other client has disconnected
- **CRDT** — Yjs. Each stroke is one atomic `Y.Map` insert at `pointerup`; the in-progress drag is buffered locally and never touches the CRDT until commit (see [ADR-0009](docs/adr/0009-active-stroke-buffering.md))

## Features

- Pen + eraser, pressure-sensitive variable-width strokes for stylus input, mouse falls back to constant-width
- Pen-flip eraser: the flipped end of a Wacom-style stylus auto-erases without changing your selected tool
- Real-time presence: cursors with name labels and per-user colors
- Collaborative undo/redo — Ctrl+Z reverses *your* last edit even when peers have edited too
- Export to PNG; save / load full project state as `.draftpunk` files
- Keyboard navigation, screen-reader announcements, WCAG 2.1 AA color contrast (zero `axe-core` violations in CI)
- Works offline-aware: reconnect → sync resumes seamlessly

## Run locally

Two terminals:

```bash
# Terminal 1 — sync server on http://localhost:1999
cd server && npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd app && npm run dev
```

Open `http://localhost:5173/?room=demo` in two browser windows. Append `&debug=1` to surface the perf overlay and seed buttons.

## Tests

End-to-end tests use Playwright + `@axe-core/playwright`. They auto-start both dev servers via `playwright.config.ts`.

```bash
npm install                  # one-time
npm run test:e2e:install     # one-time, downloads chromium
npm run test:e2e             # 24 tests, ~33s
npm run test:e2e:ui          # interactive
```

| Group | Tests | What's locked in |
|-------|-------|------------------|
| Sync | 2 | Round-trip + late-joiner state recovery from the Durable Object snapshot |
| Render perf | 2 | 1000-stroke main-canvas render under 50ms; active stroke under 16ms |
| Tools + undo | 4 | Pen, eraser, keyboard shortcuts, **collaborative** undo (your undo doesn't undo theirs) |
| Awareness | 3 | Presence, cursor publishing, tool propagation |
| Export | 4 | PNG + `Y.encodeStateAsUpdate` round-trip across rooms |
| Tablet | 3 | Pen pressure flows through input pipeline → CRDT; mouse stays constant; pen-flip eraser |
| A11y | 6 | Skip link, keyboard reachability, live-region announcements, **axe-core scan** |

## Architecture

The load-bearing decisions are documented as [Architecture Decision Records](docs/adr/). Skim the [index](docs/adr/README.md) first; each ADR is short.

The most distinctive ones are:

- **[ADR-0002: Sync via PartyKit + Durable Objects](docs/adr/0002-sync-architecture.md)** — the original plan was true peer-to-peer over WebRTC. [Spike S1](spikes/s1-webrtc-signaling/RESULT.md) showed all three default `y-webrtc` signaling servers are decommissioned Heroku apps. Pivoted to PartyKit before writing production code; [Spike S1b](spikes/s1b-partykit/RESULT.md) validated the new architecture in one afternoon.
- **[ADR-0009: In-progress strokes buffered locally](docs/adr/0009-active-stroke-buffering.md)** — naïvely writing each pointer-move point to the CRDT would saturate the network at 120Hz. The `StrokeBuilder` keeps the in-progress drag in plain JavaScript memory; one `Y.Map` insert at `pointerup`. This is the trickiest seam in the system and was missing from the original design.
- **[ADR-0006: A11y scope is honest, not performative](docs/adr/0006-accessibility-scope.md)** — the design doc proposed a "parallel a11y DOM" with screen-reader-navigable strokes. It would have delivered process accessibility (you can tab) without product accessibility (you can't understand the content). We instead announce state changes via live regions and document the canvas-content limitation explicitly.

## Deploy

Two artifacts:
- **Sync server** → Cloudflare via PartyKit (one-time + on server changes)
- **Frontend** → GitHub Pages via the included GitHub Actions workflow (auto on push to `main`)

### 1. Push the repo to GitHub

```bash
git remote add origin git@github.com:<your-username>/DraftPunk.git
git push -u origin main
```

### 2. Deploy the PartyKit server

From `server/`:

```bash
npx partykit login    # opens browser; sign in or create account (free)
npx partykit deploy   # pushes server.ts to Cloudflare
```

Note the URL it prints — looks like `https://draft-punk.<your-username>.partykit.dev`. The hostname (without scheme) is what the frontend needs.

### 3. Configure GitHub Pages + the PartyKit URL

In the GitHub repo settings:

- **Pages** → Source: **GitHub Actions**
- **Secrets and variables → Actions → Variables → New repository variable**:
  - Name: `VITE_PARTYKIT_HOST`
  - Value: `draft-punk.<your-username>.partykit.dev` (no `https://`, no trailing slash)

The build job in `.github/workflows/deploy.yml` fails fast with a clear error if this variable isn't set, so you can't accidentally ship a broken bundle.

### 4. Trigger the deploy

Push any commit to `main`. The workflow will install + typecheck + build + deploy to `https://<your-username>.github.io/DraftPunk/`.

### 5. (Optional) Custom domain

If you point a custom domain at the Pages site, add a `BASE_PATH=/` repo variable and the workflow will use it instead of the default `/<repo-name>/`.

## Layout

```
DraftPunk/
├── app/                          # frontend (deploys to GitHub Pages)
│   └── src/
│       ├── types/canvas.ts       # Stroke, Point, StrokeStyle
│       ├── crdt/                 # Y.Doc, provider, strokeBuilder, subscription, undoManager, awareness, seed
│       ├── input/                # unified PointerInputState
│       ├── canvas/               # CanvasEngine (3-layer + RAF), Renderer, PressureRenderer, CursorRenderer, HitTest
│       ├── tools/                # Tool, PenTool, EraserTool, createTool
│       ├── components/           # CanvasView, Toolbar, StylePicker, ExportMenu, UserList, ShareButton, Announcer, SkipLink, DebugOverlay
│       ├── utils/                # colors, export
│       └── App.tsx               # orchestration
├── server/                       # PartyKit server (deploys to Cloudflare)
│   └── src/server.ts             # ~15 lines: y-partykit onConnect with snapshot persistence
├── e2e/                          # Playwright integration tests (24)
├── spikes/                       # throwaway de-risking spikes preceding the production build
├── docs/
│   ├── adr/                      # 9 architecture decision records
│   └── DraftPunkImplementation.md   # original design spec (preserved for diff against ADRs)
└── .github/workflows/deploy.yml  # Pages deploy on push to main
```

## Known limitations

These are real and documented honestly rather than glossed.

- **Stroke contents are inaccessible to screen reader users.** The visual content of a drawing is not communicable in text. We announce state changes (tool, undo, connection, presence) but do not pretend strokes themselves are navigable. See [ADR-0006](docs/adr/0006-accessibility-scope.md).
- **No client-side offline editing.** Drawing requires an active WebSocket. We removed `y-indexeddb` after the PartyKit pivot since the Durable Object holds canonical state. Offline drawing with reconcile-on-reconnect is a future feature, not a current one. See [ADR-0003](docs/adr/0003-persistence.md).
- **No pan/zoom.** The canvas fills its container; everyone draws in the same coordinate space. Adding pan/zoom is its own coordinate-space rabbit hole — was deferred from MVP.
- **Vendor lock to PartyKit / Cloudflare.** A PartyKit outage means the app is down. Migrating off would require rewriting `server/src/server.ts` against another sync layer (eg `y-websocket`) and changing the client provider import. Not difficult, but it's a real coupling.
- **Snapshot debounce can lose seconds-old strokes on server crash.** Acceptable for a sketching app; would matter more elsewhere.

## Documentation

- [Architecture Decision Records](docs/adr/) — 9 short records covering the load-bearing design decisions
- [Original design spec](docs/DraftPunkImplementation.md) — the 9-phase implementation plan we built (and selectively diverged from)
- [Spike S1 — y-webrtc](spikes/s1-webrtc-signaling/RESULT.md) — RED: default signaling servers are decommissioned Heroku apps
- [Spike S1b — y-partykit](spikes/s1b-partykit/RESULT.md) — GREEN: current sync architecture validated
