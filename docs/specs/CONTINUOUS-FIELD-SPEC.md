# Continuous Field Specification

**A persistent gallery behind the reading: imagery that never fades to
black, crossfading slowly among a pool, swapping smoothly at each
pericope boundary.**

Status: SPEC — no implementation yet. Rulings by the creator are
marked ✦; open questions are marked ⁇.

---

## 1. The problem this solves

Behind-stream interlocution today is the *flash economy shown beneath
text*: each visual is a full enter→hold→exit presentation that fades
the cortex container to **opacity 0 between flashes** (visual-cortex.js
`_presentAsset`). At the Chapel's long presence (~1.4s) with a shallow
pericope pool, this reads exactly as the creator observed — choppy,
fading to black, the same few works returning. The flash economy is
built to *interrupt*; behind glassmorphism the reader wants the
opposite: a *continuous presence*.

The precedent already exists in the codebase. **Genesis** is a
continuous field — a Klee composition that grows around the token
stream with no flashes, no fade-to-black, the text on a glass tile
(Chamber.js `initializeGenesis`). The Continuous Field is *Genesis's
structure applied to sourced imagery*: instead of a growing drawing,
a slowly crossfading wall of the reading's own works.

## 2. What it is

✦ **A new presentation mode, beside behind-stream — never replacing
it.** (Creator's ruling: additive, no regression to the flash economy
for those who want it.) Selected in the visual panel as a distinct
choice; behind-stream's frequency-gated flashes remain untouched.

The field:
- **Never fades to black.** At least one image is always present
  behind the text (once the pool has warmed). Transitions are
  crossfades between works, not fade-out/fade-in through nothing.
- **Holds the pool.** It draws from the same source pool the reading
  provides (a museum category, or a pericope cue's collection),
  crossfading among its works on a slow, gentle cadence.
- **Composes with the pericope schedule.** When the reading carries a
  visual program (a Gospel chapter), the field's pool IS the current
  episode's pool; at a pericope boundary it crossfades to the new
  episode's works — the same continuity, now the gallery wall
  changing scene.
- **Sits behind the text on glass**, exactly as Genesis and
  behind-stream do (the `presentation-behind-stream` surface,
  `glass-tile` on the atom display).

## 3. Architecture: a dual-layer crossfade, driven by a clock, not the flash economy

The flash economy (VisualFlashGate, hazard rolls, the presentation
clock) is fundamentally about **discrete interrupts at frequency**.
The Continuous Field is a **steady process**, so it must NOT route
through `flash()` / `_presentAsset` at all. It is its own presenter.

### 3.1 Two image layers

```
container.presentation-continuous
  ├─ layer A  (an <img>, opacity transitions)
  └─ layer B  (an <img>, opacity transitions)
```

A crossfade is: the incoming work is set on the *hidden* layer, that
layer fades to 1 while the other fades to 0 over `crossfadeMs`; the
now-hidden layer becomes the next incoming target. Two layers so a
transition never passes through black — the outgoing image is still at
full opacity as the incoming rises. (This is the standard
double-buffer crossfade; it structurally cannot fade to black between
works, which is the entire point.)

### 3.2 The advance clock

A single interval (`requestAnimationFrame`-paced, wall-time gated)
advances the field:

```
every dwellMs:  pick next work from the pool → crossfade to it over crossfadeMs
```

- **dwellMs** — how long a work holds before the next crossfade
  begins (default long: this is contemplative, ~8–12s).
- **crossfadeMs** — the transition length (default ~2s, gentle).
- The clock is **independent of the reading clock** — the field
  breathes at its own contemplative pace, not the atom rate. (Like
  soundscapes, which are ambient and clock-independent — Shuttle spec
  §5.)

### 3.3 Pool consumption

The field draws works through the **same provider pools** the cortex
already resolves — it does not fetch differently. It holds a small
ShuffleBag over the active pool's works (the same no-repeat discipline
as the flash economy) and advances through it. When the pool grows
(streaming pin resolution) or changes (a pericope cue), the field
picks up the new works on its next advance — no reset, no black.

✦ **Selection within the pool: pure ShuffleBag order** (creator's
ruling), matching the flash economy's fairness — every work shown
before any repeats. Semantic-aware ordering is a possible future
refinement, explicitly deferred.

## 4. Interaction with the pericope schedule

The field is a **cue consumer**, exactly like the flash economy —
`applyCue` already sets `activeTypes` to the current episode's
collection (PERICOPE-IMAGERY-SPEC §6). So:

- ✦ **A pericope boundary is a pool change, and the field crossfades
  across it** — the last work of `before-pilate` gently dissolves into
  the first work of `flagellation`. No special case: the field reads
  the active pool each advance, and a cue swapped the pool.
- A cue to a **works-less episode (stillness)** fades the field to
  nothing gracefully (the one sanctioned fade-to-black — the episode
  genuinely has no imagery, and stillness outranks substitution). The
  field resumes at the next imaged episode.
- **The generation token** the cue system already advances protects
  the field's async work identically: a work resolving after a cue
  change verifies its generation before it may enter a layer.

## 5. Safety — the field has NO flash rate

This is the key safety distinction and it must be stated precisely.

