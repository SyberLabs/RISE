# ADR 0002 — Gate 0: is ChatGPT a Live host?

Date: 2026-10-02
Status: **decided 2026-10-04: ChatGPT is a Composer host.** In the decoupled probe's real-host run, reader changes applied in one persistent widget, admitted model changes did not reach it without a manual read, and Voice interleaving was not shown. See the [decision](../product/discussions/2026-10-04-composer-decision.md). Originally: probe built; host run pending. The sections below are the record that led there.

## The question, narrowed

The realtime roadmap (October 2026) asks: can ChatGPT's voice change a persistent RISE view several times during one spoken answer?

That is a question about **one host**, not about RISE's architecture. RISE's own Live page already changes the visual while it speaks, by construction: RISE owns the voice and the clock, and the model streams passages, each with its own visual, through `rise.current-events.v1` (`docs/plans/LIVE-CURRENT.md`). So no foundation work waits on this gate. Only one product decision does: whether to build ChatGPT-specific Live.

## What the documentation already settles (checked 2026-10-02)

| Question | Answer | Source |
|---|---|---|
| Can ChatGPT voice use apps at all? | Yes, since 2026-09-23, on web, iOS and Android, for apps available to the account. | ChatGPT release notes, help.openai.com/en/articles/6825453 |
| Can it use a developer-mode custom MCP app? | **Web only.** Developer-mode apps are not available on mobile. Whether Live voice on web reaches them is not documented. | help.openai.com/en/articles/12584461 |
| Does a later tool call update the view that is already open, or create a replacement? | **Not established for this host.** The MCP Apps specification describes UI resources and tool results, but does not settle ChatGPT's repeated-call widget lifecycle or delivery behavior. | MCP Apps specification 2026-01-26; ChatGPT behavior must be observed |
| Can a tool approval be given by voice? | No; spoken approval is not supported. Whether a developer-mode tool asks for approval in voice is not documented. | Voice mode FAQ, help.openai.com/articles/8400625 |
| Does voice speak, call a tool, then keep speaking within one turn? | **Not documented.** | none found |

Consequence: the host's repeated-call delivery and widget lifecycle remain empirical questions. The probe measures them directly before any storage or recovery architecture is considered. A local persistent widget demonstrates the measurement path; it does not guarantee that ChatGPT preserves, replaces, or redelivers a view.

## The questions, in cost order

1. **Does Live voice on ChatGPT web call a developer-mode RISE tool at all?** Needs no new code.
2. **Within one spoken answer, are calls made between spoken stages, without the reader speaking again?** Needs the probe below and no server state.
3. **Does each result reach the existing widget instance, or does the host replace it?** Record result delivery and instance IDs across repeated calls; do not assume either behavior.
4. **Can the reader marker receive an audible response during that same voice session?** Measure this separately from bridge acknowledgement.

## Current local persistent-widget probe

The current experiment is documented in [`docs/experiments/RISE-GATE0.md`](../experiments/RISE-GATE0.md). It uses one local, self-contained MCP Apps widget with the actual `AttractorField` renderer and a loopback-only server. The fake host sends successive results directly to that widget and records run IDs, sequence numbers, widget instance IDs, renderer-control timestamps and animation-frame callbacks. The widget does not poll or recover missed results. This describes the local probe only; ChatGPT's delivery, persistence, remounting and recovery behavior remain unverified until a real-host run.

The browser simulation checks message source, duplicate and stale results, reader-marker RPC acknowledgements, manual speech observations and teardown. It does not establish ChatGPT Voice behavior, visible pixels or audible response. No temporary HTTPS exposure, tunnel, deployment or public endpoint has been approved.

## Older Worker-only probe (historical)

An earlier `worker/mcp-gate0.mjs` probe added `rise_set_visual({ visual, intensity })` behind `MCP_GATE0`. It had no UI resource or persistent widget and measured only tool-call timing relative to speech. It is historical evidence about that Worker-only design, not the current local widget experiment or a finding about ChatGPT's view lifecycle. The tool:

- has **no UI resource**, so this Worker-only probe did not measure widget mounting or result delivery;
- accepts only a catalog visual (`still`, `attractor`, `genesis`) and an intensity from 0 to 1, and refuses anything else;
- writes one log line, `{"gate0":"TOOL_CALL","receivedAt":…,"visual":…,"intensity":…}`, and logs no request text;
- changes nothing on screen.

