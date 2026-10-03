# Gate 0 Decoupled Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a local isolated probe that separates render tools from data mutations and distinguishes automatic host delivery from reader calls and diagnostic reads.

**Architecture:** Keep the original probe and production runtime unchanged in behavior. A separate experimental server dispatch owns three tools and one RAM run; a versioned widget uses the actual Attractor renderer and the standard parent bridge. Reuse the original probe HTTP admission through narrowly injected state/dispatcher/HTML, retaining its defaults and tests.

**Tech Stack:** Existing Node, vanilla JavaScript, Vite, Vitest and Playwright; no dependencies added.

**Spec:** `docs/superpowers/specs/2026-10-03-gate0-decoupled-design.md`

## Global Constraints

- Local implementation only: no tunnel, production deployment, merge, shared inference, credentials, durable storage or Experience Events.
- Original probe defaults, snapshot validator and browser regression remain reproducible.
- Exactly three tools: rise_open_visual, rise_set_visual, rise_read_visual. Only open attaches a UI resource or compatibility alias.
- One RAM run starts at sequence 0, still/null; open/read never mutate. Required current runId on set/read, correlation only.
- Intensity 0.4–0.75, default 0.65. Still refuses intensity; refusals preserve state. Request cap 16,384 bytes, logs 128 entries.
- No polling, hidden refresh, auto-reopen or fallback message delivery. Manual reads never count as automatic synchronization.
- Root owns integration, documentation and publication; LUNA medium/high agents own implementation. One coding owner at a time.

## Task 1: Separate server tools and preserve HTTP admission

**Owner:** LUNA high.
**Files:** Create `scripts/gate0-decoupled/server.mjs`, `server.test.js`, `vitest.config.mjs`. Modify only `scripts/gate0/server.mjs` to inject state, dispatcher and HTML into existing HTTP wrapper without changing defaults. No widget code in this task.

**Interfaces:** Export `createDecoupledRunState(options = {})`, `dispatchDecoupled(message, state, widgetHtml)`, `startDecoupledServer({port = 4320, widgetHtml, testHarnessHtml = null, state})`. Reuse original createRunState/mutateVisual for strict visual mutation. Add optional `dispatchRequest = dispatch` to handleMcp; startGate0Server accepts optional state, dispatchRequest and widgetHtml, otherwise builds its existing original widget/state. New starter requires supplied HTML until Task 2 adds CLI bundling.

Snapshot exact fields: `{runId, sequence, visual, intensity, serverReceivedAt, serverAppliedAt, observedAt}`. Last-mutation timestamps are null at sequence 0, otherwise copied from the last admitted mutation; observedAt records each snapshot's server observation. Read/open preserve mutation timestamps and sequence. UTC strings use existing ISO format. Data tool replies are standard MCP results with structuredContent and concise text; errors retain isError and no snapshot.

- [ ] Write failing descriptor/state/admission tests. Start with actual assertions:

```js
const state = createDecoupledRunState();
const result = await dispatchDecoupled({jsonrpc:'2.0', id:1, method:'tools/list'}, state, '<html></html>').json();
const tools = result.result.tools;
expect(tools.map(tool => tool.name)).toEqual(['rise_open_visual','rise_set_visual','rise_read_visual']);
expect(tools.filter(tool => tool._meta?.ui?.resourceUri)).toHaveLength(1);
expect(state.sequence).toBe(0);
```

- [ ] Run `node node_modules/vitest/vitest.mjs run --config scripts/gate0-decoupled/vitest.config.mjs`; capture expected missing-export/file failures before implementation.
- [ ] Implement descriptors, closed arguments, run binding, snapshot reads and dispatch. Open accepts only empty plain object, returns baseline snapshot and v2 UI resource, no mutation. Set validates current runId then removes it from a safely validated record before calling original mutateVisual. Read validates current runId and returns snapshot. Set/read declare `ui.visibility:['model','app']`; open declares model visibility. Neither data descriptor nor its result includes template fields.
- [ ] Test real loopback HTTP using startDecoupledServer with inert HTML: bad origin, unknown route, malformed/oversize body, notifications/string IDs, correct tools and refusals. Server close in finally/afterAll. Port 0 in tests. No public URL or process left running.
- [ ] GREEN: new server tests plus original nine unit/bundle tests. Self-review and commit only owned files; report commands/counts, RED/GREEN evidence, public exports and concerns.

## Task 2: Widget delivery evidence and real-renderer harness

**Owner:** Fresh LUNA high after Task 1 approval.
**Files:** Create `scripts/gate0-decoupled/widget-runtime.mjs`, `widget-runtime.test.js`, `widget-entry.js`, `widget-build.mjs`, `widget-build.test.js`, `fake-host.html`, `browser.spec.js`, `playwright.config.mjs`. Append only the CLI entry to new `server.mjs`; no changes to original probe or production source. Use existing isolated config, adding no package scripts.

