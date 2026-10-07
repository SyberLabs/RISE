# Embed stage witness — 2026-10-07

Exact candidate `122b1cb652b440dfde9d8dcd527ef659188c2a1c` (tip of `main`; it carries the embed stage, #423, #428, #429, #432, #435, #439, and RDR-022, #474 and #478); demo Worker `rise-chatgpt-demo` version `0ffd6a0e-5d99-4d55-b0dd-b37ee6de0c18`; endpoint `https://rise-chatgpt-demo.scarlson896.workers.dev/api/mcp`; release marker checked before the session only (see Not established). Desktop web ChatGPT in Chrome on Windows 11, developer mode; the log switched on by `MCP_WITNESS` (the relay's `resources/read` framed `/live?embed=mcp&log=host`, checked before connecting). Session held 13:21–13:53 UTC, the owner present.

Claude drove the owner's signed-in Chrome through Claude in Chrome up to the poster and the first reload. Its console tool reads only the ChatGPT page's own console, not RISE's inner frame, so the owner opened DevTools on that frame and copied the lines. Claude's click on Play then timed out (Chrome reported the tab's renderer unresponsive while DevTools was open), so the owner pressed every control from Play onward and reported what was seen and heard; the owner's words are quoted as written.

## Before connecting

| Check | Result |
|---|---|
| Release marker `/release-<sha>.txt` | The exact SHA, three times running. The first requests after the deploy returned Cloudflare error 1042 while the workers.dev route propagated; within a minute every request answered |
| `/live` | 200, `X-Frame-Options: DENY`, `frame-ancestors 'none'` |
| `/live?embed=mcp` | 200, no `X-Frame-Options`, `frame-ancestors *` |
| `tools/list` | `rise_present` alone (`MCP_GATE0` false) |
| Realtime | 503 |

The connection followed the current [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt) page, read 2026-10-07. It differs from the runbook's step 3 in three small ways: the add form also asks for a description; under Connection, a Secure MCP Tunnel is offered beside the public endpoint; and after creation the page says to review the discovered tools and metadata, and after a refresh to confirm the metadata changed. In ChatGPT itself, **Refresh** is not in the plugin page's menu (Manage, Uninstall, Download plugin ZIP, Upload new version) but under Manage → Information. The existing **RISE Demo** entry pointed at the endpoint above; Refresh reported "Tools refreshed." and the tool changed from "Present a RISE Current" to "Present a reading in RISE", so the metadata did change.

## Host lines

As copied by the owner from the inner frame, after a reload of the tab with DevTools open; the source-location prefix DevTools prints is kept.

```
{"rise-host":"initialize","containerDimensions":{"height":400,"maxWidth":640},"displayMode":"inline","availableDisplayModes":["inline","fullscreen","pip"],"safeAreaInsets":{"top":0,"bottom":0,"left":0,"right":0},"theme":"dark","platform":"mobile","deviceCapabilities":{"touch":true,"hover":false},"stylesVariables":["--color-background-primary","--color-background-secondary","--color-background-tertiary","--color-background-inverse","--color-background-ghost","--color-background-info","--color-background-danger","--color-background-success","--color-background-warning","--color-background-disabled","--color-text-primary","--color-text-secondary","--color-text-tertiary","--color-text-inverse","--color-text-ghost","--color-text-info","--color-text-danger","--color-text-success","--color-text-warning","--color-text-disabled","--color-border-primary","--color-border-secondary","--color-border-tertiary","--color-border-inverse","--color-border-ghost","--color-border-info","--color-border-danger","--color-border-success","--color-border-warning","--color-border-disabled","--color-ring-primary","--color-ring-secondary","--color-ring-inverse","--color-ring-info","--color-ring-danger","--color-ring-success","--color-ring-warning","--font-sans","--font-mono","--font-weight-normal","--font-weight-medium","--font-weight-semibold","--font-weight-bold","--font-text-xs-size","--font-text-sm-size","--font-text-md-size","--font-text-lg-size","--font-heading-xs-size","--font-heading-sm-size","--font-heading-md-size","--font-heading-lg-size","--font-heading-xl-size","--font-heading-2xl-size","--font-heading-3xl-size","--font-text-xs-line-height","--font-text-sm-line-height","--font-text-md-line-height","--font-text-lg-line-height","--font-heading-xs-line-height","--font-heading-sm-line-height","--font-heading-md-line-height","--font-heading-lg-line-height","--font-heading-xl-line-height","--font-heading-2xl-line-height","--font-heading-3xl-line-height","--border-radius-xs","--border-radius-sm","--border-radius-md","--border-radius-lg","--border-radius-xl","--border-radius-full","--border-width-regular","--shadow-hairline","--shadow-sm","--shadow-md","--shadow-lg"]}
LiveHost-Kn-aa-Tt.js:112 {"rise-host":"size-changed","height":481}
LiveHost-Kn-aa-Tt.js:112 {"rise-host":"context-changed","containerDimensions":{"height":481,"maxWidth":640}}
```

The card's frame, measured from the ChatGPT page (the iframe titled `ui://rise/current`), was 640 × 481 in a 977-wide window. The relay's `iframe#app` was not found in the Elements panel, so the measurement is of ChatGPT's frame around it.

## The five questions

| Question | Observed | What changes |
|---|---|---|
| 1. Is `containerDimensions.height` fixed at the hello? | No. The hello gave `height: 400`, `maxWidth: 640`; after RISE reported 481 the host sent `context-changed` with `height: 481` | The page does not fill a fixed height; the reported height sizes the card. The 481 floor stands as written; no `data-embed` fallback is called for at this width |
| 2. `maxHeight` against the visible card height | No `maxHeight` in either line. The card measured 481 at 977 wide | Nothing at 977 wide. Not tested at 560 wide (resize skipped), so the 560 case is open |
| 3. Is the `size-changed` height applied? | Yes. Report 481, host context 481, frame 481 (at 977 wide, not the runbook's 760) | The inline height is RISE's own report, so the report is load-bearing, not merely harmless: it stays, and a wrong report would show as a wrong card |
| 4. Would a reported width be applied? | Not run (skipped for time) | Open; width stays omitted |
| 5. `availableDisplayModes`, and an Expand affordance with `['inline']` declared | `["inline","fullscreen","pip"]`. The owner, asked whether the card showed any Expand or fullscreen control: "no" | Nothing now; a fullscreen layout remains a later, additive PR |

Also from the hello: `safeAreaInsets` all zero, so there was nothing to confirm by eye; `theme` dark. The host reported `platform: "mobile"` and `deviceCapabilities` touch true, hover false on desktop Chrome. Why is not established (DevTools device emulation was not checked); a layout that branches on `platform` or hover would take the phone path on this desktop.

## What was pressed and seen

| Step | Observed |
|---|---|
| The prompt | Sent after `@RISE Demo`, exactly as the runbook gives it. ChatGPT "Worked for 7s" and called RISE Demo once |
| Poster | The title "Why a black hole is black" and Play; nothing playing. ChatGPT's text under the card: "RISE presentation is ready. The reader controls playback." |
| Reload (before Play) | The poster again, no autoplay |
| Play | The owner: "play does actually work . voice works . controls are way cleaner ." |
| Play, Pause, Settings | Asked whether the words showed as spoken over the attractor, whether Pause held the sentence, and whether Intensity, Theme (Rose, then As written), Still imagery, Text size L and resume after closing the sheet behaved, the owner answered "1-3 work". The gap from the press to the first word was not reported |
| The end | **Defect.** Asked whether Finished and Play again appeared at the end and started from the first word, the owner: "4. no", then "no finished again" |
| Card chrome | No Expand or fullscreen control on the card (the owner: "no") |
| New chat while playing | The owner: "if while playing, you suddenly open new chat, it silences". No voice outlived the thread |
| Return after a new chat | **Defect.** The owner: "when you return, and hit the first play, audio cuts out until you pause and play again: the Begin gate becomes missing on this return and thus audio is blocked" |
| Leaving the tab and returning | **Defect.** The owner: "after leaving tab and returning, some weird cases with the voice and text falling out of sync, the voice restarting while the stream is in middle. we need to 100% tie the voice to the text thats on stream and prevent false restarting and very robustly enforce proper sequencing and synchrony" |

## Defects before LIVE-004 can pass

1. **No end state.** At the end of the reading there was no Finished and no Play again (runbook step 6, The end).
2. **Silent first Play on return.** After opening a new chat mid-reading and coming back, the first Play gives no audio until Pause and Play again; the owner reads this as the audio unlock (the Begin gesture) being lost on return.
3. **Voice and text fall out of sync after the tab is hidden and shown.** In some cases the voice restarts while the words are mid-passage. The owner's requirement: the voice is tied to the words on the stage, never restarts falsely, and keeps strict order.

None was fixed during the session. Each needs a reproduction in a test before its fix.

## Not established

- Question 4 (the width report) and the resize to 560 and 1280 wide: skipped for time; no `size-changed` lines beyond the first.
- The gap from Play to the first spoken word.
- Light mode and the card's edge against a light thread; not attempted, ChatGPT's theme was not changed.
- A phone; the OS reduced-motion setting inside the frame.
- Which runs of Play, Pause and Settings the owner made before and after the console lines were copied; the lines above are from one load of the card.
- The release marker after the session: not read before the Worker was made inert. The candidate is established by the marker read before connecting and the deploy from the exact worktree.
- Audible quality; the owner confirmed the voice played, nothing more.

This is engineer-controlled integration acceptance on a real host, recorded apart from the local evidence on CI. It is not a first-time reader study.

## Inert again

The Worker was redeployed with `workers_dev: false`, `preview_urls: false`, `MCP_ENABLED` and `MCP_GATE0` false and `MCP_WITNESS` removed. Version `a4e79a82-df65-4c56-8d43-2bc56390c860` reported **No targets deployed**; at 13:52:59 UTC a POST to the MCP URL returned 404 and a GET of the root returned 404. `wrangler.demo.jsonc` was restored with `git checkout`. The 45-minute shutdown watchdog never fired: its process command line was checked, then PID 18504 was stopped. `wrangler.production.jsonc` was not edited and nothing was deployed to production. The RISE Demo plugin entry in ChatGPT is left in place, pointing at the offline endpoint.
