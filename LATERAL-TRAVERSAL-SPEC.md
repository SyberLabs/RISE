# Lateral Traversal Specification

**The Shuttle: continuous motion through the reading, DVD-grade.**

Status: SPEC — no implementation yet. Rulings by the creator are
marked ✦; open questions for future rulings are marked ⁇.

---

## 1. The problem, and the move that dissolves it

The Chamber schedules everything against one reading clock: flashes,
soundscapes, entrainment, chant beds, liturgy steps, and the preload
pipeline all assume **monotonic sequential progression** through the
atom sequence. Discrete seeking ("jump to chapter 4") breaks that
assumption catastrophically: the preload pipeline never saw the
target text, the interlocution economy has no schedule there, and
every subsystem must answer "what is true at a position I teleported
to?"

✦ **The ruling: there is no seeking.** Traversal is CONTINUOUS —
fast-forward and rewind, never jump. The reading head passes over
every atom in sequence at all speeds, so the monotonic assumption is
preserved at any velocity. There is no "arrival at an unseen
position" because every position is seen on the way there. This is
not a compromise; it is the design. A reading is a path walked, in
either direction, at any pace — never a teleport.

## 2. The two axes

✦ Two orthogonal keyboard axes, never overloaded:

| Axis | Keys | Meaning | Exists today? |
|---|---|---|---|
| **Pace** | ↑ / ↓ | WPM ±10 — how fast you read | Yes (Chamber.js `updateWpm`) |
| **Shuttle** | ← / → | Traversal velocity — which way and how hard you are moving | New |

Pace is a reading property; shuttle is a transport property. Slowing
your reading (↓) is not rewinding; rewinding (←) is not reading
slowly. The axes compose: the effective atom rate is
`paceWPM × |shuttleVelocity|`.

## 3. The shuttle state machine

```
state = { velocity, position, highWaterMark }
```

- **velocity** ∈ the ladder: `… -8× -4× -2× | 1× | 2× 4× 8× …`
  (exact rungs an implementation choice; discrete rungs are REQUIRED —
  each rung has a knowable effective atom rate, which the safety
  threshold depends on)
- **1× is home.** The shuttle always returns there; normal reading is
  the only steady state.
- **→ from 1×** steps up the forward ladder (2×, 4×, 8×).
- **← from 1×** enters rewind at -2×, further ← steps deeper
  (-4×, -8×).
- **Stepping toward home** (← while forward, → while rewinding)
  descends the ladder; crossing 1× stops there — the shuttle never
  glides through home into the opposite direction on one keypress.
  Reaching 1× resumes normal reading immediately.
- **Pause** is orthogonal (the existing pause). Pausing while
  shuttling drops velocity to 1× (paused); resuming resumes reading.
- **position** is the atom index (the chunker's sequential
  `position` field — the currency already exists).
- **highWaterMark (HWM)** = max position ever reached this session.
  It NEVER decreases. Rewind moves position below the HWM; forward
  motion above the HWM is virgin reading.

Boundary conditions:
- Rewind at position 0 clamps to 0 and drops to 1× (paused at the
  start — the DVD hits the leader).
- Forward shuttle reaching the final atom completes the session
  (§7).

## 4. The safety threshold — reusing the flash-rate defense

Fast-forward multiplies the atom rate, and with it the would-be
flash rate. The Chamber already owns the machinery that defends
flash-rate ceilings: `VisualFlashGate` (min interval 180ms, burst
3/1200ms, presence duty ceiling) and the photosensitivity
suppression path.

✦ **At any velocity ≠ 1×, rhythmic interlocution suspends** through
the existing suppression mechanism — the same code path
photosensitivity mode uses, with a new suppression reason
(`'shuttle'`). This is principled, not just convenient: the safety
system exists to bound flash rates, and the shuttle approaches the
same ceiling from a different direction. No new safety machinery; a
new caller of the old.

**Focal presence persists.** A focal (chapel icon, Rosa Mystica, the
personal image) is steady-state — it has no flash rate to violate.
The visual distinction during shuttle is therefore: text streaming
fast, rhythmic layer dark, focal layer serene. The Chapel's stillness
discipline composes: speed looks like *speed over stillness*, never
like accelerated strobing.

## 5. Subsystem behavior table

The contract every component implements against. "1× only" means
active at home velocity, suspended otherwise, resuming without
ceremony when the shuttle comes home.

