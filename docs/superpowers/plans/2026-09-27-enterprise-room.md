# EnterpRise room implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the shipping speaker rail through stage promotion, live retrieval, and multiple presenters, then the reasoning request, the ids-only decision route, the recognition mapper, and tenant residency.

**Architecture:** Each phase extends `src/enterprise/` and leaves the reader unloaded. The stage re-checks `permit` before a promoted card is public. Retrieval builds gated cards only when an audience final misses the prepared program. Several presenters share one rail and one stage. Reasoning, the Worker route, and the speech mapper stay on that same card gate.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest, the existing Cloudflare Worker, Playwright for the stage page.

**Spec:** `docs/superpowers/specs/2026-09-27-enterprise-room-design.md`

## Global Constraints

- A card body is a verbatim span of a cited page, or it is a chart with no numeric fields.
- Every numeral shown, on the rail or on the stage, is its own token in the cited page or in a cited table cell. A token glued to a letter (`Q1`) is a label.
- The decider's view is `window`, `speaker`, `mode`, `candidates` (`id`, `title`, `score`, `layouts`, `layout`), and `rail` (`id`, `title`). No document text, no cell values, no extra keys.
- A model response with any other key is held, not shown.
- Retrieval, reasoning, and promotion all call `validateCard` and `permit` for `program.audienceId`. A failure does not show and does not reach the stage.
- The reader (`src/app`, `src/components`, `src/core`, `src/visuals`) does not import `src/enterprise/`. Enterprise modules import only `./` siblings.
- No new production dependency.
- A new module under `src/enterprise/` is committed in the same change as the `npm run docs:diagram` update. The generated diagram is the module count CI checks.
- Do not mount `src/components/Chamber.js` on the stage.
- Do not add an npm package, an external file-host connector, a second rail, or an OpenRouter call on `/api/enterprise-decision`.
- Implement the tasks in order. Do not start a task whose tests assume an earlier task that is still red.

---

### Task 1: Stage admission

**Files:**
- Modify: `src/enterprise/gate.js`
- Modify: `src/enterprise/decision.js`
- Modify: `src/enterprise/session.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `permit(card, corpus, audienceId)`, `validateCard(card, corpus, audienceId)`, `reduceRail`, `session.promote(cardId)`, `session.rail()`, `program.cards`.
- Produces: `admitToStage(card, corpus, audienceId) -> boolean`. `session.promote(cardId) -> { action: 'promote' | 'refused' }`. `session.retract(cardId) -> { action: 'retract' | 'refused' }`. `session.stage() -> materialized cards`. `debrief().stage -> { cardId, at }[]`. `reduceRail` gains `stageIds` on state and handles `{ type: 'retract', cardId, at }`. Promote still sets rail status to `promoted` and appends `promotedIds`.

- [ ] **Step 1: Write the failing test**

Add to `src/enterprise/enterprise.test.js`:

```js
import { admitToStage } from './gate.js';

