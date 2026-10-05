# Embed safety check — 2026-10-05

Record. Question: do a reader's safety settings reach RISE inside ChatGPT? Feeds LIVE-005 ("verify keyboard, phone-width and reduced-motion controls"). Checked in a local browser against the fake host in `e2e/live-mcp.spec.js`. No product host was used.

## Answer

- **The reader's RISE settings do not reach the embed.** In ChatGPT, RISE's page is a frame on `rise.syberlabs.io` inside a sandbox on another site. Chrome, Safari and Firefox give a cross-site frame its own storage, so the `rise-settings` a reader saved while reading RISE directly are not there. The embed starts from RISE's defaults: photosensitivity mode off, Reduced motion off, text size medium, face Literary.
- **The system's reduced-motion preference does reach it**, through both frames, and takes hold mid-reading. The attractor and genesis fields hold one still, and text arrives whole.
- **Nothing in a Composer presentation flashes.** That holds with or without settings, for two independent reasons. The flash economy is switched off in the build (`FLASHING_ENABLED = false`, `src/core/visual-presence.js:43`). Separately, every Current lowers to a continuous presentation (`src/core/rise-current.js:268`), which never takes the flashing path (`src/app/chamber-session-factory.js:106-129`). No photosensitivity notice is raised, because there is no flashing to warn about.

So the default is safe on flashing, and safe on motion for a reader whose system asks for reduced motion. It is not safe on motion for a reader who turned on Reduced motion only inside RISE. See *Gaps*.

## Where the settings live and who reads them

| Setting | Stored | Applied | Read by the embed's surfaces |
|---|---|---|---|
| Reduced motion | `rise-settings.reducedMotion` (`src/app.js:941-1015`) | Root class `reduced-motion`, set if the setting **or** `prefers-reduced-motion: reduce` is on, and updated when the media query changes (`src/app.js:1091-1108`) | Attractor: media query or root class (`src/visuals/attractor.js:410`). Genesis: the same (`src/visuals/klee-field.js:112`). Text arrival: the same (`src/components/read/Chamber.js:3376`). CSS transitions and animations: `src/design-system.css:992` and `:1067` |
| Photosensitivity | `rise-settings.photosensitivityMode` | Root class `photosensitivity-mode` (`src/app.js:1111`) | Genesis holds still under it (`klee-field.js:109`). The attractor does not read it. It never flashes |
| Text size, face | `rise-settings.fontSize`, `.chamberFace` | `data-font-size`, `data-chamber-face` on the root | The reading view |

`src/live/host/LiveHost.js` reads none of these itself. The embed runs inside the same app shell as the rest of RISE, so the shell loads and applies them before the host mounts, and the fields read the result. The embed also tells the reader "Reduced motion is on. Imagery stays still." (`src/live/capabilities.js:90`).

## What was checked, and how

All runs use the production build that `npm run test:e2e` serves, in Chromium 141.

| Check | How | Result |
|---|---|---|
| Reduced motion reaches the embed through both frames; attractor and genesis hold still | Existing test `under reduced motion the imagery holds still…` (`emulateMedia({ reducedMotion: 'reduce' })`, canvas pixel sampling) | pass |
| Text arrives whole under reduced motion | Added to that test: no `.atom-word[data-pending]`, and the passage fade's computed `transition-duration` ≤ 1 ms | pass. Removing the reduced-motion transition rules from `design-system.css` makes it fail |
| A frame from another site with no saved settings starts on RISE's defaults; no notice; the filament turns with no system preference; the system preference then takes hold mid-reading and stills both fields | New test `framed from another site with no saved settings…`: the host page on `localhost`, the app on `127.0.0.1`, which are two sites | pass. Making `app.js` ignore the media query makes it fail |
| Cross-site frames get their own storage in Chromium | One-off script below, not in the suite | Playwright's default launch: the frame **sees** the first-party value. Without Playwright's switch: the frame sees `null` |

### Why the storage check is a one-off

Playwright launches every Chromium with `--disable-features=…ThirdPartyStoragePartitioning…` (microsoft/playwright#32230). In the test suite a cross-site frame therefore shares first-party storage, which a reader's browser would not do. A suite test that saved settings first-party and expected the embed to miss them would fail for the wrong reason. A suite test that expected the embed to see them would pass for the wrong reason. The committed test leaves the frame's storage empty, which is the state partitioning produces. Re-enabling partitioning inside the suite would mean copying Playwright's internal feature list into a test. Instead it is checked by hand:

```js
// node partition.mjs, with DISABLE_ARG set to the --disable-features=… switch that DEBUG=pw:browser prints
import { chromium } from '@playwright/test';
import http from 'node:http';
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(req.url.startsWith('/host')
    ? '<iframe src="http://127.0.0.1:4399/child"></iframe>'
    : '<script>document.title = String(localStorage.getItem("k"))</script>');
}).listen(4399);
for (const args of [[], [process.env.DISABLE_ARG.replace(',ThirdPartyStoragePartitioning', '')]]) {
  const browser = await chromium.launch({ args }); // the later switch replaces Playwright's own
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4399/child');
  await page.evaluate(() => localStorage.setItem('k', 'first-party'));
  await page.goto('http://localhost:4399/host');
  const frame = page.frames().find(f => f.url().includes('/child'));
  await frame.waitForLoadState();
  console.log(args.length ? 'partitioned' : 'playwright default', await frame.evaluate(() => localStorage.getItem('k')));
  await browser.close();
}
server.close();
```

Output on 2026-10-05: `playwright default first-party`, then `partitioned null`.

A second harness detail: a loopback frame inside a page that Playwright fulfils itself waits on Chromium's local-network-access prompt, which never resolves headless. The cross-site test grants `local-network-access` for this reason.

## Gaps

1. **A RISE-only Reduced motion or Photosensitivity choice does not travel into ChatGPT.** A reader who relies on RISE's own setting, and not the system's, sees the attractor turn and genesis grow. Nothing flashes. Ways to close it, each an owner decision:
   - Accept the system preference as the channel, and say so where the setting is offered.
   - Add a local "still imagery" control to the embed. This changes the embed's control set, which is a held contract (`controls.js`).
   - Ask for first-party storage with the Storage Access API on a reader's press. This depends on the browser, and on ChatGPT's sandbox allowing it (`allow-storage-access-by-user-activation`). Not tried.

   Answered 2026-10-05: the second way. The embed's Settings control gains a Still imagery switch, saved in the frame's own storage, and the embed's control set is no longer a held contract ([embed stage decision](../product/discussions/2026-10-05-embed-stage-decision.md) §3).
2. **The attractor ignores photosensitivity mode**, even on RISE's own site. It holds still only under reduced motion. It does not flash, so this is about motion, not seizure risk. The fix would be in `src/visuals/attractor.js`, which belongs to the Reader lane. Reported here and not edited.

## Not verified

- Any product host. Whether ChatGPT's sandbox passes `prefers-reduced-motion` to nested frames the way Chromium does here is expected but not yet observed. The LIVE-002 host session listed reduced motion as not established.
- Safari, Firefox and mobile browsers. Their storage partitioning is documented by each browser; it was not run here.
- Keyboard and phone-width controls, the other half of the LIVE-005 criterion. Existing tests cover a short frame (`in a short frame the reader keeps status, Interrupt and Stop in view…`). This record does not add to them.
