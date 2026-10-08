# Agent operating principles

This file is the shared source of truth for every agent working on RISE
(Cursor, Grok, Claude Code, Codex, and any other agent that reads `AGENTS.md`)
and for humans. It is loaded into every session, so it holds only what applies
to every task. The full frameworks live in skills:

- Superpowers workflow: `.agents/skills/` (pinned in `.agents/skills/SOURCE.txt`)
- First-principles engineering: `.cursor/skills/elon-principles/SKILL.md`
- Karpathy coding guidelines: `.cursor/skills/karpathy-guidelines/SKILL.md`

Precedence: the human partner's direct instructions, then this file, then
skills, then your defaults.

## 1. Skills first

Before any response or action, including clarifying questions, read
`.agents/skills/using-superpowers/SKILL.md` and follow it. If a skill in
`.agents/skills/` could apply, read it and follow it exactly. Announce "Using
[skill] to [purpose]". If the skill has a checklist, make one todo per item.
Skip a skill workflow only when the human partner has said to.

## 2. Reason from first principles

- Reduce the problem to what must be true. Everything else, including existing
  code, convention, and "how it is usually done", is a recommendation.
- Apply these steps in order. Never skip ahead:
  1. Question every requirement. Name who needs it and why.
  2. Delete the part or process that fails that question.
  3. Simplify what is left. Never optimize something that should not exist.
  4. Shorten the cycle time.
  5. Automate last. Never automate a broken process.
- Compare the complexity of the result with the complexity of the essential
  work. A large gap means layers, wrappers, or dependencies to delete.
- The tests, tooling, and process that produce a feature matter as much as
  the feature. If a foundation is wrong, rebuild it rather than patch it.

## 3. Write the smallest correct change

- State your assumptions. When a request has more than one reading, name the
  readings instead of silently picking one.
- Decide and proceed when the choice is reversible and the answer follows from
  the request, the code, or a sensible default. Stop and ask when the choice is
  hard to reverse, changes what the user gets, or you are confused.
- Write the minimum code that solves the problem. No speculative features,
  single-use abstractions, unrequested configuration, or handling for
  impossible cases.
- Touch only what the task needs. Match the surrounding style. Do not refactor
  or reformat adjacent code. Remove only what your own change made unused;
  mention other dead code instead of deleting it.
- Turn the task into a check you can run: reproduce a bug in a test, then make
  it pass. Loop until the check passes. Never claim a result you did not see.

## 4. Communicate plainly

- Keep status short. Lead with bad news and what it blocks.
- Use plain words. Spell out abbreviations a newcomer would not know.
- One owner per part, task, and pull request.

## 5. Check before you finish

Run the decision, feature, plan, or problem through this list and say plainly
where it fails:

- Was every requirement questioned, and what was deleted before anything was
  simplified or added?
- Does every layer, dependency, and line earn its place?
- Were the fundamentals understood before the details?
- Is the result verified by something that ran, not by reasoning alone?
- Is the experience for the reader of RISE, and for the next contributor,
  flawless?

---

# RISE project: development notes

The non-obvious things. Standard commands live in `package.json` scripts and
the Contributing section of `README.md`. Known pitfalls and the reasons behind
unusual decisions live in `docs/PROJECT-KNOWLEDGE.md`.

## Architecture at a glance

RISE is a vanilla-JS single-page app built with Vite. Reading and
browser-local work stay client-side. Its production Cloudflare Worker serves
the app and a static public catalog built from `src/content/decision-catalog.json`.
RISE spends no shared inference: reader recommendations use the reader's own
OpenRouter account or pinned Kev on the reader's computer. Former shared model
routes return 410. RISE in ChatGPT is Composer: the host model composes one
sealed Current in a single MCP tool call, the Worker admits it, and RISE
presents it under the reader's control. Dive and realtime Live are out of
current scope; the live Realtime page stays switched off by default. See
`docs/USER-OWNED-AI.md`, `docs/plans/LIVE-MCP.md` and
[the Composer decision](docs/product/discussions/2026-10-04-composer-decision.md).

## Environment / setup

- Node: the repo pins `20.19.0` (`.nvmrc`, `.node-version`); `engines` also
  allows `>=22.12.0`.
- Install dependencies with `npm ci`.
- Run `npm run audio:hydrate` before local recitation, the full unit suite, or
  browser tests. It restores ignored WAV files from the pinned audio branch.
- The full test suite needs two system tools: **`ffmpeg`** and a **Playwright
  Chromium** browser. If Chromium is already installed (cloud agent images
  usually carry one), use it; otherwise run `npx playwright install chromium`,
  or add `--with-deps` if Chromium cannot launch because shared libraries are
  missing. Without these tools the two tests noted below fail or skip rather
  than being stubbed.

## Testing / build gotchas

- The full unit suite (`npm run test:run`) runs for minutes. Two paths need
  the system tools above: `src/core/render/encode-mp4.test.js` hands real bytes
  to `ffmpeg`, and `src/core/render/chamber-paint.test.js` launches Playwright
  Chromium against a live Chamber stage.
- Browser tests (`npm run test:e2e`) are self-contained:
  `scripts/playwright-global-setup.mjs` builds the app and starts
  `vite preview` on `127.0.0.1:4317` with `VITE_RISE_ARCHIVE_REVIEW=1`. Do
  **not** start a server manually. They run Chromium only, one worker, with
  autoplay forced on (Web Audio). `npm run test:e2e:gate` is the fast subset;
  run it before pushing.
