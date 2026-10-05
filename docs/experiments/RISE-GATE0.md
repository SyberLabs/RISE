# RISE Gate 0: local host feasibility probe

**Status (2026-10-04):** closed. ChatGPT is a Composer host ([decision](../product/discussions/2026-10-04-composer-decision.md)). Kept as the record of the first probe.

This is a throwaway local experiment. It uses the actual `AttractorField` renderer in one self-contained MCP Apps widget and one mutating `rise_set_visual` tool. It does not change RISE production playback, keep data after process exit, accept reader text, use an inference API, sample a model, or capture microphone audio.

## Run locally

Use the repository’s installed dependencies and the Node runtime available on this machine:

```powershell
$node = 'C:\Users\MATEO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node scripts\gate0\server.mjs
```

The server prints a random run ID and listens only on `http://127.0.0.1:4319/mcp`. It serves one RAM-only run; restarting it creates a different run ID and clears the server log. Stop it with Ctrl+C. It accepts browser `Origin` only when it equals its own loopback origin. A server-side MCP host may omit `Origin`.

Run the isolated unit and bundle checks:

```powershell
& $node node_modules\vitest\vitest.mjs run --config scripts\gate0\vitest.config.mjs scripts\gate0\probe.test.js scripts\gate0\widget-build.test.js
```

Run the fake MCP host browser simulation (it starts an ephemeral loopback server and closes it after the test):

```powershell
& $node node_modules\@playwright\test\cli.js test --config scripts\gate0\playwright.config.mjs
```

The server’s `/__gate0/widget` test route serves the identical self-contained UI resource returned from `resources/read`. The Playwright parent page simulates MCP Apps notifications, acknowledgement, and teardown. This is a simulation, not evidence about ChatGPT Voice.

For ChatGPT to reach this local probe, a reviewed and explicitly approved temporary HTTPS exposure of the reviewed server is required. No tunnel or public endpoint is included here. Keep the server bound to loopback; do not expose it until that separate review and approval happen.

## What the probe records

Each accepted call changes the in-memory visual snapshot and advances its sequence. `attractor` accepts an optional finite intensity from the existing manifest range 0.4–0.75 and defaults to 0.65. `still` refuses an intensity. Other fields and values are refused without changing the sequence or state. The bounded server log retains only the most recent 128 accepted receipts.

The widget log is also capped at 128 entries and can be exported as JSON. Visual entries include the run ID, widget instance ID, server sequence, server-received and server-applied UTC times, tool-result receipt UTC time, renderer-control application UTC time, and the next animation-frame callback observation UTC time. “Renderer control applied” records a state update accepted by the renderer. “Animation frame observed” means the browser ran that frame callback; neither timestamp reads or proves what pixels were visible. A replacement widget gets a new instance ID, and the widget does not poll or recover missed results through another path.

Duplicate results are recorded as duplicates and do not call the renderer or advance the applied sequence. Older results are recorded as stale and do not change the visual. Result snapshots are size-bounded, closed-schema, and checked for run ID, sequence, visual, intensity, and UTC timestamp shape before any renderer operation. Only messages from the widget’s parent are considered.

The two reader controls are separate. “Send marker to model context” sends a fixed marker through `ui/update-model-context`; “Send marker message” sends that same fixed marker through `ui/message` with the required `role: "user"`. Their logs distinguish dispatch from host RPC acknowledgement. An acknowledgement means only that the host replied to the bridge request. It does not prove the active Voice model received or answered the marker. The MCP Apps specification says model context may be deferred until a later user message, and the host may deliver only the latest update; a successful `ui/update-model-context` bridge call therefore does not establish current-turn delivery. `ui/message` is a separate request to send a user message and must be evaluated independently. The manual speech-start, speech-end, and audible-reader-acknowledgment controls make timestamped entries labeled `manual`; they are not native Voice callbacks. No speech or audio is stored.

## Real-host procedure and prompts

