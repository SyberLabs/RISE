# Voice hardening 2: findings

Researched on 2026-10-08 against `main` at **681ccaaa**. The main folder moved from 4d5a7c5d to 681ccaaa during the work (#528, #529). All line numbers below are for 681ccaaa. Nothing in the repository was edited.

Labels used on every claim:

- **[code]**: verified in code by reading it.
- **[run]**: verified by running the real modules in the scratch simulation (method below).
- **[doc]**: documented platform behaviour, with a link. Where the link is Chromium source, the claim was read in that source.
- **[hyp]**: hypothesis, not verified.

## 0. Summary (bad news first)

1. **Defect 1 is reproduced deterministically.** [run] Every route to it funnels through one amplifier. The speech governor stands down once, for good (`voice-did-not-start`, speech-governor.js:137). From then on the Player paces atoms by their authored reading durations, about 38 ms per character in this fixture against about 65 ms per character for speech (speech-governor.js:107 returns `undefined` once degraded). Meanwhile the voice keeps saying its queue. Result: the visuals finish 15 to 25 s before the voice.

   Three triggers make the governor stand down falsely after Pause and Play. All three are reproduced:
   - (a) The voice rewinds further back than the screen. The screen then reaches the next passage while the voice is audibly finishing the previous one.
   - (b) After a slow re-start, the Player's speech watchdog and the governor both advance the same atom (a double advance).
   - (c) The voice is taken by an outside `cancel()`.
2. **Defect 2: no handler reachable from the band drag touches the Player, the voice or `speechSynthesis`.** [code] The full audit is in §3.1. The symptom ("the voice cuts out, then has trouble coming back") is reproduced exactly [run] by two platform events that the code does not handle:
   - an outside interruption of the current utterance (any page's or extension's cancel is browser-wide in Chromium [doc]), which browser.js:137 swallows silently;
   - a network-voice utterance that never reports.

   In both, the screen runs on in silence and stands down at the next passage. Pause and Play then bring the voice back from a stale place, passages behind the words. The drag is most likely coincidence [hyp]. §3.3 gives a cheap trace check that separates the two.
3. **The minimal fix set is five small changes**, all exercised in the simulation [run]:
   - B: one line in player.js.
   - C2: about four lines in speech-governor.js plus a two-line `speakingId()` in browser.js.
   - D: one line in speech-governor.js.
   - F′: about ten lines in browser.js and runtime.js.
   - H: one line in speech-governor.js.

   Across 7 voice models × ~350 pause points, B+C2+D takes stand-downs from 103 to 0. B+C2+D+F′ takes outside-cancel stand-downs from 29/80 to 0/80. H alone shrinks the worst divergence from 25.6 s to the normal ending (§2.5).

### Method (what "[run]" means)

`scratchpad/sim.mjs` runs the repository's own `createLiveRuntime`, `Player`, `createSpeechGovernor`, `createBeatConductor`, `createBrowserVoice` and `createMcpAppAdapter` on the field fixture (`SKY_PREMIUM_EDUCATIONAL`, 17 beats, which compiles to 45 atoms). One virtual clock drives `setTimeout`, `requestAnimationFrame`, `performance.now` and `Date.now`. The speech device is the repository's `src/test/fake-speech.js`, wrapped to model:

- a Google network voice: no boundaries, sentence-chunked by the voice's name, 400 to 900 ms start latency;
- an Edge Natural voice: no boundaries, whole passage;
- a local SAPI voice: boundaries;
- a late first start after a cancel;
- an utterance that is dropped or stalls;
- an outside `cancel()`.

It sweeps a 2 s Pause/Play through the reading every 250 ms. Candidate fixes were applied only to a scratch copy (`scratchpad/src-fix/`, via `patch.mjs`). These are fake devices: the results prove mechanisms, not field rates.

## 1. Platform behaviour, and what the code already handles

| # | Behaviour | Evidence | Handled? |
|---|---|---|---|
| P1 | **`cancel()` then a quick `speak()`.** In Chromium the renderer clears its own queue and sends `Cancel`. A following `speak()` starts at once. The cancelled utterance's `interrupted` arrives later and is fired on the old object. | [doc] Blink `SpeechSynthesis::cancel` / `HandleSpeakingCompleted` ([speech_synthesis.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/speech/speech_synthesis.cc)) | Yes [code]: browser.js ignores events from any utterance it no longer holds (`item.utterance !== utterance`, lines 99/107/115/136). |
| P1′ | **Utterance dropped right after `cancel()`.** Safari drops `start`/`end`/`boundary` on utterances queued right after `cancel()`. Chrome 135 (Google voice) had "voice does not start the first time" after cancel, called "another issue" in the report. The events half of that report was fixed. | [doc] [WebKit 238189](https://auto-bugs.webkit.org/show_bug.cgi?id=238189); [crbug 409717085](https://issues.chromium.org/issues/409717085), fixed by [CL 6492822](https://chromium-review.googlesource.com/c/chromium/src/+/6492822), merged 2025-04-28 | Partly. RISE re-speaks seconds after its own cancel (Pause→Play), not immediately. A start that never comes is not retried. A retry was tested and rejected (§2.6). |
| P2 | **The paused flag is shared across all pages.** `TtsControllerImpl::paused_` is browser-wide. Blink `resume()` returns early when the page has no current utterance. `Stop()` clears `paused_`. | [doc] [tts_controller_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/speech/tts_controller_impl.cc) `Pause`/`Resume`/`StopCurrentUtteranceIfMatches`; Blink `resume()` | Yes [code]: never calls `pause()`. It cancels on hold (browser.js:191) and on creation (browser.js:71). The header claim is correct. |
| P3 | **`onboundary` for network voices, and after `resume()`.** Chrome's Google voices come from the "Google Network Speech" component extension. Its manifest declares `event_types: ["start","end","error"]`: no word boundaries, ever. `start` is sent at the audio element's `canplaythrough`, so after a network fetch. The spec only requires boundary events "if the speech synthesis engine provides the event". | [doc] [network_speech_synthesis/mv3/manifest.json, tts_extension.js, audio.js](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/resources/network_speech_synthesis/mv3/); [Web Speech API](https://webaudio.github.io/web-speech-api/) | Yes [code]: `wordMarks` only for `localService` voices (browser.js:156). Google voices get synthetic marks at sentence ends (browser.js:120-124). `resume()` is never used. Whether Edge Natural voices omit boundaries is [hyp]: browser.js and its tests assert it, but I found no source. |
| P4 | **Google voices cut off at about 14-15 s.** The bug is long-standing and still reported in Nov 2025. | [doc] [Caktus, "The Halting Problem" (2025-11)](https://www.caktusgroup.com/blog/2025/11/03/the-halting-problem/), [crbug 332002367](https://issues.chromium.org/issues/332002367) | Yes [code]: sentence chunks of at most 180 characters (browser.js:40, 50-66, 89). The margin is thin for slow voices (QoL 11). |
| P5 | **`speaking`/`pending` get stuck.** Blink's `speaking` means "the renderer queue is non-empty". The queue pops only when the platform reports completion. Two verified ways completion never comes: (a) the network engine has no `error` listener on its audio element, so a failed or blocked synthesis fetch reports nothing; (b) a muted tab: `SpeechSynthesisImpl::Speak` returns early when `IsAudioMuted()`, sending no event at all. Every later `speak()` from that page queues behind the stuck one until `cancel()`. | [doc] Blink speech_synthesis.cc `speaking()`/`HandleSpeakingCompleted`; [audio.js](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/resources/network_speech_synthesis/mv3/audio.js) (only `canplaythrough` and `ended` listeners); [speech_synthesis_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/speech/speech_synthesis_impl.cc) `Speak` | **No.** Nothing notices a stalled utterance. The governor eventually stands down (§3). |
| P6 | **Utterances garbage-collected while queued.** Blink traces `utterance_queue_`, so queued and speaking utterances are kept alive. | [doc] Blink speech_synthesis.cc `Trace` | Yes [code]: browser.js also holds `item.utterance`. |
| P7 | **Focus loss and pointer capture.** Nothing in `TtsControllerImpl` or Blink `SpeechSynthesis` reacts to focus or pointer capture. A document's visibility follows its top-level traversable, so an iframe is hidden only when the tab is. The controller stops speech on hide only when `stop_speaking_when_hidden_` is set. I did not verify whether desktop Chrome sets it. | [doc] [HTML: page visibility](https://html.spec.whatwg.org/multipage/interaction.html#page-visibility); tts_controller_impl.cc `OnVisibilityChanged`/`ShouldSpeakUtterance` | Yes [code]: the Player auto-pauses on `visibilitychange` (player.js:378-388). A drag cannot make the frame hidden. |
| P8 | **Iframes, with or without `allow-same-origin`.** Blink speech has no origin check. `speak()` needs autoplay permission: sticky user activation on the frame itself, or on an ancestor only if the autoplay permissions policy is delegated. Otherwise it fires `error: 'not-allowed'`. | [doc] Blink `IsAllowedToStartByAutoplay`; [autoplay_policy.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/html/media/autoplay_policy.cc) `IsDocumentAllowedToPlay` | Yes [code]: the card's own Play press gives the frame activation. `not-allowed` goes to `report.fail`, which stands the governor down (browser.js:138-141, runtime.js `fail`). In claude.ai the card frame has `allow-same-origin` (memory: measured LIVE-014). An opaque origin would not block speech. |
| **P9** | **`cancel()` from any page stops everyone's speech.** `SpeechSynthesisImpl::Cancel()` calls `TtsController::Stop()` with no URL. That stops the current utterance whoever spoke it and clears the whole browser queue. Any extension's `chrome.tts.speak` with the default `enqueue: false` also calls `Stop()` (`SpeakOrEnqueue`). The page that was speaking gets `error: 'interrupted'`. | [doc] speech_synthesis_impl.cc `Cancel`; tts_controller_impl.cc `SpeakOrEnqueue`/`StopCurrentUtteranceIfMatches` | **No.** browser.js:137 returns silently on `interrupted`/`canceled`, even for the utterance it still holds. RISE itself causes this for other cards and tabs: the constructor `cancel()` (browser.js:71) runs at every Play / Play again. |
| P10 | **The Google engine's lifecycle.** The engine is an MV3 service worker plus an offscreen document (`USER_MEDIA`, no automatic lifetime limit). It closes the document 30 s after the last stop or end, so the next `speak()` rebuilds it (`loading_` → `maybeCreateOffscreenDocument_` → `loaded`). The service worker is killed after 30 s idle, and its timers die with it. | [doc] tts_extension.js; [offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen); [SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | **No allowance.** A Play after a pause longer than 30 s pays a cold start. [hyp]: if the worker is killed before its own 30 s close timer fires, the document survives and the new worker's `loading_` stays `true`. The first `speak()` would then never start (no `loaded` message is sent again) until a later stop plus 30 s. Read in source only, not seen in a running Chrome. |

## 2. Defect 1: after Pause then Play, the words and the voice part, and the visuals end while the voice is still speaking

### 2.1 The amplifier (common to every route)

- [code] `degrade()` is one way (speech-governor.js:163-167; the header at lines 36-40 says so). Once degraded, `estimate()` returns `undefined` (line 107), so `Player._atomDisplayMs` uses `atom.duration * speedFactor` (player.js:269-272). These are the compile-time reading durations, for example 2156 ms for a 56-character atom. `complete()` returns `null` (line 119), so atoms run on the Player's timer.
- [code] The voice is unaffected by a stand-down. It keeps its queue. Passages after a hold (`voiceWaitsFor`) are enqueued when the screen reaches them (runtime.js:256-268, 271-281), so a voice that is behind says them back to back, through the holds.
- [run] The baseline without a pause is: visual done 86.2 s, voice done 82.1 s, no stand-down. One stand-down at about 9 s gives: visual done 58.2 s, voice done 73.6 s. The visuals end 15.3 s before the voice. At 75 ms per character the gap is 25.6 s.

### 2.2 Most likely route: the voice is moved back, the screen is not, and the next passage boundary stands the clock down

Sequence [code], reproduced [run] (`node sim.mjs trace google 3000 2000`):

1. Pause comes from stage-controls.js:274-278, then `runtime.interrupt()` (runtime.js:449), then `player.pause()`. That emits `state: paused` (player.js:528), and runtime.js:284 calls `holdVoice`.
2. In `holdVoice` (runtime.js:548-554), `restartPoint(index)` returns `null` when the voice's speed is not yet known (speech-governor.js:238: no marks, no duration, `learned.chars === 0`). That is the whole first passage for a Google or Natural voice. It also returns `null` on a seam or once degraded (line 234). It is skipped during a flash (`betweenPhrases`). And `hold()` returns `false` whenever the voice is in another segment than the screen (browser.js:195).
3. `voice.hold()` with no place sets `current.played = current.lastMarkAt` (browser.js:189). It cancels, and on release says the segment again from `lastMark` (browser.js:205): the sentence start for a Google voice, the passage start for a Natural voice. It returns `false`, so `restartCurrentAtom()` is **not** called.
4. On Play, `isResuming` is true (player.js:474). The governor is not asked for a resumed atom (player.js:1026; the governor's header at lines 42-45 says so). So the paused atom finishes on the Player's timer while the voice re-says from further back.
5. The screen crosses into the next passage. In the fixture that means seam → hold (1.5 s, conductor-timed) → seam 3, waiting for `beat-2`. `complete()` waits for `playedMs('beat-2')`. The voice is still audibly re-saying `beat-0`, but `graceMs` is 1500 (speech-governor.js:124) and is counted from when the screen began waiting. At 9019 ms: `voice-did-not-start`. The voice starts `beat-2` 226 ms later. It was busy, not absent.

Trace signature in the new `[RISE voice]` console lines (voice-trace.js, LiveHost.js:423):

- `voice.held … restarts=false` with no `resumeAt`;
- then `voice.released`;
- then `voice.degraded reason=voice-did-not-start`;
- then `speech.end` of the *previous* passage and `speech.start` of the awaited one, both under about 2 s after the stand-down.

Rate [run]: 4 of 343 pause points at 65 ms/char and 400 ms latency; 9-10 of 379 at 75 ms/char or 900 ms latency; 9 of 356 for a Natural voice. All are in the first passage (the first 2-4 s), which is a likely place for a reader to try Pause. A local voice with boundaries had 0 of 357.

### 2.3 Second route: a slow start after Play, then a double advance

Sequence [code], reproduced [run] (`node sim.mjs trace google 58000 2000 '{"lateStartMs":3000}'`):

1. The pause lands mid-passage, the voice and the screen take up at the phrase together (`restarts=true`), and the utterance starts late. Per P10, a Google voice after a pause of more than 30 s rebuilds its offscreen document before fetching. `playedMs` stays frozen until `onstart` (browser.js:86, 96).
2. The Player's speech watchdog fires at the estimate plus 2500 ms (player.js:150, 1062-1070). It calls `scheduleNextAtom(true)`, which puts the atom on an rAF timer for its full budget again (player.js:1099-1120).
3. The voice then reaches the atom's end. The governor resolves `ended`, and the `.then` at player.js:1084 sets `this.timerId = null` **without `cancelAnimationFrame`**, then calls `processNextNode()`. The stale rAF loop keeps running and calls `processNextNode()` a second time when its own target passes. **The next atom is cut short.**
   - [run] In isolation (`scratchpad/double-advance.mjs`, Player alone), atom 1 is shown for 512 ms instead of its governed 1000 ms. With fix B, 1000 ms.
4. The screen now reaches a seam while the voice is still on the earlier atom. It stands down as in §2.2.

Trace signature:

- `voice.held … restarts=true`, then `voice.released`;
- then no audible start for more than 2.5 s. Note that this is **invisible** in the journal: a segment's `speech.start` is reported once, and a re-spoken segment reports none;
- with `?measure=1`, `__riseLive.atoms()` shows two atom entries about 500 ms apart shortly after the release;
- then `voice.degraded`.

Rate [run]: 28/343 at 2 s late, 43/343 at 3 s, 104/343 at 4 s.

### 2.4 What distinguishes the two routes

| Signal | §2.2 rewind | §2.3 late start |
|---|---|---|
| `voice.held` | `restarts=false`, no `resumeAt` | `restarts=true` with `resumeAt=N` |
| Where the pause was | first passage, a seam, a hold, a flash, or straddling two passages | anywhere, typically after a pause of more than 30 s |
| Atom log after release | the paused atom ends on time, the next passage boundary waits about 1.5 s | an atom shown for well under its time (about 500 ms) |
| Time from `voice.degraded` to the next `speech.start` | under about 2 s (the voice was busy) | about 0.5-2 s |

### 2.5 Minimal fix, and the tests that hold it

Exact diffs are in `scratchpad/candidate.diff`.

- **C2: bounded grace for a voice that is still speaking** (speech-governor.js `complete()`, plus `speakingId()` in browser.js; about 6 lines).
  - What it does: a passage the voice has not begun is owed the grace from when the voice *should have finished what it is still saying*, not from when the screen began waiting. `owed = charTime(still, len) − playedMs(still)`, computed once per wait. It is bounded, so a voice that starts and never ends still stands down. [run] Stall tests: stand-down at 23.9 s instead of 22.0 s, reading completes.
  - Test (speech-governor.test.js, browser voice on `createFakeSpeech({ boundaries: false })`, Google voice name, 3 segments): "a pause in the first passage of a voice whose speed is not known does not stand the clock down: the next passage waits until the voice has said this one again". Assert no `degraded`, and that segment 2's first atom is shown within 100 ms of the voice starting segment 2. A second test: "a voice that began a passage and never ends it still stands the clock down, once its owed time and the grace have passed".
- **D: cold grace after a hold** (speech-governor.js `install`; one line: `if (state === 'paused') begun = false;`).
  - What it does: a held voice is cancelled and spoken again, and a network engine may have shut down meanwhile (P10). The first start after a hold gets `firstGraceMs` (4 s), like the first start of the reading.
  - Test: extend `src/test/fake-speech.js` with `latencyAfterCancelMs`: the first utterance after a `cancel()` that stopped speech starts that much later. The test: "after a hold, a voice that takes 3 s to start again is waited for, as a cold engine is".
- **B: one advance per atom** (player.js:1084; one line: `if (this.timerId) cancelAnimationFrame(this.timerId);`).
  - What it does: whichever of the watchdog's timer and the governor's end comes second is ignored.
  - Test (player.govern.test.js, fake timers): a governor whose completion for atom 0 resolves 500 ms after the watchdog fired. Assert atom 1 is shown for its own governed time, and every atom is emitted exactly once in order.
- **H: speech pace after a stand-down** (speech-governor.js:107; one line: drop `degraded ||`).
  - What it does: after a stand-down the words go on at the voice's learned speed, not at silent-reading speed. This matches the product's own sentence: "paced as if it were spoken" (capabilities.js:76).
  - Test: "once stood down, each atom lasts as long as the voice's speed says, not its authored duration". The existing test "does not make each atom wait for the grace once it has stood down" (speech-governor.test.js:162) bounds by authored durations. It must be restated as "no grace per atom" with a speech-pace bound [hyp: it would fail as written].

Results [run] across 7 voice models × about 350 pause points:

| Fixes | Runs with a stand-down (sum over 7 models) | Worst voice-after-visual |
|---|---|---|
| none | 103 | **+25.6 s** |
| H | 103 | +0.45 s |
| C2 + D | 0 | −0.8 s (one double advance left) |
| **B + C2 + D (+H)** | **0** | −4.1 s (the baseline: the closing shown beat outlasts the voice) |

### 2.6 Considered and not recommended

- **A: let the first passage take up at the phrase with a guessed time**, and exclude that passage from speed learning.
  - It fixes the repetition, not the desync, once C2 is in.
  - It reverses a recorded choice (test "says nothing while it has no idea how fast the voice goes" at speech-governor.test.js:213, and dive-voice.test.js:191).
  - **The owner should decide.**
- **E: a start watchdog that re-speaks an utterance that never started.** It cures a dropped utterance (239 → 0 of 343). But it makes a merely slow start worse: at 3 s late, 0 → 21 failures, because the retry cancels a start that was coming. Recommend it only if a field trace shows a `speak` that never starts (§3.3 check).
- **Always calling `restartCurrentAtom()` after a hold** would re-show the phrase while the voice re-says from further back. C2 makes this unnecessary.

## 3. Defect 2: dragging the text band cuts the voice out, and it comes back badly

### 3.1 Every handler a press or drag on the band can reach [code]

| Listener | File:line | Effect |
|---|---|---|
| `#atom-display` `pointerdown` → `onDown` | Chamber.js:4784-4797 | The first press sets the class (`setBandMovable(true)`). A later press records the start and calls `setPointerCapture`. |
| `#atom-display` `pointermove` → `onMove` | Chamber.js:4799-4811 | `applyBandOffset()` (Chamber.js:4861-4885): sets `--band-offset` (a `transform: translateY`, Chamber.css) and calls `fitMask?.sync()` (a no-op without Fit). `preventDefault()`. |
| `#atom-display` `pointerup`/`pointercancel` → `onUp` | Chamber.js:4813-4819 | Releases capture. `writeBandOffsetSetting` → `onSettingsChange('bandOffset')` → app.js `handleSettingsTransaction`: localStorage only (`bandOffset` is in none of the apply lists, app.js:1053-1071). |
| container `pointerdown` (capture) → `onDismiss` | Chamber.js:4822-4834 | `setBandMovable(false)` when the press is outside the band. |
| document `keydown` → `onKey` | Chamber.js:4826-4835 | Escape → `setBandMovable(false)`. |
| `#chamber-display` `mousemove`/`pointerdown` (touch) | Chamber.js:1353-1357 | `showControls()` returns at once: chromeless has no `#chamber-controls` (Chamber.js:649). |
| window `resize` → `_bandResize` | Chamber.js:4847-4851 | Layout only. |
| stage `pointerdown` → `outside` | stage-controls.js:229-236 | Bound only while Settings is open. Closes the sheet. |
| window `mousedown` → `initAudio` | app.js:348-405 | Web Audio unlock. Already spent by the Play press. No speech. |

- Everything that can pause the Player in the card is: stage Play/Pause (`runtime.interrupt`/`resume`), the Player's own `visibilitychange` (player.js:378), `runtime.dive` (no Dive in the embed), and `Chamber.exitSession`/`_holdReading`/keyboard Space. The last group is not reachable: chromeless renders no control bar, binds no keyboard handler (Chamber.js:5244), and Escape returns early (Chamber.js:5015).
- The only code that touches `speechSynthesis` is browser.js:71, 143, 191 and 221, and LiveHost.js:535-536/655 (`getVoices` via `whenVoicesAvailable`).
- **No handler reachable from the band drag touches the Player, the voice or the engine.** [code] By the HTML spec, the frame cannot become hidden while its tab is visible, so the Player's visibility handler is ruled out [doc] (P7).

### 3.2 Most likely mechanism: the utterance is taken from outside, or stalls, and the code turns that into a lasting desync

Sequence [code], reproduced [run] (`node sim.mjs trace google 45000 1000 '{"externalAt":33000}'`):

1. Something stops RISE's current utterance from outside. Possible sources:
   - another page's or frame's `cancel()`: another RISE card's Play, which runs the constructor `cancel()` at browser.js:71; another card's hold while it is speaking; or the host page;
   - an extension's `chrome.tts.speak`;
   - Chrome's reading-mode read-aloud.

   All are browser-wide (P9) [doc]. Alternatively the Google engine never reports (a failed fetch, a muted tab: P5) [doc].
2. browser.js:137 returns on `interrupted`/`canceled` without clearing `item.utterance` or `item.startedAt`. So `playedNow()` keeps counting wall time (browser.js:86). The governor believes the voice is talking, and the words keep moving **in silence**. **Nothing is written to the journal** at that moment.
3. The voice's `current` never ends, so the next passage is never spoken. At the next seam, `playedMs(next)` is `undefined` → after 1.5 s, `voice.degraded reason=voice-did-not-start`. The amplifier (§2.1) takes over.
4. The reader presses Pause, then Play. `restartPoint` returns `null` because the governor is degraded (speech-governor.js:234). `hold()` rewinds the stuck segment to its `lastMark` (browser.js:189), and release says it again (browser.js:205). [run] In the trace the voice comes back saying `beat-7` while the screen is on `beat-10`/`beat-11`, three passages behind. It ends 18.3 s after the visuals: **"trouble with it coming back"**.

Rate [run]: an outside cancel at each second of the reading, with Play 3 s later, ends degraded in 29 of 80 cases. With no Play, it ends degraded in 58 of 80 (in the rest, the cancel fell in a silent hold).

The drag is most likely coincidence [hyp]. Three reasons it might not be:

- (a) **The band's text is selectable** [code]. `.atom-display` has no `user-select: none` (Chamber.css:355-391), and `onDown` does not `preventDefault`. A mouse drag therefore selects the phrase. A selection can trigger a read-aloud extension or Chrome reading mode, which calls `Stop()` browser-wide [hyp].
- (b) **A second press on a selection can start a native text drag.** The browser then sends `pointercancel` [hyp].
- (c) **Main-thread work during the drag could delay `onend` → `speak(next sentence)`**, lengthening the network gap between Google sentences [hyp, low: the move is a transform plus a no-op mask sync].

### 3.3 Second most likely, and the trace check that tells them apart

The second most likely is a Google network stall (P5): no `start` or `end` for a sentence. Its journal signature is identical to §3.2. To tell them apart, in DevTools select the card frame's context (`claudemcpcontent.com` in the context menu) at the moment the voice goes silent:

| Check | Outside interruption | Network stall or muted tab |
|---|---|---|
| `speechSynthesis.speaking` | `false`: Blink popped the interrupted utterance (`HandleSpeakingCompleted`) | `true`: the queue front never completes |
| Wrap `speechSynthesis.cancel` in the **top** frame and in the card frame with `console.trace` | shows the caller, if it is a page | nothing |
| Tab muted (speaker icon on the tab) | — | yes in the muted case |
| `[RISE voice]` after the fix F′ | `voice.taken reason=interrupted` | nothing; with the instrumentation in §3.5, a `speak` with no start |

### 3.4 Minimal fix for defect 2, and its test

- **F′: an utterance taken from outside holds the reading, visibly** (browser.js:137, plus a `taken` callback in runtime.js `attachVoice`; about 10 lines).
  - Why it is safe: this voice always lets go of its utterance *before* it cancels (browser.js:188, 219). So `interrupted`/`canceled` on the utterance it still holds was done to it from outside [code].
  - What it does: clear `item.utterance`, rewind `played` to `lastMarkAt`, report `taken`. The runtime notes `voice.taken`, pauses the Player and sets `interrupted`, so the stage shows Play. On Play the voice and the phrase take up together through the normal `resumeAt` path. It does not cancel again, so it never silences whoever took the device.
  - [run]: 29/80 → 1/80 alone, 0/80 with B+C2+D. In the trace, Play re-shows atom 18 and the voice re-says `beat-7` from its start, in step.
  - Why not re-speak automatically (variant F, also run: 58/80 → 2/80): if the outside cancel was another card or tab starting to speak, an automatic re-speak queues behind it in the browser-wide queue (`SpeakOrEnqueue` enqueues when another utterance is speaking) [doc]. The two readings would then alternate.
  - Tests: (browser.test.js, shared-engine fake) "an utterance cancelled from outside is reported as taken once, and holding afterwards does not cancel the device again". (runtime test, fake speech) "a voice taken from outside holds the reading where it is; Play takes up the phrase on screen with the voice; the journal says `voice.taken` and nothing stands down".
- **Recovery after a stand-down** (not minimal; for the owner): today Pause/Play can never re-tie a degraded reading (QoL 3). A real fix needs either a seek in the voice or rebuilding the voice at the screen's passage.

### 3.5 Instrumentation worth landing with the fixes

These are cheap, and they decide between the hypotheses on the next field run:

- `voice.taken` (F′).
- One note per re-speak start with its latency, for example `speech.resumed segmentId charIndex startedAfterMs`, so a late or missing start after Play is visible.
- The chosen voice's name on the first `speech.start`. A "Microsoft … (Natural)" voice means Edge or an adapter: Chrome on Windows lists none, so `chooseVoice` picks "Google US English" there (browser.test.js CHROME list) [code].

## 4. Quality-of-life defects in the card's voice and playback path

Each is one line; the label is the evidence.

1. The voice outlives the end: on `complete` nothing waits for the voice or stops it, so the stage shows "Play again" while speech continues (runtime.js:286-291, stage-controls.js:108-113). [code]
2. A stand-down is invisible to sighted readers: only the hidden live region changes (stage-controls.js:126-136). [code]
3. Pause and Play can never re-tie a degraded reading: `restartPoint` is `null` once degraded (speech-governor.js:234), and the voice takes up at its own stale mark (browser.js:189, 205). [code] [run]
4. A Google voice is fetched sentence by sentence, so the reader hears a network gap inside every passage at each sentence. The Chromium engine fetches per utterance and starts at `canplaythrough` (browser.js:89; tts_extension.js). [code] [doc]
5. A pause in the first passage of a voice without boundaries makes it say the whole passage again (speech-governor.js:238, browser.js:189), by design, but felt as a repeat. [code]
6. A muted tab drops every `speak()` silently and leaves the page's speech queue stuck; unmuting does not bring the voice back until Pause and Play (P5; browser.js has no stall check). [doc] [code]
7. Pressing Play on one RISE card silences any other card or tab that is speaking (browser.js:71, P9). The silenced card then runs on in silence (browser.js:137). [code] [doc]
8. Sentence-level starts and ends are not journaled (one `speech.start` per passage, browser.js:101-104), so the voice trace cannot show a late or missing start. [code]
9. `voice.released` is written after every flash, because the Player emits `playing` when an interlocution ends, although nothing was held (runtime.js:285; player.js:865). This is noise in the trace. [code]
10. The band's text is selectable by a mouse drag (no `user-select: none` on `.atom-display`, Chamber.css:355-391; no `preventDefault` in `onDown`, Chamber.js:4784). A second press on the selection can start a native text drag instead of a move. [code] / effect [hyp]
11. The 180-character utterance cap (browser.js:40) is about 12-14 s at Google's pace, close to the ~14-15 s cutoff for slow speakers or `rate` below 1. [hyp]
12. After a stand-down, the passages after each hold are handed to a voice that is behind and said back to back, so the reader loses the silences the beats asked for (runtime.js:256-268). [code] [run] (the voice finished 8.6 s *earlier* than the baseline)
13. `firstGraceMs` is 4000 (speech-governor.js:54). A cold Google engine in a fresh frame (service-worker start + offscreen document + fetch, P10) may exceed it, standing the whole reading down at its first words with no pause at all. [hyp] (check for `voice.degraded` at t < 5 s)
14. The Player's speech watchdog (2.5 s past the estimate, player.js:150) was tuned for Recitation audio. With the speech governor it fires on any late start and is what arms the double advance (§2.3). [code] [run]

## 5. Check before finishing (AGENTS.md §5)

- **Requirements questioned.**
  - "Degrade one way" survives: a reading that stops is worse. What was wrong is its false positives (C2, D) and its fallback pace (H).
  - "Re-speak after an outside cancel" was deleted in favour of holding visibly (F′).
  - The start retry (E) and "always restart the atom" were deleted.
  - A is left to the owner.
- **Every layer earns its place.** Five changes, each one to ten lines, each bound to one reproduced mechanism. None adds a dependency or a module.
- **Fundamentals before details.** The amplifier (§2.1) is fixed at its triggers and at its pace. The platform facts are read from Chromium source, not from blog lore.
- **Verified by something that ran.**
  - Every mechanism and every fix figure above came from the scratch simulation, which runs the repository's real modules.
  - **Not verified:** any real Chrome or claude.ai behaviour. No repository test was run against the patched copy, so the claim that the governor test at line 162 would fail under H is [hyp]. The P10 service-worker race is not verified. Nor is any link between the drag and an outside cancel.
  - The field rates depend on real voice latency, which only a field trace with the §3.5 notes can give.
- **The next contributor.**
  - The fake device needs two small options (`latencyAfterCancelMs`, outside `cancel`) so that each test above is deterministic.
  - The scratch harness shows the shape: `scratchpad/sim.mjs` and `scratchpad/double-advance.mjs`.

## 6. Where the fixes landed

The fixes B, C2, D, H and F′, the seam restarted on a pause between passages, the band that selects nothing while movable, and the reading that ends when the voice has, are the three commits of the pull request "Voice hardening 2" (branch `voice-hardening-2`), each with the test that reproduces its mechanism on the fake speech device, and `src/live/voice-sync.sweep.test.js`, the pause sweep from the simulation, kept as the regression guard.
