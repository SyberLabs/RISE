/**
 * Small copies of the shipped engine stills, for Home's today's poem card.
 * The full stills are up to 525 KB (fractal); Home shows one on every visit,
 * at about 200 px tall, so it gets a 480 px copy instead.
 *
 *   node scripts/build-card-stills.mjs
 *
 * Encoded by the browser, as build-engine-stills.mjs does, because the
 * system ffmpeg may have no WebP encoder. Re-run after build-engine-stills.
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIPPED_STILLS } from '../src/visuals/engine-stills.js';

const STILLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'engine-stills');
const OUT = join(STILLS, 'card');
const EDGE = 480;
const QUALITY = 0.72;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [engine, file] of SHIPPED_STILLS) {
  const source = `data:image/webp;base64,${(await readFile(join(STILLS, file))).toString('base64')}`;
  const dataUrl = await page.evaluate(async ({ source, edge, quality }) => {
    const img = new Image();
    img.src = source;
    await img.decode();
    const scale = edge / Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
  }, { source, edge: EDGE, quality: QUALITY });
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(join(OUT, file), bytes);
  console.log(`✓ engine-stills/card/${file}: ${(bytes.length / 1024).toFixed(1)} KB`);
}
await browser.close();
