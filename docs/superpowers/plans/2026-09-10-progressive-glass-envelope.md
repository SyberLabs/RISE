# Progressive Glass Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make desktop Chamber glassmorphism reveal with Progressive Reveal while preserving stable text layout and the existing mobile glass band.

**Architecture:** Keep all words laid out in `#atom-display`, move progressive glass paint to one pseudo-element, and let Chamber expand its rectangle from the union of revealed word bounds. The existing reveal scheduler remains the sole timing authority and clears the envelope through `cancelReveal`.

**Tech Stack:** Vanilla JavaScript, CSS, Vitest/JSDOM, Vite.

**Spec:** `docs/superpowers/specs/2026-09-10-progressive-glass-envelope-design.md`

## Global Constraints

- Preserve the final phrase layout from the first frame.
- Use one glass surface per atom, never per-word glass tiles.
- Keep the current full-width phone band at `max-width: 640px`.
- Keep instant and reduced-motion reveals on the existing complete slab.
- Fall back to the complete slab when word geometry is unusable.
- Touch only Chamber reveal and glass presentation code plus focused tests and documentation.

---

### Task 1: Specify the reveal-envelope contract with failing tests

**Files:**
- Create: `src/components/Chamber.progressive-glass.test.js`

- [x] Build a real Chamber with a progressive session, add the existing `glass-tile` capability to its atom display, and paint a multi-word atom with pending spans.
- [x] Stub deterministic display and word rectangles, then call `revealAtomWords` with a two-step schedule.
- [x] Assert the first onset creates a partial envelope, the second onset expands it, and every span remains in the DOM throughout.
- [x] Assert `cancelReveal` clears classes, rectangle properties, and later timer effects.
- [x] Assert a viewport at or below 640px and reduced motion do not activate a progressive envelope.
- [x] Run `npx vitest run src/components/Chamber.progressive-glass.test.js --reporter=dot` and confirm the new behavior tests fail for the missing implementation.

### Task 2: Add the single progressive glass envelope

**Files:**
- Modify: `src/components/Chamber.js`
- Modify: `src/components/Chamber.css`
- Test: `src/components/Chamber.progressive-glass.test.js`

- [x] Add a Chamber predicate that permits the envelope only for Progressive Reveal, an existing `glass-tile`, a viewport wider than 640px, and no reduced-motion preference.
- [x] Add reset, initialization, and monotonic expansion helpers. Calculate bounds relative to `#atom-display`, include its padding, reject non-finite or empty geometry, and publish the rectangle through CSS custom properties.
- [x] Route immediate and delayed word onsets through one helper that removes `data-pending` and expands the envelope.
- [x] Make `cancelReveal` clear envelope state as well as timers so atom changes and teardown are atomic.
- [x] Add one `::before` glass surface for the progressive classes, preserve atom box geometry, and layer word spans above it.
- [x] Add a narrow-viewport CSS guard so the existing phone band remains authoritative.
- [x] Run `npx vitest run src/components/Chamber.progressive-glass.test.js --reporter=dot` and confirm the focused tests pass.

### Task 3: Verify integration and production output

**Files:**
- Modify only if a failure directly identifies a regression in the new behavior.

- [x] Run `npx vitest run src/components/Chamber.progressive-glass.test.js src/components/Chamber.safety.test.js src/components/Chamber.stream-face.test.js src/components/Chamber.settings-door.test.js --reporter=dot`.
- [x] Run `npm run test:run`.
- [x] Run `npm run build`.
- [x] Inspect `git diff --check`, the final diff, and the design requirements for accidental scope or missing cleanup.
- [x] Request an independent code review and resolve all critical or important findings.
- [x] Re-run the focused tests and build after review changes.
