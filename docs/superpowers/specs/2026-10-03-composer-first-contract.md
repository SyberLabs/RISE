# Composer-first integration contract

Date: 2026-10-03. Scope: first-edition guided explanations. This document fixes the product boundary; it does not claim every behavior below is implemented.

## Semantic boundary

`rise.experience-program.v1` remains the durable score. `rise.current.v1` remains the host-facing sealed composition adapter. Use `validateRiseCurrent(input)`, `materializeRiseCurrent(input) -> { program, sources }`, and `compileRiseCurrent(input, { projection }) -> Session` in `src/core/rise-current.js`. Preserve the existing compiler/Player/Chamber path. Do not add a second score format or runtime.

Sources and character anchors are durable coordinates. Compiled atom IDs are not stable persistence coordinates. Preserve source text, theme, admitted visual intent, and Dive anchors across materialization and compilation. Speech marks and transport receipts remain timing/evidence.

An initial shared fixture uses the existing `gravity-answer` case in `src/core/rise-current.test.js`: two segments, Attractor then still, with an anchored spacetime Dive. Consumers must retain the validation and theme parity tests. Later explanatory fixtures may use different content without changing the contract.

## Host admission and Begin

The existing Worker tool consumes `{ current }` only. Sibling arguments are refused. Keep the centralized UTF-8 limits in `src/live/hosts/mcp-size.js` and the Current validator.

A successful MCP tool result carries `structuredContent: { current }` without `isError: true`. A refusal carries `isError: true` and explanatory text. The guest validates received data, but only a successful tool result authorizes readiness. Tool input, a title card, an RPC acknowledgment, and local validation alone do not authorize Begin.

Begin is an explicit reader action after readiness. Playback must never start merely because a tool result arrived. A refusal lacking Current identity must not erase a previously accepted experience. Late delivery after Stop, cancellation or teardown cannot restart it. Wrong-source messages are ignored. These are mandatory admission regressions, not optional UI preferences.

The existing `currentFrom(method, params)` and LiveHost embedded flow implement this boundary. Worker ownership ends at the result; the coordinator owns widget/bridge integration. Keep proposal correlation and teardown tests when adapting the UI.

## Reader controls and position

Begin, pause, resume and Stop act locally, without model inference. The existing Live runtime uses `interrupt(...)`, `resume()`, and `stop()`; ordinary Player playback uses its existing pause/play/stop lifecycle. UI work must consume the established owner rather than creating another playback state machine.

Pause holds the current experience and return position. Resume continues through the existing speech-governor behavior; repeating the interrupted phrase may be necessary and must not be described as sample-exact continuation. Stop cancels current speech and scheduled future work. Navigation/teardown invalidates outstanding callbacks.

Reader presentation choices have reader authority. Model-authored content does not become globally reader-approved because Begin was pressed. Before persisting a control, its owner must classify it as durable score intent or a session preference. Use existing score vocabulary for representable durable choices; receipts alone cannot establish replay support.

## Exploration and return

First-edition model interaction occurs at explicit held boundaries. Prefer the existing `dive({ question, segmentId, atCharacter })` / `surface()` path or a separate admitted Current, whichever meets the supported host contract. Preserve the original score and return position. Nested Dives and continuous model edits are outside this edition.

Show loading, exploration, refusal and return distinctly. Admit follow-up content before playing it. A cancelled, repeated or stale request cannot replace the currently accepted branch. Experienced parent content is immutable. A failure returns the reader to the held parent with a usable resume/Stop path.

The existing runtime has local Dive mechanics. ChatGPT initiation, delivery and return behavior require a separate implementation plan and real-host acceptance; this document does not invent a provider endpoint or claim that the host supports those mechanics.

## Replay and instrument boundaries

Use existing Program interchange and Vault machinery. Preserve source dependencies with the score; exporting a score without resolvable source content is not a replay demonstration. Replay acceptance compares content, anchors, branch meaning and admitted presentation intent, not browser voice identity or wall-clock timings.

Choose only instruments supported by the actual surface. Attractor and Klee/Genesis have Current support; Neural is not admitted as a Current/control instrument. Consult the existing manifest by context rather than inferring support from presence in the browser catalog. Explain atmospheric visuals honestly; do not claim they represent scientific quantities without an authored mapping.

## Ownership and review gates

- Coordinator: foundation reconciliation, MCP guest/bridge integration, real-host evidence, workflows, configuration, lockfile, integration and release.
- Score/playback owner: Current/Program/compiler/Player semantics, manifest changes, source coordinates and persistence/replay.
- Host/admission owner: Worker tools and their tests; consume the shared result contract.
- Reader-experience owner: fixtures, accessible controls and navigation; consume existing playback lifecycle methods.

An interface change needs one owner and agreement before consumers code against it. Separate worktrees and narrow PRs are required for independent changes. Real-time transport research remains isolated and is not a prerequisite for Composer acceptance.

## Acceptance checklist

- [ ] Canonical fixture preserves text, themes, visual intent and source anchors across validation/materialization/compilation.
- [ ] Begin waits for successful admission; refusal, oversized input and hostile-source messages cannot start playback.
- [ ] Stop, navigation and teardown defeat late results/callbacks.
- [ ] Pause/resume and exploration/return preserve orientation and the parent position.
- [ ] Export plus required sources replays the promised semantics.
- [ ] Exact-head browser checks and witnessed audible ChatGPT/device acceptance are recorded separately.

Foundation tests can close the admission and compilation checks only where their assertions cover these behaviors. This contract is not a release-completion certificate.
