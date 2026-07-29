# Recitation — spoken reading, revealed text, acoustic balance

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

> **Runtime decision, 2026-07-29:** browser neural inference is retired.
> The browser-provisioning material below is retained as the measurement
> record that led to the decision, not as the current implementation.

### Runtime architecture: static voice packs

Kokoro-82M and kokoro-js are local authoring tools. The pack builder runs
under Node and emits content-addressed WAV assets plus a bundled manifest:

```text
npm run build:voice-pack -- --input scripts/voice-packs/heart-beta.mjs
```

Production receives only same-origin audio. A reader's browser downloads
no model, creates no ONNX worker, requests no Hugging Face resource, and
uses no speech API or account. There is no recurring synthesis or server
cost; deployment pays only ordinary static-file storage and bandwidth.

The browser normalizes each speakable phrase, hashes it, and verifies the
exact normalized text at that manifest key. It requires **complete session
coverage before fetching audio**, so a partial pack can never stutter in
and out. It fetches and decodes eight initial phrase assets, then maintains
a twelve-asset lead with concurrent static requests.

The builder validates finite samples, audible energy, and safe peak before
writing Kokoro's own WAV output. Duration and speech-onset metadata are
computed once and stored in the manifest. The first admitted pack is Heart
(`af_heart`) for the complete Library *Meditations* selection in Phrase
mode. The UI lists only installed packs and Spoken mode selects Phrase
chunking to keep compilation and asset identity aligned.

### Historical browser-inference record (retired)

`window.speechSynthesis` is a formant synthesiser and no setting makes
it sound human. Replaced by **Kokoro-82M via kokoro-js**, both
Apache-2.0, running fully client-side — see TTS-RESEARCH.

There is no assumed browser reliability baseline. The earlier Node
benchmark selected q4f16/WASM because it measured at RTF 0.34–0.38, but
Node uses `onnxruntime-node`, not the browser's `onnxruntime-web`.
Deployed Chrome and Edge later produced non-finite q4f16 samples for
both Heart and Fenrir, while q8/WASM produced healthy audio too slowly
to sustain the Chamber. Both conclusions are measured.

The full five-voice harness confirmed this on 2026-07-29 under controlled
frame pressure: single-thread q8/WASM ran at RTF 2.60–3.03; q4f16/WASM
ran at RTF 1.86–2.09 and returned sample-zero non-finite output for
Bella's passage and two Fenrir lengths. A sparse q8 Fenrir transient
peaked at 1.082 without exceeding the clipping-ratio threshold; that is
recorded as a warning, not conflated with q4f16's numeric corruption.

fp32/WebGPU then measured at steady-state RTF 0.11–0.41 after shader
warm-up, but seven of fifteen combinations produced finite numeric
explosions, including a peak of 2.7 × 10²⁶. Because validation occurs
inside the worker on Kokoro's raw samples, this rejects WebGPU before
encoding, transfer, or playback enter the path.

### Continuous narration requires provider qualification

A provider is admitted only after the deployed-browser harness verifies
every offered voice and representative fragment, sentence, and passage.
Every run must contain finite, healthy samples and p95 generation RTF
must be at most **0.75**, leaving 25% replenishment headroom for normal
variance and the Chamber's visual workload. “The model loaded” is not
an audio-health or throughput result.

The harness lives at `/tts-harness.html`. It creates a fresh worker and
ONNX session per provider, measures q8/WASM, q4f16/WASM, optional
uint8/WASM, and fp32/WebGPU when available, retains Kokoro's own WAV for
audition, and exports the complete browser/device evidence as JSON.
Until a provider passes on the target browser/device class, Recitation
must treat speech as unavailable rather than choosing a backend by
feature detection alone.

Once a provider is qualified: cold start before entering the Chamber,
then buffer by **audio duration**, not phrase count. Generation remains
serial because ONNX permits one run per session, and queued work remains
reader-aware so text the reader has passed is discarded. Once the
Chamber is visible, generation never holds the reader. A missing or
invalid segment degrades to the authored silent timer and cannot poison
the rest of the startup lead.

### Degradation

If the buffer runs low, **stop speaking and let the reading continue
silently.** Never stall the reading to wait for audio. Authored
`[PAUSE]`/empty atoms do not count as underruns. A bounded state-transition
diagnostic records starvation and recovery without flooding the console.
**Reverent degradation applies to speech exactly as it does to imagery.**

### Timing for the reveal

The signal analysis below now runs in the local pack builder. Its onset
result travels in the manifest; the deployed browser performs no Kokoro
generation or waveform analysis.

kokoro-js exposes **no per-word timestamps** — `generate()` returns
`{audio, sampling_rate}` and nothing else. But it returns raw
`Float32Array` samples, and 20ms RMS windows find the silences between
words directly: a 7-word phrase yielded 6 gaps, onsets at
0.30/0.80/1.12/1.62/1.92s.

**The reveal is anchored to real speech onsets, not a blind
interpolation.** The first detected word remains aligned to its measured
onset. The remaining onset span is compressed to 70%, so written words
lead comprehension slightly and a run of short words cannot leave the
visual reveal trailing the voice.

RISE does not re-encode those samples. Normal playback copies them
directly into Web Audio; media fallback uses Kokoro's own IEEE Float32
WAV Blob. A parallel PCM16 encoder is both unnecessary and a format
drift risk.

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

## 5. Interlocution and acoustic mixing

The static WAV is decoded into an `AudioBufferSourceNode` on the shared
graph. Media fallback plays the fetched WAV Blob.

Full-frame Rhythmic presence is a semantic pause. The completed phrase
finishes before the visual opportunity; a next phrase prepared behind the
opaque overlay keeps every word pending, does not begin speaking, and does
not start its reading clock until the visual has fully resolved. Its measured
word reveal, WAV, and reading clock then resume together without emitting or
laying out the atom a second time. Concealed DOM preparation is never a text
or audio entrance.

Music and narration always coexist at their authored levels. Recitation
does not automatically duck in Full-frame, Attractor, Focal,
Behind-stream, Gallery, or any other presentation.

The engine retains a dormant, tested musical-layer ramp primitive for a
future authored dramatic structure such as quote → synth accent → continued
quote. That behavior must be a precise content cue with an explicit span,
not an ambient consequence of enabling speech or selecting a visual mode.

**Verified:** the graph is named layer gains each connected to
`masterGain`. Static decoded samples enter through a mono
`AudioBufferSourceNode` connected directly to `masterGain`, outside the
named musical layer gains. A future cue may therefore shape musical layers
without attenuating narration; `ui` and `typing` remain outside that
primitive. The authored WAV Blob remains the compatibility fallback when no
shared Web Audio graph exists.

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
