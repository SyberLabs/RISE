# Gate 0 decoupled render/data experiment

Date: 2026-10-03, America/Los_Angeles.
Status: approved for local implementation by the user on 2026-10-03; new public exposure remains outside this approval.
Baseline: reviewed executable `8819564483491f584c1d312b8fba10132ac8e61f`, draft PR #371.

## Decision to make

Can one existing ChatGPT widget receive subsequent model-driven visual mutations through the host bridge, without reopening the widget or reader refresh? Separately, can that widget return a fixed marker to the active Voice model?

The first real-host probe established tool calls during an active browser Voice session. Each call opened a different widget instance. A model-context update received an RPC acknowledgment, but the Voice model could not see the marker; a separate message request was rejected. The reader heard “Done” and the marker refusal, but did not confirm “Set.” These results do not establish persistent rendering, mid-utterance delivery, or reciprocal Live.

## Requirements and deletions

- The reader needs one continuing visual surface: opening and mutating it must be different operations.
- The engineer needs to distinguish server admission from delivery and rendering: server sequence and widget-applied sequence remain separately visible.
- The next contributor needs a reproducible negative result: manual reads must never be recorded as automatic delivery.
- The reader controls the experiment: fixed bounded visual states, explicit actions, honest refusals, Stop and teardown.

Delete UI-resource metadata from mutation/read tools. Do not add polling, hidden refresh, automatic reopen, iframe-state recovery, shared inference, provider credentials, production endpoints, or Experience Events. Keep this experiment outside the canonical production runtime. Server state is experimental visual state, not an Experience Program or score patch.

## Alternatives

1. **Bridge-first split, recommended.** Open one widget, mutate data through tools, observe whether the host delivers results to that widget. Reader-initiated calls provide a positive control. This is the smallest experiment that can answer the missing delivery question. It may establish only local interactivity.
2. **Split plus a server push channel.** Explicitly stream admitted snapshots to the widget. This could provide continuity independent of host result routing, but introduces a new transport, access boundary, CSP, lifecycle and reconnect design. It cannot repair Voice marker receipt by itself. Defer until the bridge experiment demonstrates why this extra layer is needed.
3. **RISE-owned runtime with the provider as a composer.** Keep playback and reader controls in the existing runtime; host tools author future work. This retains the canonical semantic centre and is the honest product fallback if the ChatGPT host cannot support reciprocity. It does not satisfy the current experiment's host-owned Voice objective.

## Tool boundary

Use a separate experimental entry point/resource version so the original direct-delivery probe remains reproducible. Reuse the actual Attractor renderer and existing strict admission patterns. Do not refactor production code to support the probe.

| Tool | Arguments | Effect | UI resource |
|---|---|---|---|
| `rise_open_visual` | closed empty object | Returns the current RAM snapshot and mounts the experimental widget. Does not mutate/reset the run. | This tool only |
| `rise_set_visual` | required current `runId`, `visual`; optional bounded `intensity` | Admits one mutation and increments sequence; returns the admitted snapshot. | None, including compatibility aliases |
| `rise_read_visual` | required current `runId` | Returns current snapshot without mutation or sequence increment. Used by an explicit reader button. | None |

One RAM-only run per server process. Start at sequence 0, visual `still`, intensity `null`. Opening or reading does not fabricate a mutation: last-mutation timestamps are null at sequence 0. Sequence 1 and later snapshots carry actual server-received and server-applied timestamps. Server response/read timing is separate from last-mutation timing. Starting a new server changes runId; stale run IDs refuse before changing state. Run ID is correlation, not authentication.

Attractor intensity remains finite, from 0.4 to 0.75, with default 0.65. Still refuses intensity. Refuse unknown fields, invalid values and malformed or oversized messages; preserve state on refusal. Keep the existing 16,384-byte request cap and bounded 128-entry logs. Define the new snapshot schema explicitly in implementation tests; do not weaken the original probe's validator to accommodate this version.

Declare render availability to the model, and mutation/read availability to both model and app using standard `_meta.ui.visibility`. Only the render descriptor carries `_meta.ui.resourceUri`; mutation/read descriptors and results carry no template alias. The render tool description instructs the model to open once and use mutation tools afterward. Detect violations in the run rather than assuming the instruction guarantees host behavior.

## Widget and evidence

Assign a random instance ID at each widget creation. Render the admitted initial snapshot only after successful delivery. Keep a renderer mounted through intensity changes; destroy it for still/Stop/teardown. Keep server sequence, widget-applied sequence, instance ID, delivery source and timestamps visible.

Accept three independently labeled result paths through the trusted parent bridge:

1. Render-tool initial result.
2. Unsolicited host tool-result notification: possible model-mutation delivery, not assumed available.
3. Matched response to a widget-initiated `tools/call`: label `reader_mutation` or `manual_read` according to the pending request.

Apply snapshots only after validating schema, size, run ID and monotonic sequence. Duplicate/stale results never replay renderer work. A read may apply a newer admitted snapshot, but its record is explicitly `manual_read`; it cannot satisfy automatic Live acceptance. Retain parent-source validation, bounded requests, timeouts and idempotent teardown. Record renderer acceptance and frame callbacks as their actual observations; neither is proof of visible pixels or audible speech.

Reader controls: fixed intensity 0.4/0.75, still, explicit “Read server state,” existing separately labeled context/message markers, log export and Stop. No timer-based reads or silent fallback from rejected marker messages. Preserve a bounded RPC error code/category where available so unsupported method, refused permission and malformed request can be investigated without saving arbitrary response bodies.

## Local verification

- Descriptor tests prove only open has a UI resource/alias; mutation/read availability is explicit.
- Opening/reading preserves sequence; valid mutation advances once; stale-run/invalid arguments leave state unchanged.
- Browser positive control opens one real renderer and makes repeated reader tool calls without adding a widget or replacing that renderer for intensity changes.
- Browser delivery cases distinguish unsolicited notifications from matched manual responses; absent notifications leave the surface unchanged. Manual reads can reconcile admitted server state but never generate a Live-pass record.
- Preserve forged-source, oversize, duplicate, stale, refusal, pending-request timeout and teardown regressions. Prove the foreign-frame test still fails when its production source guard is removed, then restore that guard.
- Exercise request/result boundaries against the actual server and preserve the old probe's tests. Run affected production checks only if production imports change; otherwise keep the scope isolated and run required repository hygiene/build checks.

## Real-host run

After exact-head review and approval for the new temporary exposure:

1. Open the widget once in Composer. Record run and instance IDs.
2. Use reader mutation buttons. Confirm host-mediated tool calls change one renderer in that same widget. This is the positive control, not a model-driven pass.
3. Ask the model for intensity 0.4, then 0.75, then still/attractor. Do not use a reader button, read or reopen between these calls. Record server receipts, widget instance count and unsolicited deliveries. Bound each observation window to 15 seconds after the model's turn completes; classify later delivery separately rather than discarding it.
4. If the model reports success but the existing widget does not advance, explicitly read state once. A newer server snapshot with an older widget sequence establishes admission without automatic widget delivery. This result is useful and does not count as Live.
5. Repeat in one browser Voice session, keeping typed-input tests distinct from spoken and mid-utterance tests. Begin with microphone muted to prevent ambient input. Unmute only for the reader's controlled spoken trial.
6. Send each fixed marker separately; distinguish host RPC acknowledgment, model recognition after another turn, and reader-confirmed same-session audible response. Never invent manual speech timestamps.
7. Stop Voice and widget, stop tunnel/server, verify the actual native processes and loopback/public endpoints are closed. Preserve the evidence; no unattended public endpoint.

Report independent outcomes: reader interactivity, model-to-existing-widget delivery, instance continuity, marker acknowledgment/recognition, audible output, and speech/tool interleaving. A reciprocal Live pass requires persistent-instance visual changes and a verified audible response to reader input in the same Voice session. A new widget, manual read or later turn cannot substitute for the claimed path.

## Product boundary and next decision

Until the missing paths are observed, ChatGPT remains Composer. A successful reader-call positive control is still worthwhile: it validates portable reader control without pretending the host supplies live model synchronization. If model mutations do not reach the original widget, stop and decide whether an explicit push transport earns its complexity. Keep future Experience Events and reader-authorized score changes centred on Experience Program → Session → Player, independently of this experimental adapter.

## Sources checked 2026-10-03

- [OpenAI UI guide](https://developers.openai.com/plugins/build/chatgpt-ui): split data/render tools; standard bridge; explicit widget calls can update local UI without remounting. This does not guarantee arbitrary model-call results reach an existing widget.
- [OpenAI reference](https://developers.openai.com/plugins/reference): `_meta.ui.resourceUri`, `_meta.ui.visibility`, compatibility aliases.
- [MCP server guide](https://developers.openai.com/plugins/build/mcp-server).
- Local exact-head probe source and recorded 2026-10-03 real-host trial.

Self-review: design separates admitted state from rendered state, marks diagnostic reads honestly, preserves the original probe, and limits implementation to one experiment. No new public exposure, production behavior or inference spending follows from approving the local implementation.
