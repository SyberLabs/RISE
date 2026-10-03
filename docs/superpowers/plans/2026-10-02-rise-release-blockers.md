# RISE Release Blockers Resolution Plan

> **For agentic workers:** Use subagent-driven-development for approved implementation slices, with LUNA medium/high implementers and coordinator-owned integration/review. This is a release roadmap: investigate each defect, then write its narrow implementation brief from the observed cause. Do not treat investigative steps as an already proven design.

**Goal:** Release a dependable, persistent ChatGPT beta of reader-controlled RISE without shared inference or first-party state exposure.

**Architecture:** Keep the presentation runtime on a separate origin from ordinary RISE browsing. RISE validates and plays Currents; ChatGPT or the reader owns inference. Add bounded delivery and abuse controls to the existing transport rather than adding a database, model proxy, or agent service.

**Tech Stack:** Vanilla JavaScript, Vite, Cloudflare Worker, MCP Apps bridge, Vitest, Playwright.

**Spec / evidence:** `docs/superpowers/handoffs/2026-10-02-rise-chatgpt-reader-begin.md` and `docs/superpowers/handoffs/2026-10-02-rise-chatgpt-live-acceptance.md`. Read the implementation versions of `docs/USER-OWNED-AI.md`, `docs/plans/LIVE-MCP.md`, and `docs/plans/CHATGPT-DEMO.md` before execution.

## Global constraints

- Verified starting implementation: branch `codex/chatgpt-demo`, SHA `04d2b8286d70ebc404e437952b6708bd4c2f9123`, draft PR #368, base `codex/production-baseline`.
- Implementation worktree: `C:/Users/MATEO/.codex/worktrees/visual-catalog/nise`; original checkout `D:/syberlabs/nise` is a different branch.
- The controlled real ChatGPT demonstration passed; the human confirmed narration. Its temporary Worker has been removed and returns 404.
- Persistent deployment, baseline merge and public-directory publication are separate decisions. Temporary-demo authorization does not authorize indefinite hosting.
- Reading/local work stay client-side. No shared inference, stored provider keys, production-origin embedded state, or microphone permission expansion.
- One owner per implementation slice. Use separate worktrees for independent Worker/client edits; agree on the transport contract first.
- Coordinator owns configuration, workflow integration, lockfile decisions, live verification and deployment. Use existing required CI; do not add a fan-out service or another required check.
- Run meaningful RED/GREEN regressions. Do not close unexplained failures merely because a retry passed.

## Release sequence

### 1. Eliminate silent transport loss — confirmed blocker

**Why:** A valid request can be accepted by the Worker and silently dropped by the guest. Reproduction: 262,140 request bytes, HTTP200/isErrorfalse, 262,233 notification characters, zero deliveries. The Worker caps request bytes; the guest caps complete JSON string characters. Matching the two numeric constants does not solve wrapper overhead or differing units.

**Owner:** One LUNA implementer owns the agreed end-to-end transport slice; coordinator reviews interface and cross-boundary proof.

**Files to inspect/change:** `worker/mcp-server.mjs`, `worker/mcp-server.test.js`, `src/live/hosts/mcp-port.js`, `src/live/hosts/mcp-port.test.js`, `src/live/host/LiveHost.js`, `src/live/host/LiveHost.test.js`, `e2e/live-mcp.spec.js`. Introduce a shared size helper only if both sides actually need it.

- [ ] Recreate the reported near-limit request in a Worker-response-to-guest integration regression and see it fail.
- [ ] Define a bounded Current payload and complete-message policy, including Unicode/UTF-8, input/result wrappers and host-added metadata headroom. Choose explicit supported bounds from measured serialized messages; do not simply increase the limit.
- [ ] Add boundary cases below/at/above admission, multibyte text, escaped text, result-only delivery and paired input/result delivery.
- [ ] Require that every accepted supported Current reaches the reader exactly once. Oversized proposals must produce an actionable refusal and permit a corrected retry. Cover a host input notification followed by a refused result: it must not leave rejected content available for playback.
- [ ] Implement the smallest shared contract and refusal path, preserving strict schema validation and source checks.
- [ ] Run Worker/guest/host focused suites and the real relay browser suite; obtain independent review and commit the slice.

