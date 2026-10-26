# Maths in both channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every formula a model writes is typeset on screen and said naturally by the voice, both derived from one parse, in Live and Composer.

**Architecture:** One pure finder (`math-text.js`) used by the parser, the chunker, the compiler and the Chamber; one browser module (`math-typeset.js`) that parses each span once with KaTeX and gives HTML plus SRE ClearSpeak speech; the Live runtime holds a maths passage until both can be given, and hands the same spoken string to the governor and the voice.

**Tech Stack:** KaTeX 0.19 (existing), speech-rule-engine 4.1.4 (new, `@xmldom/xmldom` overridden to 0.9.12), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-math-both-channels-design.md`

## Global Constraints

- Nothing new on first load: KaTeX, SRE and its rules load only for a reading with maths.
- No network but RISE's own assets: SRE's rules come through its `custom` loader with `delay: true`.
- `math-text.js` imports nothing that pulls KaTeX or SRE (the Worker bundles what `rise-current.js` reaches).
- No `$`, `\`, `{`, `}`, `^` or `_` ever reaches a voice; no backslash command is ever shown as prose.
- Reader (library) texts chunk exactly as before: maths masking only with `math: true`.
- Local test runs: targeted files only (no full suite on this PC).

---

### Task 1: The finder and the fallback (`src/core/math-text.js`)

- [ ] Corpus `src/core/math-corpus.js`: each case `{ name, text, parts }` (expected split), covering every delimiter, backticks, bare commands, currency, file paths, bars, malformed TeX, nested fractions, matrices, aligned equations.
- [ ] Failing tests in `src/core/math-text.test.js` over the corpus; `fallbackMath` cases (Greek, ², ₀, a⁄b; speech "omega", "a over b", "squared"); `mathDepth`.
- [ ] Implement `splitMath`, `hasMath`, `fallbackMath`, `mathDepth`; run `npx vitest run src/core/math-text.test.js`.
- [ ] Commit.

### Task 2: Bars inside maths (`src/live/adapters/segment-parser.js`)

- [ ] Failing test: `@say the size $|x|$ is` gives `$\vert x\vert $`, a bar outside maths still becomes `/`; chunk invariance over every cut offset.
- [ ] Make `neutralise` maths-aware; run `npx vitest run src/live/adapters/segment-parser.test.js`.
- [ ] Commit.

### Task 3: Phrases (`src/core/chunker.js`, `src/core/rise-current.js`)

- [ ] Failing tests: with `math: true` a long formula with spaces and commas is one phrase; a display formula is its own atom; without the option Reader text is unchanged (existing chunker tests).
- [ ] Mask and restore spans; promote display spans to their own paragraph; the compiler passes `math: true`.
- [ ] Run `npx vitest run src/core/chunker.test.js src/core/rise-current*.test.js`; commit.

### Task 4: Typesetting and speech (`src/core/math-typeset.js`)

- [ ] Failing tests (Node, real KaTeX and SRE): `typeset('E = \frac{1}{2}\hbar\omega')` speech is "E equals one half h bar omega"; html has `.katex` and `<math`; malformed TeX falls back; `speakable` replaces spans and punctuates; results memoised.
- [ ] Implement `loadMath` (KaTeX, CSS, SRE with `custom` loader over `?raw` rule files, ClearSpeak, the two name corrections), `typeset`, `speakable`, `mathState`.
- [ ] Run `npx vitest run src/core/math-typeset.test.js`; commit.

### Task 5: The Chamber (`src/components/read/Chamber.js`, `Chamber.css`)

- [ ] Failing test: a Chamber built before the load redraws its formula once the load settles; a fallback formula has no monospace class.
- [ ] Render through `typeset`; redraw on settle; inline/display/fallback styles.
- [ ] Run the Chamber maths tests; commit.

### Task 6: The runtime (`src/live/runtime.js`, `src/live/atom-map.js`, `src/live/speech-governor.js`)

- [ ] Failing tests: a third beat with maths after the Chamber is up waits for the load, is spoken as its speech, and the governor maps the formula phrase exactly; a load past 3 s commits with the fallback.
- [ ] Start the load on the first maths seen; gate `lower`; one `speakable` per passage for governor and voice; `mapAtoms` takes the transform.
- [ ] Run `npx vitest run src/live/runtime*.test.js src/live/atom-map.test.js src/live/speech-governor*.test.js`; commit.

### Task 7: Dwell for shown formulas (`src/core/rise-current.js`)

- [ ] Failing test: a show beat with a formula gives its phrase ≥ speaking estimate + 300 ms × depth (extra ≤ 2.5 s).
- [ ] Implement in `timeBeats`; run; commit.

### Task 8: What models are told

- [ ] Update `openai-instructions.js` and `src/live/guide/beats.js` lines on maths (§3.8); update their tests.
- [ ] Commit.

### Task 9: Proof and delivery

- [ ] Browser test: a Live answer with maths in its third beat shows `.katex`, no `.is-source`/`.is-fallback`.
- [ ] `node scripts/verify-security-dependencies.mjs` speaks a formula through SRE; `npm audit --audit-level=high` clean.
- [ ] `npx vite build` and `npm run measure:first-load` (unchanged); record the lazy chunk sizes.
- [ ] `npm run docs:diagram` after commit; roadmap task LIVE-031; PR.
