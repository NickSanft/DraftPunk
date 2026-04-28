# Draft Punk: Peer-to-Peer Collaborative Drawing

## Implementation Plan — TypeScript + React + Yjs

---

## Project Overview

**Draft Punk** is a real-time collaborative drawing canvas where multiple users can sketch, draw, and annotate together — with no central server required. It runs entirely in the browser, syncs via peer-to-peer WebRTC connections, and deploys as a static site on GitHub Pages.

Think of it as a simplified, open-source Magma or Drawpile that demonstrates mastery of CRDTs, distributed systems, and real-time UX — three of the hardest problems in frontend engineering.

**Why this impresses at the 10-year level:** Most engineers can build a drawing app. Very few can make it collaborative, conflict-free, and serverless. This project shows you understand distributed state, network topology, and the UX challenges of latency — all topics that come up in senior/staff system design interviews.

**Target timeline:** 8–10 weekends (part-time), or ~4–5 weeks full-time

---

## The GitHub Pages Constraint (and why it's a feature)

GitHub Pages serves static files only — no server-side code, no WebSockets, no databases. This sounds like a limitation, but it's actually the most interesting architectural decision in the entire project.

It forces a fully peer-to-peer architecture:

- **Yjs** handles the CRDT layer (conflict-free state synchronization)
- **y-webrtc** handles peer-to-peer data transfer between browsers
- A **public signaling server** (Yjs provides free ones) helps peers discover each other
- **IndexedDB** (via y-indexeddb) persists canvas state locally in the browser
- **BroadcastChannel** syncs across tabs on the same machine for free

The result is that two people can open the same URL, start drawing, and see each other's strokes in real time — with zero backend infrastructure. The entire application is a static bundle served from GitHub Pages.

This is a *better* portfolio story than "I spun up a WebSocket server," because it demonstrates that you understand the tradeoffs of decentralized systems: eventual consistency, partition tolerance, and the CAP theorem in practice.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Draft Punk UI                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Toolbar  │  │  Canvas  │  │  Layers   │  │   Users   │  │
│  │  Panel   │  │ (HTML5)  │  │  Panel    │  │  Cursors  │  │
│  └──────────┘  └────┬─────┘  └───────────┘  └───────────┘  │
│                     │                                       │
│         ┌───────────┴───────────┐                           │
│         │   Canvas Engine       │                           │
│         │  (stroke rendering,   │                           │
│         │   hit testing, tools) │                           │
│         └───────────┬───────────┘                           │
│                     │                                       │
│         ┌───────────┴───────────┐                           │
│         │   CRDT State Layer    │                           │
│         │  (Yjs Y.Doc)          │                           │
│         │                       │                           │
│         │  Y.Array<Stroke>      │ ← strokes (append-only)  │
│         │  Y.Map<LayerMeta>     │ ← layer visibility/order │
│         │  Y.Map<Settings>      │ ← canvas size, bg color  │
│         │  Awareness CRDT       │ ← cursors, user presence │
│         └───────────┬───────────┘                           │
│                     │                                       │
│    ┌────────────────┼────────────────┐                      │
│    │                │                │                      │
│    ▼                ▼                ▼                      │
│ ┌──────┐     ┌───────────┐    ┌───────────┐                │
│ │y-webrtc│   │y-indexeddb │    │Broadcast  │                │
│ │(peers) │   │(local save)│    │Channel    │                │
│ └───┬────┘   └───────────┘    │(same tab) │                │
│     │                          └───────────┘                │
└─────┼───────────────────────────────────────────────────────┘
      │
      │ WebRTC Data Channels (peer-to-peer, encrypted)
      │
      ▼
┌─────────────┐         ┌─────────────┐
│  Signaling  │◄───────►│   Other     │
│  Server     │         │   Peers     │
│ (discovery  │         │  (browsers) │
│  only)      │         │             │
└─────────────┘         └─────────────┘
```

### Key insight: the signaling server never sees your data

The signaling server only facilitates WebRTC connection negotiation (ICE candidates, SDP offers). Once peers connect, all drawing data flows directly between browsers over encrypted data channels. This is a strong privacy and security story.

---

## Phase 0: Project Scaffolding (Weekend 1)

### Goal
Standing React app with a blank canvas, deployed to GitHub Pages.

### Tasks

1. **Initialize the project**
   - Vite + React + TypeScript (fast builds, excellent DX)
   - ESLint flat config, Prettier
   - `tsconfig.json`: `strict: true`, `target: ES2022`

2. **Set up GitHub Pages deployment**
   - GitHub Actions workflow: build → deploy to `gh-pages` branch
   - Configure Vite `base` path for GitHub Pages subdirectory
   - Verify the blank app loads at `https://yourusername.github.io/draft-punk/`

3. **HTML5 Canvas scaffold**
   - Full-viewport `<canvas>` element with proper DPI scaling (`devicePixelRatio`)
   - Basic pointer event handling (pointerdown, pointermove, pointerup)
   - Draw a freehand line on mouse drag (local only, no sync yet)

4. **Testing infrastructure**
   - Vitest for unit tests
   - Testing strategy note: CRDT logic is unit-testable; canvas rendering is snapshot/visual-testable

### Key Dependencies (install now)

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `vite` | Build tool |
| `yjs` | CRDT engine |
| `y-webrtc` | Peer-to-peer sync provider |
| `y-indexeddb` | Local persistence |
| `vitest` | Testing |
| `nanoid` | Short unique IDs for strokes/users |
| `zustand` | Lightweight local UI state (tool selection, color, etc.) |

### Deliverable
A static site on GitHub Pages where you can draw freehand lines locally.

---

## Phase 1: CRDT Data Model (Weekend 2)

### Goal
Design the shared state that Yjs will synchronize across peers. This is the most important design decision in the project.

### The Stroke Model

A drawing canvas is fundamentally an append-only list of strokes. Each stroke is a complete drawing operation (one mousedown → drag → mouseup cycle). This maps perfectly to a `Y.Array`, which is Yjs's CRDT list type.