it('puts a permitted card on the stage only after promote', () => {
    const { corpus, program } = prepared();
    const session = openSession({ program, corpus, now: (at) => at });
    session.hear({
        text: 'Atlas renewal price',
        final: true,
        speaker: 'presenter',
        speakerId: PRESENTER,
        at: 1000
    });
    expect(session.stage()).toEqual([]);
    const card = program.cards.find(item => item.kind === 'passage');
    expect(admitToStage(card, corpus, 'all-hands')).toBe(true);
    expect(admitToStage(passageCard({
        body: 'The acquisition price is 880 million and stays in the board room.',
        provenance: [{ documentId: 'board-memo', page: 1, tableId: null, query: 'Acquisition' }]
    }), corpus, 'all-hands')).toBe(false);
    const id = session.rail()[0].id;
    expect(session.promote(id)).toEqual({ action: 'promote' });
    expect(session.stage().map(item => item.id)).toEqual([id]);
    expect(session.stage()[0].body).toContain('12.4');
    expect(session.retract(id)).toEqual({ action: 'retract' });
    expect(session.stage()).toEqual([]);
    expect(session.rail().map(item => item.id)).toEqual([id]);
    session.dismiss(id);
    expect(session.stage()).toEqual([]);
    expect(session.rail()).toEqual([]);
    expect(session.metrics().promoted).toBe(1);
    expect(session.metrics().speakerDismissed).toBe(0);
    expect(session.debrief().stage).toHaveLength(1);
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "only after promote"`

Expected: FAIL because `admitToStage` is not exported.

- [ ] **Step 3: Implement admission**

In `gate.js`:

```js
export function admitToStage(card, corpus, audienceId) {
    if (!permit(card, corpus, audienceId)) return false;
    try {
        validateCard(card, corpus, audienceId);
        return true;
    } catch {
        return false;
    }
}
```

In `initialRailState`, add `stageIds: []` and copy it in `cloneState`. On `type: 'promote'`, after marking the rail card, append `event.cardId` to `stageIds` when it is not already there. On `type: 'dismiss'`, also remove the id from `stageIds`. The rail card is removed either way. On `type: 'retract'`, remove the id from `stageIds` only. Leave the rail card in place. If the id was absent from `stageIds`, return `{ state: next, effect: 'hold' }`. Otherwise return `{ state: next, effect: 'retract' }`.

In `session.promote`, load the card from `program.cards` or the session's retrieval map (empty until Task 4). If `admitToStage` is false, return `{ action: 'refused' }` without calling `reduceRail`. Otherwise reduce with `{ type: 'promote', cardId, at: stamp() }` and, when the effect is `promote`, push `{ cardId, at: stamp() }` onto a `stageLog`. Return `{ action: 'promote' }` only when the effect is `promote`. `retract` reduces with `{ type: 'retract', cardId, at: stamp() }` and returns `{ action: 'retract' }` or `{ action: 'refused' }`. `stage()` materializes `state.stageIds` in order. `debrief().stage` returns a copy of `stageLog`.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js src/enterprise/boundary.test.js`

Expected: PASS, including the existing promote/dismiss metrics test.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/gate.js src/enterprise/decision.js src/enterprise/session.js src/enterprise/enterprise.test.js
git commit -m "Admit a promoted card onto the EnterpRise stage"
```

### Task 2: Stage surface

**Files:**
- Create: `src/enterprise/stage-view.js`
- Modify: `src/enterprise/index.js`
- Modify: `src/enterprise/demo-page.js`
- Modify: `enterprise.html`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `session.stage()`, `session.retract(cardId)`, `session.promote(cardId)`, `renderRail`.
- Produces: `renderStage(root, session)` paints `[data-surface="stage"]`. `index.js` exports `renderStage`. The page has `#stage`.

- [ ] **Step 1: Write the failing test**

```js
import { renderStage } from './stage-view.js';

it('shows a card on the stage element only after promote', () => {
    const { corpus, program } = prepared();
    const session = openSession({ program, corpus, now: () => 1500 });
    const railRoot = document.createElement('div');
    const stageRoot = document.createElement('div');
    const rail = renderRail(railRoot, session);
    const stage = renderStage(stageRoot, session);
    rail.hear({
        text: 'Atlas renewal price',
        final: true,
        speaker: 'presenter',
        speakerId: PRESENTER,
        at: 1000
    });
    expect(stageRoot.querySelector('[data-surface="stage"]')).not.toBeNull();
    expect(stageRoot.textContent).not.toContain('12.4');
    railRoot.querySelector('[data-action="promote"]').click();
    stage.update();
    expect(stageRoot.textContent).toContain('12.4');
    expect(stageRoot.textContent).toContain('pricing');
    expect(stageRoot.querySelector('[data-action="promote"]')).toBeNull();
    stageRoot.querySelector('[data-action="retract"]').click();
    expect(stageRoot.textContent).not.toContain('12.4');
    expect(railRoot.querySelector('[data-surface="stage"]')).toBeNull();
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "stage element"`

Expected: FAIL because `./stage-view.js` does not exist.

- [ ] **Step 3: Implement the surface**

`renderStage` clears `root`, creates one element with `data-surface="stage"`, and lists `session.stage()`. Each card shows `title`, passage `body` or chart rows of raw cell strings, and the provenance line `${documentId} · page ${page}`. Each card has `<button type="button" data-action="retract">Retract</button>` which calls `session.retract(card.id)` and redraws. No promote button. Return `{ update: draw }`.

Export `renderStage` from `index.js`. In `enterprise.html`, add `<section id="stage" aria-label="Stage"></section>` after `#rail`. In `demo-page.js`, construct `renderStage(document.querySelector('#stage'), session)` and call its `update` at the end of `send` and after the rail's hear. Give the stage a heading "Stage" in the page, not inside `renderStage`, so the unit test's text assertion stays the card.

Style `#stage` in `enterprise.html` with the same paper card as the rail and a full-width rule, so a phone width of 390px does not overflow. Do not import the Chamber.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/stage-view.js src/enterprise/index.js src/enterprise/demo-page.js enterprise.html src/enterprise/enterprise.test.js
git commit -m "Show promoted EnterpRise cards on a separate stage"
```

### Task 3: Retrieval index

**Files:**
- Create: `src/enterprise/retrieve.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `tokenize` from `text.js`, `validateCard`, corpus documents and tables.
- Produces: `indexCorpus(corpus, audienceId)` and `retrieve(index, text, { limit = 3 } = {})`. Cards use the shapes in the spec. Overlap requires at least 2 shared tokens and a ratio of at least 0.34, matching `prepare.js`.

- [ ] **Step 1: Write the failing test**

```js
import { indexCorpus, retrieve } from './retrieve.js';

it('retrieves a permitted sentence and skips the board memo', () => {
    const corpus = ingestCorpus({
        documents: [
            {
                id: 'ops',
                title: 'Ops note',
                audiences: ['all-hands'],
                pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
            },
            {
                id: 'board-memo',
                title: 'Board memo',
                audiences: ['board'],
                pages: [{ page: 1, text: 'The acquisition price is 880 million and stays in the board room.' }]
            }
        ],
        tables: [],
        entities: []
    });
    const found = retrieve(indexCorpus(corpus, 'all-hands'), 'cafeteria soup tuesday');
    expect(found).toHaveLength(1);
    expect(found[0].body).toBe('The cafeteria serves soup on Tuesday.');
    expect(found[0].id).toBe('card:retrieval:ops:1:0');
    expect(validateCard(found[0], corpus, 'all-hands').kind).toBe('passage');
    expect(JSON.stringify(found)).not.toContain('880');
    expect(retrieve(indexCorpus(corpus, 'all-hands'), 'acquisition price')).toEqual([]);
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "skips the board memo"`

Expected: FAIL because `./retrieve.js` does not exist.

- [ ] **Step 3: Implement retrieval**

Build one entry per sentence of each permitted document, plus one entry per permitted table that has a number column. Score with whole tokens only (no prefix boost). Drop hits below 2 shared tokens or ratio 0.34. Sort by ratio descending, then id ascending. Slice to `limit`. Map a sentence hit to a passage card whose `topicId` is `retrieval`, `layouts` is `['quote']`, `layout` is `quote`, `chart` is null, and provenance is `{ documentId, page, tableId: null, query }` with `query` the utterance trimmed to 160 characters. Map a table hit the way `prepareTalk` maps a chart: label column, every number column, layouts `bar`, `line`, `table`. Run each card through `validateCard` and drop a card that throws.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "skips the board memo"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/retrieve.js src/enterprise/enterprise.test.js
git commit -m "Retrieve permitted corpus sentences for EnterpRise questions"
```

### Task 4: Retrieval fallback on audience finals

**Files:**
- Modify: `src/enterprise/session.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `indexCorpus`, `retrieve`, `RAIL_POLICY.holdThreshold`, `hear`.
- Produces: audience finals whose best prepared score is below 0.22 may show a retrieval card on the rail. `stage()` stays empty until promote. Presenter lines and audience drafts do not retrieve. The retrieval card is found by `rail()` and can be promoted via Task 1's `admitToStage`.

- [ ] **Step 1: Write the failing test**

Use `prepared()` and a corpus that also contains the ops sentence. Build that corpus in the test, then `prepareTalk` with the existing `deck()` so the cafeteria sentence is not a prepared card. `openSession` with that pair.

```js
it('retrieves for an audience final that misses the prepared program', () => {
    const input = corpusInput();
    input.documents.push({
        id: 'ops',
        title: 'Ops note',
        audiences: ['all-hands'],
        pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
    });
    const corpus = ingestCorpus(input);
    const program = prepareTalk({
        deck: deck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: PRESENTER
    });
    const session = openSession({ program, corpus, now: (at) => at });
    const missed = session.hear({
        text: 'cafeteria soup tuesday',
        final: false,
        speaker: 'audience',
        speakerId: 'guest',
        at: 1000
    });
    expect(missed.action).not.toBe('show');
    const found = session.hear({
        text: 'cafeteria soup tuesday',
        final: true,
        speaker: 'audience',
        speakerId: 'guest',
        at: 1000
    });
    expect(found.action).toBe('show');
    expect(session.rail()[0].body).toBe('The cafeteria serves soup on Tuesday.');
    expect(session.stage()).toEqual([]);
    expect(session.promote(session.rail()[0].id).action).toBe('promote');
    expect(session.stage()[0].body).toContain('soup');
    expect(JSON.stringify(session.stage())).not.toContain('880');
});
```

`corpusInput` and `deck` are already in `src/enterprise/enterprise.test.js`. Call them. Do not export them.

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "misses the prepared program"`

Expected: FAIL because the final does not show the ops sentence.

- [ ] **Step 3: Implement the fallback**

Hold a `Map` of retrieval cards on the session. In `hear`, after the prepared ranking, if `event.speaker === 'audience'` and `event.final` and `(ranked[0]?.score ?? 0) < 0.22`, call `retrieve(indexCorpus(corpus, program.audienceId), event.text)`. Store those cards in the map. Pass them to `viewCandidates` ahead of the prepared hits. `materialize` looks at the map when `program.cards` has no match. Do not call `retrieve` for drafts or for presenters. A show still goes through `auditRendered`.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js`

Expected: PASS. The cafeteria gap test still passes because that utterance shares no two tokens with the ops sentence or the deck.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/session.js src/enterprise/enterprise.test.js
git commit -m "Fall back to corpus retrieval for unanswered audience lines"
```

### Task 5: Multiple presenters

**Files:**
- Modify: `src/enterprise/prepare.js`
- Modify: `src/enterprise/gate.js` (`validateProgram`)
- Modify: `src/enterprise/session.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `prepareTalk({ deck, corpus, audienceId, presenterId })`.
- Produces: `prepareTalk` also accepts `presenterIds`. Omitted means `[presenterId]`. `program.presenterIds` includes `presenterId` with no duplicates. `hear` accepts a presenter `speakerId` in that list. Any other presenter id returns `{ action: 'ignore' }`.

- [ ] **Step 1: Write the failing test**

```js
it('lets every listed presenter speak on the same rail', () => {
    const { corpus } = prepared();
    const program = prepareTalk({
        deck: deck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: PRESENTER,
        presenterIds: [PRESENTER, 'bruno']
    });
    expect(program.presenterIds).toEqual([PRESENTER, 'bruno']);
    const session = openSession({ program, corpus, now: (at) => at });
    const spoken = session.hear({
        text: 'Atlas renewal price',
        final: true,
        speaker: 'presenter',
        speakerId: 'bruno',
        at: 1000
    });
    expect(spoken.action).toBe('show');
    expect(session.rail()).toHaveLength(1);
    expect(() => prepareTalk({
        deck: deck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: PRESENTER,
        presenterIds: ['bruno']
    })).toThrow();
});
```

Keep the existing test that `speakerId: 'bruno'` is ignored when `presenterIds` is omitted.

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "listed presenter"`

Expected: FAIL because `presenterIds` is absent.

- [ ] **Step 3: Implement the list**

In `prepareTalk`, set `presenterIds` to the argument when it is a non-empty array of trimmed strings, otherwise `[presenterId]`. Fail with `PREPARE_PRESENTER` if `presenterId` is not in the list or the list has duplicates. Store `presenterIds` on the program before `validateProgram`. In `validateProgram`, require `Array.isArray(program.presenterIds)`, the same membership, and no duplicates. In `hear`, replace `event.speakerId !== program.presenterId` with `!program.presenterIds.includes(event.speakerId)`.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "presenter"`

Expected: PASS for both the ignore test and the listed-presenter test.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/prepare.js src/enterprise/gate.js src/enterprise/session.js src/enterprise/enterprise.test.js
git commit -m "Allow several presenters on one EnterpRise rail"
```

### Task 6: Explicit reasoning request

**Files:**
- Modify: `src/enterprise/session.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `retrieve`, `indexCorpus`, hysteresis inside `hear`'s show path.
- Produces: `session.requestReasoning({ text, at }) -> { action, cardId, tier: 'reasoning', latencyMs }`. The card is on the rail only. `stage()` is unchanged. Presenter authority is not required beyond the session already being open. The call does not fetch.

- [ ] **Step 1: Write the failing test**

```js
it('binds a reasoning request onto the rail and not the stage', () => {
    const input = corpusInput();
    input.documents.push({
        id: 'ops',
        title: 'Ops note',
        audiences: ['all-hands'],
        pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
    });
    const corpus = ingestCorpus(input);
    const program = prepareTalk({
        deck: deck(),
        corpus,
        audienceId: 'all-hands',
        presenterId: PRESENTER
    });
    const session = openSession({ program, corpus, now: (at) => at });
    const result = session.requestReasoning({ text: 'cafeteria soup tuesday', at: 1000 });
    expect(result.tier).toBe('reasoning');
    expect(result.action).toBe('show');
    expect(session.rail()[0].body).toContain('soup');
    expect(session.stage()).toEqual([]);
    expect(session.rail()[0].body).not.toContain('880');
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "reasoning request"`

Expected: FAIL because `requestReasoning` is missing.

- [ ] **Step 3: Implement the request**

`requestReasoning` calls `retrieve`, stores the cards in the retrieval map, and runs the same show path as a finalized hear with those candidates and `tier` fixed to `'reasoning'`. It still applies cooldown, dwell, `auditRendered`, and `admit` only later at promote. It does not append the utterance to the audience gap list when it shows.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "reasoning request"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/session.js src/enterprise/enterprise.test.js
git commit -m "Add an explicit EnterpRise reasoning request"
```

### Task 7: Ids-only decision route

**Files:**
- Create: `worker/enterprise-decision.mjs`
- Create: `worker/enterprise-decision.test.js`
- Modify: `worker/index.mjs`

**Interfaces:**
- Consumes: `ruleDecider` and `sanitizeDecision` from `src/enterprise/decision.js`. The Worker may import that sibling. `src/enterprise/` must not import `worker/`.
- Produces: `handleEnterpriseDecision(request)` and `POST /api/enterprise-decision`. Success body is `{ action, cardId, layout }`.

- [ ] **Step 1: Write the failing test**

```js
import { handleEnterpriseDecision } from './enterprise-decision.mjs';

const view = {
    window: 'Atlas renewal price',
    speaker: 'presenter',
    mode: 'prepared',
    candidates: [{ id: 'a', title: 'Atlas renewal', score: 0.9, layouts: ['quote'], layout: 'quote' }],
    rail: []
};

it('returns a bounded choice and refuses document fields', async () => {
    const origin = 'https://rise.example';
    const ok = await handleEnterpriseDecision(new Request(`${origin}/api/enterprise-decision`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(view)
    }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ action: 'show', cardId: 'a', layout: 'quote' });

    const dirty = await handleEnterpriseDecision(new Request(`${origin}/api/enterprise-decision`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...view, body: 'price is 999' })
    }));
    expect(dirty.status).toBe(400);
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run worker/enterprise-decision.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the route**

