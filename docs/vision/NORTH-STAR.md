# R.I.S.E. — North Star

*A product-direction document. Written 2026-07-24, after the first outside
eyes saw the system. It states the philosophy the engine already embodies but
does not yet speak, and sequences the next era of work around one insight.*

---

## 0. The one insight

We have finished building the **engine**. The next era is building the
**doorway**.

Not more capability — more *orientation*. The system already knows it is a
humane, sacred, art-historical way of reading. The user only sees knobs. The
whole next arc is the layer that translates **intentions and ideas** ("I want
to sit with the Passion," "show me how the Renaissance saw the divine," "read
this plainly") into the forty parameters we already own — and, crucially,
already validate.

Everything below is a variation on that one move.

---

## 1. What R.I.S.E. actually is (the philosophy, made explicit)

R.I.S.E. is a **Renaissance philosophy of education rendered as software**: the
conviction that Christ, art, and history are one continuous way of forming a
person, and that reading — done with beauty, reverence, and attention — is how
that formation happens. The system's deepest opinions are already in the code:

- **Reverence over completeness.** Silence beats a broken image; stillness
  outranks substitution; sacred imagery is pinned, never searched; the face of
  Christ is never procedurally generated. The machine would rather show nothing
  than show something false.
- **The right image beside the right word.** The pericope engine places
  Christ-before-Pilate against the verse that names it. Meaning is *composed*,
  not decorated.
- **Content authors; the runtime follows; the cortex renders.** A three-layer
  law that keeps the domain's intentions sovereign over the mechanism.

This is a real and rare philosophy. **The problem is that a first-time visitor
has to infer it from behavior.** A friend felt it — "you're conveying a
Renaissance philosophy of education" — but had to *sense* it through a wall of
parameters. The philosophy is implicit in the content and invisible in the
interface. **Closing that gap is the north star.**

---

## 2. What the outside eyes told us (and what each really means)

Seven notes from the first demo. Six of them are the same insight in different
clothes: *the system needs a layer that speaks in ideas, above the layer that
speaks in parameters.*

| Note | What it really is |
|---|---|
| "The parameters are overwhelming" | The core tension. We built an organ; we hand it to people who don't yet know they want one. → **Stances / progressive disclosure.** |
| "I sensed a philosophy but had to infer it" | The philosophy is invisible in the UI. → **Editorial voice; named journeys.** |
| "Beyond speed-reading — dynamic text/image layout" | We are a *temporal* medium (RSVP). He wants a *spatial* one (the Page). Two projections of one session. → **Page mode.** |
| "Let users discover their taste (A/B styles)" | Onboarding as delight; produces the input the LLM doorway needs. → **Taste model.** |
| "LLM reads the system, user says what they want, it emits JSON" | The natural-language doorway. Composes with all the above. → **LLM → validated config.** |
| "Could it be JSON → MP4?" | Distribution, not experience. Different beast; later. → **Deferred.** |
| "The Chapel is too heavy — a more welcoming door" | Add a *threshold of ideas* before the sanctuary; don't dilute the reverence. → **Chapel threshold.** |

---

## 3. The organizing principle: two layers

```
        ┌───────────────────────────────────────────────┐
        │   THE DOORWAY  — speaks in intentions & ideas  │   ← the next era
        │   stances · journeys · taste · natural language │
        └───────────────────────────────────────────────┘
                              ↓ translates to
        ┌───────────────────────────────────────────────┐
        │   THE ENGINE  — speaks in parameters            │   ← already built
        │   4 orbits · normalizers · session compiler ·   │
        │   pericope law · cortex · reverent degradation  │
        └───────────────────────────────────────────────┘
```

The engine is not going away and is not being simplified. Every knob stays for
the people who want the organ. The doorway is a **translator** that sits above
it. We already own the hard half — the validators (`normalizePresentation`,
`normalizeVisualSelection`, the session compiler) that keep any input safe.
**The doorway proposes; the engine's validators dispose.** No doorway output —
LLM or otherwise — ever reaches the cortex unclamped.

---

## 4. FIRST STEP — Stances (progressive disclosure)

*Chosen as the first direction: cheapest, de-risks demos immediately, directly
answers "overwhelming," and lays the pattern every later doorway reuses.*

### The idea
Today, entering a reading means confronting four orbits at once — Visual
(mode, source family, presentation, focals, …), Audio (soundscape, preset,
entrainment, voice), Temporal (wpm, curve, chunk), plus content. A **stance** is
a single named choice that sets a *coherent slice across all of them* — a
curated intention. The full panel stays one click deeper.

### The stances (a first proposal — names and feel to be refined)

- **Read plainly.** The words, well-paced, nothing behind them. `visualMode:
  'off'`, calm wpm, flat curve, silence or a gentle drone. The honest default
  for someone who just wants to read.
- **Read with imagery.** The Gallery behind the text (or behind-stream),
  sourced from the reading's own collection. `visualMode: 'interlocution'`,
  `presentation: 'continuous'`, glass tile on, contemplative pace.
- **Contemplate.** A single held focal (a glyph, or under the Chapel an icon /
  the rose), slow pace, a soundscape. `visualMode: 'focals'`, unhurried wpm.
- **Study.** (Forward-looking — becomes the entry to Page mode.) Text and image
  arranged in space rather than streamed in time; scrollable, re-readable.

Each stance is a **named preset over `createDefaultConfig`'s shape** — it writes
a coherent set of the fields in `visualInterlocution`, the audio orbit, and the
temporal orbit. It is not new machinery; it is a *curated point* in the
parameter space we already have.

### Design rules
1. **A stance sets, it does not lock.** Choosing "Read with imagery" then
   opening the full panel to change one thing is expected and encouraged. The
   stance is a starting posture, not a cage.
2. **The engine stays sovereign.** A stance emits a config object that goes
   through the *same* normalizers and session compiler as a hand-built one.
   Zero new validation surface; zero new ways to reach the cortex.
3. **Content can suggest a stance, never impose one.** A Gospel chapter might
   *default* to "Read with imagery" or "Contemplate," but the reader can always
   step to another stance. (Respects the existing "content never implies a
   visual package" rule — the stance is the reader's choice, pre-filled.)
4. **Sacred restraint holds.** Under the Chapel, a stance may seed an icon or
   the rose, but it never A/B-tests or randomizes devotional imagery, and it
   never generates the face of Christ. Stances honor every existing sacred
   invariant.
5. **Progressive disclosure, not amputation.** Every current control still
   exists, one affordance deeper ("Adjust…"). Power users lose nothing; new
   users gain a floor.

### Why this is the right first step
- It is **additive and low-risk**: a preset layer over an unchanged engine.
- It **de-risks every demo**: a visitor picks one word and is reading beautifully.
- It is **the reusable pattern**: journeys (#5), the taste model, and the LLM
  doorway all ultimately emit "a coherent config" — the same thing a stance
  emits by hand. Building stances *is* building the doorway's foundation.

---

## 5. The rest of the arc (sequenced, not yet scheduled)

Each of these is a richer doorway over the same engine. The order reflects
leverage-per-effort and dependency, not commitment.

1. **Stances / progressive disclosure** — *first, chosen.* The floor under
   everyone; the pattern everything else reuses.
2. **Named journeys + editorial voice.** Entry organized around ideas, not
   books-and-chapters: "The Passion, in seven paintings," "How the Renaissance
   saw the divine." Makes the philosophy *legible at the door*. A journey is a
   stance plus a curated content path.
3. **LLM → validated config.** A documented config schema an LLM emits from a
   natural-language wish; our normalizers parse and clamp it. Most demo-able
   single feature; leverages the validators we already built. Discipline: the
   model proposes, the validators dispose.
4. **Page mode (spatial reading).** The scrollable text-box / image-box
   projection beside the RSVP Stream — same session, two renderers. Highest
   novelty, most shareable, reuses the pericope engine (atoms already carry
   verse coordinates; the scheduler already knows image↔passage). The "Study"
   stance is its entry.
5. **Taste model + A/B discovery.** A lightweight preference vector over
   styles/periods, fillable by a delightful A/B game, consumed by journeys and
   the LLM doorway. Art side only — never the sacred surface.
6. **Chapel threshold.** A welcoming, idea-first door (the identity of Christ,
   the love of God, mercy, light) *before* the liturgical machinery. Ideas as
   the doorway; the books, chant modes, and pericope precision as the sanctuary
   behind it. The same progressive-disclosure principle, applied to the most
   sensitive surface with the most care.
7. **JSON → MP4.** *Deferred, possibly indefinitely.* Distribution, not
   experience; needs an offline render pipeline (headless capture + ffmpeg, or
   a server compositor). Cheaper 80% if sharing ever becomes the growth engine:
   a screen-recordable Page mode or an animated export. Revisit only if
   distribution becomes the goal.

---

## 6. What must not change (invariants the doorway inherits)

The doorway makes the engine *approachable*; it must never make it *unfaithful*.

- Reverent degradation: silence over a broken image; stillness outranks
  substitution.
- Sacred imagery pinned, never searched; the face of Christ never procedurally
  generated; fixed liturgical forms have no probabilistic behavior.
- The three-layer law: content authors schedules; the runtime follows; the
  cortex renders. A stance/journey/LLM output is *content-or-user intent*; it
  never teaches the cortex about pericopes.
- `aic-*` category ids are a vault dependency — never renamed.
- Every doorway output passes through the existing normalizers and session
  compiler. There is exactly one path to the cortex, and it is validated.

---

## 7. The through-line, once more

Six of seven friend-notes reduce to one sentence: **the system needs a layer
that speaks in intentions, above the layer that speaks in parameters.** We own
the parameters and — the part that makes this cheap and safe — the validators
that keep them honest. Stances are the first, smallest, most reusable form of
that layer. We start there.
