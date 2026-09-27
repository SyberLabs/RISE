# EnterpRise room

The live room is RISE's rule moved into a briefing. A suggestion may appear on the speaker's rail. Nothing the audience can see is on the stage until a presenter promotes it. The audience check runs again at that tap, against the room, not against the person who tapped.

The narrow rail already ships in `src/enterprise/`. This spec is the rest of the room. Implement it in the order below. Each phase ships on its own and leaves the earlier phases working.

## Already shipping

`prepareTalk` builds a frozen `rise.talk-program.v1` for one `presenterId` and one `audienceId`. Passage cards quote a cited page. Chart cards name `tableId`, `labelColumnId`, and `valueColumnIds`. `renderChart` copies cells. `permit` refuses a document whose `audiences` omit the room. `openSession(...).hear` matches drafts lexically and finalized sentences semantically, then `ruleDecider` returns `show`, `hold`, or `dismiss`. `sanitizeDecision` refuses any other field. Hysteresis is `RAIL_POLICY`: show 0.42, hold 0.22, margin 0.12, cooldown 4_000 ms, dwell 8_000 ms, max rail 3. `promote` and `dismiss` are speaker actions. `metrics` records latency samples, acceptance (`promoted / shown`), dismiss rate of cards dismissed before promotion, and `provenanceComplete`. `debrief().followUp` lists finalized utterances that did not show a card. `hints()` lists entity names the room may hear. `src/enterprise/boundary.test.js` forbids imports into or out of the sibling.

## Invariants

These do not relax in later phases.

- A card body is a verbatim span of a cited page, or it is a chart with no numeric fields.
- Every numeral shown, on the rail or on the stage, is its own token in the cited page or in a cited table cell. A token glued to a letter (`Q1`) is a label.
- The decider's view is `window`, `speaker`, `mode`, `candidates` (`id`, `title`, `score`, `layouts`, `layout`), and `rail` (`id`, `title`). No document text, no cell values, no extra keys.
- A model response with any other key is held, not shown.
- Retrieval, reasoning, and promotion all call `validateCard` and `permit` for `program.audienceId`. A failure does not show and does not reach the stage.
- The reader (`src/app`, `src/components`, `src/core`, `src/visuals`) does not import `src/enterprise/`. Enterprise modules import only `./` siblings.
- No new production dependency.

## Order

1. Stage promotion.
2. Live retrieval for audience questions the prepared program missed.
3. More than one presenter on the same rail.
4. An explicit reasoning request that binds cards ahead of, or during, the talk.
5. A same-origin Worker route that may choose among candidate ids.
6. A recognition-event mapper and the existing hint list.
7. Tenant and residency on the corpus, and one record connector.

Chamber stays the reader's timed surface. A briefing card is a quote or a chart, already rendered. The stage shows that card. It does not mount `src/components/Chamber.js`.

There is no shared npm package in this spec. The sibling directory is the extraction until a second runtime imports the gate. Moving Chamber, the Experience Program, or the Worker into a package is out of scope.

There is no connector to an external file host. The connector accepts the record shape `ingestCorpus` already validates.

There is no second rail per presenter, and no public stage control except the presenter's promote and retract.

## 1. Stage

`admitToStage(card, corpus, audienceId)` in `src/enterprise/gate.js` returns true only when `permit` is true and `validateCard` returns. Otherwise false. It does not throw for an audience miss.

`session.promote(cardId)` calls `admitToStage` on the program card (or a retrieval card held by the session). If it is false, or the id is not on the rail, the call returns `{ action: 'refused' }` and `stage()` stays unchanged. If it is true, the rail card's status becomes `promoted`, the id is appended to the stage once, and the call returns `{ action: 'promote' }`.

`session.stage()` returns the materialized cards on the stage, in promotion order. The same shape as `rail()`: `id`, `title`, `status`, `layout`, `kind`, `body`, `chart`, `provenance`, `latencyMs`.

`session.retract(cardId)` removes that id from the stage. It does not increment `speakerDismissed`. It does not decrement `promoted`. A retracted card is not on the stage. Retract of an unknown id returns `{ action: 'refused' }`.

`dismiss` of a card that is still `shown` behaves as it does now. `dismiss` of a `promoted` card removes it from the rail and from the stage, and still does not increment `speakerDismissed`.

`debrief().stage` is `{ cardId, at }[]` for each successful promote, including cards later retracted. `debrief().promoted` stays that list of ids.

`renderStage(root, session)` in `src/enterprise/stage-view.js` paints `session.stage()` into an element `data-surface="stage"`. It shows title, body or chart cells, and provenance. It has a Retract button (`data-action="retract"`) and no Promote button. `renderRail` does not render a stage. After promote, the rail metrics still show `Promoted N`.

`enterprise.html` gains a second region, `#stage`, wired through `demo-page.js` to `renderStage`. The rail and the stage update together after hear, promote, dismiss, and retract.

## 2. Live retrieval

Retrieval runs only as a fallback. Prepared matches stay first.