✦ **The Continuous Field is not a flash source.** A flash is a rapid
appearance/disappearance; the VisualFlashGate exists to bound flash
*rate* (min interval, burst, duty ceiling — visual-safety.js). The
field has none of that: it holds each work for many seconds and
transitions over seconds. Its effective "flash rate" is a fraction of
a hertz — orders of magnitude below any photosensitivity concern, in
the same regime as a slow film dissolve.

Therefore:
- The field does **not** consult the VisualFlashGate (it is not
  gated because it cannot burst).
- **Photosensitivity mode** still suppresses it — not because it
  flashes, but because the mode's contract is "no non-essential
  moving imagery," and a crossfading field is moving imagery. Under
  photosensitivity mode the field is **still** (holds one work with
  no transitions, or suspends entirely — §6 ruling).
- **`prefers-reduced-motion`**: the field holds a single work with
  crossfades disabled (a still gallery — one image, no motion),
  matching how Rosa Mystica and the attractor honor reduced motion.

## 6. Reduced motion & photosensitivity rulings

✦ **Reduced motion** → the field shows ONE work, no crossfades, no
advance clock. A still image behind the text. (The imagery's value
survives; only the motion is removed.)

✦ **Photosensitivity mode** → the field suspends entirely (no imagery
behind the text — the mode is a hard safety override, and the reader
who set it wants stillness, not a held image competing with the
text). Consistent with how photosensitivity mode suppresses the flash
economy wholesale.

## 7. The Shuttle (LATERAL-TRAVERSAL-SPEC)

The field is ambient imagery, clock-independent — like soundscapes it
**persists at any shuttle velocity**, holding the current work. It
does not accelerate its crossfades at 4×; it simply keeps showing the
field. (Contrast the flash economy, which suspends off home velocity
because its flash *rate* would multiply — the field has no rate to
multiply.) At a shuttle boundary crossing that changes the pericope
pool, the field crossfades to the new episode on its own next
advance, whichever direction the head moved.

## 8. Degradation

- **Cold pool** (no works resolved yet): the field shows nothing
  (transparent, the text's own field behind it) until the first work
  resolves, then fades it in. Never a broken image, never a
  placeholder — the reverent-degradation contract (SacredImage's
  decode-before-reveal applies: a work is decoded before it enters a
  layer).
- **A work fails to load**: skipped silently, the field holds its
  current work and advances to the next. A single miss costs one
  crossfade, never the field.
- **An empty pool mid-session** (all works failed): the field fades
  to nothing and waits; the pin-recovery backoff may refill it.

## 9. Controls (the visual panel)

A new presentation option in the interlocution section, beside
"Behind stream":

- ✦ **Gallery** (creator's ruling). Selecting it sets
  `interlocution.presentation = 'continuous'`. The user-facing label
  is "Gallery"; the config value is `'continuous'`.
- **Cadence** (optional, deferred): dwell/crossfade timing could be
  exposed, but sensible contemplative defaults (dwell ~10s, crossfade
  ~2s) ship first. A single "slower / faster" control is the likely
  future surface, not raw milliseconds.
- The glass tile behind the text is **on by default** (the field
  needs the text legible over imagery), reusing the existing
  `streamGlass` control.

## 10. What this spec deliberately excludes

- **No effect on the flash economy.** Behind-stream and full-frame
  interlocution are untouched; this is a third presentation, selected
  explicitly.
- **No new provider or pool machinery.** The field consumes the pools
  the cortex already resolves; it is a new *presenter*, not a new
  *source*.
- **No Ken Burns / pan-zoom** (deferred). The first field is a pure
  crossfade — motion is the dissolve alone. Slow pan/zoom is a clean
  future layer if wanted, but it introduces its own motion-safety
  questions and is out of scope here.
- **No per-work timing authoring.** The field's cadence is uniform;
  it is a wall, not a slideshow with per-slide durations.

## 11. Build order

1. **The presenter** (`ContinuousField` in visual-cortex, or a small
   sibling module): the two-layer element pair, the advance clock, the
   crossfade, the ShuffleBag over the active pool. Pure of the flash
   economy. Unit-testable with a fake pool + fake clock.
2. **Cortex wiring**: a `presentation === 'continuous'` branch that
   starts/stops the field instead of the flash loop; the field reads
   `activeTypes`' resolved pool and re-reads it on `applyCue`.
3. **Chamber surface**: `initializeContinuousField` beside
   `initializeStreamPresentation` / `initializeGenesis` — the glass
   tile, the layer host.
4. **Panel control**: the "Field" presentation option; `presentation:
   'continuous'` flows through the same config path as behind-stream.
5. **Safety**: reduced-motion (one still work) and photosensitivity
   (suspend) paths, each tested.
6. **Compose with pericopes**: verify a Gospel chapter's field
   crossfades at each episode boundary and stills on a works-less
   episode.

---

*The frame is the creator's: behind glassmorphism, a continuous
presence rather than a flashing interrupt — a gallery wall the text
floats over, changing scene with the reading. Built as a distinct
presenter beside the flash economy, with no flash rate and therefore
no gate, honoring reduced motion and photosensitivity as stillness.*
