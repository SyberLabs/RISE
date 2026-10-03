# Isolated ChatGPT Demo Setup

The demo is a separate Cloudflare Worker named `rise-chatgpt-demo`. Production `wrangler.production.jsonc` remains unchanged with MCP disabled. The demo enables the existing MCP route and permits framing only for the embedded live page. It uses the existing application and has no provider key, database secret or shared inference requirement.

Use Node compatible with the repository engines. Dependencies are already pinned; use `npm ci` in a fresh checkout and `npm run audio:hydrate` before full audio/browser validation.

```sh
npm run build
npx wrangler deploy --config wrangler.demo.jsonc --dry-run
npx wrangler dev --config wrangler.demo.jsonc
```

After deployment is explicitly approved, build the exact reviewed commit, add its release marker to dist, and publish only the demo configuration:

```sh
npm run build
node --input-type=module -e 'import {execFileSync} from "node:child_process"; import {writeFileSync} from "node:fs"; const sha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(); writeFileSync(`dist/release-${sha}.txt`,`${sha}\n`);'
npx wrangler deploy --config wrangler.demo.jsonc
```

Use the HTTPS URL Wrangler actually reports. The MCP URL is that origin plus `/api/mcp`. The widget frames the same origin’s `/live?embed=mcp`. Check the exact release marker before and after host acceptance. Confirm ordinary `/live` remains unframable and only the embedded shape is framable; retired inference routes still refuse shared inference.

In a signed-in ChatGPT account eligible for custom MCP apps, open Plugins → Add → Create MCP App. Name it RISE Demo, use the HTTPS `/api/mcp` endpoint and select No authentication: this demo serves a stateless presentation tool and requires no provider key. Review the custom-server risk acknowledgement and grant access only after explicit approval. If the account requires developer mode, enable it only with approval. Review the discovered `rise_present` tool and UI resource, add the connection to a fresh conversation and run the acceptance cases. Refresh metadata after server or resource changes, then use a new conversation.

Developer-mode availability depends on account/workspace policy. A signed-out browser or unavailable developer mode is an actual access blocker, not a failed RISE runtime test. Public directory submission is outside this demonstration.

Official setup: https://developers.openai.com/plugins/deploy/connect-chatgpt
# ChatGPT RISE Demo Acceptance

This is a private developer-mode demonstration. RISE owns validation, rendering and playback; ChatGPT supplies the initial Current. No provider key or RISE-funded inference is used. The closed calmer control changes brightness only and makes no claim about emotional efficacy.

## Ten cases

| Case | Action or prompt | Expected outcome |
|---|---|---|
| 1. Direct presentation | “Use RISE to explain why a black hole is black in three short passages. Make the first passage an attractor. Keep the words plain.” | ChatGPT calls rise_present with a valid Current. RISE offers Begin; after the reader presses it, RISE renders readable text and an attractor field. |
| 2. Indirect presentation | “Give me a short spoken, visual explanation of tides through RISE. Start with an attractor passage.” | The host selects the same tool, without the reader supplying JSON. |
| 3. Malformed proposal | Inspector calls rise_present with schema rise.invalid.v1. | Tool error names the schema problem, no structured Current or playback. Corrected valid call succeeds. |
| 4. Unsupported visual | Inspector calls with visual unknown-surface. | Strict refusal; no silent substitution. A valid supported visual succeeds. |
| 5. Calmer | During the first attractor passage, Interrupt, type “make it calmer” in Visual change, then Change visual. | Brightness target decreases by 0.1; same held text and position. Resume continues the same reading. No sampling call. |
| 6. Lower bound | Repeat the exact calmer command until the lower bound. | Target remains at least 0.4; a further change reports the limit. |
| 7. Unsupported compound | Type “make it calmer and stop” in Visual change. | Specific refusal naming supported phrases; playback and brightness unchanged. |
| 8. Pause and resume | Interrupt during a passage, inspect the held words, then Resume. | Same place is retained; the reading continues. Stop ends playback. |
| 9. Reopen and teardown | Reopen or reload the widget, press Begin, then later close it. | If the host redelivers the result, it waits for Begin and starts from the beginning, as the visible notice says. Teardown stops playback; no continuing voice or controls. |
| 10. Capability and duplicate delivery | Inspect host capabilities; engineer sends identical input/result in the browser harness. | Answer and calmer work without sampling. Unsupported Dive explains its limit. Duplicate Current plays once. |

Cases 3,4 and duplicate injection use protocol/browser checks, not an instruction to persuade ChatGPT to violate its schema. Run cases 1,2,5,6,7,8,9 and sampling observation in actual ChatGPT. Keep host and fake-harness evidence separately labeled.

## Evidence record

For each case record exact commit and endpoint, host/version where exposed, prompt or protocol fixture, tool name, validation result, rendered outcome, capability/refusal and pass/fail. Use only these non-sensitive example prompts. Do not capture account identifiers, credentials or unrelated conversations.

For the golden flow record a view of the first passage and field, the held passage, the brightness receipt and resumed reading. Inspect normal and reduced-motion rendering. Listen to the actual spoken output when the host/browser permits reader-activated audio. If audio cannot be heard, mark audible quality unobserved; paced fallback is not evidence of sound quality.

Engineering readiness requires reviewed code, required CI, affected unit/browser tests and a build/dry-run. Demo readiness additionally requires a real ChatGPT tool call, visible widget and successful reader redirection. Independent first-time reader observation remains a later product-value gate; this demo is not proof of demand or retention.

## Engineering evidence and remaining acceptance

The baseline at `a4ece2d3` passed required CI and all 21 full-validation jobs. A later demo run at `856a0852` passed 19 jobs but failed the authored 240 WPM export and live canvas-control checks. The final fix candidate at `c320e33c` adds startup cancellation and preserves retry guidance within the runtime display limit; its focused evidence follows. Full remote validation of the candidate is still required.

| Area | Evidence | Status |
|---|---|---|
| Validated tool delivery | Worker/port 59 unit tests; real worker responses feed the browser fake host | Passed |
| Duplicate delivery | Port guard removal produces two deliveries; restored guard passes. A delayed matching result preserves held browser text and state | Passed |
| Exact calmer commands | 84 affected unit tests; browser target 0.65 → 0.55, held text unchanged, resume and no sampling | Passed |
| Replay, teardown and refusal | 172 affected unit tests; 16 affected browser cases, including delayed-startup unit regressions and displayed long-error guidance | Passed locally |
| Canvas response | Existing active-field readiness marker precedes actual pixel measurement; response remains below one second | Passed locally |
| Authored pace and portable review | Captured slider/save/project/export values all 240; full clean-browser journey passed. Earlier 240-to-280 failure remains unexplained | Open concern; remote validation pending |
| Isolated serving | Wrangler dry-run; actual local HTTP handshake, tools, resource origin, results/refusal, GET/HEAD framing and six retired routes | Passed locally |
| Build and repository checks | Hygiene, security compatibility, unchanged diagram and build; first load 59.5 KB brotli against 64 KB | Passed |
| Public endpoint and exact release | Explicit deployment approval, HTTPS checks and release marker | Pending |
| Real ChatGPT model and widget | Ten-case acceptance in the signed-in host, including local reader redirection | Pending |

The audit retains two existing moderate Vitest dependency findings and no high or critical findings. Builds retain existing JSON import-attribute and large-chunk warnings. An earlier Dive phrase-timing browser retry is recorded separately; later affected browser runs passed. These results do not establish real-host rendering, audible quality or product value.
