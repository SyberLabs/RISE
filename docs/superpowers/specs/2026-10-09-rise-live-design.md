# RISE LIVE: design

**Status: Accepted** by the owner on 2026-10-09 (the clock decision, LIVE-017); **amended 2026-10-10** with the persona and honesty rules (§1, items 6 and 7), the interjection (§6.1, stage 4.5) and the illustrator (§6.2, stage 5.5), at the owner's direction of 2026-10-10. Written 2026-10-09 for LIVE-017, at the owner's direction of 2026-10-08: RISE LIVE is the third product of the line, after the Reader and Composer. Stage 2 (the venue, LIVE-018) is built and live; stage 3 is under way.

Audience: the owner, and the engineer who builds the first slice.

## 0. Summary, bad news first

- **Live is the product where RISE owns the venue.** Composer has taught us what a foreign host costs: the frame is made when the host decides (the blank card, the first-chat-of-the-day card), the model reads what the host lets it (resources no model reads), the room has the display modes the host grants, and nothing the reader does reaches the model. Every one of those is the host's to fix, and none of them will be fixed for us. Live removes the host: the Reader site is the venue, the reader's own key is the provider, and RISE holds the clock, the stage and the events.
- **The one decision: the clock.** A live reading has a voice that speaks and words that follow it. If the provider speaks (a realtime model's native audio), the clock's authority sits in a stream RISE cannot hold, pause, or restart a phrase in, and everything Pause, seek, replay, hold and a future Dive rest on being able to do exactly that. **Decision proposed: Live keeps one clock, RISE's own voice over streamed text** (§2). Provider audio is not refused; it is a *second clock discipline*, built on purpose and later (§2.3), never by loosening the first.
- **Most of Live already exists, parked.** The runtime, the reducer, the stream contract, the text-stream adapter with Gemini and OpenAI Realtime behind it, the microphone listener, the voice, the governor, the beats, the instrument and the scene sandbox are in the tree and tested (§3). What does not exist is perception (§4), the venue (§5), and the discipline that lets a model change a room while it plays (§6).
- **The shortest slice is small** (§8): the Reader site's Live page, one text provider on the reader's key, the microphone, RISE's voice, the instrument, and three events going up. It can be felt in a week of build, and it is the first time anyone can ask "is this a medium?" with the host out of the way.

## 1. What must be true

Reduced to what cannot be otherwise:

1. **The reader asks in words and gets a room, not a box.** Words become a reading as they arrive (a Current that streams), with a voice, imagery, typography and time, under the reader's controls from the first phrase. This is `docs/plans/LIVE-CURRENT.md`'s claim; Live is where it is made without a host in the way.
2. **The reader can act while it plays, and the model knows.** Pause, seek, replay, pace (built: the instrument), "slow down", "show me that as a diagram", a slider dragged in a scene — bounded, named events going *up* to the model, which answers by changing the room. VISION §2.4's two laws hold: actions, never inferences about the reader; only to the reader's chosen provider, with the reader's key.
3. **One clock.** Whoever speaks is the clock; the words follow the voice; nothing else may move the reading. The whole playback instrument and voice hardening were built on this and must not be undone to fit a provider.
4. **The reader's key, the reader's provider, no shared inference** (`docs/USER-OWNED-AI.md`). Live spends nothing of ours. The deterministic mock adapter is the demo path.
5. **The sandbox stays the boundary.** A model's code runs where Creative Control put it: a worker, an offscreen canvas, admission, budgets, a kill switch. Interactive scenes add events in and out of that box; they never open it.
6. **RISE speaks as itself.** (Added 2026-10-10.) In Live the reader talks to RISE, not to a tool a model calls. The system prompt says *You are RISE*; the persona belongs to the system — the runtime, the stage, the guide, the admission rules and the voice — and the intelligence is whichever model the reader brings. For the reader the distinction disappears: "RISE, tell me about black holes with an attractor visual" is answered by RISE, in RISE's voice, in RISE's room. In the architecture the distinction stays exactly where item 4 puts it: the reader's provider, the reader's key, nothing of ours spent. Composer keeps its own posture (there the host's model is the speaker and RISE is what it calls); the two never share one prompt.
7. **The persona never hides the model.** (Added 2026-10-10.) A Current's `origin` names the model and who runs it, the About panel shows it, and a reader who asks "who are you really?" is told plainly: RISE, speaking through the model they connected, on their key. The directory's rules, `USER-OWNED-AI.md` and plain honesty all want the same sentence. The persona is a voice, not a disguise.

Everything else — which provider, which transport, which widget — is a recommendation.

## 2. The clock decision

### 2.1 The two disciplines

| | RISE's voice over streamed text | Provider-native audio |
|---|---|---|
| Who speaks | RISE (`src/live/voices/`: the browser's voice today; a provider TTS as a sibling renderer later) | the model (OpenAI Realtime audio, Gemini Live audio) |
| Clock | RISE's, with marks per word where the voice gives them; held, sought, re-anchored at will | the provider's stream; RISE can stop it, not hold it mid-phrase or replay a phrase |
| Latency to first sound | provider text first-token + voice start (today ~1–2 s) | provider audio first chunk (~0.5–1 s) |
| Interruption | exact: hold the voice, keep the head where it was, take up at the phrase (built) | stop the stream; the model re-answers; the head is wherever the audio was |
| Seek / replay / pace | built (#549): re-anchor the voice at a passage | not possible on a stream; needs recorded audio and re-synthesis |
| Voice quality | browser voices today; provider TTS with word timestamps later (a better clock than `speechSynthesis`) | the model's own voice, expressive, with prosody the text cannot carry |
| Words on screen | exact, from the text | from the provider's transcript events, which lag and revise |
| Dive / follow-up | possible: the voice is held, the child Current speaks | possible but the parent cannot resume mid-phrase |

### 2.2 The decision

**Live keeps one clock: RISE's voice over streamed text.** Reasons, in order of weight:

1. Every control the reader has today (Pause, seek, replay, pace, the hold through an external cancel, "the reading ends when the voice has") is a property of a clock RISE owns. A provider stream has none of them, and giving them up to gain prosody reverses the week's work.
2. The words are the medium. Live shows the words as they are said; a provider transcript lags and revises, and a reading whose words correct themselves after being spoken is a worse reading than one with a plainer voice.
3. The adapters already carry text only *for this reason* (their own headers say so: "It carries text only: RISE speaks it with its own voice, which is what lets a Dive hold the voice").
4. Voice quality is not lost: a provider **text-to-speech** renderer with word timestamps (OpenAI, ElevenLabs, on the reader's key) is a sibling voice renderer under the same clock, and a better one than the browser's. That is the voice upgrade, and it keeps the discipline.

### 2.3 What provider-native audio would be, if ever

A **second clock discipline**, stated so it is never confused with a relaxation of the first:

- The provider's audio is the clock while it plays. RISE shows words from the transcript, marked *provisional* until the provider finalises them, and never advances past audio heard.
- Pause = stop the stream and discard the rest; Play = ask the model to continue from the last finalised sentence (a new request). No seek, no replay, no pace. The instrument collapses to Play/Pause and the model's own continuation.
- A Dive is a new turn; the parent cannot resume mid-phrase.

It is a different product posture (a conversation with a room) rather than a reading. It may be worth building for its own sake; it is not Live's first edition, and the runtime must keep the two apart as two adapter capabilities (`capabilities.speaks: 'host' | 'provider'`), never one code path with flags.

## 3. What exists, parked

Measured against the tree at 2026-10-09, not against hope.

| Layer | Built | Where | State |
|---|---|---|---|
| Event stream contract | `rise.current-events.v1`, reducer, sealed Currents | `src/live/stream.js`, `protocol.js`, `docs/specs/LIVE-CURRENT-EVENTS-V1.md` | live, used by Composer |
| Runtime | one Player governed by the voice; hold/interrupt/resume; seek/replay/pace; journal; `onNote` trace | `src/live/runtime.js` | live |
| Voice | browser voice (sentence-wise Google voices, marks, hold/release, seek, rate, external cancel as `taken`) | `src/live/voices/browser.js`, `speech-governor.js` | live, hardened (#515, #535) |
| Beats | holds, cues, the conductor, scenes native and generated, typography, maths, styles | `src/core/beats.js`, `src/live/beat-conductor.js`, `src/scenes/*` | live (CC-002..CC-008) |
| Instrument | back/forward/replay/pace/full screen, keyboard, the tick line | `src/live/host/stage-controls.js` | live (#549) |
| Text providers | the text-stream adapter; Gemini (SSE over fetch); OpenAI Realtime (WebRTC data channel, text only) | `src/live/adapters/text-stream.js`, `gemini*.js`, `openai-*.js` | built and conformance-tested in 2026-09; unverified against the real services since; the Realtime page is switched off by default |
| Microphone | press-to-talk utterances with a silence timer; privacy sentence; closed state list | `src/live/mic/listener.js`, `interpret.js` | built; the "reader speaks, the voice holds" path exists (`runtime.hold({ text })`) |
| Visual control | "more vibrant" through manifests; cues to the running engine | `controlVisual`, `src/scenes/manifests.js` | live |
| Perception | — | — | **nothing** |
| The venue | the Reader site's `/live` page (`LiveHost` outside a card) | `src/live/host/LiveHost.js` | exists for the card; the site page is off by default and has no Live product surface |

The seed is large. The absence is specific: perception, the venue, and the model's right to change a room that is playing.

## 4. Perception: the events that go up

The axis VISION calls the one we have invested nothing in. Live's first job.

**What goes up.** Bounded, named, in the reader's own words of action, never a claim about the reader:

| Event | When | Body |
|---|---|---|
| `held` / `resumed` | Pause/Play, a hold through an external cancel | passage id, position |
| `sought` / `replayed` | the instrument | from, to |
| `paced` | the pace control | rate |
| `visual.changed` | "more vibrant", a Settings change | parameter, value |
| `said` | the reader spoke (the microphone) | the words, as heard |
| `scene.input` | a scene widget moved (§6) | scene id, control id, value |
| `finished` | the reading ended | — |

**Where it goes.** To the provider the reader chose, as part of the next turn's context, through the adapter (`connection.record`, which already exists for host events). Nothing is sent on a timer; events are batched and sent with the reader's next words, or when the model is asked to continue. The journal is the source; the adapter is the only door.

**What the model does with it.** The same thing it does with any context: it may change the room (§6) or answer. A reading that notices "you replayed the third passage twice" and says "let me put that another way" is the whole promise of VISION §1, item 3.

**What never goes up:** anything inferred (attention, confusion, mood), anything from the page outside the reading, anything to anyone but the chosen provider.

## 5. The venue: the Reader site's Live page

Composer's card is the host's; Live's page is ours. It is the existing `LiveHost` presented as a page of the Reader site, not a card:

- **Entry, and whose key.** The reader brings a question, typed or spoken, and a credential for the provider that will compose. The credential posture is `USER-OWNED-AI.md`'s: a key lives in memory for the session and is forgotten on reload; RISE stores none. Two routes, decided here:
  - **OpenRouter, through a new text-stream adapter** (`connect` over OpenRouter's streaming chat completions; one adapter, every model the reader can reach). This reuses the one key flow the site already has (`src/core/openrouter-oauth.js`, the token held in memory) and is Live's first provider. The adapters in the tree today are Gemini (its own Google key in `x-goog-api-key`) and OpenAI Realtime (its own key); there is no OpenRouter text-stream adapter yet, so the venue slice builds one before it builds anything else.
  - **A provider's own key, typed into the Live page** for Gemini or OpenAI, held in memory only, for a reader who has one. Same posture, no storage, the field cleared on reload.
  The deterministic mock adapter is the demo without any key.
- **The stage.** The full instrument, full screen by the browser's own API, the Look sheet and Settings the Reader already has, sound beds (SND-001), no host rules on actions.
- **The composer's time.** A streamed Current is v1 passages today (the text-stream adapter emits segments as they arrive). Live's Currents should be **v2 beats streamed**: the line format gains a beat per line (say / show / hold / scene / cue), so holds and scenes arrive in time, not only at the end. This is the one protocol change Live needs, and it is additive to `rise.current-events.v1` (a `segment.begin` body gains a `beat`).
- **One answer, many turns.** A Live session is a sequence of Currents in one room: the reader speaks, the model continues or composes anew, the room persists (theme, look, scene state) across turns unless the model changes it. This is Composer's "continues" idea made native.

## 6. The model changes a room that is playing

Today a model composes once; the room follows the score. Live needs rate: the model may change the room while it plays, within bounds, without the reading faltering (VISION §7's "one visual, one phrase, one second").

- **The channel is the stream.** A model's mid-reading change is an event like any other: `visual.control` (a manifest command), `scene.cue`, `look.change`, `pace.suggest`. The reducer admits them; the runtime applies them at the next phrase boundary (or at once for cues, as the conductor does today). No second runtime.
- **Bounded by manifests and admission,** exactly as cues are now. The model never drives frames.
- **Interactive scenes.** The sandbox learns to listen: pointer and key events forwarded into the worker (`rise.input`), scene state out as `scene.input` events (§4). The widget catalog VISION §2.5 wanted is then *a style of generated scene* with a tested `rise.lib` widget set (slider, draggable point, step-through), not a second format. This keeps one pipeline and still gives the model widgets it can rely on.

### 6.1 The interjection (added 2026-10-10; stage 4.5)

The reader speaks while the reading plays: "What do you mean by that? Show me." Today that is three half-built things; it becomes one first-class event.

- **Hold at the boundary.** The microphone's press holds the voice at the current phrase (built: `runtime.hold({ text })`); the room stays as it is, the head where it was. Nothing is cancelled.
- **The question goes up with the room.** The reader's words (`said`, §4) go to the model with the journal of this reading so far: what has been said, what is on screen, where the head is. One request on the reader's key, through the room's one adapter connection.
- **The model answers inside the room.** Its reply is a Current fragment streamed into the same room (stage 3's beats), spoken by the same voice, over the same scene unless it changes it (§6). Then one of three endings, decided by the model and named in the stream: **resume** (take the held reading up where it was), **replace** (the rest of the reading is withdrawn; the answer continues as the reading), or **end** (the answer was the end).
- **The reader's controls hold throughout.** Pause, seek and replay act on the interjection as on any passage; "back" from the first phrase of an interjection returns to the held phrase.
- **It is not a Dive.** A Dive opens a child reading and returns; an interjection is the same reading, continued by the reader's question. Dive stays parked.
- **Measure:** time from the reader's last word to RISE's first word of answer; the voice never speaks two things at once; the head is where the reader expects after each of the three endings.

### 6.2 The illustrator (added 2026-10-10; stage 5.5)

"Create a visual to demonstrate it." The voice must never do two things at once, so the picture is drawn by a second role, the **illustrator**: a second request to the reader's chosen provider with its own system prompt (the scene contract, `rise.lib`, the figure rules, the admission diagnostics), given the room (theme, the running scene, what was just said, what the reader asked) and returning only a picture: a cue, a figure or a scene. Rules:

- **The illustrator never speaks.** It returns scene material; the conductor starts it at the next phrase boundary. One clock survives.
- **Climb the cheapest medium first.** A native engine cue ("an attractor visual") lands at once and needs no model; a labelled diagram is an SVG figure and takes seconds; a code scene is the last resort, since a model takes ten to twenty seconds to write one. The composer's request to the illustrator names the medium it needs, and RISE answers from its own engines before it asks anyone.
- **The voice bridges the wait honestly.** While the illustrator draws, RISE says what it is doing or goes on explaining; a shown line may say *drawing…*. Dead air is the failure, not latency.
- **Admission is the same door.** The illustrator's scene passes `admitSceneCode` / the figure allowlist like every other; a refusal returns the line, column and rule to the illustrator, which repairs and retries, bounded (three attempts); after that the reading goes on without the picture and the journal says so.
- **One runtime, one adapter kind.** The illustrator is a second connection on the same adapter and key, not a second runtime, service, or agent framework. Its result enters the stream as scene events (stage 3's forms), so nothing downstream knows there were two roles.
- **Cost is the reader's, and visible.** Each illustrator request is billed to the reader's key like any turn; usage is shown with the reading's own.
- **Measure:** request-to-picture time per medium; refusal and repair rates; whether the composer's voice ever paused for the picture.

## 7. What we refuse

| Proposal | Verdict |
|---|---|
| Provider-native audio as Live's first voice | Refused for the first edition (§2). It is a second discipline, built on purpose if at all. |
| A second runtime or Player for Live | Refused. One runtime gains events and rate. |
| Events on a timer, or events that describe the reader | Refused (§4). |
| A host-provided venue for Live (a card) | Refused. Composer is the host product; Live owns its venue. |
| Model-emitted HTML or UI | Refused, as VISION §5 (amended 2026-10-09) says: only sandboxed scene modules execute. |
| Shared inference for the demo | Refused. The mock adapter is the demo. |
| A persona that hides the model (added 2026-10-10) | Refused (§1, item 7). RISE is a voice, not a disguise; `origin`, About and a plain answer name the model. |
| An illustrator that speaks, or that runs outside the one runtime (added 2026-10-10) | Refused (§6.2). It returns scene material through the same admission; the conductor places it; one clock. |

## 8. The order to build it in

Each stage leaves something true and demonstrable if the next never comes.

1. **The clock decision recorded** (this document, accepted by the owner). Adapter capability `speaks: 'host'` named; the realtime audio path stays off.
2. **The venue slice.** The `/live` page on the Reader site with the mock adapter and one real text provider on the reader's own credential: the **OpenRouter text-stream adapter** (new; the in-memory token flow the site already has), with the Gemini and OpenAI adapters behind a typed, in-memory provider key for readers who have one (§5). The microphone, RISE's voice, the instrument. Verify the Gemini and OpenAI adapters against the real services once (they were built against conformance fakes). *A week; the first time Live can be felt.*
3. **Beats streamed.** The line format and the adapter emit v2 beats; holds and scenes arrive in time. The eval corpus gains streamed cases.
4. **Perception v1.** The seven events of §4 go up with the reader's next words; the guide teaches the model what they mean. The persona lands here: the Live system prompt says *You are RISE*, with the honesty rule (§1, items 6 and 7). Measure: does a model change what it says when told the reader replayed?
4.5. **The interjection** (§6.1, added 2026-10-10). The reader speaks mid-reading; the voice holds at the phrase; the question goes up with the room; RISE answers inside the room and resumes, replaces or ends. The first moment it feels like talking to RISE. Measure: last word to first word; no two voices; the head where the reader expects.
5. **The model changes the room.** Mid-reading `visual.control` / `look.change` / `scene.cue` events admitted and applied at phrase boundaries; the "one visual, one phrase, one second" demonstration.
5.5. **The illustrator** (§6.2, added 2026-10-10). A second role on the reader's key draws what the composer asks for, climbing the cheapest medium first (engine cue, figure, code scene), through the same admission, while the voice goes on. Measure: request-to-picture per medium; repair rate; the voice never waits.
6. **Interactive scenes.** `rise.input` into the worker; `scene.input` out; a widget set in `rise.lib`; the neural-network page of VISION §2.5.
7. **A better voice under the same clock.** A provider TTS renderer with word timestamps on the reader's key, as a sibling of the browser voice.
8. **Later, if wanted:** the second clock discipline (§2.3) as its own posture.

## 9. What could make this wrong

- **Latency.** Text first-token plus voice start may feel slow beside a native-audio model answering in half a second. Stage 2 measures it; if the gap is the feeling, stage 7 (provider TTS, streaming audio with timestamps) is the answer before stage 8 is.
- **The adapters may have rotted.** Built against fakes in 2026-09, unverified since. Stage 2 verifies them first.
- **Perception may not change what a model says.** Stage 4 is an experiment, measured, not assumed.
- **Scope.** Eight stages is months for one owner and one coordinator. Stage 2 alone is the product's proof; everything after it is additive.

## 10. Check against the operating principles

- *Every requirement questioned:* the second clock discipline is the thing deleted from the first edition; a widget catalog as a second format is deleted in favour of a widget set inside the one scene pipeline; a Live card is deleted.
- *Every layer earns its place:* nothing new below the runtime; the venue, events and rate are additions to one pipeline.
- *Fundamentals before details:* the clock decision precedes any adapter work.
- *Verified by something that ran:* nothing here has; §3 is measured against the tree, and §8 names what each stage proves.
- *Flawless for the reader and the next contributor:* the reader keeps every control they have; the next contributor gets one runtime and one rule.
