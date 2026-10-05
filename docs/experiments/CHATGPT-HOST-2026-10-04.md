# ChatGPT host session — 2026-10-04

Local date: 2026-10-04 (America/Los_Angeles); timestamps below are UTC on 2026-10-05. This is one controlled Composer conversation and one decoupled-probe conversation, including one muted Voice session. It is partial acceptance evidence, not a reciprocal Live pass.

## Candidates and scope

Composer: exact consolidated main `891aa8788529bc5b434d366d450ebb40fd64a402`, temporary `rise-chatgpt-demo` Worker version `825e974f-4cde-4159-b39a-8cb75b9f0bc5`. The installed developer-mode RISE Demo connection was refreshed. Reader-owned AI and production configuration were unchanged; shared inference and Realtime were disabled. The demo also advertises the older stateless Gate 0 tool; the Composer prompts selected `rise_present` explicitly or through a plain request.

Decoupled probe: exact #372 head `f689a002f8a746a07fd22fd60a2cfd4216f973da`, isolated loopback server and temporary Quick Tunnel. Three tools: render-only open, data-only mutation, data-only read. One bounded RAM run, no provider keys, inference, microphone recording or persisted reader text.

## Composer observations (LIVE-002)

- A plain three-passage black-hole explanation produced an admitted Current and a Begin card in real ChatGPT. Begin started narration and paced text. The reader confirmed: **“yes i hear it.”** This confirmation applies to this candidate.
- Interrupt displayed held text and Resume. The compound request `make it calmer and stop` was refused explicitly. A calmer request on a later passage without an adjustable visual was refused contextually.
- Stop displayed the stopped card. Reloading the conversation redelivered a Begin card without automatic playback. Reopening begins at the start, as the widget states.
- An indirect request for a spoken visual explanation of tides selected RISE and produced another Begin card. This is Composer behavior: each presentation creates a new widget.
- **Acceptance gap:** pressing Interrupt immediately after Begin displayed Held while startup was still pending. Later the tides widget showed Reading complete alongside Held. The cause is not diagnosed; reproduce with explicit DOM observations before calling this a runtime defect. Browser automation occasionally returned a deadline after an action had executed, and accessibility snapshots lagged the DOM.
- Successful brightness adjustment while held, lower-bound behavior, Resume continuity, reduced-motion/mobile host behavior and the visible speech-unavailable fallback were not established in this session. Do not mark full Composer acceptance complete.

## Decoupled render/data observations (LIVE-R01)

Run ID `2dfd8747-3d68-45e1-8902-648f8ea3402d`; widget instance `5ae7ff59-a51f-4006-950c-f3a1c48decbd`. Opening at 00:54:01 returned sequence 0, applied via `initial_render`; the real Attractor renderer subsequently appeared. ChatGPT reported that the opening result contained no readable run metadata, so the operator supplied the visible run ID for later calls.

| Action | Result in the existing widget |
|---|---|
| Reader intensity 0.4 at 00:54:37 | Sequence 1; `reader_mutation`; renderer acceptance and following animation frame recorded |
| Reader intensity 0.75 at 00:54:51 | Sequence 2; same instance; `reader_mutation` |
| First model intensity 0.4 request | ChatGPT reported a platform safety refusal; an independent loopback diagnostic read still showed sequence 2 |
| Composer context/message markers | Both host RPCs acknowledged. The message action resumed generation of the previous model request; server admitted intensity 0.4 at 00:56:53 (sequence 3). Marker recognition itself was not proven |
| Model intensity 0.75, still, then attractor 0.65 | Completed without another open/read call; widget stayed at applied sequence 2. Each completed turn was followed by at least a 15-second observation window |
| Single explicit widget read at 01:00:15 | Same instance advanced directly to sequence 6, labeled `manual_read`; latest admission timestamp 00:59:30 |

Two additional operator loopback diagnostic reads were used to distinguish the initial platform refusal from subsequent admission. They did not update the widget. No polling, hidden refresh or extra opening substituted for automatic delivery.

**Conclusion:** reader-driven interaction and persistent instance identity work. Four admitted model mutations did not reach the existing widget automatically in the observed windows. A manual read recovered the admitted state; it cannot count as Live synchronization. Initial platform refusal and later successful admission must both remain in the record.

## Voice and markers

One Voice session was started on the same conversation and the microphone was muted immediately after connection. A typed mutation request and a typed marker-recognition question were submitted; these do not establish spoken or mid-utterance interaction. The widget remained at sequence 6. Voice mutation admission and exact spoken response were not independently established.

The Voice context update was dispatched at 01:01:09.151 and acknowledged at 01:01:09.589. The separate Voice message marker was dispatched at 01:01:55.953 and rejected at 01:01:55.969 with host error `-32000`. The reader had headphones off and could not confirm the Voice acknowledgments. Audible Voice output and model recognition are **unverified**. Composer narration remains separately reader-confirmed.

ChatGPT remains classified as **Composer**. This bounded experiment supplies no basis for a reciprocal Live claim. Do not add polling to disguise this missing delivery path or move the semantic centre into the experimental RAM adapter.

## Validation on exact candidates

Fresh local runs before exposure: Composer Worker/MCP tests 40 passed; MCP port tests 34 passed; production build and Wrangler dry run succeeded. Probe unit/bundle tests 11 passed; real-renderer Chromium tests 9 passed. Initial native process resource failures were retried serially; the successful runs are the evidence. Main's production and full validation were also green before this session. These local/CI results do not replace real-host observations.

## Shutdown and remaining work

Voice was ended. Stop was activated, but a stopped receipt was not observed; the probe tab was then closed to tear down the renderer. The exact loopback listener Windows PID 25588 and Quick Tunnel Windows PID 8836 were terminated. Header-labelled Cygwin process evidence mapped its PID 1038 to WINPID 8836; automatic review initially rejected termination until this mapping was verified.

Wrangler deletion failed before deleting the demo because its legacy KV namespace enumeration required an unavailable scope. Credentials were not expanded. The demo was instead redeployed with `workers_dev: false`, preview URLs disabled, and both MCP gates false. Version `4875b375-fad7-4a01-ad0d-2b39d01b4006` reported **No targets deployed**. The inert Worker remains in the account; an administrator can remove it later. Production was untouched.

Independent shutdown checks: demo MCP URL returned HTTP 404; Quick Tunnel returned HTTP 530; loopback port 4320 refused connection. The installed test connections now point at offline endpoints.

Next: reproduce early Interrupt during startup and complete Composer reader controls/fallback acceptance. Review #372 with this negative automatic-delivery evidence. Any second host session should answer a specific remaining question rather than repeat the same transport experiment. Full real-time mutation is not a dependency of the first Composer release.

The bounded widget log is preserved in [CHATGPT-HOST-2026-10-04.jsonl](CHATGPT-HOST-2026-10-04.jsonl). It contains only trial IDs, timestamps and renderer/marker receipts; it does not include account details, other conversations or microphone content.

Evidence-branch verification: tracker graph validated 32 tasks; tracker tests 11 passed; production browser gate 42 passed with 3 configured skips. The cleanup watchdog was terminated after the successful endpoint shutdown and its process absence verified.
