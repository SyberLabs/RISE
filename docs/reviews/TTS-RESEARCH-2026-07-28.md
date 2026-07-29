# TTS research — replacing the robotic voice

*2026-07-28, for RECITATION-SPEC §2.*

---

## The problem

The current voice is `window.speechSynthesis` — the browser's built-in
synthesiser. It is free, needs no network, and sounds like 2005. On
Windows it is usually Microsoft David or Zira; on Chrome it may fall
back to eSpeak, which is worse. **This is not a tuning problem.** No
rate, pitch, or voice-selection change makes a formant synthesiser
sound human.

## The constraint that decides it

**R.I.S.E. is a static site on Netlify.** No server, no backend, no
secret storage. That eliminates every hosted TTS service outright,
because each needs either a server to hold an API key or a proxy to
avoid exposing one in client JavaScript:

| service | quality | why not |
|---|---|---|
| ElevenLabs | best available | API key; free tier is small and personal-use |
| Google Cloud TTS | excellent (Neural2/Chirp) | API key + billing account |
| Amazon Polly | very good | API key; 5M chars free for 12 months only |
| Azure Speech | very good | API key |

Adding a serverless function to proxy one of these is possible, but it
turns a static site into a service with a bill attached, a rate limit to
police, and a key to rotate. That is a large change for a reading
feature.

## Microsoft Edge TTS — investigated and rejected

`edge-tts` wraps the same neural voices Edge uses, needs no key, and is
free. It is also **an undocumented endpoint reached by reverse-
engineering Microsoft's protocol**, with no public API and no
endorsement. Microsoft's own answer to whether it may be used
commercially points to Azure instead.

It also cannot work here on the merits: the required custom WebSocket
headers cannot be set from a browser other than Edge, so it needs a
server regardless.

Rejected on both counts. A reading environment should not be built on
an endpoint that may be withdrawn or may not be permitted.

---

## Recommendation: Kokoro-82M, in the browser

**[kokoro-js](https://www.npmjs.com/package/kokoro-js) v1.2.1,
Apache-2.0**, running
[onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX),
**also Apache-2.0**.

Both the library and the weights are permissively licensed. Nothing to
attribute, nothing to pay, no key, no server. The model runs entirely
client-side via Transformers.js — WebGPU where available, WebAssembly
otherwise.

### Quality

Kokoro-82M reached **#1 on the TTS Arena leaderboard** in January 2026,
above models five to fifteen times its size, and reviewers report it is
hard to distinguish from ElevenLabs in casual listening on clean,
well-punctuated prose.

Its reported weakness is **limited emotional range — an even, neutral
delivery**. For dramatic narration that is a real limitation. For
contemplative reading it is close to what we want: the Chamber is not
trying to act the text.

### Voices are graded, and most are not good

The model card grades all 24. Only two earn an A:

| voice | grade | notes |
|---|---|---|
| **af_heart** | **A** | the reference voice |
| **af_bella** | **A-** | trained on the most data |
| af_nicole | B- | whispered/ASMR character |
| am_fenrir, am_michael, am_puck, af_kore, af_aoede, af_sarah | C+ | |
| am_adam | F+ | the worst in the set |

**Default to af_heart.** Offering all 24 without saying which are good
would be a disservice — a reader picking `am_adam` would conclude the
whole feature is bad.

### The costs, stated plainly

1. **A 92 MB model download** (q8 quantisation; fp32 is 326 MB). One
   time, then cached — but it is real, and must never happen unless a
   reader asks for voice. Load lazily, on enabling recitation, with
   visible progress.
2. **WASM inference is slow.** WebGPU is 10–100× faster and is the
   difference between usable and not. Chrome/Edge 113+ have it; Safari
   and Firefox largely do not, so a large share of readers get the slow
   path.
3. **Cold start is three phases** — download, graph deserialisation, and
   a warm-up inference that JIT-compiles the WASM kernels. The first
   utterance is much slower than the rest.
4. **It can hang a tab.** At least one project reports the browser
   locking up during load. **It must run in a Web Worker**, never on the
   main thread, or a slow machine will freeze the reading.

### Why it still fits

The `stream()` API with `TextSplitterStream` accepts text incrementally
and yields audio in chunks, which suits RSVP: atoms are short, and
generation can run ahead of the reading rather than blocking it.

And the failure mode is already specified. RECITATION-SPEC §2 requires
that a reading which cannot be spoken is read silently, never stalled.
If the model will not load, is too slow, or the device cannot run it,
recitation falls back to the existing behaviour. **Reverent degradation
applies to speech exactly as it does to imagery.**

---

## Measured, 2026-07-29

Both open questions are answered. Measured in **Node with
`device: "cpu"`**, which is the WASM/CPU path — the slow one, and the
one most Safari and Firefox readers get. WebGPU only improves on this.

| measurement | result |
|---|---|
| **Cold start** | **3.2s** — far better than the three-phase warning implied |
| **Warm generation** | ~3.1s average per atom |
| **Real-time factor** | **~1.09 consistently** |
| **Per-word timestamps** | **NO** — `generate()` returns `{audio, sampling_rate}` and nothing else |
| **Waveform onsets** | **YES** — 6 silence gaps for a 7-word phrase, onsets at 0.30 / 0.80 / 1.12 / 1.62 / 1.92s |

### The number that decides the design

**RTF ~1.09 means generation takes LONGER than the audio it produces.**
Every atom costs slightly more wall-clock time to synthesise than to
speak. On CPU, Kokoro cannot stay ahead of a reading — it falls further
behind with each phrase.

This does not kill the feature, but it rules out generating on demand.
Three ways forward:

1. **WebGPU where available.** Reported 10–100× over WASM would put RTF
   well under 1. But it excludes most Safari and Firefox readers, so it
   cannot be the only plan.
2. **Generate ahead, buffer deep.** Start synthesising several atoms
   before playback begins and keep a queue. At RTF 1.09 the buffer
   drains slowly, so a long reading still degrades — but a lead of ten
   atoms covers a lot.
3. **Speak selectively.** The montage act does not narrate continuously;
   it speaks a handful of held phrases. **At that density RTF 1.09 is
   irrelevant** — there is dead air between utterances to generate in.

Option 3 is what the reel actually needs, and it is the honest scope.
Continuous narration of a full reading is a different feature and should
not be promised.

### Timing: interpolation is not required

`generate()` exposes raw `Float32Array` samples, so 20ms RMS windows find
the silences between words directly. A 7-word phrase yielded 6 gaps —
enough to drive the typed reveal off **real speech onsets** rather than
dividing duration evenly. The reveal can follow the voice honestly.

### What the probe cost, and the lesson

The first four attempts each took roughly seven minutes and produced
nothing, because they ran through Playwright — whose `webServer` config
rebuilds the entire app before serving. Worse, the page was never
loading at all: the SPA fallback served `index.html`, and the
diagnostic saying so (`title: R.I.S.E.`, `#go: 0`) was in hand after the
second run and not acted on.

Moved to a plain Node script: **43 seconds, complete answers.** The
lesson is the one this codebase keeps teaching — reach for the smallest
harness that can answer the question, and read the diagnostic before
running the expensive thing again.

## What remains unmeasured

- **WebGPU speed in a real browser.** The 10–100× figure is reported,
  not measured here. It decides whether continuous narration is ever
  viable, and needs a browser probe — but only if continuous narration
  is wanted, which the reel does not require.
- **`stream()` under Node hangs.** The streaming API produced no output
  and exited 13. It may be browser-only. Worth knowing before relying
  on it; `generate()` works fine and is sufficient for held phrases.
