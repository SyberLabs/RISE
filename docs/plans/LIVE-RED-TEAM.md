# Red team of the live Current

**Status:** an adversarial review of the live layer as merged in [#319](https://github.com/SyberLabs/RISE/pull/319), on `main` at `c4e31ff`. It changes no production behaviour. Every confirmed defect below has a test that asserts the invariant and is marked as an expected failure (`it.fails` in [`src/live/red-team.test.js`](../../src/live/red-team.test.js), `test.fail()` in [`e2e/live-red-team.spec.js`](../../e2e/live-red-team.spec.js)). When a defect is fixed, its test starts failing and the fix removes the mark. Nothing here was tried against a real OpenAI session or a product MCP host.

The invariant under attack: *models, hosts, plugins, and providers may propose information and events; they must never directly mutate authoritative playback or runtime state outside the bounded operations RISE explicitly permits.*

## A. Executive assessment

**The protocol and reducer hold, but the runtime does not. Stop is not authoritative while an `await` is in flight, and the MCP host can claim a human author.**

- **The event boundary holds.** Hostile JSON, reordering, duplicates, conflicting sequence numbers, far-future gaps, prototype keys, and events after a terminal event were all refused within budget. Across 400 seeded hostile deliveries the reducer never threw, ended text never changed, and every lowering was a prefix of the next. One gap is real: `state.set` and `evidence.add` are still accepted for an ended segment, which the plan says is refused.
- **The runtime has four races, all the same bug.** `start`, `dive`, `surface`, and `stop` each await a provider or Player and then act without re-checking whether the reader pressed Stop meanwhile. In the browser, with OpenAI's transport faked, Stop pressed during connect still sends the question to the provider (billed to the reader's key) and presents the answer. This must be fixed before OpenAI Live is switched on.
- **The MCP host can forge who wrote an answer.** A Current or Dive answer from the host's model may carry `origin: { kind: 'human', name: 'Your teacher' }`. RISE then shows "From Your teacher." and compiles the program with `authority: 'user'`. Attribution is the one thing a reader may take as evidence, so this must be fixed before MCP is switched on.
- **The generic text stream parser has bounded-looking limits and several defects.** A line that starts with `@` is buffered without bound. A passage reaching 3,999 characters emits a blank chunk the reducer refuses. One large delta overflows the adapter's queue. One character per delta exhausts the 5,000-event cap inside every text limit. None of these affects the sealed or MCP paths. They matter for any line-format provider, OpenAI included.
- **`frame-ancestors *` is a deliberate risk, not a defect.** With `MCP_ENABLED`, any website can frame `/live?embed=mcp`, act as its host, and read every question the reader types or speaks. The browser test proves this. It is what an MCP app needs today, but it runs on RISE's primary origin.
- **OpenAI Realtime matches the documentation where the two can be compared.** The endpoint, the multipart shape, the event names, and the response statuses match. Three behaviours can only be settled by a real session, listed in §G.

Both flags are `"false"` in `wrangler.production.jsonc`, so none of this is reachable in production today.

## B. Trust boundary

```
 UNTRUSTED                               │ ADAPTER (per provider)          │ RISE (authoritative)
                                         │                                  │
 OpenAI Realtime ── oai-events JSON ────►│ openai-wire: names, response id, │
   (via Worker relay: key regex,         │   status → delta/done/error      │
    same-origin, SDP checks, no echo)    │ segment-parser: @lines → events  │
                                         │ text-stream: writer + channel(64)│
 Generic text provider ── deltas ───────►│   pushNow ≤ 128, else OVERFLOW   │
                                         │                                  │   validateEvent (closed catalog,
 MCP host (any parent frame) ─ JSON-RPC ►│ mcp-port: source === parent      │──► bounds, forbidden keys)
   tool input Current, sampling result   │ mcp-app: currentToEvents(current)│      │ (event is data from here)
                                         │   origin passed through ◄─ F-7   │      ▼
 Reader speech / typing ─── text ───────►│ closed grammar (Dive / Surface)  │   createCurrentStream (pure):
                                         │                                  │     seq window 16, refusals 8,
                                         │                                  │     5,000 events, 16×4,000 chars
                                         │                                  │      │ ended segments only
                                         │                                  │      ▼
                                         │                                  │   compileRiseCurrent → Session
                                         │                                  │      │ (authority from origin ◄ F-7)
                                         │                                  │      ▼
                                         │                                  │   runtime: start/dive/surface/stop
                                         │                                  │     (awaits unguarded ◄ F-1..F-4)
                                         │                                  │      ▼
                                         │                                  │   Player.extend / Chamber (one)
```