```typescript
// src/types/canvas.ts

interface Point {
  x: number;
  y: number;
  pressure: number;       // 0-1, from pointer events (pen tablet support)
  tiltX: number;          // -90 to 90 degrees, pen angle on X axis
  tiltY: number;          // -90 to 90 degrees, pen angle on Y axis
  timestamp: number;       // for potential replay/animation
}

interface Stroke {
  id: string;              // nanoid, globally unique
  userId: string;          // who drew this
  tool: ToolType;          // "pen" | "eraser" | "highlighter" | "shape"
  points: Point[];         // the path
  style: StrokeStyle;
  layerId: string;         // which layer this belongs to
  timestamp: number;       // when the stroke started
}

interface StrokeStyle {
  color: string;           // hex color
  width: number;           // brush size in pixels
  opacity: number;         // 0-1
  lineCap: "round" | "square" | "butt";
  compositeOp?: string;    // for eraser: "destination-out"
  pressureSensitivity: number;  // 0-1, how much pressure affects width
  tiltSensitivity: number;     // 0-1, how much tilt affects shape
}

type ToolType = "pen" | "eraser" | "highlighter" | "rectangle" | "ellipse" | "line" | "select";

interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;           // z-index
  ownerId?: string;        // optional: "claimed" by a user
}
```

### Yjs Document Structure

```typescript
// src/crdt/document.ts

import * as Y from "yjs";

function initializeDoc(ydoc: Y.Doc) {
  // Append-only list of all strokes on the canvas
  const yStrokes = ydoc.getArray<Y.Map<any>>("strokes");

  // Layer metadata (visibility, order, locking)
  const yLayers = ydoc.getMap<Y.Map<any>>("layers");

  // Canvas-level settings
  const ySettings = ydoc.getMap("settings");
  // settings: { width: 1920, height: 1080, backgroundColor: "#ffffff" }

  return { yStrokes, yLayers, ySettings };
}
```

### Why Y.Array<Y.Map> instead of Y.Array<JSON>

Each stroke is stored as a `Y.Map` (not a plain JSON object) so that individual stroke properties can be updated without replacing the entire stroke. This matters for:
- Moving strokes (select tool changes `points` offsets)
- Changing stroke color after the fact
- Soft-deleting strokes (adding a `deleted: true` flag instead of removing)

### The Awareness CRDT (Cursor Presence)

Yjs provides a separate `Awareness` protocol for ephemeral, per-user state that doesn't need to persist. This is perfect for:
- Live cursor positions (show where other users are drawing)
- User identity (name, color)
- Current tool selection (show what tool each user has active)

```typescript
// src/crdt/awareness.ts

interface UserAwareness {
  userId: string;
  name: string;
  color: string;            // assigned cursor/stroke color
  cursor: { x: number; y: number } | null;
  currentTool: ToolType;
  isDrawing: boolean;        // show "active stroke" indicator
  inputDevice: "mouse" | "pen" | "touch";  // show what device they're using
}
```

### ADR: Why CRDTs over Operational Transform

Write the first Architecture Decision Record here. Key points:
- OT requires a central server to order operations — incompatible with GitHub Pages
- CRDTs guarantee eventual consistency with no coordination
- Yjs specifically is battle-tested (900k+ weekly downloads, used by JupyterLab, Tiptap, etc.)
- The tradeoff is that CRDTs grow monotonically (tombstones for deleted items), but for a drawing canvas this is manageable — strokes are relatively small

### Testing
- Unit test the stroke model: create, serialize, validate
- Unit test Y.Array operations: append stroke, observe changes, merge two docs
- Test conflict resolution: two users add strokes simultaneously, verify both appear

### Deliverable
A well-typed CRDT document model with Yjs integration and a test suite proving conflict-free merges.

---

## Phase 2: Canvas Rendering Engine (Weekends 2–3)

### Goal
Build a performant rendering pipeline that draws strokes from the CRDT state to the HTML5 Canvas.

### Rendering Architecture

The canvas uses a **layered rendering** approach:

```
┌──────────────────────┐
│   Cursor Overlay      │  ← Top: other users' cursors (separate canvas)
├──────────────────────┤
│   Active Stroke       │  ← Current in-progress stroke (separate canvas)
├──────────────────────┤
│   Main Canvas         │  ← All committed strokes (composited layers)
└──────────────────────┘
```

Using multiple stacked `<canvas>` elements avoids redrawing all strokes on every frame. The active stroke canvas only redraws the stroke being drawn right now. The main canvas only redraws when a stroke is committed.

### Stroke Rendering

```typescript
// src/canvas/renderer.ts

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = stroke.style.color;
  ctx.lineWidth = stroke.style.width;
  ctx.lineCap = stroke.style.lineCap;
  ctx.globalAlpha = stroke.style.opacity;

  if (stroke.style.compositeOp) {
    ctx.globalCompositeOperation = stroke.style.compositeOp as GlobalCompositeOperation;
  }

  // Use quadratic curves for smooth interpolation between points
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
  }

  // Pressure-sensitive width (optional, for pen tablets)
  // This requires breaking the stroke into segments with varying lineWidth
  ctx.stroke();
  ctx.restore();
}
```

### Pan & Zoom (Infinite Canvas)

An infinite canvas uses a **camera transform** — all coordinates are transformed through a view matrix before rendering:

```typescript
// src/canvas/camera.ts

interface Camera {
  x: number;       // pan offset
  y: number;
  zoom: number;    // scale factor (1 = 100%)
}

function screenToCanvas(camera: Camera, screenX: number, screenY: number): Point {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  };
}

function applyCamera(ctx: CanvasRenderingContext2D, camera: Camera): void {
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
}
```

Zoom is controlled by scroll wheel, pan by middle-click drag or two-finger trackpad gesture. Store coordinates in **canvas space** (not screen space) so that strokes render correctly at any zoom level.

### Performance Optimization

- **Dirty rectangle tracking:** Only redraw the bounding box of changed strokes, not the entire canvas
- **Off-screen buffer:** Pre-render completed layers to an off-screen canvas; composite them in one `drawImage` call
- **RequestAnimationFrame batching:** Buffer pointer events and render at 60fps, not on every event
- **Spatial indexing (stretch):** Use a quadtree or R-tree for hit testing and partial redraws on large canvases

### Deliverable
Smooth local drawing with multiple brush sizes, colors, an eraser, and pan/zoom on an infinite canvas.

---

## Phase 3: Peer-to-Peer Sync (Weekends 3–4)

### Goal
Connect browsers together using Yjs + y-webrtc so that strokes appear in real time across peers.

### Room-Based Connection

Each canvas session is identified by a **room name** embedded in the URL hash:

