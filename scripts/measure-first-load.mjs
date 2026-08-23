#!/usr/bin/env node
/**
 * WHAT A READER DOWNLOADS BEFORE THEY HAVE CHOSEN ANYTHING.
 *
 * `dist/assets` totals tell you what was built. They do not tell you what a
 * first-time visitor pays to see the Portal, and those two numbers have been
 * far apart here. The bundler reports 18.7 MB; the visitor pays for whatever
 * `index.html` names — the entry chunk, every `modulepreload`, and the
 * stylesheet — and nothing else until they navigate.
 *
 * So this reads the built `index.html` and adds up exactly that set, at the
 * compression Netlify serves. Anything the shell does not name is not counted,
 * because a reader does not fetch it.
 *
 * Usage:
 *   node scripts/measure-first-load.mjs [dist-dir] [--json] [--budget <KB>]
 *
 * `--budget` exits nonzero when the brotli total exceeds the given kilobytes,
 * so a regression can fail a build rather than be noticed a release later.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const budgetIndex = args.indexOf('--budget');
const budgetKb = budgetIndex === -1 ? null : Number(args[budgetIndex + 1]);
const distDir = args.find(arg => !arg.startsWith('--') && arg !== args[budgetIndex + 1]) || 'dist';

const shell = join(distDir, 'index.html');
if (!existsSync(shell)) {
    console.error(`No ${shell}. Run \`npm run build\` first.`);
    process.exit(2);
}

const html = readFileSync(shell, 'utf8');

// The shell names its own critical set: the entry script, every modulepreload
// the bundler decided the entry needs, and the stylesheet. A reference that
// resolves to nothing on disk is a broken deploy, not a free byte, so it is
// reported rather than skipped.
const referenced = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]))];

const missing = [];
const files = [];
for (const ref of referenced.sort()) {
    const path = join(distDir, ref.replace(/^\//, ''));
    if (!existsSync(path)) { missing.push(ref); continue; }
    const bytes = readFileSync(path);
    files.push({
        name: basename(ref),
        raw: bytes.length,
        gzip: gzipSync(bytes, { level: 9 }).length,
        brotli: brotliCompressSync(bytes, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
        }).length
    });
}

const sum = key => files.reduce((total, file) => total + file[key], 0);
const total = { raw: sum('raw'), gzip: sum('gzip'), brotli: sum('brotli'), requests: files.length };

if (asJson) {
    console.log(JSON.stringify({ schema: 'rise.first-load.v1', distDir, total, files, missing }, null, 2));
} else {
    const kb = n => `${(n / 1024).toFixed(0)} KB`;
    console.log(`first load — what ${shell} names, before any navigation\n`);
    for (const file of [...files].sort((a, b) => b.brotli - a.brotli)) {
        console.log(`  ${file.name.padEnd(42)} raw ${kb(file.raw).padStart(8)}   gzip ${kb(file.gzip).padStart(7)}   brotli ${kb(file.brotli).padStart(7)}`);
    }
    console.log(`\n  ${'TOTAL'.padEnd(42)} raw ${kb(total.raw).padStart(8)}   gzip ${kb(total.gzip).padStart(7)}   brotli ${kb(total.brotli).padStart(7)}`);
    console.log(`  ${total.requests} requests`);
    for (const ref of missing) console.log(`\n  MISSING: ${ref} is named by the shell and is not on disk`);
}

if (missing.length) process.exit(1);

if (budgetKb !== null) {
    const brotliKb = total.brotli / 1024;
    if (brotliKb > budgetKb) {
        console.error(`\nfirst load is ${brotliKb.toFixed(0)} KB brotli, over the ${budgetKb} KB budget`);
        process.exit(1);
    }
}