Authority changes hands twice. The first handover is at `validateEvent`: what came from a provider becomes a plain, bounded, closed-catalog value. The second is at the runtime, where the reducer's committed segments become a Session only RISE can present. Everything left of the reducer may propose. It may not reach the Player except through ended segments.

The breaks found are at three points. The origin of an MCP answer crosses unchanged and becomes authority (F-7). The runtime's awaits let a closed run act (F-1 to F-4). And `validateEvent` reads some fields twice, which is safe only while every producer is JSON or structured clone (F-9).

## C. Findings

Severity is the harm if the flag in question were switched on today: **High** means it breaks the invariant or the reader's trust in a way they would notice or be billed for; **Medium** means a correct answer fails or misleads; **Low** means a local defect with a bounded effect.

### Confirmed defects

**F-1 · High · CONFIRMED DEFECT: Stop during connect does not stop.**
- *Where:* `src/live/runtime.js` `start()`: `main = await openRun(...)` (line 286) with no `stopped` check after it. `LiveHost` shows Stop before `await runtime.start()`.
- *Reproduce:* unit test "Stop while the provider is still connecting"; browser test "DEFECT: Stop pressed while the OpenAI session is connecting".
- *Expected:* after Stop, no provider request, no Player, and the connection closed.
- *Observed:* status returns to `live`, a Player is created and presented, and the connection is never closed. In the browser, `response.create` is sent after Stop (`askedAfterStop: 1`) and the answer is shown. The peer closes only when the answer finishes.
- *Scenario:* the reader presses Stop because they asked the wrong question. The question is still sent, billed to their key, and the answer takes over the screen.
- *Smallest fix:* after each await in the runtime, `if (stopped) { await connection.close(); return; }`. Pass an `AbortSignal` from `stop()` into `adapter.open`, so the WebRTC transport can abandon the offer before the data channel opens.

**F-2 · High · CONFIRMED DEFECT: two Dives can open, and the first is orphaned.**
- *Where:* `runtime.js` `dive()` checks `if (side)` (line 331) before `side = await openRun(...)` (line 349). The Dive button stays enabled until the status becomes `diving`, which happens only after the open resolves (`controls.js` lines 208–209).
- *Reproduce:* unit test "two Dives asked before the first has opened".
- *Expected:* a second Dive is refused while one is opening (`NESTED_DIVE`).
- *Observed:* both open. The first is overwritten and never closed, and it keeps generating on the reader's key.
- *Smallest fix:* set a pending-Dive marker synchronously before the await and clear it on failure. Same re-check as F-1.

**F-3 · Medium · CONFIRMED DEFECT: Stop while a Dive is opening starts the Dive.**
- *Where:* `runtime.js` `dive()`: no `stopped` check after `openRun`.
- *Reproduce:* unit test "Stop while a Dive is still opening".
- *Observed:* status becomes `diving` after `stopped`, and the side run starts and is never closed.
- *Smallest fix:* the F-1 fix.

**F-4 · Medium · CONFIRMED DEFECT: Stop during Surface re-presents a destroyed Player.**
- *Where:* `runtime.js` `surface()`: `await closeRun(child)` (line 370), then presents the main Player and sets `live` without checking `stopped`.
- *Reproduce:* unit test "Stop during Surface" (`presentedAfterStop: 1`).
- *Observed:* the host is handed a Player that `stop()` already destroyed.
- *Smallest fix:* the F-1 fix.

