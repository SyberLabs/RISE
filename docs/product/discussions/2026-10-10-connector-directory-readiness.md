# RISE in Anthropic's connector directory: readiness review

Date: 2026-10-10. Live build at review time: 5b0996d2. Owner: Mateo (SyberLabs).

Three reviews were run in parallel against main and the live site: Anthropic's published
listing requirements (primary sources, quoted and dated 2026-10-09), a security and
protocol scan in a reviewer's voice, and a policy, privacy, brand and documentation
review. This page is the synthesis: what was fixed today, what is still open, who owns
each item, and the exact submission material.

## 1. Verdict

RISE can be submitted as a Community connector as soon as the two pull requests in
flight land (wording and documentation; the five screenshots), the owner settles one
decision (whether the Plus voice stays out of the Claude connector for the first
submission), and every unchecked must-have in section 7 is done, including the
example-prompt verification and the tool testing. Everything the automated scan is known to check is addressed or in flight.

## 2. How listing works

- The process is self-serve: a developer portal (`claude.ai/directory/manage`), an
  automated scan, then a **Community** listing by default. Anthropic escalates to
  **Verified** on its own. There is no partner program and no interest form.
- Any paid Claude plan can submit. The listing belongs to the organization it is
  submitted from (a personal Pro or Max account, or a Team or Enterprise owner).
- Review contact: `mcp-review@anthropic.com`. MCP App questions: `mcp-apps@anthropic.com`.
- Sources: `claude.com/docs/connectors/building/submission`,
  `claude.com/docs/connectors/building/review-criteria`, the Anthropic Software
  Directory Policy (`support.claude.com/en/articles/13145358`).

## 3. Fixed today (merged and live at 5b0996d2)

| PR | What a reviewer would have flagged | What changed |
|---|---|---|
| #603, #604 | The per-address rate limit (30/min) throttled every Claude user together, since all arrive from Anthropic's egress range; the 429 was not JSON-RPC | Anthropic's published range `160.79.104.0/21` is exempt; a tripped limit answers a JSON-RPC error with `Retry-After`; the limit is charged before the body is read |
| #603 | `tools/list` was 28 KB; the `rise_present` description was 11.7 KB and echoed the whole Current back | 10.5 KB and 1.7 KB; the accepted call returns a one-line receipt; the long guide lives behind `rise_guide` |
| #603 | Every `/.well-known/*` path returned the app page; no `security.txt` | Unknown paths and the OAuth discovery paths answer a JSON 404; `security.txt` (RFC 9116) is served |
| #603 | The resource declared `inline` only while the app declared `fullscreen` and `pip` | Both declare the same modes |
| #605 | Model-written scene code was held in by a denylist; containment rested on the host's CSP | The card ships its own Content Security Policy with no `unsafe-eval`; the worker locks `Function`, `eval`, the global object and its message channel; a foreign `import()` and `fetch` are proven refused in the browser test |

Verified live: `security.txt` is `text/plain`; the OAuth discovery path is 404;
`tools/list` is 10,535 bytes; the card's HTML carries the policy meta and declares
`frameDomains: []` with only `https://rise.syberlabs.io` for connections and resources.

Also verified clean by the scan, with live evidence: origin validation, no sessions,
body caps, clean JSON-RPC errors, tool titles and annotations (`readOnlyHint`), the SVG
figure allowlist, admin routes behind Cloudflare Access, retired routes at 410, no
telemetry, no secrets in the tree or history, zero production dependency
vulnerabilities (the one Dependabot alert is a development-only chain).

## 4. In flight (pull requests open at the time of writing)

- **Wording and pages.** The server text described `rise_guide` as something Claude
  should "read how" from; the policy forbids directing Claude to load behavioural
  instructions at run time, so the tools now describe a *format reference*, and the
  guide's second-person lines become field descriptions. "In the manner of 3Blue1Brown"
  is dropped. The Sign in link leaves the card (the connector needs no account). The
  privacy page states that Cloudflare Workers logging is on and what it keeps. Terms say
  the card shows words the model wrote, and the public-domain claim is scoped to the
  United States. README gains a Claude section; APPS.md gains the sound bed.
