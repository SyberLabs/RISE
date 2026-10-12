# RISE connector submission packet

**Filed 2026-10-11** from the paid account, live build a7387e6d; Community listing pending the
automated scan. The portal had no field for the screenshots or the allowed link URIs; they
are kept ready in `docs/assets/directory/` and under **Server** below. Recorded in
[the readiness register](2026-10-10-connector-directory-readiness.md) §7 and in LIVE-004.

Date: 2026-10-10. For: Mateo (SyberLabs), who files it. Source:
[the readiness register](2026-10-10-connector-directory-readiness.md) (§5 decisions, §7
checklist, §8 listing copy, §9 questions) and
[the directory screenshots](../../assets/directory/DIRECTORY-SCREENSHOTS.md).

Every field Anthropic's portal asks for, filled, in the order to paste it. The listing copy
is §8 of the register as drafted; the decisions behind it are the owner's of 2026-10-10:
submit without the Plus voice, terms corrected and the test payment link removed, the demo
prompts verified through Claude, the MCP Inspector run recorded, and the owner submits from
the paid account that will own the listing.

## Before you start

**The freeze (2026-10-11).** Connector-facing code is frozen from the build this packet
names until the submission is filed. The build to submit is the one `release.txt` shows at
filing time; record it in the register (§7) and in LIVE-004. Nothing merges to the card, the
Worker's MCP route, the tool text or the pages until then. The last connector change was
#631 (a613d0e7): the bed fades out when the voice has ended.

What must be true before you press Submit. All but the last are yours, in this order.

1. **A fresh chat, first thing.** Start a new chat before any other RISE use that day, with
   the connector added (`https://rise.syberlabs.io/api/mcp`), and ask one demo prompt. The
   card must appear without a page reload, through the permission prompt. This is the one
   check to hold the submission for if it fails: it is a reviewer's first interaction, and
   the "first chat of the day" blank card (LIVE-016) has never been reproduced or fixed.
