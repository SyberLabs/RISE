/**
 * Render one Ostensoria seed in Chromium (Chamber engine) and write a PNG.
 *
 *   node scripts/check-ostensoria-seed.mjs
 *   node scripts/check-ostensoria-seed.mjs --seed CRISTO-2363
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (process.argv[index + 1] == null || process.argv[index + 1].startsWith('--')) return true;
  return process.argv[index + 1];
}

function findPlaywrightChrome() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(root)) return null;
  const names = readdirSync(root);
  const headless = names.filter(name => name.startsWith('chromium_headless_shell-')).sort().at(-1);
  const full = names.filter(name => name.startsWith('chromium-') && !name.includes('headless')).sort().at(-1);
  const candidates = [];
  if (headless) {
    candidates.push(join(root, headless, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
  }
  if (full) {
    candidates.push(join(root, full, 'chrome-win64', 'chrome.exe'));
  }
  return candidates.find(existsSync) || null;
}

async function launchChromium() {
  const sandbox = process.env.PLAYWRIGHT_BROWSERS_PATH || '';
  const home = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (sandbox.includes('cursor-sandbox-cache') && existsSync(home)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = home;
  }
  const options = { headless: true, args: ['--disable-dev-shm-usage'] };
  try {
    return await chromium.launch(options);
  } catch (error) {
    const executablePath = findPlaywrightChrome();
    if (executablePath) return chromium.launch({ ...options, executablePath });
    throw error;
  }
}

const seed = String(arg('--seed', 'CRISTO-2363'));
const outDir = resolve(arg('--out', join(ROOT, 'out', 'ostensoria-coverage')));
const outPng = join(outDir, `${seed.replace(/[^A-Za-z0-9_-]/g, '_')}.png`);

const options = {
  family: 'clifford',
  order: 4,
  mirror: true,
  quality: 2,
  palette: 'lilac',
  hue: 0,
  bands: 1.25,
  sat: 0.86,
  exposure: 2.1,
  gamma: 0.9,
  bloom: 0.6,
  chroma: 2.2,
  grain: 0.05
};

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.js'),
  server: { port: 4188, strictPort: false, open: false },
  logLevel: 'error'
});
await server.listen();
const origin = server.resolvedUrls?.local?.[0];
if (!origin) throw new Error('Vite did not bind a local URL');

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`${origin}scripts/ostensoria-seed-check.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.renderOstensoria === 'function');

console.log(`Generating ${seed} · Clifford D4·m · lilac · standard…`);
const info = await page.evaluate(({ seed, options }) => window.renderOstensoria(seed, options), {
  seed,
  options
});

mkdirSync(outDir, { recursive: true });
await page.locator('#c').screenshot({ path: outPng, type: 'png' });

const coeff = (info.cur?.coeff || []).map(n => Number(n).toFixed(2));
console.log(`family ${info.cur.family}  kind ${info.cur.kind}  D${info.cur.order}${info.cur.mirror ? '·m' : ''}`);
console.log(`palette ${info.look.palette}  bands ${info.look.bands}  sat ${info.look.sat}`);
console.log(`coeff [${coeff.join(' ')}]`);
console.log(`void ${(info.coverage.voidFraction * 100).toFixed(2)}%  ink ${(info.coverage.inkFraction * 100).toFixed(2)}%`);
console.log(`wrote ${outPng}`);

await browser.close();
await server.close();
