# Session consolidation — 2026-07-24

A record of what shipped today, what was diagnosed, and what threads are
still loose. Written so nothing is lost across the handoff (SOL is
implementing the Matthew 27 fix in parallel; see the last section for the
file-ownership boundary).

---

## Shipped and committed (all green: 902 unit + 11 e2e)

### The Gallery (Continuous Field) — complete, NOT yet deployed
A third interlocution presentation beside Full frame and Behind stream: a
persistent crossfading gallery behind the reading that never fades to black.
Built to `CONTINUOUS-FIELD-SPEC.md`, all six steps.

- `af3b915` spec
- `60ea1e6` step 1 — the presenter (`src/visuals/continuous-field.js`):
  dual-layer double-buffer crossfade, own advance clock, ShuffleBag over the
  active pool, generation-guarded decode-before-reveal, `poolChanged({stillness})`.
  Pure of the cortex; injectable now/raf/caf. 11 unit tests.
- `afac8e1` step 2 — cortex wiring: `setContinuousFieldHost`,
  `_syncContinuousField`, `_continuousPool`/`_continuousPoolKey`, `flash()`
  stands down in continuous mode, `syncSafety()` for live photosensitivity.
- `9c839b0` step 3 — the Chamber surface (`initializeContinuousField`), glass
  tile + radial scrim, host mounted behind the text.
- `1b221f1` steps 4–5 — the "Gallery" panel option + safety (consent gate,
  photosensitivity suspend, reduced-motion still). Shared `normalizePresentation`.
- `485c146` step 6 — live e2e verification. Fixed two defects the live run
  surfaced: the `'continuous'` value was normalized away in the session
  compiler; the field's decode was wired to a nonexistent cortex method.

**Design note for future work:** the presentation surfaces now go through one
`normalizePresentation` in `src/core/visual-presence.js` (used by the panel,
the session compiler, and app.js). Add future surfaces there, not ad-hoc.

### Bug 3 — Chapel-held focal leak — fixed
`d8129d2`. A Chapel Icon (`focals.type:'icon'`) or per-book Rosa Mystica
(`'rose'`) is launch-scoped like the pills; `_clearLaunchVisualIdentity` now
releases it to the standard glyph on clear/load, while user-chosen
standard/personal focals survive. Four regression tests.

### Review documents
`84af00a`. Two docs in `docs/reviews/`:
`SOL-PROMPT-gospel-pericope-races.md` and
`BUG-MEMO-visual-identity-leaks.md`.

---

## Diagnosed today (root cause found, fix owned by SOL)

### Bug 2 — Matthew 27 "stuck on first episode" — ROOT CAUSE FOUND
Not a race, not pool warming. **Program loss across a re-launch.**
`visualProgram` travels with `loadText` but is NOT persisted, so any path that
rebuilds the Orbital from saved state brings back the text and its first
collection (via saved prefs) but drops the program → the second session builds
no `_visualSchedule` → the cortex sits on the persisted `before-pilate` pool
through verse 66.

Three dropping seams, all verified in code:
- `_persistText()` — saves text/textSource/origin/sources/provenance, no program
- `_applySavedText()` — restores the same incomplete set
- `resetPrefs()` — preserves text/sources/origin/provenance, drops program

The intermittency was launch-history dependent:
- Chapel → Begin immediately → program present → works.
- Exit → return to restored Orbital → Begin → program absent → stuck.
- Reset settings with the text loaded → Begin → program absent → stuck.

**Fix (SOL implementing):** treat `visualProgram` as loaded-text identity, not
a preference — save in `_persistText`, restore in `_applySavedText`, preserve
through `resetPrefs`, keep clearing in `clearText`/`_clearLaunchVisualIdentity`.
Regression test: load program → begin → reconstruct Orbital → begin again
without another loadText → assert program survives and a segment-2 verse
reaches the cortex; plus resetPrefs retains / clearText removes.

**Why the earlier "synchronous scheduler" fix didn't fully solve it:**
synchronously constructing from a `null` program still yields no scheduler.

---

## Loose threads (open, not yet owned)

### Thread A — Full browser-reload recovery of a Gospel reading
SOL's caveat. Persisting `visualProgram` fixes the same-SPA exit→return case.
A true page reload ALSO loses the Chapel provider's in-memory dynamic
collection registration (`setDynamicChapelCollections`). Complete reload
recovery must additionally rehydrate the Chapel provider from the restored
reading's provenance — or re-run the Chapel domain handoff. **Constraint:** the
Orbital must NOT reconstruct pericopes itself (three-layer law); it re-runs the
domain handoff or rehydrates from provenance. Deferred until the same-SPA fix
lands and is confirmed.

### Thread B — Bug 1: Doré imagery persists into a new sequence
Reader: Numbers 2 (Doré) → remove → switch visual → Doré imagery still plays.
Distinct from the pill fix — it's the actual cortex pool, one layer deeper.
Confirmed cause candidate: `_clearLaunchVisualIdentity` resets
`atriumCollections` but NOT `interlocution.sourced`. If `sourced` still carries
the Doré category at the next begin, app.js re-warms its pool. Also check the
in-panel source-removal path (may not run the clear step at all). Full analysis
in `BUG-MEMO-visual-identity-leaks.md`.

### Thread C — Bug 4: Chapel icon → in-chamber switch to Rhythmic → "neither"
The in-panel mode-switch path never runs `_clearLaunchVisualIdentity`, so the
held icon isn't released and the mode change half-applies. Suggested: factor
"release a launch-held focal" into a helper, call it from the panel's
mode-switch away from `focals` too (user standard/personal focals still
survive). In `BUG-MEMO-visual-identity-leaks.md`.

### Thread D — Cortex pool re-arm hardening (the ONE true race)
SOL: "worth hardening, but not the cause of this run." When cues fire in rapid
succession, each `applyCue` → `_rotateAssetGeneration` aborts the prior warm.
Confirm a later episode's pool can't end up permanently empty (warm cancelled,
never re-armed). **This is the bug class that would justify the virtual-clock
simulation kernel** — deferred until we actually chase it.

### Thread E — The simulation harness (decision: DEFER)
Considered transforming the system into a headless simulation kernel (virtual
clock + fake provider + timeline recorder) with CLI/console/vitest faces.
Decision: **defer the kernel.** Today's bugs were lifecycle/persistence, which
plain "reconstruct across a boundary" tests catch deterministically — no clock
needed. Reserve the kernel for Thread D (a genuine race), when we tackle it.
A cheaper near-term win in the same spirit: a small **lifecycle round-trip test
suite** asserting every identity-carrying config field (visualProgram, sourced,
focal, atriumCollections) survives-or-dies correctly across
persist/restore/reset. This would have caught Bug 2, Bug 1, and Bug 3 as a
class.

---

## Deploy status
The Gallery and the Chapel-focal fix are committed and green but **NOT
deployed** — a deploy was interrupted to report the bugs. Recommend deploying
once SOL's Matthew 27 fix lands, so all three ship together.

## File-ownership boundary (avoid collision with SOL)
SOL is implementing the Matthew 27 fix and has created
`src/core/visual-program.js` (untracked). **Do not touch** that file or
`ChamberOrbital.js`'s persistence path (`_persistText`, `_applySavedText`,
`resetPrefs`, and the program-carrying parts of `loadText`) until SOL's change
lands. The focal-release logic in `_clearLaunchVisualIdentity` (Bug 3, already
committed) is settled and should be preserved through SOL's edit.