```
https://yourusername.github.io/draft-punk/#room=friday-sketch-jam
```

When the app loads, it reads the room name from the hash (or generates one), creates a Yjs document, and connects the WebRTC provider:

```typescript
// src/crdt/provider.ts

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

function createSession(roomName: string) {
  const ydoc = new Y.Doc();

  // Peer-to-peer sync via WebRTC
  const webrtcProvider = new WebrtcProvider(roomName, ydoc, {
    signaling: [
      "wss://signaling.yjs.dev",
      "wss://y-webrtc-signaling-eu.herokuapp.com",
    ],
    // Optional: encrypt all data so signaling server can't read it
    password: null,  // or prompt user for a room password
  });

  // Local persistence — canvas survives page refresh
  const indexeddbProvider = new IndexeddbPersistence(roomName, ydoc);

  // Awareness for cursors and presence
  const awareness = webrtcProvider.awareness;

  return { ydoc, webrtcProvider, indexeddbProvider, awareness };
}
```

### Sync Flow

1. **User A** opens the app, creates room `friday-sketch-jam`
2. **User A** draws a stroke → stroke is added to `Y.Array<Stroke>` in the local Y.Doc
3. **Yjs** automatically propagates the Y.Doc update to all connected peers via WebRTC data channels
4. **User B** opens the same URL → y-webrtc connects to User A via the signaling server
5. **User B's** Y.Doc merges the incoming updates — the stroke appears on their canvas
6. **Both users** now have identical CRDT state; future operations merge automatically

### Handling the "Late Joiner" Problem

When User B joins an existing session, they need the full document state. Yjs handles this automatically — the WebRTC provider requests a full state sync from connected peers. But there's a subtlety: if *no one* is online, the canvas would be empty.

Solutions:
- **y-indexeddb** persists the document locally, so if User A refreshes, their own strokes survive
- For true persistence across all users, you'd need a server (out of scope for GitHub Pages, but document this as a known limitation and a future extension)
- Alternatively, add an **export/import** feature so users can save and share canvas state as a file

### Awareness Integration

Show other users' cursors in real time:

```typescript
// Update local awareness on every pointer move
awareness.setLocalStateField("cursor", { x: canvasX, y: canvasY });
awareness.setLocalStateField("isDrawing", true);

// Listen for remote awareness changes
awareness.on("change", () => {
  const states = awareness.getStates();
  // Render each remote user's cursor on the overlay canvas
  renderRemoteCursors(states);
});
```

### Room Management UI

- **Create room:** Generate a random room name (e.g., `sketch-abc123`), update URL hash
- **Join room:** Paste or click a shared URL
- **Share button:** Copy the room URL to clipboard
- **User list:** Show connected peers with their assigned colors
- **Connection status:** Indicator showing "Connected to N peers" or "Offline (changes will sync when reconnected)"

### Testing
- Two Y.Doc instances syncing via a test provider (no actual WebRTC needed in tests)
- Verify stroke ordering after concurrent inserts
- Verify awareness updates propagate
- Verify late-joiner gets full state

### Deliverable
Two browser windows drawing on the same canvas in real time. Sharing works by sending a URL.

---

## Phase 4: Drawing Tools & UX Polish (Weekends 4–5)

### Goal
Make the drawing experience feel good — this is where product sense shows.

### Tool System

```typescript
// src/tools/base.ts

interface Tool {
  name: ToolType;
  cursor: string;              // CSS cursor style
  onPointerDown(e: PointerState): void;
  onPointerMove(e: PointerState): void;
  onPointerUp(e: PointerState): void;
  onKeyDown?(e: KeyboardEvent): void;
  renderPreview?(ctx: CanvasRenderingContext2D): void;  // ghost shape while dragging
}
```

### Tools to Implement

| Tool | Behavior | CRDT Operation |
|------|----------|----------------|
| **Pen** | Freehand drawing with pressure sensitivity | Append stroke to Y.Array |
| **Highlighter** | Semi-transparent wide stroke | Append stroke with `opacity: 0.3` |
| **Eraser** | Removes strokes under cursor | Set `deleted: true` on hit strokes via Y.Map |
| **Line** | Click → drag → release for a straight line | Append 2-point stroke |
| **Rectangle** | Click → drag for rectangle | Append 4-point stroke (corners) |
| **Ellipse** | Click → drag for ellipse | Append approximated curve stroke |
| **Select** | Click/lasso to select, then move/delete | Modify stroke points via Y.Map |
| **Pan** | Middle-click or Space+drag to pan | Local camera state only (not synced) |

### Keyboard Shortcuts

- `B` — Pen (Brush)
- `E` — Eraser
- `H` — Highlighter
- `L` — Line
- `R` — Rectangle
- `V` — Select
- `Space` (hold) — Pan
- `Ctrl+Z` / `Cmd+Z` — Undo (using Yjs UndoManager)
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` — Redo
- `[` / `]` — Decrease/increase brush size
- `Ctrl+S` / `Cmd+S` — Export canvas

### Undo/Redo (the hard part)

In a collaborative system, undo is surprisingly complex. If User A draws a stroke and User B draws another, then User A hits undo — it should undo *User A's* stroke, not User B's.

Yjs provides `UndoManager` which handles exactly this:

```typescript
import { UndoManager } from "yjs";

const undoManager = new UndoManager(yStrokes, {
  // Only track operations from the local user
  trackedOrigins: new Set([ydoc.clientID]),
});

