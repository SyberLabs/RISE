# Addressable catalog admission implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Search the nine registered procedural surfaces and open an admitted catalog choice through the existing live runtime.

**Architecture:** Immutable core metadata derives identity/descriptions from the existing registry. Pure admission maps Attractor and Klee to existing Current names; the lazy catalog view and deterministic live host consume this contract. All other entries remain specimens, with no claim of live admission or mutable controls.

**Tech Stack:** Existing vanilla JavaScript, Vite, Vitest, Playwright; no added dependencies.

**Spec:** docs/superpowers/specs/2026-10-01-addressable-catalog-design.md (approved).

## Global constraints

- Use the nine entries of LISTED_PROCEDURAL_PATTERNS, not the count of files in src/visuals.
- Keep the existing Current, Player, Chamber and renderer ownership.
- Only the existing Attractor intensity control is advertised as mutable in this slice.
- Keep the three existing Current names compatible; do not widen the visual enum to every registry ID as a shortcut.
- Unsupported or unknown IDs are refused as data at admission; they cannot silently mount nothing.
- No model-generated code, new inference, interaction uploads or second playback pipeline.
- Performance cost is explicitly unmeasured until a reproducible measurement exists.
- No lockfile, dependency, production configuration or workflow changes. No Portal menu change.
- Supported Node: C:/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe. Use cmd.exe for simple commands or C:/cygwin64/bin/bash.exe login:false for quoting; default PowerShell fails here.

## Shared interfaces and file responsibilities

Create src/core/visual-catalog.js with VISUAL_CATALOG and getCatalogVisual(id), queryVisualCatalog({query = '', capabilities, liveOnly = false, includeUnavailable = false}), admitCatalogVisual(id, capabilities). All returned metadata/arrays/receipts are immutable. Search accepts strings of at most 200 characters; unknown/non-string queries return an empty array. Match normalized id, name, description and tags with all whitespace-separated terms. Unknown capability records do not admit drawing. Metadata can still be browsed with includeUnavailable:true.

Each entry derives id/name/description from the registry; contains tags, requires:{canvas:true}, specimen:true, parameters, mutableControls, liveVisual ('attractor' for attractor, 'genesis' for klee, null otherwise), and cost:null. Reuse ATTRACTOR_VISUAL_MANIFEST.parameters for Attractor; all other externally admitted parameter maps and mutableControls are empty. Fixed/default/renderer-owned is explicit reader copy. No copied unbounded setter ranges or invented costs.

Admission returns {status:'accepted',id,visual} or {status:'refused',code}. Codes UNKNOWN_VISUAL, NOT_LIVE_SURFACE, CAPABILITY_UNAVAILABLE. Validate identity/live support before capabilities so unavailable drawing cannot hide an unsupported surface. All nine have specimens; exactly Attractor and Klee have live openings. The text-only floor is a host decision following CAPABILITY_UNAVAILABLE for a known live surface, not admission of an unknown name.

Task 2 creates src/components/VisualCatalog.js/CSS and tests, adds lazy /visual-catalog route in src/app/route-manifest.js, src/app.js and index.html with existing router lifetime conventions. LiveHost adds a Browse visuals link and consumes ?catalog=<id> only on the deterministic mock path. The catalog's admitted-choice link goes to /live?catalog=<id>; no auto-start or new player. The reader chooses Start in the existing host. Selection is revalidated with the host's own capability record.

createMockAdapter gains optional openingVisual ('still'|'attractor'|'genesis'); omit it to preserve every existing script. Unknown constructor values throw. Only the first segment of an answer gets this visual; Dive scripts are unchanged. This changes no open-request schema, protocol enum or stream semantics. No canvas for a known live choice yields openingVisual:'still' plus a visible explanation. Unsupported/unknown catalog queries show a refusal and never become a default selection. Provider/embed/evaluation modes cannot falsely claim to apply a catalog demo choice.

