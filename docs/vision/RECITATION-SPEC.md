# Recitation — spoken reading, typed text, ducked music

*Written 2026-07-28. A presentation mode in which the reading is spoken
aloud, the text arrives as it is spoken, and the music yields to the
voice and returns.*

---

## 0. What this is, and what it is not

**A reading mode, not an export.** The Chamber gains a way of reading;
if a reel is wanted, the screen is recorded. JSON → MP4 remains deferred
(NORTH-STAR §5.7) and this does not bring it closer — but it does make
the eventual export a *capture* problem rather than a *rendering* one,
which is the harder half.

Four elements, three of which mostly exist:

| element | state before this work |
|---|---|
| **Speech** | `AudioEngine.speak()` exists, complete, with `onStart`/`onEnd` hooks — and **no callers anywhere**. Dead code since it was written. |
| **Ducking** | The exact pattern exists for the Shuttle: ramp a gain to 0 over 0.4s, restore over 0.8s. Not wired to voice. |
| **Glowing text** | Living Text already tints each atom by valence — amber warm, blue-violet cool, tanh-saturated. Colour, not glow. |
| **Typed reveal** | Nothing. This is the only genuinely new mechanism. |
| **Keystroke sound** | `layerGains.typing` and a `buffers.typing` sampler already exist, with a configured volume — built for something else and ready to pair with the reveal. |

So the work is one mechanism and three connections.

---

## 1. Typed reveal

### The problem it creates

R.I.S.E. rests on a temporal contract: an atom's `duration` is computed
from its word count at the session's WPM, and the reader is promised
that long enough to read it. A character-by-character reveal breaks
that promise silently — the phrase is not readable until the reveal
finishes, so a reader gets less time than the duration implies.

### The rule

**Typing is independent of speech, and behaves differently with it.**

- **Without TTS** — the reveal completes within the first portion of the
  atom's duration; the remainder is reading time at rest. The temporal
  contract is preserved exactly: `duration` still means what it has
  always meant.
- **With TTS** — the text follows the voice. Characters arrive as they
  are spoken, and the atom lasts as long as the utterance does. The WPM
  setting stops governing, which is correct: when a reading is *spoken*,
  the voice is the clock.

That second case is a deliberate transfer of authority, and it must be
visible in the UI rather than surprising. A reader who set 250 wpm and
then enabled voice should understand why the pace changed.

### Reveal budget (no TTS)

The reveal takes `min(REVEAL_MAX_MS, duration × REVEAL_SHARE)`, so a
short atom is not swallowed by its own animation and a long one does not
crawl. Proposed: `REVEAL_SHARE = 0.35`, `REVEAL_MAX_MS = 600`.

An atom shorter than roughly 400ms already bypasses the fade path in
`displayAtom` — those appear whole, as they do now. **Typing a
three-word atom that lives for 300ms would be a strobe, not a reveal.**

### Reduced motion

`prefers-reduced-motion` disables typing entirely; text appears whole.
This is animation, and the existing safety posture treats animation as
opt-out by default.

---

## 2. Speech

`speak()` is wired to the player's atom advance. Its `onEnd` is what
advances the reading rather than the computed duration — that is the
authority transfer above, made concrete.

Failure is not silence-forever: `speak()` already calls `onEnd` on
error and on empty text, so a voice that will not speak still advances
the reading. **Reverent degradation applies to speech exactly as it does
to imagery** — a reading that cannot be spoken is read silently, never
stalled.

The phrase markers `|` and `[PAUSE]` are already stripped before
speaking. Good: they are breath notation for a reader, not words.

---

## 3. Ducking

When speech starts, the music ramps down; when it ends, back up. The
Shuttle's `_setSuspended` is the pattern — cancel scheduled values, set
current, ramp.

Two differences from the Shuttle case:

1. **Duck, do not silence.** The reel's effect is music *yielding*, not
   stopping. A floor around 15–20% keeps the bed present under the
   voice. Full silence between every phrase would pump audibly.
2. **Asymmetric timing.** Down fast (~150ms) so the voice is never
   fighting a swell; up slow (~600ms) so the return is a breath rather
   than a switch. The Shuttle's 0.4/0.8 is close and worth borrowing.

**Verified rather than assumed:** the graph is a set of named layer
gains (`binaural`, `harmonics`, `noise`, `drone`, `ambient`, `swell`,
`soundscape`, plus `typing` and `ui`) each connected to `masterGain`.
TTS goes through `window.speechSynthesis`, which does **not** route
through the Web Audio graph at all — so ducking the musical layers
cannot attenuate the voice, and the risk this paragraph was written to
flag does not exist. Duck the musical layers; leave `ui` and `typing`
alone, since those are feedback rather than bed.

---

## 4. Glow

Living Text already computes a per-atom colour from valence. Glow is a
`text-shadow` derived from that same colour, so the two never disagree —
one signal, two expressions.

It should be **strongest on the character being revealed** and settle as
the phrase completes, which is what makes typed text look alive rather
than merely animated. If that proves fussy, a whole-atom glow that
brightens during the reveal and settles afterward is an acceptable
simplification.

---

## 5. Where it lives

A presentation choice, beside Full-frame / Behind-stream / Gallery —
those describe how imagery is presented; this describes how the *text*
is presented, which is a different axis and may want its own control.

**Open question**, and the one most likely to need a second pass: the
visual presentation surfaces and this are orthogonal (a recitation can
run under a Gallery), so folding it into the same three-way control
would be a category error of the kind the Library's shelves just went
through. It probably belongs beside the WPM and chunking controls, in
the temporal orbit, because that is what it modifies.

---

## 6. Invariants

- **The temporal contract holds when the voice is off.** Duration means
  what it means; typing borrows from it, never extends it.
- **Reverent degradation.** No voice, no speech synthesis, an error
  mid-utterance — the reading continues silently. It never stalls.
- **Reduced motion disables typing.** Not "types faster" — off.
- **One signal, two expressions.** Glow derives from the Living Text
  colour rather than computing its own.
- **The Chapel is unaffected.** Sacred readings have their own
  chant beds and liturgical pacing; nothing here changes them, and
  synthetic speech over scripture is a decision nobody has made.