Reject non-POST, an origin that is not the request origin, and bodies over 4_096 bytes. Parse JSON. Allow only the keys listed in the spec, recursively on candidate and rail entries. On a bad key, return 400 `{ error: { code: 'DECISION_SHAPE', message: 'Decision view has an unknown field' } }`. Otherwise respond 200 with the sanitized rule decision's `action`, `cardId`, and `layout` only. Wire the path in `worker/index.mjs` before the 404. Do not read `OPENROUTER_API_KEY`. Update `boundary.test.js` so a Worker file may import `src/enterprise/decision.js` while enterprise files still may not import `worker/` or other `src/` trees. The current boundary walk flags any `enterprise/` string under `worker/`. Change that walk to allow `worker/enterprise-decision.mjs` and `worker/enterprise-decision.test.js` only.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run worker/enterprise-decision.test.js worker/index.test.js src/enterprise/boundary.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/enterprise-decision.mjs worker/enterprise-decision.test.js worker/index.mjs src/enterprise/boundary.test.js
git commit -m "Add an ids-only EnterpRise decision route"
```

### Task 8: Recognition mapper

**Files:**
- Create: `src/enterprise/speech.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `program.presenterIds`, `session.hints()`, `session.hear`.
- Produces: `mapRecognitionEvent(raw, { presenterIds })` returns `{ text, final, speaker, speakerId, at }`.