### Task 1: Core catalog and admission

**Files:** Create src/core/visual-catalog.js and src/core/visual-catalog.test.js. Consume visual-registry.js, visual-control-contract.js and existing render/support.js in tests only; do not import renderers in metadata.

**Interfaces:** Produce the shared catalog/query/admission contract above. Later tasks consume exactly those names and receipt fields.

- [ ] Write failing tests for nine identities/descriptions, immutability, search by multiple text terms, 200-character limit, invalid query, includeUnavailable, missing/false/non-boolean canvas capability, and liveOnly. Verify specimen declarations against renderSupportFor for procedural kinds and Attractor field kind.

```js
expect(admitCatalogVisual('klee', {canvas:true})).toEqual({status:'accepted',id:'klee',visual:'genesis'});
expect(admitCatalogVisual('turrell', {canvas:true})).toEqual({status:'refused',code:'NOT_LIVE_SURFACE'});
expect(admitCatalogVisual('attractor', {})).toEqual({status:'refused',code:'CAPABILITY_UNAVAILABLE'});
expect(queryVisualCatalog({query:'nodes regular',capabilities:{canvas:true}}).map(item=>item.id)).toEqual(['neural']);
```

- [ ] Run src/core/visual-catalog.test.js red with supported Node and node_modules/vitest/vitest.mjs; retain intended failures in report.
- [ ] Implement metadata by mapping LISTED_PROCEDURAL_PATTERNS. Centralize the two admitted aliases in this core module, and reuse the verified Attractor parameter object. Deep-freeze created data; return null for unknown getCatalogVisual IDs and bounded refusal data for admission.

```js
// Identity and copy originate in the existing registry, never a second independent list.
export const VISUAL_CATALOG = Object.freeze(LISTED_PROCEDURAL_PATTERNS.map(pattern => Object.freeze({
  id: pattern.id, name: pattern.name, description: pattern.description,
  // verified declarations specified in the shared contract
})));
```

- [ ] Run catalog, existing visual-registry/taxonomy, live boundary and rise-current tests; confirm no live import in core and no lazy-renderer regressions. Self-review and commit owned files; report exact commands/results.

### Task 2: Catalog view and existing-runtime sample admission

**Files:** Create src/components/VisualCatalog.js, VisualCatalog.css, VisualCatalog.test.js; modify src/app/route-manifest.js/tests, src/app.js and index.html; modify src/live/host/LiveHost.js/tests; modify src/live/adapters/mock.js/tests; modify src/live/capabilities.js/tests only for truthful drawing detection.

**Interfaces:** Consume Task1 catalog functions. Produce lazy /visual-catalog page, /live?catalog=<id> local sample selection, and createMockAdapter({openingVisual}) as specified. Existing protocols and Player remain unchanged.

- [ ] Write failing UI/host/mock tests before implementation. Catalog searches metadata, exposes readable bounds/default and cost-unmeasured copy, has specimen-only labels, offers live links only for admitted choices, and preserves descriptions when drawing is unavailable. Unknown and unsupported URL IDs refuse; known live ID without drawing opens still with an explanation. Default mock scripts and every Dive remain unchanged. Test actual null 2D context detection (method existence alone is insufficient); use separate canvases for 2D and WebGL2 probes so a 2D context does not falsely disable WebGL2.

```js
const adapter = createMockAdapter({clock,openingVisual:'genesis'});
// With existing adapter test helpers, collect an answer and a Dive:
expect(answerEvents.find(e=>e.type==='segment.begin').visual).toBe('genesis');
expect(diveEvents).toEqual(defaultDiveEvents);
// Catalog view unit test uses real DOM and injected environment; no production test hooks.
```