- **Screenshots.** Five PNGs of the card alone, at least 1000 px wide, each paired with
  its prompt, under `docs/assets/directory/`.

## 5. Open decisions (owner)

1. **Plus and the AI-audio rule.** Policy §4B excludes "software that uses AI models to
   generate images, video, or audio content" unless Anthropic permits it in writing; the
   portal asks for an "AI media generation" acknowledgment. The Plus voice is
   ElevenLabs speech. Two paths: (a) submit with Plus unreachable from the Claude card
   and absent from all connector text, which is already true today, and ask about Plus
   afterwards; (b) write to `mcp-review@anthropic.com` first and hold submission.
   Recommendation: (a). The free voice is the device's own speech synthesis; the visuals
   are code and SVG the model writes, which is closest to the allowed "diagrams, charts".
2. **Terms and Plus pricing.** `TERMS.md` sells Plus at $8.99 while `/api/plus/status`
   says `available: false` and the production payment link is Stripe's *test* link. A
   reviewer who reads the terms will notice. Either remove the Plus clause until Plus
   ships, or make it true.
3. **Security reporting channel.** `security.txt` points at `syberlabs.software@gmail.com`
   because no `security@` address exists and GitHub private vulnerability reporting is
   disabled on the repository. Enabling it (`gh api -X PUT
   repos/SyberLabs/RISE/private-vulnerability-reporting`) would allow a second, durable
   channel.
4. **Workers plan.** No `limits.cpu_ms` is set; admission of a maximum-size Current
   measured 38 to 112 ms locally. On Workers Free (10 ms CPU) large calls can fail
   intermittently with a Cloudflare error page. If the account is on Workers Paid, set
   `"limits": { "cpu_ms": 1000 }`; if not, that is a reason to upgrade before the
   listing drives traffic.
5. **Branding.** Anthropic's trademark guidelines permit its marks only in approved
   materials. Keep "Claude" out of the server name, tool names and icon (true today).
   Whether marketing may say "RISE in Claude" is unknown; ask `marketing@anthropic.com`.

## 6. Process risks seen during this review

- **The Codex-feedback bot can race a live author.** On #603 the author agent disabled
  auto-merge to fix a real Codex finding; the workflow answered the thread itself,
  re-armed auto-merge and merged the unfixed commit. The fix followed as #604. Until the
  workflow checks for an active author, push the fix commit first and answer second.
- **The `voice-provider` deploy job fails on every run** (the Cloudflare token lacks
  access to the `rise-plus-preview` Worker). Production deploys regardless, but the
  listing must not advertise Plus voices while that is so.
- **The deploy guard refuses any commit that is no longer the head of main.** Several
  merges in quick succession mean only the last one's run deploys. Expected, but check
  `release.txt` rather than a single run's status.

## 7. Submission checklist

Must have:
- [x] Streamable HTTP MCP server, no auth, tools with titles, descriptions, annotations
- [x] Self-contained card (`frameDomains: []`); own CSP; display modes agree
- [x] Rate limit that does not throttle Anthropic's egress; JSON-RPC errors throughout
- [x] `/.well-known/security.txt`; OAuth discovery paths 404
- [x] Privacy policy URL (`https://rise.syberlabs.io/privacy`), terms, support contact
- [x] Public documentation URL (`https://rise.syberlabs.io/apps`)
- [ ] Tool and server text free of run-time instruction fetching, creator names, promotion (in flight)
- [ ] 3 to 5 PNG screenshots ≥ 1000 px wide, cropped to the card, prompts separate (in flight)
- [ ] At least three working example prompts (drafted below; verify in claude.ai before submitting)
- [ ] Attest that every tool was run in MCP Inspector and as a custom connector in Claude, plus the iOS and Android apps
- [ ] A paid Claude account in the organization that will own the listing
- [ ] The Plus decision (section 5.1) and the AI-media acknowledgment answered truthfully

Should have:
- [ ] Allowed link URIs in the portal: `https://syberlabs.io`, `https://rise.syberlabs.io`
- [ ] Light theme check of the card against the host's tokens; WCAG AA contrast; keyboard control
- [ ] Card assets accept `Origin: *.claudemcpcontent.com` and never depend on `Referer` (iOS)
- [ ] `structuredContent` well under 150,000 characters (true: a Current is capped far below)
- [ ] The reader is told the voice is synthetic (the Voice row names the device voice)