`indexCorpus(corpus, audienceId)` in `src/enterprise/retrieve.js` lists sentences and tables whose document `audiences` include `audienceId`. Board-only documents are absent.

`retrieve(index, text, { limit = 3 } = {})` scores that list with the same whole-token overlap `prepare.js` uses (at least 2 shared tokens and ratio at least 0.34). It returns plain card objects that `validateCard` accepts for that audience. Passage ids are `card:retrieval:${documentId}:${page}:${n}` where `n` is the sentence index on that page. Chart ids are `card:retrieval:chart:${tableId}`. Titles are the document title or the table title, not a generated sentence. The query field is the utterance text, trimmed to 160 characters.

`hear` for `speaker: 'audience'` and `final: true` consults retrieval only when the best prepared candidate score is missing or below `RAIL_POLICY.holdThreshold` (0.22). Retrieved cards are offered to the decider ahead of the weak prepared list. They are stored on the session so `rail()` and `stage()` can materialize them. They are not written into the frozen program. A retrieved card still needs `promote` to reach the stage. Draft audience lines do not retrieve. Presenter lines do not retrieve. If retrieval also misses, the utterance remains a follow-up gap and the rail is unchanged.

## 3. Presenters

`prepareTalk` accepts `presenterIds` as an array of one or more trimmed strings. `presenterId` remains required and must be one of `presenterIds`. When `presenterIds` is omitted, it is `[presenterId]`. `validateProgram` requires `presenterIds` to include `presenterId` and to contain no duplicates.

`hear` with `speaker: 'presenter'` ignores the event unless `speakerId` is in `program.presenterIds`. Audience `speakerId` values are not presenter authority. The room still has one rail, one stage, and one audience.

## 4. Reasoning

`session.requestReasoning({ text, at })` is the explicit request. It calls `retrieve` on the permitted corpus even when the speaker is the presenter and even when prepared scores are high. The best retrieved card, if `validateCard` passes, is offered through the same show path and the same hysteresis as `hear`. It lands on the rail. It does not land on the stage. The return value uses `tier: 'reasoning'`. No network call. No card field beyond the gate's keys.

## 5. Decision route

`worker/enterprise-decision.mjs` exports `handleEnterpriseDecision(request)`. `worker/index.mjs` routes `POST /api/enterprise-decision` to it.

The JSON body may contain only `window`, `speaker`, `mode`, `candidates`, and `rail`. `candidates` entries may contain only `id`, `title`, `score`, `layouts`, and `layout`. `rail` entries may contain only `id` and `title`. Any other key, a body over 4_096 bytes, a missing `Origin` that does not match the request origin, or a non-POST is refused. The handler does not read `env` for documents. It returns `sanitizeDecision(ruleDecider(view), candidates)` as JSON `{ action, cardId, layout }`. This route does not call OpenRouter. A later replacement may, and it will still have to return that shape. The browser session keeps `ruleDecider` until a caller passes another `decider`.

## 6. Recognition

`mapRecognitionEvent(raw, { presenterIds })` in `src/enterprise/speech.js` maps `{ transcript, isFinal, speakerLabel, at }` to the `hear` event. `speaker` is `presenter` only when `speakerLabel` is in `presenterIds`. Otherwise `speaker` is `audience`, including a missing label. `text` is `transcript`. `final` is `isFinal === true`. `speakerId` is `speakerLabel` or `'audience'` when the label is missing. The module does not touch a microphone. `session.hints()` remains the phrase list a recognizer may boost. `demo-page.js` keeps the textarea. It does not gain a speech vendor.

## 7. Tenant, residency, connector

`bindTenant(input, { tenantId, residency })` in `src/enterprise/corpus.js` requires both strings, non-empty and trimmed, then `ingestCorpus`. The frozen corpus gains `tenantId` and `residency`. Existing `ingestCorpus` calls with no binding get `tenantId: 'local'` and `residency: 'local'`, so the current fixture stays valid.

`combineCorpora(left, right)` throws `EnterpriseError` code `CORPUS_RESIDENCY` when `residency` differs, and code `CORPUS_TENANT` when `tenantId` differs. It concatenates documents, tables, and entities when both match, and re-ingests. It does not merge audiences.

`corpusFromRecords(records, binding)` is `bindTenant(records, binding)`. That is the only connector.

## Verification

Each phase adds tests in `src/enterprise/` and, for the route, `worker/enterprise-decision.test.js`. Run `npx vitest run src/enterprise/enterprise.test.js src/enterprise/boundary.test.js src/core/system-design.test.js worker/enterprise-decision.test.js`. The stage page is checked in a browser at `/enterprise.html`: promote shows the card on `#stage` and not before; retract clears it; an audience line that misses the deck can still put a permitted sentence on the rail; 880 from the board memo never appears; a 390px width does not overflow.

## Costs

The latency numbers in `RAIL_POLICY` and the match tests remain ceilings on the fixture, not measurements of a recognizer or a network embedder. Retrieval walks the in-memory corpus. A corpus that no longer fits in memory is a later storage problem, and this spec does not add a database.
