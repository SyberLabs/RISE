# ChatGPT Reader-Controlled Demo Implementation Plan

> **For agentic workers:** Use subagent-driven-development task by task with LUNA medium/high implementers and independent reviews.

**Goal:** A tested reader-controlled Current in an actual ChatGPT host.
**Architecture:** Retain the stateless Worker and MCP bridge into the existing runtime and player. Add validated result delivery, one closed local command and explicit recovery semantics.
**Tech Stack:** Vanilla JavaScript, Vite, Vitest, Playwright, Cloudflare Worker.
**Spec:** `docs/superpowers/specs/2026-10-01-chatgpt-demo.md`

## Global Constraints

- RISE owns playback and admission; the host owns initial inference.
- No shared inference, provider API key, SDK extraction, second schema or renderer, cloud session, telemetry or public-directory submission.
- Exact “make it calmer” and “please make it calmer” reduce active attractor intensity by 0.1 to a minimum of 0.4. More vibrant retains its 0.1 increase and maximum of 0.75. Refuse other instructions; preserve position, pace and lifecycle.
- Reopening replays from the beginning, explicitly. No checkpoint claim. Sampling is optional; real-host evidence is separate from fakes.
- Production MCP stays disabled. Isolated demo deployment requires explicit authorization.

### Task 1: Deliver validated tool results

**Files:** `worker/mcp-server.mjs`, `worker/mcp-server.test.js`, `src/live/hosts/mcp-port.js`, its tests, and `e2e/live-mcp.spec.js`.
**Interfaces:** Consume `rise.current.v1`; produce `tools/call.result.structuredContent.current` containing the exact validated object and truthful accepted-for-presentation text. Preserve APP_URI, transport and schema.

- [ ] Add failing worker assertions using its existing fixtures:

```js
const response = await json(await post(rpc('tools/call', {
  name: TOOL.name, arguments: { current: BLACK_HOLES_CURRENT }
})));
expect(response.result.structuredContent).toEqual({ current: BLACK_HOLES_CURRENT });
expect(response.result.content[0].text).toContain('accepted');
```

Also assert invalid results carry no Current. Add a port test that `currentFrom(METHODS.toolResult, { isError: true, structuredContent: { current: BLACK_HOLES_CURRENT } })` returns null.
- [ ] Run worker and port tests red. Add successful structured content and accurate text; ignore errored tool results in the port. No server state or playback acknowledgement.
- [ ] Extend the fake-host helper with optional result-only delivery, using the actual worker dispatch result instead of a fabricated result. Valid result plays; input plus result plays once; invalid server result has no playable Current. Run `e2e/live-mcp.spec.js` and targeted unit suites.
- [ ] Inspect the diff, commit narrow files, write the task report with red/green evidence and obtain independent spec/quality review.

### Task 2: Bounded calmer control

**Files:** `src/live/visual-control.js` and tests, `src/live/host/controls.js` and tests, `e2e/live-control.spec.js` or `e2e/live-mcp.spec.js`.
**Interfaces:** Consume an exact closed reader phrase; produce the existing `runtime.controlVisual` command. Preserve the boolean matcher API or explicitly migrate every caller if its return type must change.

- [ ] Write failing tests for normalized calmer and please phrases, compound-instruction refusal, 0.65 to 0.55, minimum 0.4, unavailable visual, existing vibrant behavior and the shared microphone phrase route.
- [ ] Implement the closed directional mapping through existing admission and manifest bounds. Feedback names brightness and supported phrases. No model intent classification or scene changes.
- [ ] In the MCP browser test, pause at a known atom, apply calmer, verify the lower target and unchanged text, then resume without a sampling request. Run grammar/control unit tests and live-control/MCP browser suites.
- [ ] Commit, report evidence and obtain independent spec/quality review.

### Task 3: Recovery and honest embedded status

**Files:** `src/live/adapters/mcp-app.js` and tests, `src/live/host/LiveHost.js` and tests, `src/live/host/controls.js` and tests only if needed for a persistent notice, `e2e/live-mcp.spec.js`.
**Interfaces:** Consume host reinitialization and result delivery plus existing interrupt/stop behavior. Produce a persistent replay notice and actionable refusal guidance. No persisted Current, checkpoint or server session.

- [ ] Write failing tests for embedded “Reopening starts this reading from the beginning” notice and invalid-Current “Ask the assistant again” guidance. Standalone controls remain unchanged.
- [ ] Add the minimum MCP-specific notice and error guidance using existing UI patterns.
- [ ] Extend browser scenarios: malformed Current shows zero atoms; a fresh valid view plays; reloading the nested frame reinitializes and consumes the host’s result from the first passage; teardown acknowledges and clears controls; interruption resumes the same atom; sampling absence sends no model request. Do not assert checkpoint restoration.
- [ ] Run affected adapter/host/control unit tests and MCP browser tests. Commit, report and obtain independent review.

### Task 4: Isolated serving and demonstration acceptance

**Files:** Coordinator owns `wrangler.demo.jsonc`, `docs/plans/CHATGPT-DEMO.md`, validation and integration.
**Interfaces:** Consume the reviewed built application; produce a concrete deployable demo configuration, reproducible acceptance script and real-host evidence. No new runtime package.

- [ ] Create the dedicated configuration with `main: ./worker/index.mjs`, `workers_dev: true`, `MCP_ENABLED: true`, shared inference routes off, `dist` assets and `run_worker_first` for `/api/*`, `/live` and existing Worker-script policy paths. Do not change production configuration or require database secrets for this flow.
- [ ] Document compatible Node build, Wrangler dev/dry-run/deploy commands, same-origin HTTPS `/api/mcp` connection, developer-mode account prerequisite and metadata refresh. Define ten named acceptance cases with prompts, expected outcomes and evidence status: direct and indirect valid requests, malformed schema, unsupported visuals and compound controls, calmer bounds, pause/resume, reopening, sampling absence and duplicate delivery.
- [ ] Verify the Worker bundle/dry-run and exact framing policy with existing Worker tests. Run required CI hygiene, security compatibility, generated diagram, build and first-load budget plus affected tests and baseline browser journeys. Push a stacked PR, attach it and obtain most-capable final review.
- [ ] After explicit approval of the reviewed configuration and commit, deploy the isolated HTTPS demo endpoint. Connect the signed-in ChatGPT account and record actual tool selection, payload, result, widget rendering, capabilities and errors using only non-sensitive demonstration prompts.
- [ ] Exercise ask/play/calmer/pause/resume/reopen/refusal in ChatGPT. Inspect visible text/field and actual audibility; mark quality unobserved where inspection is unavailable. A demo-ready claim requires the real-host loop. If access or approval blocks, complete unaffected work and name the exact outstanding requirement.
