# External Current v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile a safe, provider-neutral, sealed answer document through RISE's existing score, Session Compiler, and Player boundary.

**Architecture:** A strict input validator in `src/core/rise-current.js` accepts declarative segments. A lowering function builds the existing Experience Program and calls `compileSession`; no new playback loop or provider client is added.

**Tech Stack:** Vanilla JavaScript ESM, Vitest, existing Experience Program and Session Compiler.

**Spec:** `docs/specs/RISE-CURRENT-V1-SLICE.md`

## Global Constraints

- Schema is exactly `rise.current.v1`; 1–16 segments, at most 4,000 characters per segment and 20,000 total.
- Visual choices are `still`, `attractor`, `genesis`; unknown fields and prototype keys fail closed.
- Dive quotes must verify against exact half-open UTF-16 spans; no unsourced factual citation is implied.
- The sole Session constructor remains `compileSession`; the sole Player constructor remains `src/app/chamber-session-factory.js`.
- This slice is sealed, offline, and does not claim realtime speech or host interception.

## Review Focus

- Duplicate segment ids must fail before source ownership is lowered.
- A mismatched quote span must fail with a useful field path.
- Prototype keys in parsed JSON must fail before data is copied into provenance.
- Empty or oversized text must fail before the Session Compiler's looser normalizations.
- A model origin without an identifiable provider must fail; its provider is attribution, never evidence.

---

### Task 1: Validate external Current documents

**Files:** Create `src/core/rise-current.js`; test `src/core/rise-current.test.js`.

**Interfaces:** `validateRiseCurrent(input): frozen Current`; `RiseCurrentError { code, path }`.

- [x] Write failing tests for a detached immutable valid document and each Review Focus input, unknown visual, extra executable field, and total size cap.
- [x] Run `npx vitest run src/core/rise-current.test.js`; confirm failures name missing validator behavior.
- [x] Implement strict field/type/size/id/quote checks and detached immutable output.
- [x] Run targeted test; confirm all cases pass.

### Task 2: Lower to the canonical runtime

**Files:** Modify `src/core/rise-current.js`; test `src/core/rise-current.test.js`.

**Interfaces:** `compileRiseCurrent(input, { projection = 'stream' } = {}): Session`.

- [x] Add failing integration tests for two segments, source identity, score authority, closed visual lane, anchored Dive, Page selection, and input immutability.
- [x] Run targeted test and observe missing compiler behavior.
- [x] Build canonical Experience Program tracks, then call `compileSession` with source text and origin provenance.
- [x] Run targeted tests and the existing source-span, thread, Session Compiler, and Current tests after `npm run content:build`.

### Task 3: Document the usable seam and verify

**Files:** Modify `README.md`; create `docs/examples/current-v1.json`.

**Interfaces:** A static sample consumable by `compileRiseCurrent` with no provider credentials.

- [x] Add a two-segment fixture and a short import/compile example, labeling live audio and ChatGPT integration as future work.
- [x] Run the fixture through the exported compiler; run full unit suite, build, hygiene and first-load checks, and report any environment-dependent gates accurately.
- [x] Commit only scoped files and open a reviewable PR.