Run one surface at a time, keep one Voice conversation open, and note any widget replacement. Do not use Composer success as voice evidence. The [ChatGPT Voice documentation](https://learn.chatgpt.com/docs/features/voice) currently describes Voice in the desktop app; browser Voice availability and app/tool behavior remain unestablished by that page. Treat the browser run as a separate experiment and fill its table only if browser Voice and the same app surface are actually available.

1. Connect the approved HTTPS URL ending in `/mcp` to the ChatGPT app. Confirm the server’s printed run ID matches the widget’s first accepted result.
2. Start a new voice session and say: “Use the RISE Gate 0 app. Set the visual to attractor at intensity 0.65, then keep the same voice session open while I ask for two visual changes.”
3. While the same voice session remains open, ask separately: “Set the attractor intensity to 0.4.” Then: “Set the attractor intensity to 0.75.” Then: “Switch to still, then back to the attractor at the default intensity.” Do not restart Voice between requests. Use the widget log to compare sequence and instance ID.
4. During that same session, click each reader-marker action separately. Ask GPT-Live to repeat and answer the fixed marker aloud without stopping or restarting the voice chat. Mark audible speech start/end and any audible reader acknowledgment with the manual controls. Record only whether an acknowledgment occurred, not its words.
5. Stop the server with Ctrl+C after the run. Preserve the exported factual log with the observation table; it contains no spoken content.

## Classification

Use one classification for each surface and trial:

- **supported interleaving** — repeated visual tool calls arrive in the same run with increasing sequence, the same widget instance visibly persists, and GPT-Live audibly acknowledges the reader marker during that same Voice session.
- **speech suspended during tools** — the same Voice session and widget persist, and tool mutations work, while speech audibly pauses during tool activity and resumes afterward. Record whether the marker receives a spoken acknowledgment in that session.
- **turn-only** — the host delivers or acknowledges the tool/reader marker only after the current Voice turn ends, or a new Voice turn/session is required before the model responds.
- **inconclusive** — access, delivery, timestamps, or audible behavior cannot be established from the run.

A new widget instance during a tool call means this direct-delivery probe failed to keep that widget alive for the observed call. It does **not** establish that every possible ChatGPT integration must remount or that persistent visuals are impossible. Record the observed instance IDs and classify only what the evidence supports. A reciprocal pass requires both a persistent visual instance and a real same-session spoken response to the reader marker; matching Composer behavior does not qualify.

## Desktop GPT-Live observations

Surface/account/app version: ____________________  Date/time: ____________________  Run ID: ____________________

| Trial | Server seq + received/applied UTC | Widget instance ID(s) | Result received / renderer applied / frame callback UTC | Manual speech start/end | Marker dispatch + host ack UTC | Audible same-session marker ack? | Classification + notes |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |

## Browser Voice observations

Surface/account/app version: ____________________  Date/time: ____________________  Run ID: ____________________

| Trial | Server seq + received/applied UTC | Widget instance ID(s) | Result received / renderer applied / frame callback UTC | Manual speech start/end | Marker dispatch + host ack UTC | Audible same-session marker ack? | Classification + notes |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |

## Documentation basis

The implementation follows the official [MCP server guide](https://developers.openai.com/plugins/build/mcp-server), [MCP Apps UI guide](https://developers.openai.com/plugins/build/chatgpt-ui), [tool design guide](https://developers.openai.com/plugins/plan/tools), [plugin reference](https://developers.openai.com/plugins/reference), [quickstart](https://developers.openai.com/plugins/build/app-quickstart), [MCP Apps specification (2026-01-26)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx), and current [ChatGPT Voice documentation](https://learn.chatgpt.com/docs/features/voice). The widget uses the documented `ui/initialize`, `ui/notifications/initialized`, `ui/notifications/tool-result`, `ui/update-model-context`, `ui/message`, and `ui/resource-teardown` bridge methods. The Voice docs describe turn-taking generally but provide no native speech lifecycle callback or guarantee about the widget lifecycle during repeated tool calls.