- [ ] Run intended red tests and record exact evidence.
- [ ] Render accessible search/cards using textContent or existing escaping. Display all nine entries by using includeUnavailable:true, with truthful capability/live/specimen labels. Preview only after the reader requests it; reuse visualCortex.renderLeafStill(id) through the existing stillQueue serialization/cache, lazy imports and safeUrl. Dispose owned requests/listeners on navigation; a stale preview must not mutate a departed view. Do not destroy the shared cortex or render nine expensive specimens eagerly.
- [ ] Add the lazy route/container and direct path boot/history handling using existing public-room patterns. Link from /live, preserve Portal menu count and existing VisualNavigator/Living Flame editor behavior.
- [ ] In LiveHost, revalidate the catalog query inside its mock adapter path and use openingVisual only for the prepared answer. CAPABILITY_UNAVAILABLE on a known live choice maps to still with clear reader copy; any other refusal prevents Start from opening a provider/player. Prevent catalog-demo claims in keyed, embed and evaluation modes; preserve their existing behavior or explicitly refuse the conflicting query before side effects.
- [ ] Implement mock opening override as a copy of only the first answer segment, leaving fixtures and Dive scripts immutable. Constructor validates its closed names. Keep existing stream/lowering/runtime unchanged.
- [ ] Run new and existing route, host, mock, capability, catalog, runtime, controls, Current and boundary tests. Self-review/commit owned files; report red/green commands and lifecycle evidence. Do not modify production configuration or run full CI/browser; coordinator and Task3 own those.

### Task 3: Browser admission proof and documentation

**Files:** Create e2e/visual-catalog.spec.js using existing fixtures; extend docs/plans/LIVE-CURRENT.md. Keep source fixes with coordinator routing to their original owner.

**Interfaces:** Consume the real /visual-catalog page and /live?catalog=klee|attractor. Existing Playwright global setup owns the production build and preview server.

- [ ] Write browser acceptance tests. Search to the Klee card, request a specimen and verify it actually loads; follow its admitted link, Start and verify real mounted Klee/Genesis canvas paints while narration text advances. Repeat the actual renderer proof for Attractor (existing live-control paint checks can be reused/run). Verify specimen-only surfaces cannot become a live sample, unknown direct URL refuses, and no 2D context yields readable words without imagery and an explicit explanation. Use actual canvas bytes or loaded rendered specimen pixels, never just metadata or a receipt.

```js
expect(paintedCanvasBytes.some(byte=>byte!==0)).toBe(true);
await expect.poll(()=>shownNarration()).not.toBe(beforeNarration);
```

- [ ] Run feature browser tests with supported Node and node_modules/playwright/cli.js. Hydrate audio before tests; Chromium is already installed. Do not start a second server. If existing implementation satisfies the first acceptance run, report that honestly rather than fabricate a red failure. If it fails, distinguish harness issues from concrete runtime defects and report those before fixes.
- [ ] Document catalog scope, nine surfaces versus two live admissions, fixed/default parameters versus Attractor mutable intensity, capability floor, sample URLs, cost-unmeasured status and real-provider/perceptual limits.
- [ ] Run feature and live-control suites plus browser gate. Self-review/commit owned test/docs files; report exact commands/results and skipped/environment limitations. Coordinator runs independent feature checks, full units and exact required CI checks, regenerates the architecture graph, measures production first-load budget and dispatches final whole-change review.

## Controller checks

- [ ] Verify isolated native worktree and baseline tests, set up plan-specific ignored ledger/briefs/reports.
- [ ] Self-review spec coverage, placeholders and consistent interfaces; preflight shared-file/interface table.
- [ ] Sequential LUNA implementations with task-scoped spec/quality review and fixes before successors.
- [ ] Hydrate audio/install dependencies and use verified FFmpeg/Chromium for full checks.
- [ ] Independent browser/full-unit/required CI checks; reproducible generated diagram and first-load budget.
- [ ] Most-capable whole-change review; one consolidated LUNA fix wave and scoped re-review if required.
- [ ] Collect exhaustive rulings, clean only this plan's scratch, preserve managed worktree and follow finishing workflow. No merge/deployment authorized.