**Exit evidence:** Previously failing near-limit fixture passes; accepted messages reach Begin exactly once; refused messages never play and corrected small requests recover.

### 2. Protect persistent public serving — confirmed blocker

**Why:** The anonymous MCP endpoint currently has no rate limiter. Statelessness and no paid inference reduce damage but do not bound sustained public abuse.

**Owner:** LUNA Worker implementer; coordinator owns reviewed hosting configuration and Cloudflare coordination.

**Files:** `worker/mcp-server.mjs`, `worker/mcp-server.test.js`; inspect `worker/index.mjs` for routing placement. Keep `wrangler.demo.jsonc` temporary. Choose a separate persistent embed configuration/origin before adding its binding; do not enable framing on the ordinary production origin.

- [ ] Establish the normal ChatGPT initialization/tool/resource request pattern, then propose a documented rate/burst policy that allows that pattern.
- [ ] Use Cloudflare's native rate-limiting binding; key requests using trustworthy edge information. Account for provider egress addresses potentially serving multiple readers. Do not assume a per-address limit identifies a person or guarantees global quotas.
- [ ] Test allowed requests, exceeded requests, recovery, binding failure/unavailability and missing client information. Define explicit failure behavior; prevent an unavailable limiter from silently leaving the route unlimited.
- [ ] Apply checks before expensive parsing/validation where feasible. Retain body-size, JSON-only and browser-Origin checks. Return a clear throttling response without reflecting request content.
- [ ] Verify the deployed limiter with a small authorized controlled burst and a normal ChatGPT flow.

**Exit evidence:** Normal host requests work; excess requests are predictably refused; limiter failure follows the documented policy; isolated origin has no provider secret, reading history or persistent reader store.

Reference: [Cloudflare rate-limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). It is local to Cloudflare locations and is not a precise global accounting mechanism.

### 3. Resolve unexplained reading-state failures — baseline integration hold

**Why:** Authored export unexpectedly changed 240 to 280 words per minute in earlier browser runs. Final-SHA unit validation also once failed queued catalog Back navigation, then passed focused and unchanged-full-suite retries. Neither cause is established.

**Owner:** LUNA client investigator/implementer; coordinator adjudicates whether findings affect the isolated beta, baseline, or both.

**Files:** `e2e/authored-examples.spec.js`, `src/app.visual-catalog-path.test.js`; follow their imports to the actual pace persistence/export and Portal navigation owners before editing them.

- [ ] Replay the original failing journeys at their failing revisions and current head, with fresh browser state. Preserve the original failure evidence.
- [ ] Trace authored pace through slider/input, saved project, reopen, and exported bundle. Locate the first point where 240 becomes 280; distinguish event delivery from state persistence.
- [ ] Trace queued Back through the real transition completion and destination consumption. Distinguish lost navigation from an assertion that races an unfinished transition.
- [ ] Turn each established cause into a deterministic regression, then fix the responsible boundary. If the issue is in the test, wait for the actual completion contract rather than adding arbitrary sleep or merely raising a timeout.
- [ ] Run affected journeys and the full suite under representative load after changes. Record the cause and evidence. If a cause cannot be reproduced, keep the hold open or seek a separately explicit risk disposition.

**Exit evidence:** Pace persists as 240 through export; queued Back lands at the catalog; regression exercises the observed cause. Passing retries alone are insufficient.

### 4. Define and verify the beta product promise — scope decision and acceptance gaps

**Why:** Audible presentation works in ChatGPT, but the tested host does not offer widget model sampling. In-place model-powered Dive therefore remains unavailable. Reduced-motion live rendering and independent first-time reader use were not verified.