- There is **no lint script**. The pull request `CI` job runs, in one job:
  `node scripts/ci-hygiene.mjs`, `npm run security:audit`,
  `npm run security:compat`, `npm run docs:diagram` (which must leave
  `docs/specs/ARCHITECTURE.md` unchanged), a fixed set of fast unit tests
  including `src/core/system-design.test.js`, `npx vite build`, and
  `npm run measure:first-load`, which holds what `dist/index.html` fetches to
  a ratcheting brotli budget declared in the script, then the browser gate
  (`npm run test:e2e:gate`, a few minutes). It runs for every pull request,
  including prose-only changes. The fast unit test list, and the number of
  files it must collect, are in `vitest.fast.config.js`.
- After a merge, the `CI` job runs again on `main` and uploads the `dist/` it
  built; the `production` job waits for it and deploys that artifact without
  rebuilding. The full unit, Scriptorium, and sharded browser suites run on
  `main` after that and on manual dispatch; they do not hold deployment.
- `docs/specs/ARCHITECTURE.md` §3 carries a **generated** import graph between
  `<!-- BEGIN GENERATED DIAGRAM -->` markers. Edit
  `scripts/build-architecture-diagram.mjs`, never the diagram. The rest of that
  file is hand-written and guarded by `src/core/system-design.test.js`.
- This file is published to the repository wiki by `scripts/build-wiki.mjs`.
  Any relative Markdown link in it must point at a file in the tree, or the
  wiki build fails.
- The main-branch ruleset requires one check and no human approval: `CI`.
  It also requires every review thread resolved. Never make a check that only
  runs after merge required; it blocks pull requests forever.
- `Codex feedback` (`.github/workflows/codex-feedback.yml`) is not a check.
  It runs when Codex submits a review with unresolved findings and answers
  them under the Reviewer findings contract above. It is not required and
  must never be.

## Public dependency lookup (GitHits)

- `.mcp.json` registers the hosted GitHits MCP server
  (`https://mcp.githits.com`, OAuth on first use via `/mcp`). Headless
  agents set `GITHITS_API_TOKEN` in the environment; never write a token to
  a file.
- Use it for the exact source and docs of the dependency version in
  `package-lock.json`, and for vulnerability, changelog, and upgrade checks
  before bumping a dependency.
- It indexes public open-source code only. Never send it private RISE code,
  tokens, secrets, or personal data; it cannot answer questions about this
  repository.

## Product roadmap and task tracking

- Before selecting work, read [the product library and tracker](docs/product/README.md) and the applicable Reader or Composer + RiseSDK direction. Shared foundation work has its own lane.
- Run `npm run roadmap:check`; claim one task in `docs/product/tasks/` with one owner, and honor dependencies and acceptance criteria. Coordinate before replacing another owner.
- Update the task record in the same PR as the work, using the validated CLI described in the product library. Link exact PR/commit/test evidence and separately record human observations. Keep branch, merged, deployed and accepted distinct; a green build cannot pass human gates.
- Review recent unmapped changes and link them to tasks when justified. Do not automatically complete tasks from PR status or copy historical test counts as current evidence.
- The local read-only team dashboard runs with `npm run roadmap:dev`; product discussions are indexed under `docs/product/`. Hosting follows a separate content/access review.

## Parallel agent work

- For independent backend and client changes, use separate worktrees and
  branches. Agree on the endpoint shape and error behavior before coding.
- Give one agent `worker/*` and its tests, another `src/*` and its tests, and
  a third read-only review when useful. Each coding agent owns one narrow
  pull request.
- Keep `.github/workflows/*`, `wrangler.production.jsonc`, the lockfile,
  integration, and production verification with the coordinating agent.
- Merge through the required `CI` check, then verify the exact live release.
  Do not add an agent service or another required check for fan-out.

## Reviewer findings

Codex reviews every pull request and opens a review thread per finding. The
author agent, not a human, answers every thread, with exactly one of two
replies, then resolves it:

- `Fixed in <short sha>: <one line>` after the smallest correct change and the
  narrowest test that proves it. Commit as `Codex: <what changed>`.
- `Not a defect: <one-line reason>` when the finding is style, naming,
  preference, or speculative hardening. A defect is something that would ship
  a bug, a security hole, data loss, a broken build, or a failing test.

A thread left unanswered is a merge blocker, not an opinion. When the author
session is gone, `.github/workflows/codex-feedback.yml` answers in its place
(Sonnet, bounded turns, two rounds per pull request) and arms auto-merge.
Humans review the product at the live site, not the pull request.

## Running / manual testing

- `npm run dev` serves on `http://localhost:5173/`. The Vite dev server also
  mounts dev-only middleware (Curia `POST /__curia/apply`, Export-MP4) that
  does not exist in the production build.
- Quickest path through the core reading experience: Home → **Library** →
  **Keystones** (or open `/try-rise`) → pick a canonical reading (e.g.
  Meditations) → **Enter reading**. Text then streams over time with
  generative visuals; the **Page** control switches to a paginated text view.
- The app persists state in the browser (localStorage and IndexedDB), so a
  reload may land directly on Home and skip the first-run intro.

## Cloud agent images

- Cursor Cloud: the base image already carries `ffmpeg` and Chromium's system
  libraries, so the startup script only needs `npm ci` and
  `npx playwright install chromium` (no `sudo` or apt).
- Claude Code on the web: Chromium is preinstalled and Playwright is
  configured to find it. Do not run `npx playwright install`.