- [ ] **Step 1: Write the failing test**

```js
import { mapRecognitionEvent } from './speech.js';

it('maps a labeled transcript and treats an unknown voice as the audience', () => {
    expect(mapRecognitionEvent({
        transcript: 'Atlas renewal price',
        isFinal: false,
        speakerLabel: 'ada',
        at: 20
    }, { presenterIds: ['ada'] })).toEqual({
        text: 'Atlas renewal price',
        final: false,
        speaker: 'presenter',
        speakerId: 'ada',
        at: 20
    });
    expect(mapRecognitionEvent({
        transcript: 'cafeteria soup tuesday',
        isFinal: true,
        at: 40
    }, { presenterIds: ['ada'] }).speaker).toBe('audience');
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "unknown voice"`

Expected: FAIL because `./speech.js` does not exist.

- [ ] **Step 3: Implement the mapper**

Implement the function exactly as the spec's recognition section. No `window`, no microphone, no network. `session.hints()` is already the boost list; do not duplicate it.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "unknown voice"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/speech.js src/enterprise/enterprise.test.js
git commit -m "Map recognition events onto EnterpRise speaker roles"
```

### Task 9: Tenant residency and the record connector

**Files:**
- Modify: `src/enterprise/corpus.js`
- Test: `src/enterprise/enterprise.test.js`

**Interfaces:**
- Consumes: `ingestCorpus`.
- Produces: `bindTenant(input, { tenantId, residency })`, `combineCorpora(left, right)`, `corpusFromRecords(records, binding)`. Unscoped `ingestCorpus` sets `tenantId` and `residency` to `'local'`.

- [ ] **Step 1: Write the failing test**

```js
import { bindTenant, combineCorpora, corpusFromRecords } from './corpus.js';

