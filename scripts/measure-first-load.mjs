#!/usr/bin/env node

/**
 * What a first-time visitor downloads before the Portal can paint.
 *
 * THE PROJECT HAS TUNED CHUNKING THREE TIMES WITHOUT THIS NUMBER. Three
 * rounds of `manualChunks` moved three kilobytes, because the bytes are in
 * `src/app.js`'s static import graph where no bundler configuration can
 * reach them. A chunk table tells you how the graph was cut; it does not
 * tell you what is fetched before anything is on screen. That is this.
 *
 * The first-load set is exactly what `dist/index.html` asks for by itself:
 * the entry module, every `modulepreload` the bundler decided is needed to
 * run it, and every stylesheet. Anything reached by a later `import()` is
 * not in it, which is the whole point of deferring one.
 *
 * Sizes are brotli because that is what a CDN serves and what a reader
 * actually waits for. Netlify compresses on the fly, so the bytes on disk
 * are not the bytes on the wire.
 *
 *   node scripts/measure-first-load.mjs           report, and gate the budget
 *   node scripts/measure-first-load.mjs --bundle  also account for all of dist/
 *   node scripts/measure-first-load.mjs --json    machine-readable
 */

import { brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');

/**
 * Spec §16's target is 60 KB. The budget is set at the measured value plus
 * headroom rather than at the target, so it ratchets: each delta that lands
 * lowers it, and nothing can silently climb back. A budget set at a number
 * nobody has reached yet fails on day one and gets deleted by day two.
 */
export const FIRST_LOAD_BUDGET_BYTES = 72 * 1024;

const brotli = bytes => brotliCompressSync(bytes, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
}).length;

/** Assets `index.html` requests on its own, in the order it requests them. */
export function firstLoadAssets(html) {
  const assets = [];
  const push = (kind, href) => {
    if (href && href.startsWith('/')) assets.push({ kind, href });
  };
  for (const [, href] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    push('script', href);
  }
  for (const [, rel, href] of html.matchAll(/<link[^>]+rel="(modulepreload|stylesheet)"[^>]+href="([^"]+)"/g)) {
    push(rel, href);
  }
  return assets;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Text masquerading as code. A chunk that is 95% string literal is a book
 * the bundler was asked to parse as a program; spec §16 wants this at zero.
 */
function textShareOfJavaScript() {
  const assetsDir = join(DIST, 'assets');
  let total = 0;
  let text = 0;
  for (const path of walk(assetsDir)) {
    if (!path.endsWith('.js')) continue;
    const bytes = statSync(path).size;
    total += bytes;
    const source = readFileSync(path, 'utf8');
    // A payload module is one whose bytes are overwhelmingly quoted string.
    const quoted = (source.match(/"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [])
      .reduce((sum, literal) => sum + literal.length, 0);
    if (quoted / Math.max(1, source.length) > 0.8) text += bytes;
  }
  return { total, text };
}

/**
 * The Portal is a dynamic import, so it is not in `index.html`'s request
 * set — but a reader stares at nothing until it arrives. Counting only what
 * the shell asks for would flatter every delta that moves something behind
 * an `import()`. Spec 12's target is stated as "shell + router + Portal +
 * Portal.css", so that is what has to be weighed against it.
 */
function portalAssets() {
  return readdirSync(join(DIST, 'assets'))
    .filter(name => /^Portal-[^/]+\.(js|css)$/.test(name))
    .map(name => ({ kind: 'portal', href: `/assets/${name}` }));
}

function weigh(assets) {
  return assets.map(asset => {
    const bytes = readFileSync(join(DIST, asset.href.replace(/^\//, '')));
    return { ...asset, raw: bytes.length, brotli: brotli(bytes) };
  });
}

export function measure() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const assets = weigh(firstLoadAssets(html));
  const portal = weigh(portalAssets());
  const shell = brotli(Buffer.from(html));
  const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
  return {
    assets,
    portal,
    requests: assets.length + 1,           // index.html is a request too
    raw: sum(assets, 'raw') + Buffer.byteLength(html),
    brotli: sum(assets, 'brotli') + shell,
    toPortalRequests: assets.length + portal.length + 1,
    toPortalBrotli: sum(assets, 'brotli') + sum(portal, 'brotli') + shell
  };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function main() {
  const argv = process.argv.slice(2);
  const report = measure();

  if (argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('First load — what a visitor fetches before the Portal paints\n');
    for (const asset of report.assets) {
      console.log(
        `  ${asset.kind.padEnd(14)} ${kb(asset.brotli).padStart(10)} br  `
        + `${kb(asset.raw).padStart(10)} raw   ${asset.href}`
      );
    }
    console.log(
      `\n  ${'TOTAL'.padEnd(14)} ${kb(report.brotli).padStart(10)} br  `
      + `${kb(report.raw).padStart(10)} raw   ${report.requests} requests`
    );
    console.log(`  budget         ${kb(FIRST_LOAD_BUDGET_BYTES).padStart(10)} br`);

    console.log();
    for (const asset of report.portal) {
      console.log(
        `  ${asset.kind.padEnd(14)} ${kb(asset.brotli).padStart(10)} br  `
        + `${kb(asset.raw).padStart(10)} raw   ${asset.href}`
      );
    }
    console.log(
      `  ${'TO PORTAL'.padEnd(14)} ${kb(report.toPortalBrotli).padStart(10)} br`
      + `${''.padStart(18)}${report.toPortalRequests} requests`
    );

    if (argv.includes('--bundle')) {
      const { total, text } = textShareOfJavaScript();
      const share = total === 0 ? 0 : Math.round((text / total) * 100);
      console.log(
        `\n  dist/assets JavaScript: ${kb(total)}, of which text payloads `
        + `${kb(text)} (${share}%)`
      );
    }
  }

  if (report.brotli > FIRST_LOAD_BUDGET_BYTES) {
    console.error(
      `\nFirst load is ${kb(report.brotli)} against a ${kb(FIRST_LOAD_BUDGET_BYTES)} budget.`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