The evidence is the **gap between calls**. Calls seconds apart, with speech heard between them, mean voice interleaves. Calls within a second of each other mean they were batched before or after the speech.

Tests: `worker/mcp-gate0.test.js` (6). Three deliberate breakages were each caught: the flag ignored, the upper intensity bound removed, the log line removed.

## Historical Worker-only run sheet

The following procedure belongs to the older Worker-only probe. It requires separate approval to deploy that demo Worker; no exposure or deployment approval has been granted. Use the current local probe instructions in `docs/experiments/RISE-GATE0.md` for the persistent-widget experiment.

1. `npm run build`, then `npx wrangler deploy --config wrangler.demo.jsonc`. Note the HTTPS address.
2. In a terminal beside the browser: `npx wrangler tail rise-chatgpt-demo --format pretty`.
3. ChatGPT web, developer mode: create the MCP app at `<address>/api/mcp`, no authentication. Refresh its metadata. Check that two tools are listed: `rise_present` and `rise_set_visual`.
4. New conversation with the app added. Start screen recording with audio. Start Live voice. Say:
   > "Using RISE, explain in three short spoken stages how a star becomes a black hole. Before stage one set the RISE visual to still at 0.3, before stage two to attractor at 0.6, before stage three to genesis at 0.9."
5. Say nothing until voice stops. Stop recording.
6. Repeat steps 4 and 5 twice more, each in a new conversation.
7. For each run, record: the `receivedAt` values from the tail, the gaps between them, whether speech was heard between calls, whether any approval prompt appeared, and the order of speech and tool entries in the transcript.

## Historical Worker-only pre-registered verdicts

| Verdict | Condition | Roadmap outcome |
|---|---|---|
| **Interleaves** | In at least 2 of 3 runs: at least 2 calls in one answer, each pair at least 1.5 s apart, speech heard between them, and the reader did not speak. | Ask questions 3 and 4 next. ChatGPT may be a Live host. |
| **Sync points** | Calls are spread through the answer, but speech stops at each call and resumes on its own. | Still viable. Calls become synchronization points. Ask questions 3 and 4. |
| **Turn-based** | No call is made during voice; or a call ends the answer and the reader must speak again; or all calls fall within 1.5 s of each other before or after the speech. | Keep the provisional Composer-host planning default; widget lifecycle remains undecided. |
| **Blocked** | Developer mode or Live voice is unavailable to the account, or approval prompts stop every call. | Recorded as an access blocker, not a RISE result. Default applies. |

## Decision

Until a real-host run is recorded, the planning default is **Composer host** and no ChatGPT-specific Live implementation starts. This is a provisional product decision, not a claim about host lifecycle guarantees. RISE's own Live experience does not depend on this gate.

## Consequences for the realtime roadmap

These are recorded here because Gate 0 is where they surfaced. Each is a requirement questioned before anything is built.

1. **The durable Experience Program remains the semantic center.** `rise.current-events.v1` is the current adapter for its passages and cues. Whether a future event vocabulary is needed remains an open design decision; this ADR does not rule one in or out.
2. **Durable reader-control authority remains open.** A host acknowledgement of a marker or RPC does not establish that the reader authorized durable changes to an Experience Program. Define that authority explicitly before designing or implementing it.
3. **Run the existing evaluation before building more of the medium.** The roadmap puts "does this feel different from voice plus a visualizer" at step 10. The instrument to ask it exists (`docs/plans/LIVE-EVALUATION.md`), with a visualizer control condition, and has never been run; `docs/plans/LIVE-HANDOFF.md` records the answer as unknown. It is the trunk question. It should run before manifests, a catalog or a voice clock.
4. **The live page's real-provider status is tracked in `LIVE-HANDOFF.md`.** Any result there informs RISE's own Live path but does not settle ChatGPT's widget lifecycle.

## Alternatives considered

- **Make `rise_set_visual` a UI tool.** Not used in the local probe because it would add a view-mounting variable to the direct-delivery measurement. ChatGPT's behavior remains empirical.
- **Build a server store now.** Deferred until real-host evidence establishes whether persistence or recovery is needed.
- **Treat local view timestamps as host timing.** Rejected: local renderer and frame callbacks describe the browser simulation only.
- **Skip the run and decide from documentation.** Rejected as final: the one fact that decides it, whether voice speaks between calls, is not documented. Accepted as the default if the run does not happen.
