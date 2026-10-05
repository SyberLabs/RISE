# ChatGPT Reader-Controlled Demo Design

The demo proves one loop: ask ChatGPT for a short Current with an attractor passage, admit it in RISE, play, type “make it calmer,” pause and resume at the same place, then recover from rejected proposals and reopened views. The user approved this direction, instructed execution until ready, and selected ChatGPT.

## Architecture and authority

Retain the existing vanilla widget, Worker, MCP relay and port, Current validator, adapter, runtime, Player and Chamber. The server returns the validated Current as `structuredContent.current` with accurate acceptance text; the widget validates again before creating runtime events. The host owns initial inference. RISE owns admission and playback. Local reader redirection changes only admitted attractor intensity.

No public SDK, new composition schema, second player, account store, cloud session, telemetry or shared inference is needed to demonstrate this loop. These requirements are deleted from the demo scope. Microphone access, public-directory submission and quantitative emotion claims are also unnecessary.

## Reader redirection

“Make it calmer” and “please make it calmer” lower the active attractor brightness target by 0.1, bounded at 0.4. “More vibrant” retains its 0.1 increase, bounded at 0.75. Normalize case, spacing and terminal punctuation as the existing matcher does; refuse unknown or compound instructions with supported choices. Feedback describes brightness, not a measured emotional effect. Preserve Current, segment, reading position, pace, main/side lifecycle and reduced-motion rules. No inference call is made for this adjustment.

## Recovery

Reopening starts from the beginning when the host redelivers a valid tool result. A persistent embedded notice explains this; exact checkpoint persistence is not promised. Amended 2026-10-05: the notice leaves the embed; on a reopen the poster itself, the title over Play, carries the fact ([embed stage decision](../../product/discussions/2026-10-05-embed-stage-decision.md)). Interrupted playback resumes the same runtime atom. Teardown ends playback and clears controls. A malformed Current shows no passage and gives a clear instruction to ask the assistant again; a corrected tool call in a fresh or reopened view can play.

Sampling is optional and unnecessary for the initial Current and redirection. Unsupported Dive remains explicitly refused. Host capabilities must be observed in ChatGPT, not inferred from the reference or fake host.

## Serving and acceptance

Serve the same built app through a dedicated demo Worker configuration with MCP enabled and only `GET/HEAD /live?embed=mcp` framable. Production MCP remains off. The server and nested frame share one HTTPS origin. No provider key or database secrets are required for the demonstrated flow.

Acceptance requires the selected 240 WPM to survive baseline variation/export; real server results to reach result-only sandboxed widgets; duplicate delivery to play once; calmer bounds and refusals to preserve playback; and browser evidence for pause/resume, teardown, corrected retry and reload replay. Required CI and independent reviews must pass. Ten named acceptance cases and recorded evidence make the demonstration repeatable.

The real ChatGPT model must select the tool, generate a valid Current, render the widget and support reader redirection. Record visual and audible quality only when actually inspected. Fake-host tests are engineering evidence, not product-host evidence.

Deployment and connector changes are external steps. Prepare a concrete configuration, commit and verification before requesting explicit authorization; the prior automatic approval rejection of production merges must not be circumvented.

## Official references

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/deploy/connect-chatgpt

The existing MCP bridge is the starting point; this is not a new application scaffold.