## 8. Listing copy (draft)

**Name:** RISE

**One-liner:** Turns an answer into a short reading you watch and listen to: your device
speaks it, the words appear as they are spoken, and a drawn visual plays behind them.

**Description:**

> Ask Claude to explain something and present it in RISE. Claude writes the answer as a
> short reading: a title, up to 16 passages, and, if it likes, a colour theme, a look,
> and a diagram or figure of its own. RISE shows it in the chat as a card. You press
> Play. Your device's built-in voice reads it aloud, the words appear as they are spoken,
> and a visual plays behind them.
>
> You stay in control: play, pause, go back or forward a passage, hear a passage again,
> change the pace, and in Settings choose the theme, how vivid the imagery is, whether it
> moves at all, the text size, the sound and the voice. If your device has no voice, the
> reading still plays, paced, with every word shown.
>
> The imagery is drawn, not generated. RISE draws it live with its own procedural
> engines: line drawings, a strange attractor, soft light, fractal flames, spectral
> plates. When Claude adds a diagram or figure, RISE checks it first and runs it apart
> from the page, with no network and no access to your data. RISE calls no image, video
> or speech model of its own: the voice is your device's built-in speech.
>
> RISE needs no account and no key, and it costs nothing. It receives only the reading
> Claude writes for it, plays it, and keeps none of it. It never sees your conversation,
> memory or files.
>
> What it does not do: it takes no actions, makes no pictures to order, and is not for
> tables, code, or long reports. Claude answers those itself.
>
> Made by SyberLabs. Privacy: rise.syberlabs.io/privacy

**Category:** Education (primary); Media or Learning if offered.
**Before connecting, users need:** nothing.
**Reads or writes:** neither; both tools are read-only.
**Authentication:** none. **API:** our own (Cloudflare Workers at rise.syberlabs.io).
**Icon:** `public/android-chrome-512x512.png`.
**Documentation:** `https://rise.syberlabs.io/apps`. **Privacy:** `https://rise.syberlabs.io/privacy`.
**Support:** `syberlabs.software@gmail.com`.

**Compliance answers:**
- Financial transactions: none.
- AI media generation: RISE calls no media model. The voice is the device's own speech
  synthesis (Web Speech API); diagrams and figures are code or SVG the model writes,
  rendered by RISE. (If Anthropic reads on-device speech as AI audio, this is the
  question to ask them; see section 5.1.)
- Conversation data: only the tool's argument, not stored.
- Prompt injection: the tool returns a one-line receipt or a clipped validator message;
  `rise_guide` returns a format reference, not instructions.

**Demo prompts:**
1. "Explain how black holes bend light, and present it in RISE."
2. "Show me what a derivative is, as a RISE reading in the premium-educational style."
3. "Give me a two-minute RISE reading on why the sky is blue, in the Signal look."
4. "Present a short reflection on Marcus Aurelius and the inner citadel in RISE, in the Garden look."
5. "Show me the parts of an animal cell in RISE."

Negative checks (Claude should not call RISE): "Book me a table for two tomorrow
night." "Generate a picture of a cat." "Write a 10,000-word report and read it in RISE."

## 9. Questions for Anthropic

1. Does on-device browser speech synthesis count as "AI models … generate … audio"?
   Would written permission be granted for a speech model to narrate Claude's own answer?
2. May the card mention a paid tier or link to a checkout outside the card?
3. For an authless server, what satisfies "test account credentials"?
4. May marketing say "RISE in Claude" and show Claude's interface in screenshots?
5. Is the MCP App UI reviewed by a person at the Community level, and against what list?
6. Is there a size limit on the `ui://` HTML resource?

## 10. Source documents

The three review documents (requirements with quotes and URLs, the security scan with
file and line references, the policy review with the full listing draft) were produced
in the session's scratchpad on 2026-10-09/10 and are summarised above. Their findings
are recorded in the task records LIVE-004, CC-005 and SND-001 through the roadmap tool.