// Undo the last local operation (doesn't affect other users)
undoManager.undo();
undoManager.redo();
```

This is a *fantastic* talking point in interviews — most candidates don't know that collaborative undo is a distinct problem from single-user undo.

### Layer System

Layers let multiple users work without stepping on each other:
- Each layer is a filter on the stroke array (`stroke.layerId === layer.id`)
- Layer visibility, order, and opacity are stored in `Y.Map<LayerMeta>` (synced)
- A user can "claim" a layer, signaling to others not to draw on it (social convention, not enforced)
- Toggling visibility re-renders only affected layers

### Color Picker & Brush Settings

- Preset color palette (8–12 curated colors) + custom hex input
- Brush size slider (1–50px) with live preview circle on cursor
- Opacity slider for the highlighter tool

### Deliverable
A polished drawing experience with multiple tools, undo/redo, layers, and keyboard shortcuts.

---

## Phase 5: Presence & Social Features (Weekend 5–6)

### Goal
Make the multiplayer experience feel alive and social.

### Remote Cursors

Each connected user gets a colored cursor rendered on the overlay canvas:
- Cursor shows their name label and current tool icon
- Cursor position updates at ~30fps via the Awareness CRDT
- When a user is drawing, their cursor shows a "drawing" indicator (animated dot or trail)
- Cursors smoothly interpolate between position updates (lerp) to avoid jitter

### User Identity

On first visit, prompt for a display name (stored in localStorage). Assign a random color from a perceptually-distinct palette (8 colors that are easy to tell apart). Show this info in a "Users Online" panel.

### "Follow" Mode

Click on another user's avatar to "follow" their viewport — your camera smoothly tracks their pan/zoom position. This is useful for art jams where one person is presenting. Their camera state is shared via Awareness.

### Chat Sidebar (Optional Stretch)

A simple text chat using a `Y.Array<ChatMessage>`:

```typescript
interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}
```

Since it's CRDT-backed, chat history syncs and persists with the canvas.

### Deliverable
A social, multiplayer canvas with visible cursors, user names, and connection status.

---

## Phase 6: Export, Import, & Persistence (Weekend 6–7)

### Goal
Let users save and share their work, and address the ephemeral nature of P2P data.

### Export Options

- **PNG/JPEG:** Flatten all visible layers, render to an off-screen canvas, call `canvas.toBlob()`
- **SVG:** Convert strokes to SVG `<path>` elements (vector export, infinite resolution)
- **Project file (.draftpunk):** Export the full Yjs document state as a binary blob (`Y.encodeStateAsUpdate(ydoc)`). This captures the entire CRDT history and can be reimported

### Import

- **Project file:** Load a `.draftpunk` file and apply it to the current Y.Doc (`Y.applyUpdate(ydoc, data)`)
- **Image:** Import a raster image as a background layer (stored as a data URL in the CRDT — note size limits)

### Persistence Strategy

Since GitHub Pages can't run a database, persistence is handled client-side:

| Mechanism | Scope | Survives |
|-----------|-------|----------|
| **y-indexeddb** | Per-browser | Page refresh, browser restart |
| **Export file** | Manual save | Everything (user downloads a file) |
| **URL room name** | Session-based | As long as at least one peer is online |

Document this clearly as a tradeoff: "True server-side persistence would require a backend. This project deliberately avoids one to demonstrate pure P2P architecture. See ADR-003 for the reasoning."

### Optional: Cloudflare Worker Relay

For users who want persistence beyond browser storage, document (but don't necessarily implement) how a thin Cloudflare Worker + Durable Object could act as a always-online peer that persists the Y.Doc. This shows you know how to *evolve* the architecture without over-engineering the MVP.

### Deliverable
Export canvas to PNG/SVG, save/load project files, and local persistence across sessions.

---

## Phase 7: Performance & Edge Cases (Weekend 7–8)

### Goal
Handle the hard problems that separate toy demos from credible projects.

### Large Canvas Performance

- **Viewport culling:** Only render strokes whose bounding boxes intersect the visible viewport
- **Level-of-detail:** At low zoom levels, simplify strokes (reduce point count with Ramer-Douglas-Peucker algorithm)
- **Web Workers:** Move CRDT merge operations off the main thread to prevent frame drops during sync
- **Stroke batching:** When catching up with many remote strokes, batch renders into chunks across multiple frames

### Network Edge Cases

- **Offline mode:** User draws offline → strokes accumulate in local Y.Doc → when reconnected, CRDT automatically merges with peers. Show an "Offline" badge in the UI.
- **Peer disconnect:** Awareness CRDT automatically removes stale cursors after timeout
- **Signaling server down:** y-webrtc falls back to BroadcastChannel for same-origin tabs. Document this limitation.
- **Large documents:** Monitor CRDT size; add a "compact" feature that snapshots the current state and creates a fresh Y.Doc (lossy — loses undo history, but reduces memory)

### Deliverable
A production-hardened canvas that handles real-world conditions gracefully.

---

## Phase 8: Accessibility (Weekend 8–9)

### Goal
Make Draft Punk usable by everyone, including users who rely on assistive technologies. Accessibility in a canvas-based drawing app is genuinely hard — most apps skip it entirely. Doing it well is a powerful signal that you think about all users, not just the happy path.

### Why This Deserves Its Own Phase

Canvas elements are invisible to screen readers by default — they're just a rectangle of pixels. Making a collaborative drawing tool accessible requires thoughtful architecture, not just a few ARIA labels. This is a distinct engineering problem with its own tradeoffs and design decisions worth documenting.

### Screen Reader Support

The `<canvas>` element needs a **parallel accessible DOM** that describes what's happening on the canvas in structured, navigable text.

```typescript
// src/accessibility/a11y-tree.ts

interface A11yStrokeNode {
  id: string;
  role: "img";
  label: string;           // e.g., "Red pen stroke by Alice on Layer 1"
  boundingBox: DOMRect;    // for spatial navigation
  layerName: string;
  userName: string;
}

// Maintain a live-region container that announces canvas events
function announceCanvasEvent(message: string, priority: "polite" | "assertive" = "polite") {
  const region = document.getElementById("canvas-announcements");
  if (region) {
    region.setAttribute("aria-live", priority);
    region.textContent = message;
  }
}
```

Key announcements to make:
- "Alice joined the canvas" / "Bob left the canvas" (assertive)
- "New stroke added by Alice on Layer 1" (polite, debounced — don't announce every remote stroke individually during rapid drawing)
- "Connected to 3 peers" / "Offline — changes will sync when reconnected" (assertive)
- "Undo: removed your last stroke" / "Redo: restored your last stroke" (polite)
- "Tool changed to Eraser" / "Brush size set to 12px" (polite)
- "Canvas exported as PNG" (polite)

### Keyboard Navigation

Drawing apps are inherently pointer-driven, but all *non-drawing* interactions must be keyboard accessible:

| Action | Keys | Notes |
|--------|------|-------|
| Cycle through tools | `Tab` within toolbar | Focus ring visible on each tool button |
| Activate tool | `Enter` or `Space` | On focused toolbar button |
| Brush size | `[` / `]` | Works without focus on toolbar |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` | Global |
| Pan canvas | Arrow keys | When canvas is focused, move viewport in 50px increments |
| Zoom canvas | `+` / `-` | When canvas is focused |
| Open layer panel | `Ctrl+L` | Focus moves to panel |
| Toggle layer visibility | `Space` | On focused layer item |
| Open export dialog | `Ctrl+S` | Focus trap within dialog |
| Close dialog/panel | `Escape` | Return focus to canvas |
| Share room link | `Ctrl+Shift+S` | Announces "Room link copied" |
| Select stroke | `Tab` within canvas | Navigate strokes in DOM order (via a11y tree) |
| Delete selected stroke | `Delete` / `Backspace` | On selected stroke |

