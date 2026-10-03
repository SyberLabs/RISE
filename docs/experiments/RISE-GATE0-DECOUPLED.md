# RISE Gate 0: decoupled render/data probe

This is a local feasibility experiment. It keeps opening a widget separate from changing its data. It uses the actual Attractor renderer and one bounded RAM-only run. It does not modify a production score, call an inference API, accept reader text, record microphone audio or persist state after exit.

Implementation validation is recorded below only after it runs. A local simulation cannot establish real ChatGPT Voice behavior.

## Local commands

From the repository root, using a supported Node runtime and installed dependencies:

```sh
node node_modules/vitest/vitest.mjs run --config scripts/gate0-decoupled/vitest.config.mjs
node node_modules/@playwright/test/cli.js test --config scripts/gate0-decoupled/playwright.config.mjs
node scripts/gate0-decoupled/server.mjs
```

The standalone probe binds loopback port 4320. The server prints its run ID and MCP URL. The browser test owns an ephemeral loopback server; do not start a second server for tests. Only a separately reviewed, explicitly approved temporary HTTPS exposure can make the standalone probe reachable to ChatGPT.

## What is separated

| Operation | Effect |
|---|---|
| `rise_open_visual` | Opens the widget from current state; carries the UI resource. Does not reset or mutate the run. |
| `rise_set_visual` | Admits a visual mutation for the current run ID; returns data without a widget template. |
| `rise_read_visual` | Reads current server state without a mutation; returns data without a widget template. |

The model should open once, then use the data mutation tool. Reader controls call tools through the host bridge. Each accepted mutation advances server sequence once. Initial sequence 0 means still/no mutation; opening or reading does not invent mutation timestamps. Restart changes the run ID, and stale run IDs refuse.

Attractor intensity is finite from 0.4 to 0.75, default 0.65. Still accepts no intensity. Unknown fields and malformed or oversized requests refuse without changing state. Request size is capped at 16,384 bytes, and evidence logs retain at most 128 entries.

## Reading the evidence

The widget keeps one instance ID per creation and a separate applied sequence. Results are labeled by the actual receiving path:

- `initial_render`: opening result.
- `host_notification`: unsolicited result delivered by the parent host.
- `reader_mutation`: response to an explicit widget mutation call.
- `manual_read`: response to “Read server state.”

A successful server mutation does not establish widget delivery. A manual read can bring the widget up to the latest admitted state, but it cannot count as automatic Live synchronization. No polling or hidden refresh substitutes for the missing delivery path.

Renderer acceptance and a following animation-frame callback are separately recorded. They do not verify visible pixels or audible speech. Duplicate and stale results do not replay renderer changes. Refusal, stopped state and teardown are explicit. Parent-source and message-size guards remain required.

The fixed context-marker and marker-message controls are distinct. Host RPC acknowledgment means only that the host replied; recognition by the active model and reader-confirmed audible acknowledgment need their own observations. A rejected message has no silent fallback. Manual speech controls are operator annotations, not native callbacks.

## Real-host run sheet

Use a fresh, explicitly approved test connection to the reviewed exact head. Keep the older direct-delivery probe as a comparison, not a hidden fallback.

1. Open once in Composer. Record server run ID, widget instance ID and sequence 0.
2. Click the bounded intensity buttons. Confirm one widget/renderer accepts both responses. This proves reader-driven interaction only.
3. Ask the model to set intensity 0.4, then 0.75, then still and attractor. Do not reopen, refresh or click reader controls between these requests. Observe for 15 seconds after each completed model turn; record later arrivals separately.
4. If the model reports admission but the widget remains unchanged, click “Read server state” once. Record the server sequence and older widget sequence. A newer snapshot obtained by this read proves admission without prior automatic delivery.
5. Repeat in one browser Voice session. Begin with microphone muted to prevent ambient turns. Typed requests while Voice is active are distinct from spoken and mid-utterance requests. Unmute only for the reader's controlled spoken trial.
6. Send context and message markers separately. Record dispatch, host acknowledgment/refusal, model recognition and reader-confirmed audible response independently.
7. Use Stop, end Voice, and shut down the tunnel and server. Verify actual process exit and that loopback and public endpoints no longer serve the probe.

On Windows, stopping a shell wrapper can leave its native child alive. Check the exact trial port/listener PID and tunnel PID before terminating only those processes. Do not kill all Node or cloudflared processes. A session-exit message alone is insufficient shutdown evidence.

Report reader interactivity, automatic model-to-widget delivery, instance continuity, marker recognition, audible output and speech/tool interleaving independently. A reciprocal Live pass requires persistent visual changes and a verified spoken response to reader input in the same Voice session; a manual read or another widget cannot substitute.

## Evidence and product boundary

Historical direct-delivery trial at `88195644` on 2026-10-03: browser Voice invoked mutations, each opened a new instance, the host acknowledged a context marker that the Voice model could not see, and a marker-message request was rejected. The reader heard “Done” and the marker refusal; “Set” was unconfirmed. The trial server/tunnel were removed. These are observations about that version, not this decoupled version.

The decoupled probe has no real-host acceptance until a new run is explicitly recorded. ChatGPT remains classified as Composer. This experimental RAM visual state is not the canonical Experience Program, reader-authorized score history or Experience Events protocol.

The [OpenAI UI guide](https://developers.openai.com/plugins/build/chatgpt-ui) recommends separating data tools from rendering and demonstrates explicit widget tool calls without remounting. It does not guarantee that model calls deliver their results to an existing widget. The [reference](https://developers.openai.com/plugins/reference) defines tool visibility and UI-resource metadata. This probe tests the gap directly.

## Local validation record — 2026-10-03

Executable candidate: `7587e8a86f5fd79fc0ae746e6a2f38686f1e0f4a`, based on the repair candidate `88195644`. New isolated unit/bundle suite: 11 passed; new real-renderer browser suite: 9 passed. Both current-state-on-open and retained-marker-outcome regressions failed before their fixes and passed afterward. Removing the parent-source guard made the hostile-frame regression fail; restoring it made the covering browser suite pass. Original isolated probe: 9 unit/bundle and 1 browser test passed; its code is unchanged by the widget fixes.

Production unit suite: 5,751 passed and 61 configured skips, with one worker. Production browser gate: 32 passed and 3 configured skips. The final candidate has identical `src`, `worker`, and test-configuration trees to those runs. Hygiene: 8 checks clean; dependency compatibility passed; audit passed at the high threshold with two existing moderate Vitest/mocker advisories. Generated architecture diagram stayed unchanged; system-design tests passed 8/8; wiki generated 71 pages. Production build passed with existing JSON-import and large-chunk warnings; first load was 59.1 KB brotli against a 64 KB budget.

One nonblocking test gap remains: the server read test checks observation timestamps but does not directly prove clock advancement between two separated reads. Real ChatGPT delivery, Voice marker recognition, and audible output remain unverified for this version.

The reviewed HTTP admission wrapper is reused through narrow optional state/dispatcher/HTML injection, preserving original defaults. This avoids copying admission logic; if that boundary proves unsuitable, the experiment can replace it with a separately reviewed isolated wrapper.

Shutdown: Cloudflare returned error 10007, “This Worker does not exist on your account,” for `rise-chatgpt-demo` in the scarlson896 account, and its public endpoint returned 404. No new tunnel or Worker was deployed for this experiment. The local CLI listener on port 4320 was stopped and independently verified closed.