2. **One long reading, played through.** A lesson of twenty or more beats with figures and
   holds (the potato lesson is the right shape), played start to end without seeking, on
   your Edge voice. The sixteen-beat defect (#629) lived three days because every fixture
   was short. Then copy "About this reading": it should show no `run.failed` and no
   `refused:` line.
3. **The demo prompts, each once, in the claude.ai chat and in the Claude iOS and Android
   apps.** Each should show the card; press Play once in each. The tool calls are already
   proven ([the Inspector run](../../assets/directory/INSPECTOR-RUN-2026-10-10.md),
   [the Claude run](../../assets/directory/CLAUDE-RUN-2026-10-10.md)); what only you can see
   is the card rendering and playing in each app. The attestation below claims all three.
4. **The negative prompts.** "Book me a table for two tomorrow night." and "Generate a
   picture of a cat." must not call RISE. The listing's health badge counts refusals as
   errors, so a tool called wrongly costs the listing over time.
5. **Sign in with the paid Claude account that will own the listing.** The listing belongs
   to the organization it is submitted from.
6. **The live site matches this packet**: `/terms` names no price, `/api/plus/status` says
   `available: false` and `/api/plus/config` serves no payment link,
   `/.well-known/security.txt` names the policy. Re-checked on 2026-10-11 against
   a613d0e7; the terms' planned-price sentence found then is removed in the same pull
   request as this revision.

## Server

| Field | Value |
| --- | --- |
| Connector type | MCP connector (remote, Streamable HTTP) |
| Server URL | `https://rise.syberlabs.io/api/mcp` |
| Authentication | None |
| Before connecting, users need | Nothing: no account, no key, no payment |
| Reads or writes user data | Neither. Both tools are read-only (`readOnlyHint: true`) |
| API | Our own: a Cloudflare Worker at `rise.syberlabs.io` |
| Allowed link URIs | `https://syberlabs.io` and `https://rise.syberlabs.io` |

## Listing

**Name:** RISE

**One-liner:** Turns an answer into a short reading you watch and listen to: your device
speaks it, the words appear as they are spoken, and a drawn visual plays behind them.

**Description:**

> Ask Claude to explain something and present it in RISE. Claude writes the answer as a
> reading: a title and its passages (up to 64 beats and 20,000 characters, which is about
> twenty minutes at the longest; most readings are a minute or two), and, if it likes, a
> colour theme, a look, and a diagram or figure of its own. RISE shows it in the chat as a card. You press
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

| Field | Value |
| --- | --- |
| Category | Education (primary); Media or Learning if offered |
| Icon | `public/android-chrome-512x512.png` in the repository (512 × 512 PNG), also at `https://rise.syberlabs.io/android-chrome-512x512.png` |
| Documentation URL | `https://rise.syberlabs.io/apps` |
| Privacy policy URL | `https://rise.syberlabs.io/privacy` |
| Terms URL (if asked) | `https://rise.syberlabs.io/terms` |
| Support contact | `syberlabs.support@gmail.com` |
| Security contact (if asked) | `https://github.com/SyberLabs/RISE/security/advisories/new`, policy at `https://github.com/SyberLabs/RISE/blob/main/SECURITY.md` |

## Test and launch instructions

Paste this into the reviewer-instructions field:

> RISE needs no account, credentials or payment; there is nothing to sign in to.
> Add a custom connector with the URL https://rise.syberlabs.io/api/mcp (no authentication).
> Then ask, for example, "Show me the parts of an animal cell in RISE." Claude calls
> rise_guide for the format reference when it writes in a named style, then rise_present
> with the reading. The card appears in the chat showing the title and Play; press Play.
> Your device's built-in speech reads it and the words appear as they are spoken; if the
> device has no voice, the reading plays paced with every word shown. Settings, on the card's
> bar, changes the theme, imagery, motion, text size, sound and voice.
> rise_present refuses a malformed reading with a one-line message, and Claude can correct
> it and call again. Both tools are read-only and store nothing.

## Compliance answers

| Question | Answer |
| --- | --- |
| Financial transactions | None. Nothing in RISE is for sale. |
| AI media generation | RISE calls no media model. The voice is the device's own speech synthesis (Web Speech API); diagrams and figures are code or SVG the model writes, rendered by RISE. |
| Conversation data | Only the tool's argument, which is not stored. Cloudflare's request logs keep metadata (method, path, status, timing, the client address Cloudflare sees) for at most 7 days, as the privacy page states; no tool text is logged. |
| Prompt injection | The tool returns a one-line receipt or a clipped validator message; `rise_guide` returns a format reference, not instructions. |

The AI-media answer is the register's §8 wording without its internal note. That note
stands: if Anthropic reads on-device speech as AI audio, that is question 1 of the
register's §9, to ask at `mcp-review@anthropic.com`. The Plus voice is not part of this
submission (register §5.1, decided 2026-10-10): it is unreachable from the Claude card and
named in no connector text.

## Screenshots

Upload in this order from `docs/assets/directory/`, each with its prompt in the prompt
field. All five are PNG, 1140 × 753, the card alone.

| File | Prompt to paste |
| --- | --- |
| `01-sky-scene.png` | Give me a RISE reading on why the sky is blue, in the premium-educational style. |
| `02-animal-cell.png` | Show me the parts of an animal cell in RISE. |
| `03-garden-reflection.png` | Present a short reflection on Marcus Aurelius and the inner citadel in RISE, in the Garden look. |
| `04-settings.png` | Explain how black holes bend light, and present it in RISE. |
| `05-poster-play.png` | Show me what a derivative is, as a RISE reading in the premium-educational style. |

## Demo prompts

1. "Explain how black holes bend light, and present it in RISE."
2. "Show me what a derivative is, as a RISE reading in the premium-educational style."
3. "Give me a RISE reading on why the sky is blue, in the premium-educational style."
4. "Present a short reflection on Marcus Aurelius and the inner citadel in RISE, in the Garden look."
5. "Show me the parts of an animal cell in RISE."

Prompt 5's tool calls are recorded in [the Claude run](../../assets/directory/CLAUDE-RUN-2026-10-10.md).
The others are verified by your own runs under "Before you start"; note each outcome in that
record when done. If a prompt fails, drop it here before filing (the portal needs at least
three).

If the portal asks for cases where the connector should not be used: "Book me a table for
two tomorrow night." "Generate a picture of a cat." "Write a 10,000-word report and read it
in RISE."

## Attestation

The text you tick:

> Every tool was run in MCP Inspector and as a custom connector in Claude, including the
> Claude iOS and Android apps.

The evidence:

- MCP Inspector 2.10.1 against the live server: `tools/list`, both tools called, refusals,
  `resources/list`, `resources/read` of the card.
  [INSPECTOR-RUN-2026-10-10.md](../../assets/directory/INSPECTOR-RUN-2026-10-10.md)
- The custom connector called from Claude: `rise_guide` and `rise_present` with the worked
  `parts-of-a-cell`, accepted.
  [CLAUDE-RUN-2026-10-10.md](../../assets/directory/CLAUDE-RUN-2026-10-10.md)
- The claude.ai chat, iOS and Android runs: yours, from "Before you start" above. To be
  added to the Claude run record when done. Do not tick the attestation before them.

## File it

1. Go to `claude.ai/directory/manage`, signed in with the paid account that will own the
   listing.
2. Choose **MCP connector**.
3. Paste, field by field:
   - Server URL, authentication (none), and allowed link URIs from **Server**.
   - Name, one-liner, description, category, icon, documentation, privacy and support from
     **Listing**.
   - The reviewer instructions from **Test and launch instructions**.
   - The four answers from **Compliance answers**.
   - The five images with their prompts from **Screenshots**, in order.
   - At least three of the **Demo prompts** that passed.
4. Tick the attestation only once the three runs in **Attestation** are all done.
5. Submit. The automated scan runs first; the listing is Community by default. Review
   questions go to `mcp-review@anthropic.com`, MCP App questions to `mcp-apps@anthropic.com`.
6. Record the submission date and anything the portal asked that this packet did not cover
   in the register (§7) and in LIVE-004.
