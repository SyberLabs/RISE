# ADR 0002 — Gate 0: is ChatGPT a Live host?

Date: 2026-10-02
Status: **probe built; host run pending.** Default if the run has not happened by 2026-10-09: ChatGPT is a Composer host only.

## The question, narrowed

The realtime roadmap (October 2026) asks: can ChatGPT's voice change a persistent RISE view several times during one spoken answer?

That is a question about **one host**, not about RISE's architecture. RISE's own Live page already changes the visual while it speaks, by construction: RISE owns the voice and the clock, and the model streams passages, each with its own visual, through `rise.current-events.v1` (`docs/plans/LIVE-CURRENT.md`). So no foundation work waits on this gate. Only one product decision does: whether to build ChatGPT-specific Live.

## What the documentation already settles (checked 2026-10-02)

| Question | Answer | Source |
|---|---|---|
| Can ChatGPT voice use apps at all? | Yes, since 2026-09-23, on web, iOS and Android, for apps available to the account. | ChatGPT release notes, help.openai.com/en/articles/6825453 |
| Can it use a developer-mode custom MCP app? | **Web only.** Developer-mode apps are not available on mobile. Whether Live voice on web reaches them is not documented. | help.openai.com/en/articles/12584461 |
| Does a second tool call update the view that is already open? | **No.** Each call that names a UI resource mounts a new view, and each view receives its tool input and result once. Nothing delivers a later call to an earlier view. | MCP Apps specification 2026-01-26, github.com/modelcontextprotocol/ext-apps |
| Can a tool approval be given by voice? | No; spoken approval is not supported. Whether a developer-mode tool asks for approval in voice is not documented. | Voice mode FAQ, help.openai.com/articles/8400625 |
| Does voice speak, call a tool, then keep speaking within one turn? | **Not documented.** | none found |

Consequence: a single persistent view that changes cannot come from ChatGPT handing it later calls. It could only come from RISE keeping state on its server and the view fetching it. That is a server store RISE does not have today, and it is worth building only if voice interleaves at all. So the gate is split into questions taken in cost order, and the run stops at the first "no".

## The questions, in cost order

1. **Does Live voice on ChatGPT web call a developer-mode RISE tool at all?** Needs no new code.
2. **Within one spoken answer, are calls made between spoken stages, without the reader speaking again?** Needs the probe below and no server state.
3. **Can an open view pick up those changes while voice runs?** Needs a server store. Not built. Asked only if 2 passes.
4. **Can the view send the reader's action back into the same voice conversation?** Not built. Asked only if 2 passes.

## The probe

`worker/mcp-gate0.mjs` adds one tool, `rise_set_visual({ visual, intensity })`, listed only when `MCP_GATE0` is `"true"`. Only `wrangler.demo.jsonc` sets it; production and staging do not. The tool:

- has **no UI resource**, so ChatGPT mounts no view per call (a new view per call would confuse the measurement);
- accepts only a catalog visual (`still`, `attractor`, `genesis`) and an intensity from 0 to 1, and refuses anything else;
- writes one log line, `{"gate0":"TOOL_CALL","receivedAt":…,"visual":…,"intensity":…}`, and logs no request text;
- changes nothing on screen.

The evidence is the **gap between calls**. Calls seconds apart, with speech heard between them, mean voice interleaves. Calls within a second of each other mean they were batched before or after the speech.

Tests: `worker/mcp-gate0.test.js` (6). Three deliberate breakages were each caught: the flag ignored, the upper intensity bound removed, the log line removed.

## Run sheet (about 15 minutes, one person)

Needs, from the creator: approval to deploy the demo Worker, a signed-in ChatGPT web account with developer mode, and a screen recorder that captures tab audio.

1. `npm run build`, then `npx wrangler deploy --config wrangler.demo.jsonc`. Note the HTTPS address.
2. In a terminal beside the browser: `npx wrangler tail rise-chatgpt-demo --format pretty`.
3. ChatGPT web, developer mode: create the MCP app at `<address>/api/mcp`, no authentication. Refresh its metadata. Check that two tools are listed: `rise_present` and `rise_set_visual`.
4. New conversation with the app added. Start screen recording with audio. Start Live voice. Say:
   > "Using RISE, explain in three short spoken stages how a star becomes a black hole. Before stage one set the RISE visual to still at 0.3, before stage two to attractor at 0.6, before stage three to genesis at 0.9."
5. Say nothing until voice stops. Stop recording.
6. Repeat steps 4 and 5 twice more, each in a new conversation.
7. For each run, record: the `receivedAt` values from the tail, the gaps between them, whether speech was heard between calls, whether any approval prompt appeared, and the order of speech and tool entries in the transcript.

## Pre-registered verdicts

| Verdict | Condition | Roadmap outcome |
|---|---|---|
| **Interleaves** | In at least 2 of 3 runs: at least 2 calls in one answer, each pair at least 1.5 s apart, speech heard between them, and the reader did not speak. | Ask questions 3 and 4 next. ChatGPT may be a Live host. |
| **Sync points** | Calls are spread through the answer, but speech stops at each call and resumes on its own. | Still viable. Calls become synchronization points. Ask questions 3 and 4. |
| **Turn-based** | No call is made during voice; or a call ends the answer and the reader must speak again; or all calls fall within 1.5 s of each other before or after the speech. | ChatGPT is a Composer host only. Delete the probe. |
| **Blocked** | Developer mode or Live voice is unavailable to the account, or approval prompts stop every call. | Recorded as an access blocker, not a RISE result. Default applies. |

## Decision

Until the run is recorded: **ChatGPT is treated as a Composer host.** No ChatGPT-specific Live work starts. This follows from the documentation leaning against it (one view per call, approvals that cannot be spoken, developer apps on web only) and from the fact that RISE's own Live page does not depend on it.

## Consequences for the realtime roadmap

These are recorded here because Gate 0 is where they surfaced. Each is a requirement questioned before anything is built.

1. **Do not add `rise.experience-events.v1`.** `rise.current-events.v1` already exists, is validated and ordered, and already carries per-passage visuals (`segment.begin`), bounded state changes (`state.set`) and immutable finished passages (`segment.end`). A second event protocol would break the roadmap's own rule of one semantic center. Extend the existing one: what is missing is cue changes to passages not yet spoken, and audio and pace as cue types.
2. **The commit horizon already has its first half.** A finished passage is immutable today. What is missing is the finer line inside the passage being spoken.
3. **Run the existing evaluation before building more of the medium.** The roadmap puts "does this feel different from voice plus a visualizer" at step 10. The instrument to ask it exists (`docs/plans/LIVE-EVALUATION.md`), with a visualizer control condition, and has never been run; `docs/plans/LIVE-HANDOFF.md` records the answer as unknown. It is the trunk question. It should run before manifests, a catalog or a voice clock.
4. **The live page has never run against a real provider** (`LIVE-HANDOFF.md`, OpenAI Realtime "not verified"). That check is cheaper than Gate 0 and answers more.

## Alternatives considered

- **Make `rise_set_visual` a UI tool.** Rejected: each call would mount a new view, which tests ChatGPT's view handling instead of voice interleaving.
- **Build the server store now, so one run answers questions 1 to 3.** Rejected: it adds state and a storage dependency to a stateless server for a question that question 2 may close.
- **Keep timing in the view instead of the server.** Rejected: the view would need to be open and would need the store above.
- **Skip the run and decide from documentation.** Rejected as final: the one fact that decides it, whether voice speaks between calls, is not documented. Accepted as the default if the run does not happen.