**F-5 · Medium · CONFIRMED DEFECT: the text stream adapter's outcome depends on chunking.**
- *Where:* `src/live/adapters/text-stream.js` line 79: `pushNow` fails past twice the channel capacity (128 queued events), and the adapter ends with non-recoverable `OVERFLOW`.
- *Reproduce:* unit test "the same answer arriving in one delta overflows". A 200-line answer in one delta ends in phase `open` with nothing shown. The same answer line by line completes.
- *Expected:* the same words produce the same Current however they are chunked. The parser corpus proves this holds below the queue.
- *Scenario:* a provider or proxy that buffers and flushes (common with HTTP streaming) loses a long answer.
- *Smallest fix:* push from the parser with back-pressure (`await channel.push`) instead of `pushNow`, or coalesce the parser's output per delta into one `segment.text` per segment.

**F-6 · Low–Medium · CONFIRMED DEFECT: one character per delta exhausts the event cap.**
- *Where:* the parser emits one `segment.text` per non-empty delta, and `stream.js` caps a stream at 5,000 events.
- *Reproduce:* unit test "an answer within every text limit fails TOO_MANY_EVENTS" (three passages under 10,000 characters).
- *Smallest fix:* coalesce text per microtask in the adapter. Do not raise the cap: it bounds a hostile provider, not an honest one.

**F-7 · Medium · CONFIRMED DEFECT: the MCP host's model can present its words as a person's.**
- *Where:* `src/live/adapters/mcp-app.js` `accept` → `currentToEvents(current)` (line 120). `current-events.js` line 22 copies `current.origin` unchanged. `rise-current.js` line 197 derives `authority: 'user'` from a non-model origin. `host/passage.js` line 90 renders "From {who}.".
- *Reproduce:* unit test "a Dive written by the host's model can present itself as a human author"; browser test "DEFECT: the host's model can have its Dive shown to the reader as a person's words" (the passage reads "From Your teacher.").
- *Expected:* the origin of anything that arrives through the host says it came through the host. RISE cannot verify a claim of human authorship, so it must not display one.
- *Scenario:* a prompt-injected or careless host model attributes an answer to a teacher, a doctor, or the reader. RISE's own chrome then vouches for it, and the Session is marked as the user's rather than proposed.
- *Smallest fix:* in `mcp-app.js`, replace the incoming `origin` with `{ kind: 'model', name: 'Host model', provider: 'MCP host' }`, as `ensureOpen` already does. Keep the host's claimed name only as quoted, unverified text if it is wanted at all.

**F-8 · Low–Medium · CONFIRMED DEFECT: the line parser's `@` buffer is unbounded and rescanned.**
- *Where:* `src/live/adapters/segment-parser.js` line 192: `if (!midLine && buffer.startsWith('@')) return;`. The buffer waits for a newline with no limit and is searched again on every delta.
- *Reproduce:* unit test "a line that begins with @ is buffered without any bound". Pushing 32 MB grew the heap by about 146 MB, against an expected bound under 4 MB. In a probe, 64 MB grew it by 775 MB, and 40,000 one-character pushes took 47 ms, against 4 ms for a normal line: superlinear.
- *The hypothesis is proved.* The Current's text limits do not apply, because nothing has become text yet. With OpenAI the buffer is bounded only by the model's own maximum output, since the Worker sets no `max_output_tokens` (the documented default is `"inf"`). With a generic provider it is unbounded.
- *Smallest fix:* a header longer than a small cap (about 200 characters) is not a header. Treat the line as words, or drop it and count a refusal.

**F-9 · Low today, High with in-realm plugins · CONFIRMED DEFECT: `validateEvent` checks and copies separately.**
- *Where:* `src/live/protocol.js` `validateEvent` reads `visual`, `evidence.kind`, `origin.kind`, the interrupt reason, and `type` more than once.
- *Reproduce:* unit tests "an accessor can return a visual outside the closed catalog after it was checked" (`webgpu:any-shader`) and "an accessor can change an evidence kind between the check and the copy" (`javascript:alert(1)`).
- *Why Low today:* every current producer is `JSON.parse` output or a structured clone from `postMessage`, and neither can carry getters. An in-page plugin passing objects directly would get past the closed catalog.
- *Smallest fix:* snapshot the input once at entry (`structuredClone`, which drops accessors, or a JSON round trip). Alternatively, read each field once into a local and validate the local.

