# The embed witness: one ChatGPT session on the candidate

For Mateo, by hand. PR 6 of the [embed stage decision](../product/discussions/2026-10-05-embed-stage-decision.md) §9; the checks are its §10. It settles the real-host half of [LIVE-004](../product/tasks/LIVE-004.json) and answers the five host questions that were never recorded. One session, desktop web, DevTools open on RISE's frame. It is what [LIVE-002](../experiments/LIVE-002-HOST-2026-10-05.md) did, on the stage instead of the bar.

## 1. The candidate

The exact candidate is the tip of `main` once PR 6 is merged. Read it, and check that the stage is in it:

```sh
git fetch origin && git rev-parse origin/main
git log --oneline origin/main | grep -E '#(423|428|429|432|435|439)\)'   # six lines
```

Check that SHA out in its own worktree (never the main folder), `npm ci`, and keep the SHA for the record.

## 2. Deploy the demo Worker from it

As LIVE-002 did ([CHATGPT-DEMO.md](CHATGPT-DEMO.md), setup). In `wrangler.demo.jsonc`, for the session only: `"workers_dev": true`, `"MCP_ENABLED": "true"`, `"MCP_GATE0": "false"` (LIVE-002 advertised `rise_present` alone). Then, from the worktree:

```sh
npm run build
node --input-type=module -e 'import {execFileSync} from "node:child_process"; import {writeFileSync} from "node:fs"; const sha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(); writeFileSync(`dist/release-${sha}.txt`,`${sha}\n`);'
npx wrangler deploy --config wrangler.demo.jsonc
```

Write down the HTTPS origin and the version id Wrangler prints. The MCP URL is that origin plus `/api/mcp`. Before connecting: `curl -s https://<origin>/release-<sha>.txt` prints the SHA; `curl -sI https://<origin>/live` carries `X-Frame-Options: DENY` and `curl -sI "https://<origin>/live?embed=mcp"` does not. Do not commit the config change; step 9 restores it.

## 3. Connect in ChatGPT developer mode

From the official page [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt), read 2026-10-05 ("Account and workspace policies apply to adding and using custom MCP servers"):