### Focus Management

- **Focus trap in dialogs:** Export, settings, and room-creation dialogs trap focus so Tab doesn't escape into the background
- **Focus restoration:** When a dialog closes, focus returns to the element that triggered it
- **Canvas focus indicator:** A visible border/outline on the canvas when it's the active element (styled to be clearly distinct from the browser default)
- **Skip link:** A "Skip to canvas" link as the first focusable element on the page for users navigating with Tab

### Color & Visual Accessibility

- **Minimum contrast ratios:** All toolbar text, labels, and icons meet WCAG 2.1 AA (4.5:1 for text, 3:1 for UI components)
- **Color-blind safe palette:** The default color palette avoids relying on red/green distinction alone. User colors assigned for remote cursors are chosen from a perceptually-distinct palette tested against protanopia, deuteranopia, and tritanopia
- **High-contrast mode:** A toggle (or automatic detection via `prefers-contrast: more`) that applies high-contrast styles to the toolbar, panels, and cursor labels
- **Cursor differentiation:** Remote cursors are distinguished by both color AND shape (circle, triangle, square, diamond) so they remain identifiable without color

### Motion & Animation

- **`prefers-reduced-motion`:** When enabled, disable cursor interpolation (snap instead of lerp), disable drawing indicator animations, and reduce or eliminate transition effects on panels and dialogs
- **No flashing content:** Ensure no UI element flashes more than 3 times per second (WCAG 2.3.1)

### ARIA Roles & Landmarks

```html
<main role="application" aria-label="Draft Punk collaborative canvas">
  <nav role="toolbar" aria-label="Drawing tools">
    <button role="radio" aria-checked="true" aria-label="Pen tool (B)">Pen</button>
    <button role="radio" aria-checked="false" aria-label="Eraser tool (E)">Eraser</button>
    <!-- ... -->
  </nav>

  <div role="region" aria-label="Canvas drawing area">
    <canvas aria-label="Collaborative drawing canvas" tabindex="0"></canvas>
  </div>

  <aside role="complementary" aria-label="Layers panel">
    <!-- layer list -->
  </aside>

  <div id="canvas-announcements" aria-live="polite" aria-atomic="true" class="sr-only"></div>
  <div id="connection-status" role="status" aria-live="assertive" class="sr-only"></div>
</main>
```

### Testing Accessibility

- **Automated:** axe-core or eslint-plugin-jsx-a11y in CI to catch ARIA violations, missing labels, contrast issues
- **Manual checklist:** Test with VoiceOver (macOS), NVDA (Windows), and keyboard-only navigation
- **Color contrast:** Verify all color combinations with a tool like Colour Contrast Analyser
- **Reduced motion:** Test with `prefers-reduced-motion: reduce` toggled on

### ADR: Accessibility in a Canvas Application

Document the fundamental tension: `<canvas>` is semantically opaque, but the app must still communicate state to assistive technologies. Explain the parallel accessible DOM approach, what it covers (stroke navigation, tool state, connection status) and what it can't cover (the visual content of the drawing itself). Note that this is an honest limitation — no drawing canvas app fully solves this — but Draft Punk goes further than most.

### Deliverable
A fully keyboard-navigable UI, screen reader announcements for all canvas events, WCAG 2.1 AA compliant color contrast, and an automated accessibility test suite in CI.

---

## Phase 9: Drawing Tablet Support (Weekend 9–10)

### Goal
Deliver a professional-grade input experience for users with drawing tablets (Wacom, Huion, XP-Pen, Apple Pencil). This is what separates a toy whiteboard from a tool artists would actually use — and it demonstrates deep understanding of input device APIs.

### Why This Matters for a Portfolio

Drawing tablet support involves working with the Pointer Events API at a level most web developers never touch. You'll handle pressure curves, tilt mapping, barrel button remapping, and palm rejection — all concepts that translate directly to any hardware-adjacent frontend role. It also shows you care about power users, not just the lowest-common-denominator mouse experience.

### Pointer Events API Deep Dive

The browser's Pointer Events API is the foundation. It provides `pressure`, `tiltX`, `tiltY`, `twist`, and `pointerType` — but the raw values need significant processing to feel natural.

```typescript
// src/input/pointer-input.ts

interface PointerInputState {
  pointerType: "mouse" | "pen" | "touch";
  x: number;
  y: number;
  pressure: number;         // 0-1, raw from hardware
  tiltX: number;            // -90 to 90
  tiltY: number;            // -90 to 90
  twist: number;            // 0 to 359 (barrel rotation)
  isPrimary: boolean;
  button: number;           // 0=tip, 2=eraser end, 5=barrel button
  buttons: number;          // bitmask of all pressed buttons
}

function handlePointerEvent(e: PointerEvent): PointerInputState {
  return {
    pointerType: e.pointerType as "mouse" | "pen" | "touch",
    x: e.clientX,
    y: e.clientY,
    pressure: e.pointerType === "mouse" ? 1.0 : e.pressure,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    twist: e.twist,
    isPrimary: e.isPrimary,
    button: e.button,
    buttons: e.buttons,
  };
}
```

### Pressure Sensitivity

Raw pressure from tablets is linear (0–1), but natural drawing feels logarithmic. A **pressure curve** maps the raw value to an effective value that controls brush width and/or opacity.

```typescript
// src/input/pressure-curve.ts

interface PressureCurveConfig {
  // Cubic bezier control points (like CSS easing)
  // Default: slightly concave — light touch is forgiving, firm press maxes out
  p1: { x: number; y: number };  // default: { x: 0.25, y: 0.1 }
  p2: { x: number; y: number };  // default: { x: 0.75, y: 0.9 }
  minPressure: number;            // below this, ignore (dead zone for palm rejection)
  maxPressure: number;            // above this, clamp to 1.0
}

function applyPressureCurve(raw: number, config: PressureCurveConfig): number {
  if (raw < config.minPressure) return 0;
  if (raw > config.maxPressure) return 1;

  // Normalize to 0-1 within the min/max range
  const normalized = (raw - config.minPressure) / (config.maxPressure - config.minPressure);

  // Apply cubic bezier curve
  return cubicBezier(normalized, config.p1, config.p2);
}
```

