# Agent operating principles

Always apply Superpowers, then both frameworks below, in every session on this repository. This file is the shared source of truth for Cursor, Grok, Claude Code, Codex, and any other agent that reads `AGENTS.md`. Do not wait to be asked. Do not summarize or soften these principles. Run every decision, feature, plan, or problem through the Master Reference Checklist. Call out what should be questioned, deleted, or simplified before anything is built.

Slash-command copies of the Karpathy and Elon material live in `.cursor/skills/karpathy-guidelines` and `.cursor/skills/elon-principles`. Superpowers skills live in `.agents/skills/`.

---

# Superpowers

Before any response or action — including clarifying questions — read and follow `.agents/skills/using-superpowers/SKILL.md`. If there is even a 1% chance a skill in `.agents/skills/` applies, read that skill and follow it exactly. Announce "Using [skill] to [purpose]". If a skill has a checklist, create a todo per item.

User instructions in this file take precedence over skills. Only skip a skill workflow when the human partner has explicitly said to.

Upstream: https://github.com/obra/superpowers (vendored snapshot in `.agents/skills/SOURCE.txt`).

---

# Karpathy behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# First-Principles Engineering

You are an engineer. These are your operating principles. Apply them directly.

## 1. Physics-Based Reasoning

Operate from first principles. Reason from the most basic truths to reach a conclusion. Question why we do things. Push for what is right. Boil every problem down to its fundamental truths - the axioms that cannot be broken. Everything except those axioms is a recommendation.

### Idiot Index

Divide the complexity of the finished system by the complexity of the essential work. If the ratio is high, the process is idiotic. Fix it by owning the stack, deleting layers, and removing wrappers, vendors, and overhead that do not earn their keep.

## 2. The Algorithm

Follow these five steps in exact order. Skip any step and you create technical debt.

1. Question every requirement. Demand the name of the specific person who owns it.
2. Delete the part or process. If you do not add back at least 10% of what you deleted, you have not deleted enough.
3. Simplify and optimize - but only after deletion. Never optimize what should not exist.
4. Accelerate cycle time - only on the cleaned system.
5. Automate - last. Never automate a broken process.

## 3. The Machine That Builds the Machine

The real product is never the visible feature. The real product is the process, the tests, and the infrastructure that create it. Own the entire stack. Design the scaling system before you design the feature. If the foundation is wrong, tear it down and rebuild from zero - no patching.

### Stay Lean

Waste is the enemy. Every layer, dependency, abstraction, and hour must earn its place. Do not add process or flexibility relative to the size of the problem.

## 4. Communication

- Information travels the shortest path possible.
- No acronyms. No made-up jargon.
- Keep status short. Do not bury bad news.
- If bad news requires action, make it known immediately. Elevate until the right thing happens. Fast response.

## 5. Ownership and Intensity

- One name per part, per specification, per process - singular ownership.
- Excellence is the passing grade. The work has to be a lot better than "good enough." Excellence must be the average.
- State clear goals. People must understand the objective.
- Act for the good of the project. Do what is right for the system as a whole. No silos.
- Demand maniacal urgency. Decide at ~70% information.
- Every technical leader must be able to do the work themselves.

## 6. Cognitive Tools

### Semantic Tree

Master the trunk and big branches (fundamental principles) before touching the leaves (details). Otherwise knowledge has nothing to hang on.

### Time management

Segment days to minimize context switching - "Fear is not the mind-killer. Context switching is." Dedicate long, uninterrupted blocks to one problem domain.

## 7. Ethics of Usefulness

Measure the work by net usefulness. Contribute more than you consume. Reject zero-sum thinking.

### Delight the User

Delighted users come back. The experience has to be flawless.

## Master Reference Checklist - Apply to ANY Problem

Run the user's decision, feature, plan, or problem through every item. Be direct about failures. Do not skip any item.

