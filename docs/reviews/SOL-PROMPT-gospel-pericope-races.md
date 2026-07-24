# SOL review request — race conditions in the Gospel pericope pipeline

**Role.** You are a senior software engineer and systems architect doing a
focused, adversarial review of one subsystem of R.I.S.E. (a Vite vanilla-JS
audiovisual reading environment). You are looking specifically for **race
conditions, ordering hazards, and lifecycle bugs** — the kind that make a
feature "work on my machine, fail in the demo." Assume the happy path is
already tested; your job is the timing edges. Be concrete: name the
interleaving, the two events that can reorder, and the observable failure.

## The feature under review

The **Gospel pericope imagery** system reads a Gospel chapter as a *schedule
of episodes*. As the reader moves verse by verse, the imagery behind/around
the text is meant to follow the narrative — Christ before Pilate, then the
flagellation, the crowning, the carrying of the cross, the crucifixion, the
deposition, the entombment. Each episode has its own curated collection of
museum works.

The architecture is three layers, by design (the law: *content domains
author schedules; the session runtime follows schedules; the cortex renders
cues*):

1. **Layer 1 — domain compiler.**
   `src/content/chapel/imagery/pericope-program.js`
   Compiles a chapter into a `visualProgram` = `{ coordinateSpace:
   'scripture', segments: [{ id, match:{chapter,verseStart,verseEnd}, cue },
   ...], fallback }`. Disjoint segments via a narrowest-wins verse sweep.
   The handoff (`src/content/chapel/handoff.js`) recompiles once with the
   resolved fallback and returns the program in its config.

2. **Layer 2 — generic scheduler.** `src/core/visual-scheduler.js`
   `VisualScheduleController.observe(atom)` reads `atom.chapter`/`atom.verse`,
   matches a segment, and calls `onCue(cue, { cueId, generation, prefetch })`
   **only when the cue changes**. Structural-silence atoms (no coordinate)
   HOLD the current cue. A monotone `generation` token guards staleness.

