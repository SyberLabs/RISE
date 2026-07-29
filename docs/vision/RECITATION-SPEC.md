# Recitation — spoken reading, revealed text, ducked music

*Written 2026-07-28, revised 2026-07-29 against a frame-by-frame reading
of the reference reel and a measured TTS probe.*

---

## 0. What this is

A presentation in which text arrives over a short duration rather than
appearing whole, optionally spoken aloud, with the music yielding to the
voice and returning.

**A reading mode, not an export.** If a reel is wanted, the screen is
recorded. JSON → MP4 stays deferred (NORTH-STAR §5.7) — but this makes
the eventual export a *capture* problem rather than a *rendering* one,
which is the harder half.

### What the reference reel actually does

The reel is two acts, and only the second is R.I.S.E.'s business.

**Act one (0:00–8:25)** — captions over filmed footage, in **word
mode**: `OKAY` · `IF` · `YOU` · `HAD` · `15` · `MINUTES`, each word
replacing the last at 150–350ms. This is word-chunked RSVP, which
R.I.S.E. already does. The footage is not ours to generate.

**Act two (8:25–25:30)** — a hard cut to black, then a montage in
**phrase mode**, where each phrase *reveals itself* rather than
appearing:

```
I   →   I AM   →   I AM THE   →   I AM THE ALPHA.
```

That is **one atom revealing progressively**, not four atoms replacing
each other. Measured from the frames: **750ms reveal, then 1000ms held**
— a 43% reveal share, about 50ms per character. Then imagery, then
`THE FIRST.` held 1400ms, then more imagery, then `AND` at 450ms, then
`THE END` split across a composition.

So the two acts differ in **chunk mode**, and the "typewriter" is a
reveal *within* a phrase atom.

### What already exists

| element | state |
|---|---|
| **Word / phrase chunking** | Both modes exist and are selectable. |
| **Held sacred imagery** | The Chapel pins works; Gallery and full-frame present them. |
| **Speech** | `AudioEngine.speak()` is complete at `engine.js:2064` with `onStart`/`onEnd` hooks — and **has never had a caller**. |
| **Ducking** | The exact ramp pattern exists for the Shuttle. Not wired to voice. |
| **Per-atom colour** | Living Text tints by valence. Driven by the wrong signal for this — see §3. |
| **Keystroke sound** | `layerGains.typing` with a sampler and configured volume, built for something else. |
| **Progressive reveal** | Nothing. The one genuinely new mechanism. |

---

## 1. The reveal

### The problem it creates

An atom's `duration` is computed from word count at the session WPM, and
the reader is promised that long to read it. A progressive reveal breaks
that promise silently — the phrase is not readable until the reveal
completes, so the reader gets less time than the duration implies.

### The rule

**The reveal is independent of speech, and behaves differently with it.**

- **Without speech** — the reveal completes within a share of the atom's
  duration; the remainder is reading time at rest. The temporal contract
  is preserved exactly.
- **With speech** — the reveal follows the voice. Words appear as they
  are spoken, and the atom lasts as long as the utterance. **The WPM
  setting stops governing**, which is correct: when a reading is spoken,
  the voice is the clock.

That second case transfers authority away from a setting the reader
chose, so it must be visible in the UI rather than surprising.

### Budget, without speech

`reveal = min(REVEAL_MAX_MS, duration × REVEAL_SHARE)`.

The reel measures **43%** and ~50ms per character. Proposed:
`REVEAL_SHARE = 0.4`, `REVEAL_MAX_MS = 800`. A short atom is not
swallowed by its own animation; a long one does not crawl.

Atoms under ~400ms already bypass the fade path in `displayAtom` and
appear whole. **Revealing a three-word atom that lives 300ms is a
strobe, not a reveal** — those keep appearing whole.

### Granularity: word, not character

The reel reveals `I` → `I AM` → `I AM THE`, which is **word by word**.
Character-by-character is a different effect and a worse one here: a
reader tracking half-words is decoding, not reading. Words also give the
speech case a natural unit to sync against.

### Reduced motion

`prefers-reduced-motion` disables the reveal entirely — text appears
whole. Not "reveals faster": off.

---

## 2. Speech

`speak()` is wired to the player's atom advance, and its `onEnd`
advances the reading rather than the computed duration.

### Voice

`window.speechSynthesis` is a formant synthesiser and no setting makes
it sound human. Replaced by **Kokoro-82M via kokoro-js**, both
Apache-2.0, running fully client-side — see TTS-RESEARCH.

### Continuous narration is viable

Measured: cold start **3.2s**, real-time factor **~1.09** on CPU. That
sounds fatal and is not — a **9% deficit**, against which:

- **The reading is already 19–23% silence.** `[PAUSE]`, `[HOLD]`, and
  paragraph breaks are dead air the synthesiser generates through.