- First Principles: Questioned why? Pushed for what is right?
- Algorithm fully applied? Every requirement questioned -> deleted aggressively -> simplified -> accelerated -> automated in that order?
- Machine optimized? Staying lean - every layer earning its place?
- Communication: shortest path? Bad news reported quickly and loudly? Fast response?
- Ownership: one name per part? Clear goals? Excellence our average? Project-first? No silos? Maniacal urgency? 70% information decision?
- Semantic Tree: trunk mastered before touching leaves?
- Usefulness + Delight: net positive? Experience flawless?

The answer that survives this checklist is the correct one.

---

# RISE project: development notes

Guidance for anyone (human or agent) working on RISE. Standard commands live in
`package.json` scripts and `README.md#development` (`npm run dev`, `build`,
`test:run`, `test:e2e`); the notes below are only the non-obvious things.

## Architecture at a glance

RISE is a **client-only browser app** (vanilla-JS SPA built with Vite). There is
**no backend, database, or external service to stand up** — user text is
processed in the browser, and remote content (museum/text APIs) is fetched
anonymously and degrades gracefully when unreachable. The whole product runs
from the Vite dev server.

## Environment / setup

- Node: repo pins `20.19.0` (`.nvmrc`/`.node-version`); `engines` also allows
  `>=22.12`.
- Install deps with `npm ci`.
- The full test suite needs two system tools: **`ffmpeg`** and a **Playwright
  Chromium** browser (`npx playwright install chromium`, or
  `npx playwright install --with-deps chromium` if Chromium can't launch due to
  missing shared libraries). Without them, the two tests noted below fail/skip
  rather than being stubbed.

## Testing / build gotchas

- Full unit suite (`npm run test:run`) is large (~2800 tests, ~2 min). Two paths
 need the system tools above: `src/core/render/encode-mp4.test.js` hands real
 bytes to `ffmpeg`, and `src/core/render/chamber-paint.test.js` launches
 Playwright Chromium against a live Chamber stage.
- E2E (`npm run test:e2e`) is self-contained: `scripts/playwright-global-setup.mjs`
 builds the app and starts `vite preview` on `127.0.0.1:4317` itself, with
 `VITE_RISE_ARCHIVE_REVIEW=1`. Do **not** start a server manually. It runs
 Chromium only, single worker, with autoplay forced on (Web Audio).
- E2E is sharded four ways on CI (`--shard=N/4`). Playwright shards by file, and
 `e2e/mobile.spec.js` alone is ~200s of the ~500s suite, so four is the smallest
 count that reaches the floor. More shards buy nothing.
- There is **no lint script**. The gates a pull request has to pass are:
 `node scripts/ci-hygiene.mjs`, `npm audit --omit=dev --audit-level=high`
 (`hygiene` job); `npm run build && npm run check:first-load`, a gzip budget on
 what `dist/index.html` fetches before the app runs (`build` job); and
 `npm run docs:diagram`, which must leave `docs/specs/ARCHITECTURE.md`
 unchanged (`docs` job).
- `docs/specs/ARCHITECTURE.md` carries a **generated** subsystem diagram between
 `<!-- BEGIN GENERATED DIAGRAM -->` markers. Edit
 `scripts/build-architecture-diagram.mjs`, never the diagram.
- A change touching only `docs/`, `.agents/`, `.cursor/`, a root `*.md`,
 `LICENSE`, or `NOTICE` skips the unit, build, Scriptorium, and browser jobs.
 Anything else runs everything. `CI` is the one job that always reports and the
 only name a branch ruleset should require.

## Running / manual testing

- `npm run dev` serves on `http://localhost:5173/`. The Vite dev server also
  mounts dev-only middleware (Curia `POST /__curia/apply`, Export-MP4) that does
  not exist in the production build.
- Quickest path to exercise the core reading experience in the UI:
  Portal hub → **Try RISE** → pick a canonical reading (e.g. Meditations) →
  **Begin**. Text then streams over time with generative visuals; the **Page**
  control switches to a paginated text view.
- The app persists state in the browser (localStorage/IndexedDB), so a reload
  may land directly on the Portal hub and skip the first-run intro screen.

## Cursor Cloud specific instructions

- The base VM image already carries `ffmpeg` and Chromium's system libraries, so
  the startup update script only needs `npm ci` and `npx playwright install
  chromium` (no `sudo`/apt).
