/**
 * Pre-rendered stills for the engines that are too expensive to draw while a
 * reader is choosing.
 *
 * Measured cost of one still, in the browser:
 *   rockgarden 50ms · turrell 64ms · klee 66ms · neural 70ms
 *   harmonograph 77ms · apparitio 365ms · ostensoria 697ms · fractal 1139ms
 *
 * The cheap ones are drawn live and nobody notices. The expensive ones would
 * hitch the panel on every click — and Fractal serves frames from a queue the
 * reading also draws from, so a preview could empty it and open the reading on
 * a cache miss. These are rendered ONCE, here, from the real engines, so the
 * pictures a reader chooses between are the engines' own work rather than
 * decoration. Attractor has no still branch at all and is sampled from a live
 * field the way Page Mode samples it.
 *
 *   node scripts/build-engine-stills.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'engine-stills');
const EDGE = 512;            // the slot is small; more than this is waste
const QUALITY = 0.82;

/**
 * Hand-picked specimens: the engine's own output, chosen by eye rather than
 * by whichever frame a script happened to catch. Attractor belongs here too —
 * it has no still branch, and a single frame of a field that integrates is
 * the 'photograph of a wheel mid-turn' this codebase already warns about, so
 * the frame worth showing is one a person picked.
 */
const FROM_FILE = {
    fractal: process.env.RISE_STILL_FRACTAL,
    ostensoria: process.env.RISE_STILL_OSTENSORIA,
    attractor: process.env.RISE_STILL_ATTRACTOR
};

/**
 * Trim the empty ground, then downscale.
 *
 * A plate captured full-frame is mostly ground — the attractor arrived as a
 * pale figure adrift in 1920x1080 of white — and the preview slot crops to
 * cover, so an untrimmed capture reads as a blank card at thumbnail size.
 * The bounding box is taken against the corner colour, which is the ground by
 * definition, with a small margin left so the figure is not cut to its edge.
 */
async function downscale(page, dataUrl) {
    return page.evaluate(async ({ url, edge, quality }) => {
        const img = new Image();
        await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });

        const full = document.createElement('canvas');
        full.width = img.naturalWidth;
        full.height = img.naturalHeight;
        const fctx = full.getContext('2d', { willReadFrequently: true });
        fctx.drawImage(img, 0, 0);
        const { data } = fctx.getImageData(0, 0, full.width, full.height);

        const at = (x, y) => (y * full.width + x) * 4;
        const ground = [data[0], data[1], data[2]];
        const TOLERANCE = 14;
        let minX = full.width, minY = full.height, maxX = -1, maxY = -1;
        for (let y = 0; y < full.height; y++) {
            for (let x = 0; x < full.width; x++) {
                const i = at(x, y);
                if (Math.abs(data[i] - ground[0]) > TOLERANCE
                    || Math.abs(data[i + 1] - ground[1]) > TOLERANCE
                    || Math.abs(data[i + 2] - ground[2]) > TOLERANCE) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        // Nothing found, or the figure already fills the frame: keep it whole.
        let sx = 0, sy = 0, sw = full.width, sh = full.height;
        if (maxX > minX && maxY > minY) {
            const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
            sx = Math.max(0, minX - pad);
            sy = Math.max(0, minY - pad);
            sw = Math.min(full.width - sx, (maxX - minX) + pad * 2);
            sh = Math.min(full.height - sy, (maxY - minY) + pad * 2);
        }

        const scale = Math.min(1, edge / Math.max(sw, sh));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', quality);
    }, { url: dataUrl, edge: EDGE, quality: QUALITY });
}

const toBuffer = dataUrl => Buffer.from(dataUrl.split(',')[1], 'base64');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await mkdir(OUT, { recursive: true });
const written = [];

// 1. The specimens supplied as files.
for (const [engine, file] of Object.entries(FROM_FILE)) {
    if (!file) { console.log(`${engine}: no source given, skipped`); continue; }
    const raw = await readFile(file);
    const ext = file.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
    const shrunk = await downscale(page, `data:image/${ext};base64,${raw.toString('base64')}`);
    const bytes = toBuffer(shrunk);
    await writeFile(join(OUT, `${engine}.webp`), bytes);
    written.push([engine, bytes.length, 'supplied']);
}

// 2. The ones rendered from the engines themselves. Needs the app running —
// `npm run preview`, or any origin via RISE_ORIGIN. Without one this phase is
// skipped rather than failing: the supplied specimens are still written.
const origin = process.env.RISE_ORIGIN || 'http://127.0.0.1:4317/';
let reachable = true;
try {
    await page.goto(origin, { timeout: 8000 });
    await page.waitForTimeout(1500);
} catch {
    reachable = false;
    console.log(`no app at ${origin} — skipping the rendered stills`);
}

const rendered = !reachable ? {} : await page.evaluate(async () => {
    const out = {};
    const cortex = await window.__RISE_TEST__.ensureVisualCortex();
    cortex.init();
    // Apparitio draws onto the shared plate canvas like the other plates, so
    // one call is enough. A failure leaves it out rather than shipping a
    // broken picture.
    try {
        const work = await cortex._renderContinuousProceduralWork('apparitio');
        if (work?.url) out.apparitio = work.url;
    } catch { /* omitted */ }
    return out;
});

for (const [engine, url] of Object.entries(rendered)) {
    const shrunk = await downscale(page, url);
    const bytes = toBuffer(shrunk);
    await writeFile(join(OUT, `${engine}.webp`), bytes);
    written.push([engine, bytes.length, 'rendered']);
}

await browser.close();
console.log('\nengine stills written to public/engine-stills:');
for (const [engine, size, how] of written) {
    console.log(`  ${engine.padEnd(12)} ${String(Math.round(size / 1024)).padStart(4)}KB  (${how})`);
}
