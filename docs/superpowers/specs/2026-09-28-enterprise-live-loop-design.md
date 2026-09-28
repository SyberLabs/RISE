# EnterpRise live loop

The room in `2026-09-27-enterprise-room-design.md` decides synchronously, from
typed lines, with the rule decider. This spec makes it a live loop:

microphone → streaming recognition → evidence → candidates → bounded JEV
decision → speaker rail → presenter promotion → authority recheck → stage →
event trace.

Every invariant in the room spec still holds. This spec adds three more.

- A decision that fails, times out, is cancelled, is superseded, or does not
  validate is `hold`. It does not show, publish, or mutate the rail.
- The decision provider sees only the context below. It never sees a document,
  a page, a table cell, a card body, a tenant, a credential, or the audience.
- Only a finalized utterance asks for a decision. An interim transcript warms
  the lexical tier and nothing else.

## Context protocol

`src/enterprise/context.js` defines `rise.enterprise-context.v1`. It is the
only shape that crosses from the browser to the decision route, and the only
shape the trace records for a decision.

```
{
  schema: 'rise.enterprise-context.v1',
  requestId,                                   // session nonce + turn number
  evidence:  { window, speaker, mode },        // what was heard
  structure: { candidates: [{ id, title, score, layouts, layout }],
               rail: [{ id, title }] },        // the legal options
  authority: { actions }                       // what the decider may do
}
```

`authority.actions` is `show`, `hold`, `dismiss` when there is a candidate and
`hold`, `dismiss` when there is none. Promotion is never an action: the
authority to publish belongs to a presenter and is not delegable. The room's
own authority (tenant, residency, audience, presenters) stays in the session
and the gate. It is not serialized.

`validateContext` refuses unknown keys at every level, a window over 600
characters, more than 5 candidates or 3 rail entries, an id over 160
characters, a score outside 0..1, and a layout outside `quote`, `bar`, `line`,
`table`. The Worker and the browser import the same module.

The names follow SyberWork's Evidence / Structure / Authority split. There is
no shared package: the directory is the extraction until a second runtime
imports it.

## Prepare, decide, resolve

`session.prepare(event)` does the synchronous work: presenter authority,
window, lexical or semantic match, audience retrieval. It returns a turn with
a frozen `context`. `session.resolve(turn, raw, meta)` sanitizes the raw
decision against that turn's candidates, audits the rendered numerals, and
reduces the rail.

`resolve` refuses (holds) when:

- the turn was not issued by this session, or was already resolved;
- a later final turn has been prepared (`stale`);
- the decider failed (`meta.reason`: `timeout`, `cancelled`, `error`,
  `invalid`, `unavailable`);
- the chosen card was dismissed after the turn was prepared.

`promote(cardId, { by })` refuses a promoter who is not a listed presenter.
`by` defaults to the program's presenter, the device owner.

`hear(event)` is `resolve(prepare(event), ruleDecider(view))`. It keeps its
current behaviour, drafts included, for tests and explicit local mode.

`session.warm(event)` runs the lexical tier on an interim transcript and
returns the leaders' ids, titles, and scores. It does not touch the rail.

`reduceRail` returns a `reason` with every hold: `cooldown`, `dwell`,
`margin`, `duplicate`, `unknown`, or `not-show`.

## Live loop

`createLiveLoop({ session, decide, timeoutMs, trace })` in
`src/enterprise/live.js` owns concurrency. An interim result calls `warm`. A
final calls `prepare`, aborts any decision still in flight, calls
`decide(context, { signal })` under a timeout (default 3_500 ms), and passes
the answer to `resolve`. At most one decision is in flight.

A cancelled decision resolves with the reason `superseded`; `stop()` uses
`stopped`. `decide` returns `{ raw, meta }`. `localDecider` wraps `ruleDecider`.
`createRemoteDecider` in `src/enterprise/remote-decider.js` posts the context
to `/api/enterprise-decision`, accepts only `rise.enterprise-decision.v1` with
the same `requestId`, and returns `{ action, cardId, layout }` as `raw`.
Anything else throws, and the loop resolves `hold`. There is no fallback from
JEV to rules: local mode is chosen, not inherited from a failure.

## Decision route

`POST /api/enterprise-decision` joins the other decision routes behind
`decisionProvider(env)` and `DECISION_LIMITER`. Unconfigured is 503.

The route validates the context, then asks the provider one `choice`
question. The option keys are opaque: `hold`, `dismiss`, and
`show_<n>_<layout>` for each candidate and layout. Criteria text is the
candidate title and score. State is the window, speaker, mode, and rail
titles. The provider cannot name a card id, a layout that is not offered, or
anything else. The route maps the choice back to `{ action, cardId, layout }`,
checks it against `authority.actions`, and replies
`{ schema, requestId, action, cardId, layout, confidence, model, provider?,
revision? }`. Upstream timeout is 2_500 ms. A provider error, a wrong
checkpoint, malformed JSON, or an unknown choice is 502; a timeout is 504.
Upstream bodies are never echoed.

The route logs one JSON line per request: `requestId`, `status`, `outcome`,
`latencyMs`, candidate count, provider name. It never logs the window.

## Speech

`src/enterprise/recognition.js` wraps the browser `SpeechRecognition`
(`continuous`, `interimResults`). It emits `{ transcript, isFinal, at }`,
restarts after the recognizer's own `end` while listening, and stops on
`not-allowed`, `service-not-allowed`, `audio-capture`, or three restarts
inside ten seconds. Web Speech has no speaker labels: the page labels finals
with the selected speaker (the presenter, or an audience question), and
`mapRecognitionEvent` does the rest.

Chrome's default recognizer sends audio to its vendor. `speechPolicy:
'on-device'` sets `processLocally` and refuses to start when the browser
cannot confirm on-device recognition. The page says which recognizer is in
use before the microphone starts. A browser without Web Speech keeps the
typed transcript.

## Trace

`src/enterprise/trace.js` is an append-only, bounded event list (2_000
events) with a monotonic `seq` and a clock. Event types: `speech.state`,
`speech.interim`, `speech.final`, `warm`, `retrieve`, `candidates`,
`decision.request`, `decision.response`, `decider.change`, `rail.show`,
`rail.hold`, `rail.dismiss`, `promote.gate`, `stage.publish`, and
`stage.retract`. Speech events carry a character count, not text. Decision
events carry `requestId`, provider, model, revision, outcome, and latency.
`summary()` returns counts and decision latency p50/p95. The page can export
the trace as JSON.

## Page

`enterprise.html` gains Listen / Stop, a speaker toggle, a decider select
(JEV or local rules), a live status line (`aria-live="polite"`), the interim
transcript, the warm leader, and Export trace. The typed transcript stays.
The page is a build input so the Worker serves it beside the route.

## Out of scope

A stage window on a second screen, a server-side trace store, a hosted
embedder, speaker diarization, and a corpus that does not fit in memory.

## Verification

Unit: `npx vitest run src/enterprise worker src/core/system-design.test.js`.
Browser: `e2e/enterprise.spec.js` drives a fake recognizer and a routed
decision response through final → rail → promote → stage, and proves malformed,
stale, failed, and restricted responses leave the rail and stage unchanged.