Expose a **pressure curve editor** in the settings panel — a small UI where users drag control points on a graph to customize their feel. This is a feature real drawing apps offer (Clip Studio Paint, Krita) and is visually impressive in a demo.

### Pressure-Sensitive Rendering

The standard Canvas API `lineWidth` is constant per stroke. For pressure-sensitive width, each stroke is rendered as a series of **variable-width segments**:

```typescript
// src/canvas/pressure-renderer.ts

function renderPressureStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, style } = stroke;
  if (points.length < 2) return;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Width varies with pressure
    const effectivePressure = applyPressureCurve(curr.pressure, userConfig.pressureCurve);
    const width = style.width * effectivePressure * style.pressureSensitivity
                + style.width * (1 - style.pressureSensitivity);  // blend with base width

    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = style.color;
    ctx.lineCap = "round";
    ctx.globalAlpha = style.opacity;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
}
```

For higher quality, use filled shapes (circles + connecting quads) instead of stroked lines — this avoids visible joints between segments. This is how professional drawing engines work.

### Tilt Support

Pen tilt affects brush shape — a tilted pen produces an elongated, calligraphic stroke. Map `tiltX`/`tiltY` to an elliptical brush tip:

```typescript
// src/input/tilt-mapping.ts

interface BrushTipShape {
  radiusX: number;      // horizontal radius of the elliptical tip
  radiusY: number;      // vertical radius
  rotation: number;     // angle in radians
}

function tiltToBrushShape(
  tiltX: number,
  tiltY: number,
  baseSize: number,
  tiltSensitivity: number
): BrushTipShape {
  // Convert tilt to radians
  const tiltXRad = (tiltX * Math.PI) / 180;
  const tiltYRad = (tiltY * Math.PI) / 180;

  // Tilt magnitude (0 = perpendicular to tablet, 1 = flat)
  const tiltMagnitude = Math.sqrt(tiltXRad ** 2 + tiltYRad ** 2) / (Math.PI / 2);

  // Tilt direction
  const tiltAngle = Math.atan2(tiltYRad, tiltXRad);

  // Elongate the brush tip based on tilt
  const elongation = 1 + tiltMagnitude * tiltSensitivity * 2;

  return {
    radiusX: baseSize / 2,
    radiusY: (baseSize / 2) * elongation,
    rotation: tiltAngle,
  };
}
```

### Barrel Button & Pen Eraser

Drawing tablets provide hardware buttons that the Pointer Events API exposes:

| Hardware | `e.button` | `e.buttons` | Suggested mapping |
|----------|------------|-------------|-------------------|
| Pen tip (press) | 0 | 1 | Draw with active tool |
| Barrel button | 5 | 32 | Quick color picker (eyedropper) |
| Pen eraser end | 2 | 4 (some) or 32 (some) | Switch to eraser, switch back on flip |

```typescript
// src/input/button-mapper.ts

interface ButtonMapping {
  tipAction: "draw";                              // always draw
  barrelAction: "eyedropper" | "pan" | "undo";    // configurable
  eraserAction: "eraser";                          // always eraser
}

function getEffectiveTool(
  input: PointerInputState,
  activeTool: ToolType,
  mapping: ButtonMapping
): ToolType {
  // Pen eraser end: always eraser, regardless of active tool
  if (input.button === 5 || (input.buttons & 32 && input.pointerType === "pen")) {
    return "eraser";
  }

  // Barrel button: contextual action
  if (input.button === 2 && input.pointerType === "pen") {
    return mapping.barrelAction === "eyedropper" ? "eyedropper" : activeTool;
  }

  return activeTool;
}
```

Let users customize barrel button behavior in settings. This is a small feature that real artists care about deeply.

### Palm Rejection

When using a stylus on a touchscreen (iPad, Surface), the user's palm rests on the screen and generates touch events. The browser *should* handle this via `touch-action: none` CSS, but not all devices are reliable.

```typescript
// src/input/palm-rejection.ts

interface PalmRejectionConfig {
  enabled: boolean;
  ignoreThreshold: number;     // ignore touches wider than this (palms are large)
  penPriority: boolean;        // while pen is active, ignore all touch inputs
}

function shouldRejectInput(
  e: PointerEvent,
  isPenActive: boolean,
  config: PalmRejectionConfig
): boolean {
  if (!config.enabled) return false;

  // While pen is active, reject all touch input
  if (config.penPriority && isPenActive && e.pointerType === "touch") {
    return true;
  }

  // Reject large contact areas (palms)
  if (e.pointerType === "touch" && e.width > config.ignoreThreshold) {
    return true;
  }

  return false;
}
```

Apply `touch-action: none` on the canvas element via CSS, and set `{ passive: false }` on pointer event listeners to prevent browser gesture interference.

### Multi-Touch Gestures (Tablet Screens)

On devices with a touchscreen stylus (iPad, Surface, Android tablets), support two-finger gestures *while drawing with the pen*:

| Gesture | Action |
|---------|--------|
| Two-finger pinch | Zoom canvas |
| Two-finger drag | Pan canvas |
| Two-finger rotate | Rotate canvas (optional — store rotation in Camera) |
| Three-finger tap | Undo (matches iOS convention) |

This requires tracking pen and touch events simultaneously, which is handled by `isPrimary` and `pointerId` in the Pointer Events API.

### Tablet Settings Panel

Add a dedicated "Tablet" section in settings:

- **Pressure curve editor:** Visual bezier curve graph with draggable control points
- **Pressure sensitivity slider:** Quick 0–100% adjustment (modifies curve steepness)
- **Tilt sensitivity slider:** 0–100%
- **Barrel button action:** Dropdown (Eyedropper / Pan / Undo / Custom shortcut)
- **Palm rejection:** On/Off toggle with sensitivity threshold
- **Test area:** A small scratch pad within the settings panel where users can test their pressure curve without affecting the main canvas