it('refuses to mix residencies and accepts one record connector', () => {
    const binding = { tenantId: 'northwind', residency: 'eu' };
    const left = corpusFromRecords(corpusInput(), binding);
    expect(left.tenantId).toBe('northwind');
    expect(left.residency).toBe('eu');
    const other = bindTenant(corpusInput(), { tenantId: 'northwind', residency: 'us' });
    expect(() => combineCorpora(left, other)).toThrow(/residency/i);
    const right = bindTenant({
        documents: [{
            id: 'ops',
            title: 'Ops note',
            audiences: ['all-hands'],
            pages: [{ page: 1, text: 'The cafeteria serves soup on Tuesday.' }]
        }],
        tables: [],
        entities: []
    }, binding);
    expect(combineCorpora(left, right).documents).toHaveLength(left.documents.length + 1);
    expect(ingestCorpus(corpusInput()).residency).toBe('local');
});
```

`combineCorpora` concatenates disjoint ids and re-ingests. The residency error code is `CORPUS_RESIDENCY` and the message contains `residency`. A tenant mismatch throws code `CORPUS_TENANT`.

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "residencies"`

Expected: FAIL because `bindTenant` is not exported.

- [ ] **Step 3: Implement binding**

`bindTenant` fails with `CORPUS_RESIDENCY` or `CORPUS_TENANT` when the string is missing or untrimmed-empty, then calls `ingestCorpus` and returns a frozen corpus with those two fields. `ingestCorpus` defaults them to `'local'` when absent. `corpusFromRecords` is `bindTenant`. `combineCorpora` checks residency then tenant, then `ingestCorpus` of the concatenated records with the shared binding. Do not add a database or a network fetch.

