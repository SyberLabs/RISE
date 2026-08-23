/**
 * What a reader downloads before RISE runs at all, held to a number.
 *
 * `dist/index.html` names the whole set: the entry module, the chunks Vite
 * preloads because the entry statically imports them, and the stylesheet. A
 * chunk reached only through `import()` is not here, which is the point — the
 * budget is a ceiling on the first screen, not on the application.
 *
 * The measurement is gzip, because that is what crosses the wire. It prints the
 * breakdown whether it passes or fails, so the number is never a mystery and a
 * regression names the asset that grew.
 *
 *   npm run build && npm run check:first-load
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

// Today's first screen is 305.2 kB. The headroom is deliberate: ordinary work
// should not turn this red, and a new subsystem landing in the entry chunk
// should. Lower it when the first screen gets smaller — a budget that only ever
// rises is not a budget.
const BUDGET_KB = 320;

// gzip only — Node's zlib omits the filename header the gzip(1) CLI writes, so
// this agrees with the sizes Vite reports at the end of a build.
const transferBytes = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const kB = (bytes) => (bytes / 1000).toFixed(2);

let indexHtml;
try {
    indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
    console.error(`✗ no ${DIST}/index.html — run \`npm run build\` first`);
    process.exit(1);
}

/** Every asset the document tells the browser to fetch before anything runs. */
const firstLoad = [
    ...[...indexHtml.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)]
        .map(m => ({ role: 'entry', href: m[1] })),
    ...[...indexHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)]
        .map(m => ({ role: 'preload', href: m[1] })),
    ...[...indexHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
        .map(m => ({ role: 'style', href: m[1] }))
];

if (!firstLoad.some(asset => asset.role === 'entry')) {
    console.error('✗ dist/index.html declares no module entry — the build shape changed');
    console.error('  This check reads the document, so it must be taught the new shape.');
    process.exit(1);
}

const measured = [];
const missing = [];

for (const { role, href } of firstLoad) {
    const path = join(DIST, href.replace(/^\//, ''));
    try {
        statSync(path);
    } catch {
        missing.push(href);
        continue;
    }
    measured.push({ role, href, bytes: transferBytes(path) });
}

if (missing.length) {
    console.error('✗ the page asks for assets the build did not emit:');
    for (const href of missing) console.error(`      ${href}`);
    process.exit(1);
}

const total = measured.reduce((sum, asset) => sum + asset.bytes, 0);
const budget = BUDGET_KB * 1000;

const report = [...measured].sort((a, b) => b.bytes - a.bytes);
for (const { role, href, bytes } of report) {
    console.log(`  ${kB(bytes).padStart(8)} kB  ${role.padEnd(8)} ${href}`);
}
console.log(`  ${'—'.repeat(8)}`);
console.log(`  ${kB(total).padStart(8)} kB  first load, gzipped (budget ${BUDGET_KB} kB)`);

if (total > budget) {
    console.error(`\n✗ the first screen is ${kB(total - budget)} kB over budget`);
    console.error('  Defer what the first screen does not need behind import(),');
    console.error('  or raise BUDGET_KB in scripts/check-first-load-budget.mjs and say why.\n');
    process.exit(1);
}

console.log(`\n✓ ${kB(budget - total)} kB of headroom\n`);
