/**
 * Precompute each work's divisions, so a card can say what it holds.
 *
 *   node scripts/build-division-index.mjs
 *
 * WHY THIS EXISTS
 * ───────────────
 * Archive payloads are lazy on purpose: these are whole books, and a
 * reader browsing the shelf must not download Vitruvius to see his
 * name. But that laziness meant a card could not know how many chapters
 * it was offering, so every one of them read "0 verses" — a count that
 * was wrong, in a noun that was wrong, for 79 works at once.
 *
 * Divisions are derived deterministically from bytes that are already
 * committed, so they can be derived ONCE here instead of in every
 * reader's browser. The output is a few kilobytes and the payloads stay
 * exactly as lazy as before.
 *
 * Re-run after any ingest. The archive test asserts the index still
 * agrees with the works it describes, so a stale index fails loudly
 * rather than quietly mis-stating a shelf.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { divideSections } from '../src/content/archive/divisions.js';

const WORKS_DIR = resolve('src/content/archive/works');
const OUT = resolve('src/content/archive/division-index.json');

const index = {};
let divided = 0;

for (const file of readdirSync(WORKS_DIR).filter(f => f.endsWith('.js')).sort()) {
    const id = file.replace(/\.js$/, '');
    const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
    const key = Object.keys(mod).find(k => k.endsWith('_SECTIONS'));
    if (!key) {
        console.warn(`  ! ${id}: no SECTIONS export`);
        continue;
    }
    const { divided: isDivided, noun, entries } = divideSections(mod[key]);
    const words = entries.reduce((n, e) => n + e.words, 0);
    index[id] = {
        divided: isDivided,
        // The work's own word for its divisions, so a card can say
        // "365 chapters" and "24 books" rather than flattening both.
        noun: noun || null,
        count: entries.length,
        words
    };
    if (isDivided) divided++;
    console.log(
        `  ${String(entries.length).padStart(4)} ${(noun || '—').padEnd(8)} ` +
        `${String(words).padStart(9)}w  ${id}`);
}

writeFileSync(OUT, `${JSON.stringify(index, null, 2)}\n`);
const total = Object.values(index).reduce((n, v) => n + v.words, 0);
console.log(`\n${Object.keys(index).length} works, ${divided} divided, ` +
    `${total.toLocaleString()} words → ${OUT}`);