- **A head start drains slowly.** 30s of lead covers 5.6 minutes of
  continuous reading.

So: cold start on entering the Chamber (concurrent with choosing
settings, therefore free), pre-generate a lead during the preparation
stage that already exists, refill during pauses the scheduler can see
coming.

### Degradation

If the buffer runs low, **stop speaking and let the reading continue
silently.** Never stall the reading to wait for audio. `speak()` already
calls `onEnd` on error and on empty text. **Reverent degradation applies
to speech exactly as it does to imagery.**

### Timing for the reveal

kokoro-js exposes **no per-word timestamps** — `generate()` returns
`{audio, sampling_rate}` and nothing else. But it returns raw
`Float32Array` samples, and 20ms RMS windows find the silences between
words directly: a 7-word phrase yielded 6 gaps, onsets at
0.30/0.80/1.12/1.62/1.92s.

**The reveal follows real speech onsets, not an interpolation.**

---

## 3. Emphasis

The reel colours emphasised words **cyan** against white: `15`,
`MINUTES`, `BEAUTIFUL`, `AMAZING`, `LORD`, `JESUS`, `CHRIST`. That is
semantic, not decorative — it marks what the sentence is *for*.

**Emphasis is authored, exactly as phrase boundaries are.** The Vault's
sequences already carry `|` marks placed by a human; emphasis is the
same kind of notation and belongs in the same layer. Content authors;
the runtime follows.

Living Text is **not** the right source. It computes valence, and
sentiment is not emphasis — `BEAUTIFUL` scores high and `15` does not,
yet the reel emphasises both. Deriving emphasis from sentiment would
mark the wrong words confidently.

The two coexist: Living Text tints the atom by mood; emphasis marks
particular words within it. One is climate, the other is stress.

**Emphasis also affects timing.** `DO` holds 950ms where its neighbours
hold 200ms — the question landing. An emphasised word earns dwell, which
the temporal system can already express.

---

### Notation and the display path

Checked: an asterisk notation passes through the chunker untouched —
`I would tell you how *beautiful* and *amazing*...` survives phrase
chunking as one atom with the marks intact. So emphasis can be authored
in the text and parsed at the display layer, the same seam `|` uses.
The marks are stripped before display and before speech, exactly as
`|` and `[PAUSE]` already are.

**One real consequence.** `displayAtom` currently sets
`atomDisplay.textContent = atom.content` at two sites. Text content
cannot carry per-word colour, and it cannot be revealed word by word.
Both the reveal and emphasis require the atom to be built from
**per-word spans** instead.

That is a change to the hottest path in the reading loop, so it must:

- keep the existing fast path for atoms under ~400ms, which appear whole
  and need no spans at all;
- escape the text, since building HTML from content is a new injection
  surface where `textContent` was inherently safe;
- and leave the non-recitation path byte-identical, so an ordinary
  reading is not paying for a feature it is not using.

---

## 4. Glow

Serif type on black with a blurred halo. Glow is a `text-shadow`
derived from the atom's Living Text colour, so the two never disagree —
one signal, two expressions.

Strongest on the word being revealed, settling as the phrase completes.
If that proves fussy, a whole-atom glow that brightens during the reveal
and settles after is an acceptable simplification.

---

## 5. Ducking

Speech starts, music ramps down; speech ends, it returns.

1. **Duck, do not silence.** A floor around 15–20% keeps the bed present.
   Full silence between phrases would pump audibly.
2. **Asymmetric.** Down fast (~150ms), up slow (~600ms) so the return is
   a breath rather than a switch.

**Verified:** the graph is named layer gains each connected to
`masterGain`. TTS audio does not enter the Web Audio graph through
`speechSynthesis`, and Kokoro's output is a Blob played through an
`Audio` element — so ducking the musical layers cannot attenuate the
voice. Duck the musical layers; leave `ui` and `typing` alone.

---

## 6. Where it lives

The existing three-way control (Full-frame / Behind-stream / Gallery)
describes how **imagery** is presented. This describes how **text** is
presented. They are orthogonal — a recitation can run under a Gallery —
so folding them into one control would be a category error of the kind
the Library's shelves just went through.

It belongs beside WPM and chunking, in the temporal orbit, because that
is what it modifies.

---

## 7. Invariants

- **The temporal contract holds when the voice is off.** The reveal
  borrows from `duration`, never extends it.
- **Reverent degradation.** No model, slow device, error mid-utterance —
  the reading continues silently. It never stalls waiting for audio.
- **Reduced motion disables the reveal.** Off, not faster.
- **Emphasis is authored.** The runtime never guesses which words matter.
- **One signal, two expressions.** Glow derives from the Living Text
  colour rather than computing its own.
- **The Chapel is unaffected.** Sacred readings have chant beds and
  liturgical pacing. Synthetic speech over scripture is a decision
  nobody has made, and this spec does not make it.
