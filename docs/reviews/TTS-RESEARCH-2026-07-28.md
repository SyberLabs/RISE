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

## What I could not establish

- **Word-level timing.** The typed reveal following the voice
  (RECITATION-SPEC §1) needs to know when each word is spoken.
  kokoro-js exposes phonemes per chunk but the README does not document
  per-word timestamps. If they are unavailable, the reveal can be
  driven by audio duration divided across the phrase — an approximation
  that will drift on long atoms. **This needs a prototype before the
  design is committed.**
- **Real-world latency on a mid-range machine.** Reported figures vary
  and none of them measured our case: short phrases, generated
  continuously. Worth measuring before promising streaming keeps up.

## Suggested next step

A throwaway prototype that loads the model in a worker and speaks ten
atoms, measuring cold start, per-atom latency, and whether timing data
is available. **Roughly an hour, and it answers the two open questions
above before any of it is wired into the Chamber.**