```typescript
// src/input/tablet-config.ts

interface TabletConfig {
  pressureCurve: PressureCurveConfig;
  tiltSensitivity: number;         // 0-1
  barrelAction: "eyedropper" | "pan" | "undo";
  palmRejection: PalmRejectionConfig;
  smoothing: {
    enabled: boolean;
    level: number;                  // 0-10, higher = more stabilization
  };
}

// Persist to localStorage so settings survive sessions
function saveTabletConfig(config: TabletConfig): void {
  localStorage.setItem("draft-punk-tablet-config", JSON.stringify(config));
}
```

### Stroke Smoothing / Stabilization

Fast pen movement produces noisy coordinates. A **stroke stabilizer** filters the input for smoother lines:

- **Moving average:** Average the last N points (simple, low latency)
- **Lazy Nezumi style:** The cursor "drags" a point on a string — the drawn point lags behind the cursor, producing naturally smooth curves. Higher stabilization = longer string = more lag but smoother output
- Expose as a slider: "Stabilization: 0 (raw) → 10 (maximum smoothing)"

```typescript
// src/input/stabilizer.ts

class StrokeStabilizer {
  private buffer: Point[] = [];
  private stringLength: number;

  constructor(level: number) {
    // String length in pixels — higher = smoother but more lag
    this.stringLength = level * 5;
  }

  addPoint(raw: Point): Point {
    if (this.buffer.length === 0) {
      this.buffer.push(raw);
      return raw;
    }

    const last = this.buffer[this.buffer.length - 1];
    const dx = raw.x - last.x;
    const dy = raw.y - last.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.stringLength) {
      // Move the stabilized point toward the raw cursor
      const ratio = 1 - this.stringLength / distance;
      const stabilized: Point = {
        x: last.x + dx * ratio,
        y: last.y + dy * ratio,
        pressure: raw.pressure,
        tiltX: raw.tiltX,
        tiltY: raw.tiltY,
        timestamp: raw.timestamp,
      };
      this.buffer.push(stabilized);
      return stabilized;
    }

    return last; // Don't emit a point yet — pen hasn't moved far enough
  }

  reset(): void {
    this.buffer = [];
  }
}
```

### Testing Tablet Input

Tablet input is hard to unit test because it depends on hardware. Use this testing strategy:

- **Mock PointerEvents:** Create synthetic events with controlled `pressure`, `tiltX`, `tiltY`, `pointerType: "pen"` to verify pressure curves and tilt mapping
- **Pressure curve math:** Pure unit tests for the bezier curve function
- **Palm rejection logic:** Unit test the rejection filter with simulated pen + touch sequences
- **Manual QA checklist:** Document a manual test script ("draw a line with light pressure, verify thin stroke; draw with heavy pressure, verify thick stroke; flip pen, verify eraser activates")

### ADR: Input Device Abstraction

Document why Draft Punk abstracts pointer input behind a `PointerInputState` interface rather than handling `MouseEvent` and `TouchEvent` separately. Key points: Pointer Events unify mouse, pen, and touch under a single API; storing `pointerType` with each stroke enables device-aware replay and per-device settings; the abstraction allows future support for non-standard inputs (gamepad dpad for accessibility pan, external Bluetooth styluses) without changing the tool system.

### Deliverable
Pressure-sensitive variable-width strokes, tilt-aware brush shapes, barrel button remapping, palm rejection, a configurable pressure curve editor, and stroke stabilization — all working across Wacom, Apple Pencil, and touchscreen devices.

---

## Directory Structure

