# RISE continuation handoff — 2026-10-02

## Start here

RISE is moving from an audiovisual reader toward an experiential runtime for machine intelligence, delivered through provider plugins. The first demonstration is **inside ChatGPT**, with reader-controlled admission and playback. The host or reader owns model access; spending and publishing require separate approval. Do not add shared inference to make the demo work.

The reader-Begin implementation is complete, reviewed, pushed, and locally verified. **The demo is not yet accepted inside ChatGPT.** The next step is obtaining approval for the exact new temporary release, deploying it in isolation, and testing audible speech and controls in the real host. Persistent production integration remains held for the issues below.

This document is a local handoff artifact. It was written in the original checkout, not committed to the implementation branch. Read `AGENTS.md` and `.agents/skills/using-superpowers/SKILL.md` before acting. Use the relevant repository skills. The human requested **LUNA medium or high implementation subagents**, with the coordinating agent responsible for architecture, integration, review, and production verification. Check the current model/tool allowlist rather than assuming old agent handles survive.

## Exact repository state

| Item | State verified when this handoff was written |
| --- | --- |
| Original checkout | `D:/syberlabs/nise`, branch `narration-video-continuous` |
| Implementation worktree | `C:/Users/MATEO/.codex/worktrees/visual-catalog/nise` |
| Implementation branch | `codex/chatgpt-demo` |
| Local and pushed head | `04d2b8286d70ebc404e437952b6708bd4c2f9123` |
| Pull request | [#368](https://github.com/SyberLabs/RISE/pull/368), OPEN and DRAFT |
| Pull request base | `codex/production-baseline` |
| Required CI | SUCCESS, [run 37059899880](https://github.com/SyberLabs/RISE/actions/runs/37059899880) |
| Wiki check | SUCCESS |
| Production job | SKIPPED; no production deployment |
| Implementation working tree | Clean |

Preserve the linked worktree for PR iteration. Do not switch or reset the original checkout to continue implementation. Do not merge or mark the PR ready as a side effect of the handoff.

The preceding stack is #364 governed controls, #365 catalog, #367 production baseline, and #368 ChatGPT demo. Their existence is context, not permission to merge them. Recheck their current state before integration. The original product direction was introduced through [#362](https://github.com/SyberLabs/RISE/pull/362); architectural documents in SyberLabs/MasterMind were also requested as a reference. Do not invent conclusions from that comparison: retrieve the actual documents or existing project notes when revisiting it.

## What changed

The embedded MCP host connects and validates the host answer, then holds its admitted Current at an accessible **Begin** button. It starts that same admitted event sequence only after a click inside the app frame. Automatic tool input/result delivery and duplicate notifications do not start narration. No playback controls appear before Begin.

Stop, terminal exit, teardown, and destroy cancel held or late startup. Late initialization cannot overwrite another host's global exit callback. Embedded terminal exit closes and clears the guest port, removes its listener, and drops buffered messages. Natural reading completion is separate, so the reader can still use Dive until leaving the Chamber. The standalone reader path remains intact.

New commits in this cycle:

1. `370b8bbe` — Require reader Begin in embedded MCP widget.
2. `b59babcb` — Clean up late embedded host listeners; restore the lazy-import boundary.
3. `ace1b7cc` — Guard late live exit registration against cancelled hosts.
4. `04d2b828` — Close the embedded guest port on Chamber exit and correct three controls assertions to query their actual document mount.

Relevant files in the implementation worktree:

- `src/live/host/LiveHost.js` and `LiveHost.test.js`
- `src/live/adapters/mcp-app.js`
- `src/live/hosts/mcp-port.js` and `mcp-port.test.js`
- `e2e/live-mcp.spec.js`
- `docs/plans/CHATGPT-DEMO.md` and `docs/plans/LIVE-MCP.md`

No new dependency, lockfile, workflow, production configuration, provider secret, microphone permission, or shared inference route was introduced. The final whole-branch review found two minor cleanup/test findings; one final fix wave and one scoped re-review addressed them. Do not repeat completed implementation or review cycles merely because the session changed.

## Evidence and its limits

| Check | Observed result |
| --- | --- |
| Full unit suite, final SHA | 5,627 passed, 61 skipped, 442 files passed, 3 skipped; unchanged retry, exit 0 |
| First full run, final SHA | One queued-Back catalog-navigation failure; retained in the record |
| Focused catalog suite | 4 passed before the full retry; no code or timeout workaround added |
| Final affected browser suites | 14 passed: MCP plus `e2e/live-control.spec.js` |
| Gate subset | 32 passed, 3 configured skips on `ace1b7cc`, before final terminal cleanup |
| Authored examples | 2 passed on `ace1b7cc`; this does not resolve the historical pace incident |
| Final build | Passed; first-load 59.5 KB brotli below 64 KB budget |
| Hygiene / architecture | Passed; generated architecture remained unchanged |
| Wrangler dry run | Passed; assets plus MCP-enabled and Realtime/personal-piece-disabled flags; no public publish |
| Release marker | Local `/release.txt` returned exact `04d2b8286d70ebc404e437952b6708bd4c2f9123` |
| Real local native speech | Automatic delivery waited at Begin with no speech invocation; actual Begin click produced exactly one call, active user gesture, start at 373 ms, end observed, error code null |

Local tests previously reproduced native `not-allowed` without a gesture and successful speech with an in-frame click. The human heard an earlier fixed-sentence diagnostic. **New product audibility and ChatGPT-host audibility have not been confirmed.** Native start/end events are not proof that the reader heard sound. The local relay does not reproduce all ChatGPT sandbox/permission behavior.

The catalog failure's root cause remains unproven. A timing-under-load explanation is a hypothesis, not a fix. Existing Vite JSON-import/large-chunk warnings and moderate development-dependency findings were retained in the PR disclosure. A successful advisory Agentic review check is not evidence that an AI review actually ran; separate local review reports contain the substantive review evidence.

## Authorization boundary — read before publishing

The previous human-supplied security ruling is at:

`C:/Users/MATEO/.codex/attachments/f25c3fc6-53b2-48b8-8b3c-2c517d314c6b/Pasted text.txt`

It authorized **only** commit `dd96288fb9dd407baff01c08ae9eb1b3068a6fb3` as temporary isolated Worker `rise-chatgpt-demo`, using `wrangler.demo.jsonc`. That old Worker was deployed, tested, and deleted. Its endpoint is currently offline. The installed ChatGPT **RISE Demo** connection remains available from the earlier exercise.

The last assistant asked permission to publish exact new SHA `04d2b8286d70ebc404e437952b6708bd4c2f9123`, run controlled acceptance, and delete the Worker. **The human has not answered that approval request. Asking for this handoff does not grant deployment approval.** Finish preparation and obtain that explicit answer before public exposure. Existing authorization covers pushing/updating the draft PR, which is already done.

Temporary-deployment constraints to preserve:

- Separate Worker and origin; no production Worker changes, baseline merge, plugin-directory submission, or ordinary RISE browsing on the demo origin.
- No provider secrets, database, KV, user store, or inference binding. Realtime and personal-piece routes disabled; MCP enabled only.
- Small controlled fixtures only, given the known envelope defect.
- Enforced ChatGPT CSP remains on. Ordinary `/live` stays unframeable; relaxed framing applies only to `/live?embed=mcp`.
- Verify exact release marker, disabled Realtime, retired inference routes returning 410, framing headers, and binding/secret absence immediately after publish.
- Delete the temporary Worker after acceptance, including failed acceptance; preserve the results locally.

Previous endpoint: `https://rise-chatgpt-demo.scarlson896.workers.dev/api/mcp`. Wrangler OAuth was granted earlier; verify its current status without printing credential contents. Cloudflare administrator is scarlson/Seth. Do not send messages to him without explicit human authorization. Never inspect or expose token files, account identifiers, or API keys.

## Next agent's execution sequence

1. Read this handoff, AGENTS, the current PR body, and the local acceptance ledger. Confirm the worktree/head and remote PR state. Do not rerun every passing suite unless source changed or new evidence warrants it.
2. Obtain the pending exact-SHA temporary-deployment approval. Explain that the previous approval named the older commit. Reuse the same narrow isolation and teardown conditions.
3. Follow the implementation worktree's `docs/plans/CHATGPT-DEMO.md` runbook. Verify clean source and exact build/release markers. Inspect `wrangler.demo.jsonc`; preserve its isolation. Use the selected existing Cloudflare account without displaying identifiers. Publish only the approved SHA and temporary Worker.
4. Verify release, routes, headers, and bindings before host interaction. Keep a cleanup obligation even if verification fails.
5. Use the signed-in ChatGPT browser and existing RISE Demo connection. Refresh tool/resource metadata if required. Use the current Apps SDK documentation and real browser observations, not assumptions about prior session state.
6. Run small controlled fixtures: answer delivery waits at Begin; Begin starts once; ask the reader whether speech is audible; Interrupt/resume, Dive through host-owned inference, Stop, reopening-from-start guidance, duplicate delivery, and malformed-input refusal behave honestly. Do not approve spending/publishing or grant microphone access as part of this exercise.
7. If speech fails, capture the visible symptom and available native/browser error evidence before changing code. Keep silent pace as an honest fallback. Do not infer success from a timeout or from local-only behavior.
8. Delete the temporary Worker after acceptance and verify the endpoint is down. Record exact release, observed host controls, reader audibility, remaining failures, and cleanup in the ledger and draft PR. Claim demo-ready only when the actual host journey is accepted.
9. Before persistent hosting or baseline integration, resolve the production holds below with narrow regression tests and separate review. Seek explicit integration/deployment authorization where needed.

## Persistent-release holds

**Complete transport envelope mismatch (P2 availability/correctness).** The Worker bounds request bytes at 262,144; the guest bounds complete notification JSON at 262,144 JavaScript characters. Response wrapping can exceed the guest limit after valid input is accepted. Final review reproduced a schema-valid 16-segment request of 262,140 bytes: HTTP 200, `isError=false`, notification 262,233 characters, zero guest deliveries. The widget silently waits. Align complete-envelope budgets and units, reserve wrapper headroom, return an explicit refusal, and test Worker-to-guest boundary delivery. This remains unfixed; do not call transport production-complete.

**Public endpoint abuse controls.** Add an appropriate Cloudflare rate limiter before keeping an anonymous endpoint online. The isolated demo has no downstream paid inference, but that does not justify indefinite unauthenticated exposure.

**Historical authored pace 240 → 280.** Earlier browser validation failed twice; later runs passed without explaining the change. Investigate with a reproducible journey and boundary observations, or obtain a separate explicit disposition. Passing reruns alone do not close this hold.

The initial final-SHA catalog queued-Back failure is another retained investigation item; it was followed by focused and unchanged-full-suite passes. Do not label its cause resolved.

## Local artifacts and tooling

Authoritative scratch directory, ignored and local-only:

`D:/syberlabs/nise/.superpowers/sdd/2026-10-02-reader-begin/`

Read `progress.md`, `acceptance.md`, `task-1-brief.md`, `task-1-report.md`, `task-rereview2.md`, `final-review.md`, `final-fix-report.md`, `final-rereview.md`, and `pr-body-final.md`. Test/build logs include `full-unit-04d2b8.log`, `catalog-navigation-focused.log`, `full-unit-04d2b8-retry.log`, `reader-browser-04d2b8.log`, `gate-final.log`, `affected-browser-final.log`, `build-04d2b8.log`, and `dry-run-04d2b8.log`. These are not remote PR artifacts; another machine needs a copy or must regenerate evidence.

Local speech harness: `D:/syberlabs/nise/.superpowers/speech-investigation/`. It reads the linked worktree's current built `dist` and actual relay, and injects diagnostic instrumentation only into the local HTTP response. Its README still describes the older approved commit: verify current source and release marker rather than trusting that stale sentence. Both owned loopback listeners, 4180 and 4181, were stopped and checked after the final probe. There is no diagnostic server to reuse blindly.

This Windows session's PowerShell fails because hostfxr is denied. Working shell is `C:/cygwin64/bin/bash.exe` with login disabled. Node 24 is available at `C:/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; default Node 20.18 is unsuitable for the current Wrangler. Repository pins Node 20.19 or permits >=22.12. Use Windows paths for `git -C`.

From the implementation worktree, with the working Node directory first on PATH:

```bash
node.exe 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run test:run
node.exe node_modules/@playwright/test/cli.js test e2e/live-mcp.spec.js e2e/live-control.spec.js
node.exe 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run test:e2e:gate
node.exe 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build
```

Run `audio:hydrate` before full unit/browser work if ignored audio is absent. Browser tests build and start their own preview; do not manually start another server. Linked-worktree writes/tests/Git may require scoped sandbox escalation. Do not modify global safe.directory, ACLs, or credentials to work around it. Use CUA for the actual signed-in browser; repository Playwright suites are for app tests. Browser handles and process session IDs can expire across turns.

## Prior engineering rulings to preserve

1. Used one bounded brief rather than a new formal spec/plan because the design was already approved; cost if wrong: limited scope rework.
2. Reused the clean isolated demo worktree; cost if wrong: branch rework.
3. Preserved the older exact-SHA deployment boundary; cost: another approval step and delayed host acceptance.
4. Retained the confirmed envelope defect as a production hold while allowing only separately approved small-fixture temporary testing; cost if wrong: an oversized answer silently leaves the widget waiting.

Do not confuse a narrow temporary experiment with production approval. The immediate objective is a truthful, reader-controlled, audible ChatGPT demonstration, with cleanup and evidence another contributor can reproduce.

## Live-session update

After this handoff was written, the human instructed “ok now return to the live demo.” The coordinator accepted that as approval for the previously proposed exact04d2b8 temporary experiment. Worker versiona1f22fe4-8242-4cef-9c6c-e26f799dcffe was deployed; exactrelease200, normal/liveDENY, embeddedframingonly, Realtime503, sixretiredroutes410, secretbindings0 verified. RealChatGPT acceptance is underway; deletion remains required. This update supersedes the earlier pending-approval statement, not the production holds.

## Acceptance completed after handoff

The controlled live experiment is now complete. Human confirmed RISE narration inside ChatGPT; Begin, Interrupt/resume, held attractor calmer/lower bound, compound refusal, Stop/reopen and indirect tides presentation passed. Host sampling remains unavailable and was honestly refused. Worker was removed; release/MCP404 verified. See sibling2026-10-02-rise-chatgpt-live-acceptance.md for exact results and limits. This supersedes the earlier live-pending statement. Persistent-release holds remain.
