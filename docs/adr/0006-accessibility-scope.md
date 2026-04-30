# ADR-0006: Accessibility scope — state changes, not stroke navigation

**Status:** Accepted

## Context

`<canvas>` is semantically opaque to assistive technologies. A screen reader sees a rectangle of pixels regardless of what's drawn. Sighted users see strokes; everyone else sees nothing.

The original design proposed a "parallel accessible DOM" where every stroke is also rendered as an `<a11yStrokeNode>` in DOM order, allowing screen reader users to navigate strokes individually. The goal was admirable; the implementation has two fundamental problems.

**Problem 1: implementation churn.** A 1000-stroke canvas means a 1000-node a11y tree. Remote peers continuously add and remove strokes. The tree churns unbounded. Useful navigation (prev/next stroke) requires stable orderings that conflict with the CRDT's natural mutation patterns.

**Problem 2: semantic insufficiency.** Even if the DOM existed, a label like "Red pen stroke by Alice on layer 1" doesn't tell a screen reader user *what* Alice drew. The visual content of strokes is not communicable in text. The "navigable a11y DOM" delivers process accessibility (you can tab through nodes) without product accessibility (you cannot understand the content). It risks looking accessible without actually being so.

This is true of every drawing tool. No drawing canvas app on the web has solved it; no one currently believes there is a tractable solution at the per-stroke level.

## Decision

Scope a11y to what is both achievable in a reasonable timeframe and **honestly useful**:

- **Live region announcements** for state changes a sighted user perceives visually: tool change, brush color/width, connection state, undo/redo, user join/leave, export confirmations
- **Skip-to-canvas link** as the first focusable element
- **Canvas focus** with `tabindex=0` and an `aria-label` that **honestly describes** what is and isn't accessible: "Stroke contents are visible only to sighted users; tool changes, undo, and connection updates are announced."
- All UI controls keyboard-reachable via real `<button>` and `<input>` elements with proper roles
- WCAG 2.1 AA color contrast (verified by `@axe-core/playwright` in CI)
- `prefers-contrast: more` and `prefers-reduced-motion` respected

**Explicitly out of scope:** per-stroke a11y nodes, screen-reader stroke navigation, audio rendering of strokes, AI-generated alt-text.

## Consequences

**Positive**
- Every interactive control is keyboard- and screen-reader-friendly
- State changes are perceivable without sight
- An axe-core regression test runs in CI on every change
- The aria-label on the canvas is honest — no false promise of stroke-level accessibility
- Scope is achievable in a single development session

**Negative**
- Visual canvas content remains inaccessible to screen reader users. This is a real gap, not a fixable one within current technology, and we name it rather than gloss it.
- Users who relied on the design doc's promise of "screen-reader-navigable strokes" may be disappointed. We document this explicitly here and in the README.

## Locks in

- `app/src/components/Announcer.tsx` — live regions
- `app/src/components/SkipLink.tsx` — first focusable element
- `app/src/components/CanvasView.tsx` — canvas `tabindex=0` and `aria-label`
- `app/src/styles.css` — `.sr-only`, `.skip-link`, `:focus-visible`, `prefers-contrast`, `prefers-reduced-motion`
- `e2e/a11y.spec.ts` — six tests including an axe-core scan asserting zero WCAG 2.1 AA violations