1. Open ChatGPT Plugins at `https://chatgpt.com/plugins`. If **RISE Demo** from LIVE-002 is still there, open it and select **Refresh** ("Start a new conversation and rerun the affected tests"); skip to 5.
2. Select the plus button, then **Add custom MCP server**.
3. Name it RISE Demo; under **Connection**, enter the MCP server URL `https://<origin>/api/mcp` (RISE's path, not `/mcp`); no authentication.
4. Review the risk warning, select **I understand and want to continue**, then **Create as a plugin**.
5. Start a new conversation. The page says: type `@` in the prompt box and select the plugin.

Developer mode unavailable or a signed-out browser is an access blocker, not a RISE failure. Record it as such.

## 4. The one conversation

Type, after `@RISE Demo`:

> Use RISE to explain why a black hole is black in three passages, about 80 plain words each. Use the attractor visual in every passage. This is a controlled embed witness: call rise_present once and leave playback to the reader.

The card is the poster: the title and Play, nothing playing.

## 5. Put the switch in, and open the console

The widget is ChatGPT's sandboxed frame holding RISE's relay, which frames `/live?embed=mcp` on the demo origin at a fixed path (`src/live/hosts/mcp-relay.js`, `EMBED_PATH`). The log switch is a query on that inner page, so it goes in by hand:

1. Open DevTools (F12) on the ChatGPT tab. Console, then the context picker at the top left of the console (it says `top`).
2. Pick the relay frame: the one whose document holds `iframe#app`. Run `document.getElementById('app').src += '&log=host'`. The inner page reloads and says hello again through the relay.
3. Pick the inner frame: the context whose URL is `<origin>/live?embed=mcp&log=host`. Type `rise-host` in the console filter. The first line, `"rise-host":"initialize"`, is the hello's context.

If the poster does not come back after step 2 (ChatGPT did not answer the second hello or did not redeliver the answer), the one fallback is a witness-only change you make by hand on the worktree and do not commit: `EMBED_PATH` in `mcp-relay.js` becomes `/live?embed=mcp&log=host`, rebuild, redeploy (step 2), Refresh the plugin, new conversation. Say in the record which path was taken.

## 6. What to press and watch

| Step | Watch |
|---|---|
| Poster | Title and Play; nothing playing; the visible card height with the DevTools ruler (select the relay's `iframe#app` in Elements; Computed → height) |
| Play | Narration; the words shown as spoken; the attractor; the gap from the press to the first word, by ear and the clock |
| Pause | The held sentence stays; nothing moves |
| Settings | Open the sheet. Intensity: the field dims or brightens live. Theme: pick Rose, the frame and the field recolour, As written gives them back. Still imagery: on, the field holds; off, it turns. Text size: L, the words grow. Close, then Play: the same reading resumes |
| The end | Finished, and Play again. Press it: the reading starts from the first word |
| Resize | Drag the window to about 560 wide, then wide (1280). Each `"size-changed"` line; whether the card's height follows it (step 7, question 3) |
| Reload | Reload the tab: the poster again, no autoplay. Open a new chat: no voice continues |
| Light mode | ChatGPT Settings → light. A screenshot of the card's edge against the thread |
| A phone, if possible | Developer-mode plugins are web-only in the record; if the plugin is reachable in the ChatGPT phone app, repeat Poster, Play, Pause there and keep its `initialize` line (`platform`, `safeAreaInsets`) |

## 7. Reading the lines

Three kinds, one JSON object each, nothing else is instrumented. A field the host did not send is absent. `stylesVariables` is the keys of `styles.variables`, never the values.

```
{"rise-host":"initialize","containerDimensions":{…},"displayMode":"inline","availableDisplayModes":[…],"safeAreaInsets":{…},"theme":"dark","stylesVariables":["--font-sans",…],"platform":"web","deviceCapabilities":{…}}
{"rise-host":"context-changed","containerDimensions":{"maxHeight":520}}
{"rise-host":"size-changed","height":481}
```

Copy them out verbatim (select in the console, copy) into the record; they are the evidence. The five questions from the decision's §10, and what each answer changes:

| Question | How | If … | then … |
|---|---|---|---|
| 1. Is `containerDimensions.height` fixed at the hello? | the `initialize` line | fixed | the page fills it; the 481 floor matters only under 481, and then the Reader lane scopes the landscape block out by `data-embed`, first |
| 2. `containerDimensions.maxHeight` against the visible card height after the first report | the line and the ruler | `maxHeight` < 481 at 560 wide | the same fallback: the floor is replaced by the `data-embed` exclusion |
| 3. Is the `size-changed` height applied? | at 760 wide the line says 502; measure `iframe#app` | not applied | the inline height is the host's; the report stays, harmless, and the layout is checked at whatever height the host gives |
| 4. Would a reported width be applied? | once, from the inner frame's console: `parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{width:innerWidth-100}},'*')`, then reload the tab to undo | applied | the stale-width reading of the LIVE-002 clipping is confirmed; width stays omitted |
| 5. `availableDisplayModes`, and does an Expand affordance still show on the card with `['inline']` declared? | the line and the card's own chrome | the host still offers Expand | nothing changes now; a fullscreen layout is a later, additive PR |

Also from §10: a non-zero `safeAreaInsets.bottom` means `--safe-bottom` is already applied, confirm it by eye; in the inner frame with the OS reduced-motion setting on, `matchMedia('(prefers-reduced-motion: reduce)').matches` false means the Still switch is the only channel, said in the LIVE-005 record; a dark card cut against a light thread means `prefersBorder: true` is considered (owner) and nothing else; the poster not returning on reload, or a voice outliving the closed thread, is a defect fixed before LIVE-004.

## 8. The record

Write `docs/experiments/EMBED-STAGE-HOST-<date>.md` in the shape of the LIVE-002 record, no account, conversation or credential details:

```markdown
# Embed stage witness — <date>

Exact candidate `<sha>`; demo Worker `rise-chatgpt-demo` version `<id>`; endpoint `https://<origin>/api/mcp`; release marker checked before and after. Desktop web ChatGPT in <browser>, developer mode; the switch put in by <step 5.2 | the EMBED_PATH fallback>.

## Host lines
(every rise-host line, verbatim, in order)

## The five questions
| Question | Observed | What changes |

## What was pressed and seen
| Step | Observed |

## Not established
(a phone, audible quality, anything skipped and why)

## Inert again
Version `<id>` reported No targets deployed; POST to the MCP URL returned 404.
```

Add its row to `docs/README.md` beside the LIVE-002 record, then the evidence row to LIVE-004 (`kind: "observation"`): read `revision` in `docs/product/tasks/LIVE-004.json`, write a patch file, run `node scripts/roadmap.mjs update LIVE-004 --patch <file> --expect-revision <N> --summary "<text>"`, then `node scripts/roadmap.mjs validate`.

## 9. Make the Worker inert

As LIVE-002 did. In `wrangler.demo.jsonc`: `"workers_dev": false`, `"preview_urls": false`, `"MCP_ENABLED": "false"`, `"MCP_GATE0": "false"`; then `npx wrangler deploy --config wrangler.demo.jsonc`, which reports **No targets deployed**. Check `curl -s -o /dev/null -w '%{http_code}' -X POST https://<origin>/api/mcp` is 404 (a 405 during edge propagation is not done yet; wait and retry). Then `git checkout wrangler.demo.jsonc`. The plugin entry in ChatGPT now points at an offline endpoint; remove it or leave it. Production is untouched throughout.
