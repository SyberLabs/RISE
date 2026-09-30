# User-owned AI (hosted Jev via the reader's OpenRouter, local Kev) Implementation Plan

**Goal:** RISE never spends SyberLabs inference credentials. The reader either
connects their own OpenRouter account (hosted Jev, billed to them) or runs RISE
and Kev on their own computer. Reading and manual configuration need neither.

**Architecture:** One browser-safe decision contract (`src/core/decision/`)
builds the finite choice questions, calls exactly one reader-owned connection,
and admits only allowed choices before deterministic mapping to reading
settings. The Worker keeps only non-inference work: it publishes the public
catalog (`GET /api/decision-catalog`) and answers every retired inference route
with `410 SHARED_INFERENCE_RETIRED`. A local launcher starts a loopback-only
bridge (static RISE + catalog + one fixed Kev route) and the pinned Kev server.

## Requirements questioned

| Requirement | Kept? | Why |
| --- | --- | --- |
| Server decision cache (Redis, keyed by provider key HMAC) | Deleted | It only existed to save SyberLabs spend. A per-tab memory cache keeps repeat asks free for the reader. |
| Server variance turn counter (Redis INCR) | Moved to memory | Diversity per tab is enough; no shared resource is touched. |
| `DECISION_PROVIDER`, `KEV_*`, Modal deploy workflow | Deleted | They exist to run shared paid inference. |
| `/api/jev-decision` | Retired, no client replacement | No client calls it. |
| `/api/personal-piece` | Retired; feature stays disabled | It was never released (`RELEASE_VERIFIED=false`); launching a new writer path is out of scope. |
| Schema v1 response shape | Kept in the contract | Old tabs are gone after the retired route; kept only because `responseForVersion` is cheap and the oracle still asks for v2. |
| Browser-to-localhost from the public site | Rejected | Same-origin local bridge instead; the public site never talks to loopback. |

## File map

- `src/core/decision/providers.js` — Jev/Kev identity, result and attestation checks (from `server/decision-provider.mjs`).
- `src/core/decision/call.js` — one bounded, cancellable call; typed errors; no retry, no fallback.
- `src/core/decision/catalog.js` — public catalog validators shared by Worker, browser, local bridge.
- `src/core/decision/recommend.js` — question building, answer admission, deterministic settings (from `worker/jev-recommend.mjs`).
- `src/core/decision/route.js`, `src/core/passage-visuals/score-provider.js`, `src/enterprise/remote-decider.js` — the three auxiliary features on the same connection.
- `src/core/ai-connection.js`, `src/core/openrouter-oauth.js` — reader connection state (memory only) and PKCE.
- `worker/decision-catalog.mjs`, `worker/retired-inference.mjs`, `worker/index.mjs`.
- `local/` — launcher, bridge, hardware checks, `kev_server.py`.
- `scripts/decision-eval.mjs` — the 39-case comparison against mock, local, or live connections.

## Tasks

1. Shared contract extracted; ported recommendation tests pass against it (mock provider). → `npx vitest run src/core/decision`
2. Worker: catalog route, retired routes, no provider secrets read. → `worker/*.test.js`
3. Browser connection + OAuth PKCE + CSP. → unit tests for success, cancel, invalid callback, disconnect, revoked key, no key leakage.
4. Portal, oracle, Scriptorium, Chamber, enterprise switched to the connection; manual reading unchanged. → component tests + e2e gate.
5. Local package: bridge security tests (Host/Origin/paths), launcher states, Kev server identity. → `node --test local/*.test.mjs`, Python unittest.
6. Evaluation adapted (mocked/local/live labels, same fixtures and scorer).
7. CI and deploy config: no live paid smoke; secrets requirement narrowed; docs.
8. Verification: required checks, live Jev with a reader-supplied test account, local Kev on the RTX 5080.

## Release order

1. Merge: frontend and Worker ship together; retired routes return 410, so stale tabs fail clearly and spend nothing.
2. Verify production serves the release and every retired route returns 410.
3. Only then delete the now-unused Worker secret `OPENROUTER_API_KEY` and Modal/Kev secrets. Neon and Upstash stay (catalog).
