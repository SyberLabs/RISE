/**
 * Precompute each work's divisions so a card can say what it holds.
 *
 *   node scripts/build-division-index.mjs
 *
 * Archive payloads stay lazy (whole books). Division counts are derived
 * once here from committed bytes so cards need not download a work to
 * report chapters. Re-run after any ingest; the archive test asserts the
 * index still agrees with the works.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
    divideSections,
    isFrontMatterLabel,
    isInformativeLabel
} from '../src/content/archive/divisions.js';

/**
 * Labels are sent to a curator so it can choose a division by what it is
 * rather than by its number. They ride WHOLE or not at all: a truncated list
 * would read as the work's complete scheme and send the model past the end.
 */
const MAX_LABELLED_DIVISIONS = 140;
const MAX_LABEL_LENGTH = 60;

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
    const { divided: isDivided, noun, reason, entries } = divideSections(mod[key]);
    const words = entries.reduce((n, e) => n + e.words, 0);
    const labels = entries.map(e => String(e.label || '').trim());
    // Ordinals are positions, so the first division that is the work itself.
    const bodyFrom = labels.findIndex(label => !isFrontMatterLabel(label)) + 1;
    const worthSending = labels.length <= MAX_LABELLED_DIVISIONS
        && labels.some(isInformativeLabel);
    index[id] = {
        divided: isDivided,
        // Titled schemes have no division noun (named places, not
        // numbered chapters) — record rather than invent.
        titled: reason === 'titled',
        // titled | scheme | inline | measured | short | …
        // `measured` means RISE cut the text; everything else is the
        // author's (or the edition's) own scheme.
        reason: reason || null,
        authored: Boolean(reason) && reason !== 'measured',
        // The work's own word for its divisions ("chapters", "books", …).
        noun: noun || null,
        count: entries.length,
        // Where the work starts, when something precedes it.
        ...(bodyFrom > 1 ? { bodyFrom } : {}),
        ...(worthSending
            ? { labels: labels.map(label => label.slice(0, MAX_LABEL_LENGTH)) }
            : {}),
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