```
draft-punk/
├── src/
│   ├── main.tsx                    # entry point
│   ├── App.tsx                     # root component, provider setup
│   ├── canvas/
│   │   ├── CanvasEngine.ts         # core rendering loop
│   │   ├── Camera.ts               # pan, zoom, screen↔canvas coords
│   │   ├── Renderer.ts             # standard stroke → canvas drawing
│   │   ├── PressureRenderer.ts     # variable-width pressure-sensitive rendering
│   │   ├── LayerCompositor.ts      # off-screen layer rendering
│   │   ├── HitTester.ts            # point-in-stroke detection
│   │   └── DirtyRect.ts            # partial redraw optimization
│   ├── crdt/
│   │   ├── document.ts             # Y.Doc initialization, shared types
│   │   ├── provider.ts             # y-webrtc + y-indexeddb setup
│   │   ├── awareness.ts            # cursor/presence state
│   │   ├── strokeOps.ts            # add, delete, move stroke operations
│   │   └── undoManager.ts          # collaborative undo/redo
│   ├── input/
│   │   ├── pointer-input.ts        # unified pointer event handling
│   │   ├── pressure-curve.ts       # pressure → effective value mapping
│   │   ├── tilt-mapping.ts         # tilt → brush shape mapping
│   │   ├── button-mapper.ts        # barrel button / eraser end mapping
│   │   ├── palm-rejection.ts       # palm rejection filter
│   │   ├── stabilizer.ts           # stroke smoothing / stabilization
│   │   └── tablet-config.ts        # tablet settings persistence
│   ├── tools/
│   │   ├── BaseTool.ts             # tool interface
│   │   ├── PenTool.ts
│   │   ├── EraserTool.ts
│   │   ├── HighlighterTool.ts
│   │   ├── ShapeTool.ts            # line, rect, ellipse
│   │   ├── SelectTool.ts
│   │   └── PanTool.ts
│   ├── accessibility/
│   │   ├── a11y-tree.ts            # parallel accessible DOM for canvas
│   │   ├── announcer.ts            # aria-live region manager
│   │   ├── focus-manager.ts        # focus trap, restoration, skip links
│   │   └── contrast.ts             # high-contrast mode utilities
│   ├── components/
│   │   ├── CanvasView.tsx           # canvas element + pointer events
│   │   ├── Toolbar.tsx              # tool selection, color, brush size
│   │   ├── LayerPanel.tsx           # layer list, visibility toggles
│   │   ├── UserList.tsx             # connected peers
│   │   ├── CursorOverlay.tsx        # remote cursor rendering
│   │   ├── RoomControls.tsx         # create/join/share room
│   │   ├── ExportDialog.tsx         # export options
│   │   ├── ConnectionStatus.tsx     # online/offline indicator
│   │   ├── TabletSettings.tsx       # pressure curve, tilt, buttons
│   │   └── PressureCurveEditor.tsx  # visual bezier curve editor
│   ├── store/
│   │   └── uiStore.ts              # zustand: local UI state
│   ├── types/
│   │   ├── canvas.ts               # Stroke, Point, StrokeStyle, etc.
│   │   ├── awareness.ts            # UserAwareness type
│   │   └── input.ts                # PointerInputState, TabletConfig, etc.
│   └── utils/
│       ├── colors.ts               # color palette, user color assignment
│       ├── geometry.ts             # bounding box, point distance, RDP simplify
│       ├── smoothing.ts            # stroke interpolation / curve fitting
│       └── export.ts               # PNG/SVG/project file export
├── tests/
│   ├── crdt/
│   │   ├── document.test.ts
│   │   ├── concurrency.test.ts      # simulate concurrent edits
│   │   └── undoManager.test.ts
│   ├── canvas/
│   │   ├── camera.test.ts
│   │   └── hitTester.test.ts
│   ├── input/
│   │   ├── pressure-curve.test.ts
│   │   ├── tilt-mapping.test.ts
│   │   ├── palm-rejection.test.ts
│   │   └── stabilizer.test.ts
│   ├── accessibility/
│   │   ├── a11y-tree.test.ts
│   │   ├── focus-manager.test.ts
│   │   └── announcer.test.ts
│   └── tools/
│       └── penTool.test.ts
├── docs/
│   ├── adr/
│   │   ├── 001-crdt-over-ot.md
│   │   ├── 002-p2p-over-client-server.md
│   │   ├── 003-persistence-strategy.md
│   │   ├── 004-stroke-data-model.md
│   │   ├── 005-canvas-rendering-layers.md
│   │   ├── 006-accessibility-in-canvas.md
│   │   └── 007-input-device-abstraction.md
│   └── DESIGN.md
├── public/
│   └── index.html
├── .github/
│   └── workflows/
│       └── deploy.yml               # build → GitHub Pages
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## ADRs to Write

These decision records are where reviewers will spend the most time. Each one should be 1–2 pages covering context, options considered, decision, and consequences.

1. **CRDT over Operational Transform** — OT needs a central server; CRDTs enable pure P2P. Yjs chosen over Automerge for performance and ecosystem. Tradeoff: tombstone growth.

2. **Peer-to-peer over client-server** — GitHub Pages constraint makes this both necessary and interesting. Discuss CAP theorem: we choose AP (availability + partition tolerance) over consistency — eventual consistency is fine for a drawing canvas.

3. **Persistence without a backend** — IndexedDB for local, export files for sharing, room-based ephemeral sync. Document the "last peer closes browser, data is lost" limitation honestly, and outline how a Cloudflare Durable Object would solve it.

4. **Stroke as the unit of collaboration** — Why model strokes as atomic units (not individual pixels or path segments). Discuss granularity tradeoffs: pixel-level CRDTs would be too chatty, layer-level too coarse.

5. **Multi-canvas rendering** — Why use stacked canvases (main, active stroke, cursor overlay) instead of a single canvas. Discuss performance, dirty rectangles, and separation of concerns.

6. **Accessibility in a canvas application** — The `<canvas>` element is semantically opaque. Document the parallel accessible DOM approach, the tradeoffs between full spatial accessibility and practical screen reader support, and what remains honestly unsolvable (visual content description).

7. **Input device abstraction** — Why all input flows through a unified `PointerInputState` interface. Why Pointer Events over separate Mouse/Touch handlers. How device-specific features (pressure, tilt, barrel buttons) are modeled as optional enrichment rather than separate code paths.

---

## README Outline

1. **Hero:** 3-second GIF of two cursors drawing simultaneously
2. **One-liner:** "Draw together, no server required. A peer-to-peer collaborative canvas powered by CRDTs."
3. **Try it now:** Link to the live GitHub Pages demo
4. **How it works (30 seconds):** Open → create room → share URL → draw together
5. **Tablet support:** "Bring your Wacom, Apple Pencil, or touchscreen tablet — Draft Punk supports pressure, tilt, barrel buttons, and palm rejection out of the box."
6. **Accessibility:** "Keyboard navigable, screen reader announced, WCAG 2.1 AA compliant. See ADR-006 for how we tackled accessibility in a canvas app."
7. **Architecture:** Diagram showing Yjs ↔ WebRTC ↔ peers, link to DESIGN.md
8. **Why CRDTs?** 3-paragraph explanation accessible to non-experts
9. **Tech stack:** Table of key dependencies and why each was chosen
10. **Local development:** `npm install && npm run dev`
11. **Known limitations:** No server persistence, signaling server dependency, max peers
12. **ADRs:** Links to all decision records
13. **What I'd do differently in v2:** Honest retrospective

---

## Stretch Goals (pick 1–2 to show range)

### Timelapse Replay
Since every stroke has a timestamp, you can "replay" the canvas creation as an animation. Add a playback slider that renders strokes chronologically. This is visually impressive and demonstrates understanding of event sourcing.

### WebAssembly Renderer
Port the stroke rendering to Rust/WASM for a performance comparison. Even if it's only 20% faster, it shows cross-language thinking and performance engineering.

### Sticky Notes / Text
Add `Y.Text` regions on the canvas for collaborative text editing. This introduces a second CRDT type and shows you understand that different data structures need different conflict resolution.

### Room Directory
A simple list of active public rooms (would require a small serverless function). Users can browse and join open art jams.

---

## What This Proves in an Interview

| Skill | Evidence |
|-------|----------|
| **Distributed systems** | CRDT selection, conflict resolution, eventual consistency |
| **Systems design** | Multi-layer architecture, data model tradeoffs, ADRs |
| **Performance engineering** | Dirty rectangles, viewport culling, off-screen buffers |
| **Network programming** | WebRTC, signaling, offline/reconnect handling |
| **Product thinking** | UX polish, social features, export/import |
| **Accessibility** | Parallel a11y DOM, WCAG 2.1 AA, screen reader support, keyboard nav |
| **Hardware integration** | Pointer Events API, pressure curves, tilt mapping, palm rejection |
| **Security awareness** | Encrypted P2P channels, no data on signaling server |
| **Technical writing** | ADRs, README, design doc |
| **Pragmatic tradeoffs** | GitHub Pages constraint, honest limitations, v2 roadmap |

When an interviewer asks "tell me about a technically challenging project," every layer of this system has a story worth telling.