**Consumes:** Task 1 server/start API and exact seven-field snapshot. **Produces:** `buildDecoupledWidgetHtml()` returning one self-contained HTML/module; executable `node scripts/gate0-decoupled/server.mjs` on loopback 4320. Runtime exports a strict snapshot validator and controller with accept(snapshot, deliverySource), log, renderer/sequence/runId and teardown; source values `initial_render`, `host_notification`, `reader_mutation`, `manual_read`.

- [ ] Write failing runtime/bundle/browser tests before implementation. Baseline assertions:

```js
expect(validateSnapshot({runId, sequence:0, visual:'still', intensity:null,
  serverReceivedAt:null, serverAppliedAt:null, observedAt:utc})).not.toBeNull();
expect(validateSnapshot({...baseline, sequence:1})).toBeNull();
```

Use actual canvas identity in browser tests:

```js
const original = await frame.locator('canvas.attractor-canvas').elementHandle();
await frame.getByRole('button', {name:'Set intensity 0.75', exact:true}).click();
const current = await frame.locator('canvas.attractor-canvas').elementHandle();
expect(await current.evaluate((element, previous) => element === previous, original)).toBe(true);
```

- [ ] Run focused tests and record expected failures.
- [ ] Implement detached strict validation, bounded monotonic same-run acceptance and real renderer reuse. Source is set by the receiving bridge path, never trusted from snapshot. Render result at seq0 is the baseline; duplicate/stale/refused result does not change accepted sequence. Admission timestamps, bridge receipt, renderer acceptance and frame callback remain distinct. Show instance ID and applied sequence; logs capped at 128.
- [ ] Implement parent-source/8,192-byte envelope guard, matched pending requests (max 4, 8-second timeout), teardown and reader buttons. Set0.4, Set0.75, still use tools/call with runId. Read server state uses read tool and is labeled manual_read. Existing fixed marker methods remain separate. Record bounded numeric error code/category where available, no arbitrary response body. Stop is explicit and idempotent; pending completions do not change UI afterward.
- [ ] Build self-contained HTML using existing Vite library pattern and actual Attractor; no external resources or connections. New versioned resource; CLI wraps build and startup. Reuse existing shared renderer, but do not duplicate the original runtime wholesale or introduce a generic transport framework.
- [ ] Fake host handles widget tools/call by POST to actual server. Its model-mutation path can deliberately send or withhold a notification. Tests cover reader positive control, unsolicited notification, withheld delivery followed by explicitly labeled read, unchanged widget/canvas, duplicate/stale/run mismatch, refusals, forged-source delivery, oversized messages, timeouts and teardown. Outsider readiness and forwarding must be witnessed before rejection assertion.
- [ ] Run source-guard removal mutation: temporarily remove only new widget's parent-source guard, prove the foreign-frame test fails, restore exact source and rerun covering checks. No commit includes mutation.
- [ ] GREEN: all new unit/bundle/browser tests and original isolated nine unit/bundle + original browser check. Commit owned files, self-review, detailed report with RED/GREEN/mutation evidence. Do not run production full suite repeatedly or claim real-host behavior.

## Task 3: Integrate docs, verify and review the local experiment

**Owner:** Root integration; independent final reviewer.
**Files:** Approved spec, this plan, `docs/experiments/RISE-GATE0-DECOUPLED.md`, `docs/README.md` index link; generated diagram only if regeneration changes it.

- [ ] Write exact local commands, tool/dataflow/diagnostic limitations and 15-second real-host observation windows. Document current old-host findings as historical; no new-host claim. Include verified process shutdown method to avoid wrapper-child orphaning.
- [ ] Run hygiene, security compatibility/audit, docs diagram/diff, system-design test, wiki build, production build/first-load budget. Old/new focused checks are accepted from Task 2 exact head; repeat only if source changes or concrete concern demands it.
- [ ] Independently review whole new branch delta against recorded baseline88195644, including integration docs and deferred task Minors. At most one final fix dispatch plus scoped re-review, then adjudicate residuals openly.
- [ ] Record actual results and local commit; preserve draft PR371/source baseline. Publishing a separate experiment PR can follow persistent user PR instruction after concrete validation; never force-push #371 or existing stack. Real-host retest requires separate exact-head exposure approval.

## Plan self-review

Task 1 produces the seven-field snapshot and startup API consumed by Task 2. Both touch new server.mjs sequentially; Task 2 adds CLI only. Task 3 consumes both reports and owns docs, not product fixes. All spec requirements have explicit server, widget/harness or integration checks. No placeholder or undefined neighboring interface remains. Narrow HTTP-wrapper injection is chosen to retain tested request admission rather than duplicate it; original defaults and tests are required unchanged.
