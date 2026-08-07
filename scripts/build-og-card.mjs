/**
 * The card a shared link shows.
 *
 * A link to RISE carried no image at all: LinkedIn, Slack, iMessage and
 * Discord all fell back to a bare title-and-description row. This draws a
 * 1200×630 card in the product's own tokens — #0A0A0C, Marcellus set
 * open at the same 0.32em tracking the Portal uses — so the preview is
 * the product rather than a cropped app icon.
 *
 * GENERATED, NOT DRAWN BY HAND, so the wordmark cannot drift from the
 * page the way the phone's tracking did: the values below are the same
 * ones design-system.css declares, and rerunning this is how the card
 * follows a change instead of being remembered.
 *
 *   node scripts/build-og-card.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'public/og-cover.png';
const WIDTH = 1200;
const HEIGHT = 630;

// From src/design-system.css. Named here rather than imported because a
// build script that parses CSS to draw a picture is a worse dependency
// than two copies of three hex codes, and ci-hygiene has no opinion on
// an image's colours.
const VOID = '#0A0A0C';
const LIGHT = '#E8E8EC';
const FOG = '#9B9BA5';

const card = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Crimson+Pro:ital@1&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background: ${VOID};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  /* The sigil's ring, echoed — the Portal's own geometry, held back so
     it reads as ground rather than as a logo. */
  .ring {
    position: absolute; top: 50%; left: 50%;
    width: 460px; height: 460px; margin: -230px 0 0 -230px;
    border: 1px solid rgba(232, 232, 236, 0.07);
    border-radius: 50%;
  }
  .ring.inner {
    width: 360px; height: 360px; margin: -180px 0 0 -180px;
    border-color: rgba(232, 232, 236, 0.04);
  }
  .glow {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 45%, rgba(139, 127, 212, 0.10), transparent 62%);
  }
  .wordmark {
    font-family: 'Marcellus', serif;
    font-size: 132px; font-weight: 400;
    color: ${LIGHT};
    text-transform: uppercase;
    /* THE SAME SETTING THE PORTAL USES. Written as letter-spacing, not
       as four characters with spaces between them. */
    letter-spacing: 0.32em; text-indent: 0.32em;
    position: relative; line-height: 1;
  }
  .subtitle {
    font-family: 'Crimson Pro', Georgia, serif;
    font-style: italic; font-size: 30px;
    color: ${FOG};
    letter-spacing: 0.06em;
    margin-top: 30px; position: relative;
  }
  .rule {
    width: 84px; height: 1px; margin-top: 40px;
    background: rgba(232, 232, 236, 0.18);
    position: relative;
  }
  .byline {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 19px; color: rgba(155, 155, 165, 0.62);
    letter-spacing: 0.18em; text-transform: uppercase;
    margin-top: 26px; position: relative;
  }
</style></head>
<body>
  <div class="glow"></div>
  <div class="ring"></div>
  <div class="ring inner"></div>
  <div class="wordmark">RISE</div>
  <div class="subtitle">Audiovisual Reader</div>
  <div class="rule"></div>
  <div class="byline">SyberLabs</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1
});
await page.setContent(card, { waitUntil: 'networkidle' });
// A screenshot taken before the webfont arrives ships the fallback, and
// nothing about the file would say so.
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ type: 'png' });
await browser.close();

writeFileSync(OUT, shot);
console.log(`✓ ${OUT} — ${WIDTH}×${HEIGHT}, ${(shot.length / 1024).toFixed(0)} KiB`);
