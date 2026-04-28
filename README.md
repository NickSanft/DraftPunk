# Draft Punk

Real-time collaborative drawing canvas. Static frontend, edge-deployed sync layer, no traditional backend.

- **Frontend** (`app/`) — Vite + React + TypeScript, deploys to GitHub Pages
- **Sync** (`server/`) — PartyKit (Cloudflare Durable Objects) + `y-partykit`. ~15 lines of server code; persists state in a Durable Object so late joiners receive the full canvas for free
- **CRDT** — Yjs. Strokes are atomic `Y.Map`s in a `Y.Array`

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

End-to-end tests use Playwright. They auto-start both dev servers via `playwright.config.ts`.

```bash
npm install                  # one-time
npm run test:e2e:install     # one-time, downloads chromium
npm run test:e2e             # 15 tests, ~22s
npm run test:e2e:ui          # interactive
```

## Deploy

Two artifacts to deploy:
- **Sync server** → Cloudflare via PartyKit (one-time + on-server-changes)
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

### 4. Trigger the deploy

Push any commit to `main`. The workflow at `.github/workflows/deploy.yml` will:

- Install + typecheck + build the frontend with `VITE_PARTYKIT_HOST` and `BASE_PATH=/DraftPunk/` set
- Upload `dist/` as a Pages artifact
- Deploy to `https://<your-username>.github.io/DraftPunk/`

The Actions tab on GitHub shows progress and the deployed URL.

### 5. (Optional) Custom domain

If you point a custom domain at the Pages site, add a repo variable:

- Name: `BASE_PATH`
- Value: `/`

The workflow will use it instead of the default `/<repo-name>/`.

## Layout

```
DraftPunk/
├── app/                          # frontend (deploys to GitHub Pages)
│   └── src/
│       ├── types/canvas.ts       # Stroke, Point, StrokeStyle
│       ├── crdt/
│       │   ├── document.ts       # Y.Doc shape, Y.Map↔Stroke conversion
│       │   ├── provider.ts       # YPartyKitProvider lifecycle
│       │   ├── strokeBuilder.ts  # active-stroke buffer (commit at pointerup)
│       │   ├── subscription.ts   # CRDT→renderer bridge
│       │   ├── undoManager.ts    # Yjs UndoManager scoped via trackedOrigins
│       │   ├── awareness.ts      # presence types + helpers
│       │   └── seed.ts           # deterministic test fixture loader
│       ├── input/                # unified pointer event handling
│       ├── canvas/               # CanvasEngine (3-layer + RAF), Renderer, CursorRenderer, HitTest
│       ├── tools/                # Tool, PenTool, EraserTool, createTool
│       ├── components/           # CanvasView, Toolbar, StylePicker, ExportMenu, UserList, ShareButton, DebugOverlay
│       ├── utils/                # colors, export
│       └── App.tsx               # orchestration
├── server/                       # PartyKit server (deploys to Cloudflare)
│   └── src/server.ts             # ~15 lines: y-partykit onConnect with snapshot persistence
├── e2e/                          # Playwright integration tests (15 tests)
├── spikes/                       # throwaway de-risking spikes preceding the production build
├── docs/DraftPunkImplementation.md  # original 9-phase design spec
└── .github/workflows/deploy.yml  # Pages deploy on push to main
```

## Documentation

- [Design spec](docs/DraftPunkImplementation.md)
- [Spike S1 — y-webrtc](spikes/s1-webrtc-signaling/RESULT.md) — RED, default signaling servers are decommissioned Heroku apps
- [Spike S1b — y-partykit](spikes/s1b-partykit/RESULT.md) — GREEN, current sync architecture