**F-10 · Low · CONFIRMED DEFECT: a passage reaching 3,999 characters sends a blank chunk.**
- *Where:* `segment-parser.js` `send` (lines 110–122). With one character of room left, the piece can be a single space, and the reducer refuses a blank `segment.text` (`EVENT_TEXT`).
- *Reproduce:* unit test "a passage that reaches 3,999 characters sends a blank chunk". The hostile-corpus fuzz found it.
- *Effect:* it spends one of eight refusals. A provider that writes long passages can exhaust the refusal budget and fail the Current.
- *Smallest fix:* skip pieces that are blank after trimming.

**F-11 · Low · CONFIRMED DEFECT: a trailing `[` plus up to five letters is lost or glued at `@end`.**
- *Where:* `segment-parser.js` `held` (lines 84, 139–144, 169). A possible playback marker is held back. At `@end` it is dropped, or it is prefixed to the next passage's first line.
- *Reproduce:* unit test "a line ending in "[" and up to five letters". The received text was "The index is xSee [noteand then more."
- *Smallest fix:* at `@end`, or at any line end, flush `held` as text into the segment it came from.

**F-12 · Low · CONFIRMED DEFECT: an ended segment's condition and sources can still change.**
- *Where:* `src/live/stream.js`: `state.set` and `evidence.add` have no `segment.ended` check (compare `segment.text` at line 157 and `dive.attach` at line 207). `LIVE-CURRENT.md` §3 says "An event for a finalised segment … is refused and counted."
- *Reproduce:* unit test "an ended segment's condition and sources can still be changed". The Chamber then adopts the changed visual program on the next extension.
- *Effect:* the words stay immutable (fuzzed), but the imagery and the sources shown for a passage the reader has already heard can change afterwards.
- *Smallest fix:* refuse both with `SEGMENT_CLOSED`, as `segment.text` is refused. The events spec's "lowering-affecting metadata" already covers this.

### Architectural risks

**R-1 · High if MCP is enabled · `frame-ancestors *` with an unauthenticated parent.**
- *Where:* `worker/mcp-server.mjs` line 182 (for `/live?embed=mcp`). `src/live/hosts/mcp-port.js` accepts messages from `event.source === parent`, whatever that parent is.
- *Proof:* browser test "risk: any origin can frame the page, act as its host, and read the question the reader asks". A page on another origin frames RISE with no relay and receives the typed Dive question in a sampling request. Speech-derived questions go the same way.
- *Why it is a risk and not a defect:* MCP app hosts render the app in a sandboxed frame whose origin is not known in advance, so the frame has to accept any ancestor. What any site gains is the ability to show validated, bounded text in RISE's chrome, and to read what the reader asks there.
- *Smallest mitigation:* serve the embed from a separate origin (for example `embed.` or a sandbox domain) that has no first-party storage, no key, and no reading history. Show the host's origin, from `document.referrer` or `ancestorOrigins`, in the embed. Never store a key in embed mode.

**R-2 · Medium · provider output keeps running after RISE stops reading it.**
- The parser's limits and the reducer's caps drop text, but the provider keeps generating. The Worker's session sets no `max_output_tokens`, and a cap that drops text does not send `response.cancel`. The Worker also discards the call id in the `Location` header, so RISE has no server-side hangup if the browser closes uncleanly.
- *Mitigation:* set `max_output_tokens` from the Current's text budget. Cancel when the adapter ends for a local reason. Keep the call id for a hangup.

**R-3 · Low · runtime trusts voice renderers to stop calling back.**
- `runtime.js` `attachVoice` callbacks do not check `run.closed`. The browser voice guards itself (`item.utterance !== utterance`), so there is no defect today. A new renderer that does not guard would write into a closed run.
- *Mitigation:* one `if (run.closed) return;` in the runtime, so renderers need not be trusted.

**R-4 · Low · atom ids are regenerated on every lowering.**
- Every field of every committed atom except `id` is identical across lowerings (tested). The ids are fresh UUIDs each time (tested). Nothing keys on atom ids across `Player.extend` today. A future feature that did, such as bookmarks, notes, or evidence links, would break silently.
- *Mitigation:* derive atom ids from segment id and index when the first such feature is built, not before.

### Unverified assumptions (need a real provider or host)

- **U-1:** every OpenAI `error` event ends the Current (`openai-wire.js`), while the documentation says "most errors are recoverable and the session will stay open." This is safe, since it fails closed, but it may end answers needlessly.
- **U-2:** RISE sends `conversation.item.create` and `response.create` as soon as the data channel opens, without waiting for `session.created`. The documentation does not say whether that is allowed.
- **U-3:** a text-only session (`output_modalities: ['text']`) accepts the browser's receive-only audio line in the offer.
- **U-4:** Cloudflare's `observability.enabled: true` does not log the reader's `Authorization` header on `/api/live/realtime`.
- **U-5:** product MCP hosts render the app in a sandbox that works with `frame-ancestors *`, delegate the microphone, support sampling, accept protocol version `2026-01-26`, and do not rely on partial tool input.
- **U-6:** a real `speechSynthesis` and a real recognizer behave like the fakes the tests use, including boundary events and cancellation.

### False alarms (attacked and held)

| Attack | Result |
|---|---|
| Prototype keys, sparse arrays, `null`, `valueOf` objects, deep nesting, `MAX_SAFE_INTEGER` and fractional sequence numbers | Refused; no pollution |
| 400 seeds of reordering, duplicates, conflicts, gaps, junk, and post-terminal events | Never threw; ended text immutable; lowerings are prefixes; pressure ≤ 16; refusals ≤ 8 |
| Duplicate storm | Bounded by the 5,000-event cap |
| Parser under arbitrary chunking (150 hostile seeds) | Identical output, zero refusals |
| Disconnect at every character boundary | Only whole passages survive, each equal to the uninterrupted run |
| Events after Stop | Never applied |
| Player extension changing an already-heard atom | Every field but `id` identical |
| Recompiling the whole Current on every segment end | Quadratic, but 1.4 ms at 16 segments and 20,000 characters, and 15 ms summed over a whole Current. Irrelevant at today's caps; revisit if the caps rise. |
| `postMessage(…, '*')` from the embed to its parent | The parent cannot be swapped without destroying the frame. The recipient is untrusted anyway (R-1). |
| Relay origin checks | Hold (existing browser tests) |
| Worker echoing upstream errors or the key | Never echoed (existing tests) |
| Unexpected provider audio | Never attached or played |
| OpenAI endpoint, multipart shape, delta and status names | Match the current documentation |

## D. Streaming readiness

| Area | Ready? | Why |
|---|---|---|
| Protocol and reducer | **Yes** | Fuzzed and bounded; fix F-12 and snapshot input (F-9) before plugins |
| Generic text streaming | **No** | F-5, F-6, F-8, F-10, F-11: chunking changes the outcome |
| OpenAI Realtime | **No** | F-1 and F-2 bill the reader after Stop; U-1 to U-3 are untested |
| Speech sync | Partly | Correct with the fakes; real voices untested (U-6); R-3 |
| Interruption | Partly | Reducer and adapter correct; Stop races (F-1, F-3, F-4) |
| Dive and Surface | **No** | F-2, F-3, F-4 |
| Reconnect | Yes, locally | Replay and resume are tested with fakes; no real network drop tried |
| Long sessions | Yes, within caps | 20,000 characters and 16 segments bound everything measured. Repeated Dive and Surface memory was not measured. |

## E. Plugin readiness

**Not ready. The design can be made ready with a small contract.**

Of the four possible outputs (sealed Currents, RISE events, typed proposals, and capability outputs), the right one for plugins is **sealed Currents or RISE events, never objects in RISE's realm.** Both are already validated end to end. Typed proposals and capability outputs would each need a new validator, and a new place where authority could leak.

The smallest capability model:

1. **A plugin is a provider.** It implements the existing adapter contract (`open` returning events) and nothing else: no Player, no Chamber, no runtime handle.
2. **It runs out of realm,** in a worker or a sandboxed frame, so anything it produces reaches RISE by structured clone (no accessors; F-9 becomes moot). Snapshot the input anyway.
3. **RISE sets its origin.** A plugin never supplies `origin`. RISE writes `{ kind: 'model' | 'plugin', name, provider }` from the plugin's manifest (the F-7 lesson).
4. **It declares capabilities, and RISE enforces them.** The manifest lists which event types and visuals the plugin may emit, and the reducer is given that list. A plugin cannot widen it.
5. **Budgets are per plugin.** Events, characters, refusals, wall time, and provider spend belong to the plugin's run, and it ends when they are spent.
6. **Composition is by precedence, not merge.** The reader's controls come first (Stop, Surface, and Dive always win), then RISE's own lowering, then one active provider for each role (main or side). Two plugins never write into one Current. A plugin's contribution can only be a Current or a Dive.

## F. Adversarial tests added

- **`src/live/red-team.test.js`:** 22 tests. Thirteen are expected failures, one per confirmed defect: F-1 to F-12 (F-9 has two). The other nine hold, including the 400-seed delivery fuzz, the 150-seed parser corpus, the disconnect sweep, and the atom-prefix check. It runs in the full unit suite, not in the pull-request fast set.
- **`e2e/live-red-team.spec.js`:** three browser tests in the `full` project. One is a passing proof of R-1 (a cross-origin host reads the question). Two are expected failures, for F-7 (a forged author is displayed) and F-1 (a question is sent and an answer shown after Stop, against a counting fake peer).

Run them with `npx vitest run src/live/red-team.test.js` and `npx playwright test e2e/live-red-team.spec.js --project=full`.

## G. Required real-world experiments

Each experiment is one real OpenAI Realtime session (a few cents on a test key) or one real host, run once and recorded.

| Experiment | Cheapest form | Evidence it produces |
|---|---|---|
| U-2: send before `session.created` | Open a call, send `response.create` on channel open, and log the event order | Whether the first response is accepted, queued, or errors |
| U-3: receive-only audio with a text-only session | The Worker's exact offer | 201 with SDP, or a 4xx naming the audio line |
| U-1: recoverable errors | Send one malformed client event mid-answer | Whether the session stays open and the answer continues after `error` |
| F-1 on the real provider | Stop 200 ms after pressing Ask | Whether a response is billed (usage in the dashboard) |
| R-2: runaway output | Ask for a very long answer and let the parser drop it | Tokens billed after RISE stopped reading |
| U-4: key in logs | One call with a canary key, then search Cloudflare logs | Whether the header is recorded |
| U-5: product MCP host | Install the server in one product host with sampling | Whether the frame loads, sampling works, and the microphone is offered |
| U-6: real speech | One Current on Chrome and Safari with real voices | Whether boundary events arrive and cancellation is clean |

## H. Prioritized actions

**Block before enabling OpenAI Live (`LIVE_REALTIME_ENABLED`):**
1. F-1 to F-4: re-check `stopped` after every await in the runtime, close orphaned connections, add a synchronous pending-Dive guard, and pass an abort signal into `adapter.open`.
2. R-2: set `max_output_tokens` from the text budget, and cancel on a local end.
3. Experiments U-2, U-3, and U-4.

**Block before enabling MCP (`MCP_ENABLED`):**
1. F-7: RISE sets the origin of everything that comes through the host.
2. R-1: serve the embed from an origin with no first-party state, and show the host's origin to the reader.
3. Experiment U-5.

**Fix soon (generic streaming):** F-5 and F-6 (coalesce text and apply back-pressure), F-8 (cap the header line), F-10 and F-11 (parser edge cases), F-12 (refuse metadata on ended segments).

**Architecture before plugins:** F-9 (snapshot input once), R-3 (runtime ignores callbacks for closed runs), and the capability contract in §E. R-4 only when something first keys on atom ids.

**Experiments:** the table in §G. Run U-1 and U-6 before tuning error recovery or speech timing.

## Checked against the operating principles

- **Deleted rather than added:** no production code changed, and every fix proposed is a guard or a cap on existing code. No new layer is proposed except the out-of-realm rule for plugins, which removes a class of attack rather than adding a validator.
- **Verified by something that ran:** every confirmed defect and every false alarm has a test that ran. Every OpenAI claim is labelled as either matching the documentation or needing a session. Nothing about a product MCP host or a real voice is claimed.
- **Where this review is weak:** it did not measure memory across repeated Dive and Surface, try a real network drop, or read a Cloudflare log.
