// A one-off sample recorder (delete before merging): plays one dry-run digest in a local RISE build through
// Chromium, records the window, and writes when each spoken passage showed, for narrate.py.
//   node .github/changes-sample/record.mjs <digest.json> <repo> <outDir>
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const [file, repo, outDir] = process.argv.slice(2);
const digest = JSON.parse(readFileSync(file, 'utf8'));
const index = {
  schema: 'syberlabs.changes-index/v1',
  digests: [{ id: digest.id, audience: digest.audience, title: digest.title, period: digest.period, count: digest.changes.filter(c => c.included).length }]
};
mkdirSync(outDir, { recursive: true });
const size = { width: 1280, height: 720 };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: size, recordVideo: { dir: outDir, size } });
await context.addInitScript(r => { globalThis.__RISE_SAMPLE_REPO = r; }, repo);
// The staff sign-in link is not part of the reading, so it stays out of the frame.
await context.addInitScript(() => {
  const hide = () => document.head.append(Object.assign(document.createElement('style'), { textContent: '.rise-account-control{display:none!important}' }));
  if (document.head) hide(); else document.addEventListener('DOMContentLoaded', hide);
});
await context.route('**/content/changes/index.json', r => r.fulfill({ json: index }));
await context.route(`**/content/changes/${digest.id}.json`, r => r.fulfill({ json: digest }));
const page = await context.newPage();
const videoStart = Date.now();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:4318/changes/${digest.id}?voice=paced&measure=1`);
await page.locator('[data-changes-play]').click({ timeout: 30_000 });
const marks = { open: Date.now() - videoStart };
const room = page.locator('.live-venue--sealed');
await room.getByRole('button', { name: 'Play' }).click({ timeout: 30_000 });
const warn = page.locator('#photosensitivity-modal');
await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
if (await warn.isVisible()) await warn.locator('#safety-accept').click();
marks.play = Date.now() - videoStart;
if (await page.getByText('Staff sign in', { exact: true }).locator('visible=true').count()) throw new Error('the staff sign-in link is in frame');
const origin = await page.evaluate(() => performance.timeOrigin);

let passages = [];
const deadline = Date.now() + 8 * 60_000;
for (;;) {
  await page.waitForTimeout(2000);
  const live = await page.evaluate(() => window.__riseLive && { passages: window.__riseLive.passages(), atoms: window.__riseLive.atoms() });
  if (!live) continue;
  passages = live.passages;
  const shown = new Set(live.atoms.map(a => a.sourceId));
  const last = live.atoms.at(-1);
  const spoken = passages.filter(p => p.spoken);
  if (spoken.length && spoken.every(p => shown.has(p.segmentId)) && Date.now() - (origin + last.at) > 4000) break;
  if (Date.now() > deadline) { console.log('stopped at the time limit'); break; }
}
const atoms = await page.evaluate(() => window.__riseLive.atoms());
await page.screenshot({ path: `${outDir}/last.png` });
const video = page.video();
await context.close();
await browser.close();
renameSync(await video.path(), `${outDir}/silent.webm`);

const toVideo = at => origin + at - videoStart;
const timed = passages.map(p => {
  const own = atoms.filter(a => a.sourceId === p.segmentId);
  return { ...p, startMs: own.length ? Math.round(toVideo(own[0].at)) : null, endMs: own.length ? Math.round(toVideo(own.at(-1).at) + (own.at(-1).holdMs ?? 0)) : null };
});
const endMs = Math.round(Date.now() - videoStart);
writeFileSync(`${outDir}/timing.json`, JSON.stringify({ marks, endMs, passages: timed }, null, 2));
console.log(JSON.stringify({ marks, passages: timed.length, spoken: timed.filter(p => p.spoken).length }));