| Subsystem | At 1× | At velocity ≠ 1× | Rationale |
|---|---|---|---|
| Text stream | normal | renders at effective rate, chunks in traversal order | the DVD picture |
| Rhythmic interlocution | active | **suspended** (safety path, reason `'shuttle'`) | flash-rate ceiling (§4) |
| Focal (icon / rose / personal) | active | **persists** | steady-state; nothing flashes |
| Voice | active | **suspended** | speech cannot render at 4× |
| Soundscapes | active | **persist** (ambient, clock-independent) | they were never scheduled against atoms |
| Entrainment | active | **suspended** | frequency-locked to a therapeutic target; a scaled waveform is noise |
| Chant beds | active | persist (chapel-only; see liturgy exemption) | ambient contract, same as soundscapes |
| Preload pipeline | normal | unchanged — position remains monotonic in traversal order | §1: continuity preserves the assumption |
| Rolling refresh | active | active (it is clock-independent) | pool depth still matters on resume |

**Rewind rendering rule:** rewind replays chunks in reverse
SEQUENCE — the words within a chunk are never reversed or mirrored.
Frames backward, not backward frames.

## 6. The high-water-mark ledger

Everything behind the HWM has been **paid for**: text was read,
flashes were shown, provenance was honored. Consequences:

- **Rewind needs no preload.** Every asset it could want was decoded
  once; the retained window and SourceCache may still hold it, and a
  miss degrades exactly like any dry flash (stillness, never a
  substitute).
- **Re-reading** (forward at 1× from below the HWM) is reading known
  text. The preload pipeline was never invalidated — the HWM never
  moved backward, so its predictions still stand for the virgin
  territory beyond it.
- ⁇ **Replay vs redraw during re-reading:** when re-traversing paid
  territory at 1×, does the rhythmic layer show the *same* works it
  showed the first time (replay — the session as artifact, with a
  contemplative logic for scripture) or *fresh* draws (redraw — the
  session as living stream, the ShuffleBag philosophy, zero
  bookkeeping)? Deferred; the default on first implementation is
  **redraw** (costless), with replay noted as a possible future
  Chapel-mode refinement.

## 7. Completion

✦ **Completion is met regardless of velocity.** A session whose
head reaches the final atom is complete — whether it arrived at 1×
or 8×. The HWM is the honest and only progress metric; fast-forwarded
text still passed the eyes. No dwell-time accounting, no "real
reading" audit. (Progression systems — Atrium advancement, session
records — read the HWM and the completion event; they do not inspect
velocity history.)

## 8. The liturgy exemption

✦ **Liturgical sessions are traversal-exempt.** The Rosarium and the
Via run on the LiturgyRunner — fixed steps at fixed durations, by
covenant. One does not fast-forward a prayer. In liturgical rooms
the shuttle keys are inert; the existing escape ladder remains the
only exit. This is a reverence rule, stated once here and enforced
wherever the shuttle is wired: the shuttle attaches to the Chamber's
Player, and liturgical sessions do not run on the Player's shuttle
surface.

(Chapel *readings* — scripture in the Chamber via chapel handoff —
ARE shuttleable: they are readings, not liturgies. Their focal
persists and their chant beds ride through, per §5.)

## 9. What this spec deliberately does not include

- **No scrub bar, no minimap, no chapter menu.** Visual seeking UI
  reintroduces the teleport temptation. The shuttle is keys-first;
  any future surface must preserve continuity.
- **No touch/gesture bindings** (deferred until the keyboard shuttle
  proves the model).
- **No velocity persistence.** The shuttle state is session-ephemeral;
  every session begins at 1×. Nothing writes to prefs.

## 10. Implementation notes (for the future implementer)

- The Player's reading clock is already "one monotonic accumulator
  that advances only [while playing]" — velocity is a signed
  multiplier at the point where wall-time deltas become clock
  advancement. Rewind decrements the accumulator; the atom index
  derives from the clock as it does today.
- The suppression reason surfaces through the same result path as
  `'photosensitivity'` (visual-cortex `_presentationResult`), so
  telemetry distinguishes shuttle-dark from safety-dark.
- The HWM is one integer on the session state, updated in the same
  place the atom index advances, persisted with session records.
- Arrow-key wiring extends the existing `!isTyping` handler in
  Chamber.js beside ↑/↓.
- The velocity ladder and per-rung effective-WPM display belong in
  the same HUD element that shows WPM changes today (a transient
  `2×→` indicator; no persistent chrome).

---

*The frame of this spec is the creator's: traversal as an extension
of the pacing mechanism — no jumps, only motion — with rewind
grounded in sequence awareness against a high-water mark, and
fast-forward disarmed by the safety toggles the Chamber already
trusts.*