- [ ] **Step 4: Run the test and see it pass**

Run: `npx vitest run src/enterprise/enterprise.test.js -t "residencies"`

Expected: PASS. Existing ingest tests still pass because they omit the binding.

- [ ] **Step 5: Commit**

```bash
git add src/enterprise/corpus.js src/enterprise/enterprise.test.js
git commit -m "Bind an EnterpRise corpus to one tenant and residency"
```

### Task 10: Page check and the architecture pointer

**Files:**
- Modify: `docs/specs/ARCHITECTURE.md` decision 8.30, one paragraph that names this spec and this plan.
- Modify: `enterprise.html` only if the browser check shows the stage missing or overflowing.

**Interfaces:**
- Consumes: the page from Task 2 and the session from Tasks 1–5.
- Produces: 8.30 still has **Chosen**, **Rejected**, **Why**, and **Status**. Status stays `settled` for the rail and names the spec as the rest of the room.

- [ ] **Step 1: Write the failing check as a browser script, not a new dependency**

With `npm run dev` on `http://127.0.0.1:5173/enterprise.html`, a headless Chromium script asserts, in order: final text `Atlas renewal price` shows `12.4` on the rail and not on the stage; Promote shows `12.4` on the stage; Retract removes it from the stage; the board figure `880` is absent; viewport 390 does not set `scrollWidth` greater than `clientWidth + 1`.

- [ ] **Step 2: Run the script and fix only what it shows**

- [ ] **Step 3: Point 8.30 at the spec**

Add to the Why paragraph: the rest of the room is `docs/superpowers/specs/2026-09-27-enterprise-room-design.md`, executed from `docs/superpowers/plans/2026-09-27-enterprise-room.md`. Do not claim those phases are done.

- [ ] **Step 4: Run the gates this change can affect**

Run: `npx vitest run src/enterprise/enterprise.test.js src/enterprise/boundary.test.js src/core/system-design.test.js worker/enterprise-decision.test.js`

Run: `npm run docs:diagram` and confirm `docs/specs/ARCHITECTURE.md` is unchanged aside from the 8.30 sentence. The new modules under `src/enterprise/` increase that node's module count; commit the generated diagram line if the count changes.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/ARCHITECTURE.md enterprise.html
git commit -m "Point the EnterpRise decision at the room spec"
```