**Owner:** Coordinator owns the beta promise; LUNA client implementer only if the agreed capability presentation requires changes.

- [ ] Describe the initial beta accurately: spoken/visual host answers, Begin, held reading, local calmer, resume/Stop and reopen. Do not advertise working in-place AI Dive on this ChatGPT connection.
- [ ] Inspect the existing capability state and UI. Show unsupported Dive before the reader submits a question if feasible within the existing capability contract; preserve a clear refusal if capability changes.
- [ ] If in-place Dive is mandatory for release, create a separate provider-interaction design. Evaluate a documented conversation follow-up route with explicit context and return behavior. A message sent to ChatGPT is not proof that its answer returns to the same widget. Preserve host/reader-owned inference.
- [ ] Verify reduced-motion, keyboard Begin/Interrupt/Resume/Stop, speech unavailable/error fallback, and teardown during startup in the final host build. Separate local harness from actual-host evidence.
- [ ] Ask a first-time reader to complete the golden flow without coaching and record where they misunderstand playback, reopening or visual redirection. Do not infer product value from the engineering demonstration.

**Exit evidence:** Advertised beta capabilities match observed behavior; accessibility/fallback checks pass. A full product that promises in-place Dive remains blocked until that loop works.

### 5. Prepare reliable operations and review the integrated release — persistent-release gate

**Owner:** Coordinator, with Cloudflare administrator involvement only where access/configuration requires it.

- [ ] Select a stable isolated embed origin and reviewed persistent configuration with rate limiting, no first-party RISE state, no shared inference and no extra secrets.
- [ ] Define health/release checks, errors/throttling visibility, an operator and rollback/disable procedure. Avoid logging Current text, questions, provider keys or account identifiers.
- [ ] Test rollback and cleanup using least-privilege credentials. Wrangler removed the demo service but then failed legacy KV cleanup; distinguish service removal from follow-up cleanup and verify endpoint removal rather than granting broad scopes reflexively.
- [ ] Update stale source comments claiming no product host has been tried and refresh runbook/acceptance status. Attach reproducible evidence, not only local ignored scratch paths.
- [ ] Reconcile the dependent PR stack in its actual merge order; rerun required CI on the final integrated commit. Recheck full unit, browser gate, affected host suites, build/budget, architecture and security checks as warranted by the final changes.
- [ ] Obtain explicit persistent-deployment/integration authorization, deploy the approved exact release, and verify release marker, routes, framing, bindings, limiter and real ChatGPT audible/control acceptance.

**Exit evidence:** Reviewed integrated release passes required CI and live acceptance; rollback is exercised; persistent operating scope is approved. Do not reuse the temporary-demo approval as persistent approval.

### 6. Public provider-directory release — later gate

- [ ] Prepare support contact, privacy disclosures, stable hosting, accurate capability descriptions, reviewer prompts/evidence and required organization/account verification.
- [ ] Audit current submission guidance and iframe/CSP restrictions against RISE's nested-frame architecture before committing to a directory launch.
- [ ] Submit only after the persistent beta is dependable and publication is explicitly authorized.

Reference: [OpenAI plugin submission](https://developers.openai.com/plugins/deploy/submission). Developer-mode acceptance does not establish directory approval. Other provider platforms require their own adapters and acceptance evidence.

## Execution and self-review

Start with task1: it is a reproduced correctness defect and the highest-leverage blocker. Task2 and task3 investigations can proceed independently with separate owners/worktrees. Task4 can define an honest beta scope while those fixes proceed. Task5 waits for their exit criteria; task6 follows the persistent beta.

This roadmap introduces no product code and grants no deployment permission. Detailed code-level plans should be written per slice after confirming the transport policy or defect cause. That avoids inventing APIs or hiding unresolved architecture in a broad implementation plan. All current holds are mapped above; first-time reader value and directory requirements are labeled separately from proven engineering defects.