3. **Layer 3 — the cortex.** `src/visuals/visual-cortex.js`
   `applyCue(cue, meta)` → `updateConfig({ activeTypes: cue.collections })`,
   which calls `_rotateAssetGeneration` (aborts the old category's provider
   work, begins warming the new category's pool asynchronously), plus
   `_prewarmProviderPools(meta.prefetch)` for look-ahead. The behind-stream
   flash loop separately calls `flash()` → `_getNextDiagram`, which draws
   from the retained per-category `_assetPools` (`{ images, cursor }`).

Wiring: `src/components/Chamber.js` builds the `VisualScheduleController`
**synchronously** in its constructor from `session.visualProgram`, and its
`player.on('atom')` handler calls `this._visualSchedule?.observe(atom)`
before `displayAtom`. The program travels handoff → `ChamberOrbital.loadText`
→ beginSession payload → `session-compiler.js` → `models.js` Session →
Chamber.

## The reported symptom

**Intermittent.** Usually the imagery advances through the episodes as
intended. But on some runs — including, memorably, a live demo — it **sticks
on the first episode** (Christ before Pilate) for the whole chapter. This
has "regressed" more than once: a prior fix made the scheduler construction
synchronous (commit "The scheduler is built synchronously") after an async
`import()` was found racing auto-start and leaving `_visualSchedule` null
when atoms began flowing.

## What I have already verified (do not re-litigate these)

Working from a production `vite preview` build, driving the real Chapel UI
into Matthew 27, sampling the live objects:

- **The atoms are correctly coordinated.** 222 of 287 atoms carry integer
  `chapter`/`verse`; distinct verses span the whole chapter, 27:1 → 27:66.
- **The compiled program is correct.** 7 distinct episode segments in order
  (before-pilate → flagellation → crowning-ecce-homo → carrying-cross →
  crucifixion → descent-lamentation → entombment), each a `sourced` cue with
  a distinct collection.
- **The Chamber has a live `_visualSchedule`** (not null) in the reading view
  (`router.views.get('chamber-session').instance`).
- Yet across repeated runs in this environment, `_visualSchedule.activeCueId`
  stayed `before-pilate` at `generation: 1` for a 28-second sampled window,
  never advancing — even though every later verse's atoms exist in the
  session.

So: schedule *delivery* and atom *coordinates* are sound. The stick is in the
**runtime advance and/or pool-warm timing**, not the data.

## The questions I want you to answer

1. **Does `observe` actually run for every atom, in order, once playback
   starts — including after pause/resume, shuttle (reverse/fast-forward,
   `src/core/*` shuttle logic), and the concealed-atom path?** Trace the
   `player.on('atom')` emission against the scheduler. Is there any path
   where atoms are emitted (or replayed, or skipped) such that `observe`
   sees only the opening verses, or sees them out of order and latches?
   Note the sampled data showed the reading may simply **not have advanced
   past the opening verses within the window** — is the perceived "stuck on
   first" partly that the reading genuinely dwells in before-pilate's verse
   range far longer than the pool stays warm, so later episodes never get a
   chance to *show* before their cold pools are asked for? Distinguish
   "scheduler didn't advance" from "scheduler advanced but the cortex never
   presented the new pool."

2. **The cortex pool-warm race.** When cues fire in rapid succession (Matthew
   27's early episodes are short — a few verses each), each `applyCue` calls
   `_rotateAssetGeneration`, which **aborts** `_assetAbortController` and
   starts a new async warm. Walk the interleaving where episode N's warm is
   aborted by episode N+1 before it completes, repeatedly. Can the pool for a
   later episode end up **permanently empty** (its warm cancelled, never
   re-armed), so `_getNextDiagram` returns `source-unavailable` forever and
   the behind-stream surface keeps showing the last episode whose pool *did*
   warm? Is the look-ahead prefetch (`_prewarmProviderPools`) enough to hide
   this, or does it have the same abort exposure?

3. **The `_activePresentation` cancel-on-config-change.** `updateConfig`
   calls `cancelPresentation('aborted')` at its top when a presentation is
   live. In behind-stream with cues firing every few verses, is there a
   window where the cancel + rotate interacts badly with an in-flight
   `flash()` such that a frame is dropped or the epoch (`_presentationEpoch`)
   check strands a render?

4. **Generation-token completeness.** The scheduler advances a `generation`;
   the cortex has its own `_configVersion` / `_presentationEpoch` /
   `_assetAbortController`. Are these three staleness mechanisms *composed*
   correctly, or can a resolved-late pool from an old cue publish into a new
   cue's active category (or vice versa) because the token it checked is not
   the token that governs the pool it writes?

5. **Initial-pool seeding vs. first cue.** At session begin, app.js seeds the
   cortex `activeTypes` to the first segment's collections, and *then* the
   scheduler's first `observe` re-emits before-pilate (id != null-initial).
   Is there a benign double-apply here, or can the initial seed and the first
   cue race such that the wrong pool is warmed first?

## Deliverables

- A ranked list of the **specific interleavings** that can produce
  "stuck on first," most-likely first, each with: the two reorderable
  events, the precondition that makes it fire (fast atoms? short episodes?
  slow network? a particular pause/shuttle?), and the observable result.
- For the top one or two, a **minimal fix** that preserves the three-layer
  law (don't collapse the layers; don't make the cortex know about
  pericopes). Prefer making the async lifecycle *idempotent and
  re-armable* over adding sleeps.
- Any **missing test** that would have caught this — ideally a
  deterministic one over a fake clock/fake provider, since the bug is
  timing and a live e2e is flaky by nature.

## Ground rules / invariants you must not break

- The three-layer separation (compiler / scheduler / cortex) is load-bearing.
- `aic-*` category ids are Dr. Ackerman's vault dependency — never rename.
- Sacred imagery is pinned, never searched; procedural forms never depict the
  face of Christ; fixed liturgical forms have no probabilistic behavior. None
  of this should change, but flag if a fix would touch it.
- A works-less episode is *sanctioned stillness*, not a bug — do not "fix" it
  by substituting imagery.
