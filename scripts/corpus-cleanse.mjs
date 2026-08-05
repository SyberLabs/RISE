/**
 * Remove page furniture from the shelved payloads.
 *
 *   node scripts/corpus-cleanse.mjs                 # report only
 *   node scripts/corpus-cleanse.mjs --apply         # write the payloads
 *   node scripts/corpus-cleanse.mjs --apply --work the-storm-of-steel
 *
 * WHAT IT REMOVES, AND ONLY THIS
 * ──────────────────────────────
 * Running heads with POSITIONAL PROOF, per ARCHIVE-CLEANSING-SPEC §2b: a
 * short line of capitals ending in a page number, whose stem repeats
 * across the work, standing between a clause that has not ended and a
 * word that continues it. Plus the verso numeral travelling with it,
 * because a printed opening leaves both numbers behind and removing half
 * the furniture looks exactly as broken as removing none.
 *
 * It does not touch the ambiguous remainder — the ones where the
 * sentence had ended, which are also the shape of a real chapter title.
 * Those go to a reviewer (`corpus-review-jobs.mjs`). A rule that cannot
 * tell "GUILLEMONT 101" from "BOOK 1" must not be trusted to delete.
 *
 * THE SAFETY IS IN THE TOOL, NOT IN A REVIEWER
 * ────────────────────────────────────────────
 * Every removal is verified as a STRICT DELETION before anything is
 * written: each span, with its whitespace collapsed, must match the
 * furniture pattern exactly. If a single span would take a word that is
 * not a page number or a running head, the work is skipped whole and
 * says so. Nothing is repaired, narrowed, or approximated — a span this
 * cannot prove is a span it does not take.
 *
 * The record lands in cleanse-log.json: what was removed, from where,
 * and when. A trim with no record is indistinguishable from corruption
 * a year from now (§5).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// ONE VOCABULARY. The detector lives in src/content/archive/furniture.js
// and is read by the job builder, the cleanser and the tests alike.
import { stemsOf, furnitureIn, isStrictlyFurniture } from '../src/content/archive/furniture.js';

const WORKS_DIR = resolve('src/content/archive/works');
const LOG = resolve('src/content/archive/cleanse-log.json');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const workIndex = args.indexOf('--work');
const only = workIndex >= 0 ? args[workIndex + 1] : null;

const files = readdirSync(WORKS_DIR)
    .filter(n => n.endsWith('.js') && !n.includes('.test.'))
    .filter(n => !only || n.startsWith(only));

const log = [];
let totalRemoved = 0, totalChars = 0, worksTouched = 0, worksSkipped = 0;

for (const file of files) {
    const path = resolve(WORKS_DIR, file);
    const mod = await import(pathToFileURL(path).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    if (!sections) continue;

    const workId = file.replace(/\.js$/, '');
    const stems = stemsOf(sections);

    const cleaned = [];
    const removals = [];
    let refused = null;

    for (const section of sections) {
        const before = String(section.content || '');
        // Latest first, so splicing cannot invalidate the offsets behind it.
        const spans = furnitureIn(before, stems).filter(f => f.proven).reverse();
        if (!spans.length) { cleaned.push(section); continue; }

        let after = before;
        for (const span of spans) {
            const taken = after.slice(span.start, span.end);
            // STRICT DELETION. Whatever this span covers, collapsed to one
            // line, must BE the furniture and nothing else.
            if (!isStrictlyFurniture(taken)) {
                refused = `${section.name}: span would take ` +
                    JSON.stringify(taken.replace(/\s+/g, ' ').trim().slice(0, 70));
                break;
            }
            after = after.slice(0, span.start) + span.rejoin + after.slice(span.end);
            removals.push({
                division: section.name || null,
                removed: span.text.split('\n').join(' '),
                at: span.start,
                rejoined: span.rejoin === ' ' ? 'sentence' : 'paragraph'
            });
        }
        if (refused) break;
        cleaned.push({ ...section, content: after });
    }

    if (refused) {
        worksSkipped++;
        console.log(`SKIPPED ${workId}: ${refused}`);
        continue;
    }
    if (!removals.length) continue;

    const chars = sections.reduce((n, s) => n + String(s.content || '').length, 0)
        - cleaned.reduce((n, s) => n + String(s.content || '').length, 0);

    worksTouched++;
    totalRemoved += removals.length;
    totalChars += chars;
    console.log(`${workId}: ${removals.length} running heads, ${chars} characters`);
    log.push({ workId, when: new Date().toISOString().slice(0, 10), class: 'running-head',
        basis: 'ARCHIVE-CLEANSING-SPEC §2b positional proof',
        count: removals.length, characters: chars, removals });

    if (!apply) continue;

    // Rewrite the SECTIONS array in place, leaving the header, the META
    // export and everything else exactly as the ingest wrote it.
    const src = readFileSync(path, 'utf8');
    const marker = src.match(/export const [A-Z0-9_]+_SECTIONS = \[/);
    if (!marker) { console.log(`  ! ${workId}: no SECTIONS array found; not written`); continue; }
    const start = marker.index + marker[0].length - 1;
    const end = src.indexOf('\n];', start);
    if (end < 0) { console.log(`  ! ${workId}: unterminated SECTIONS array; not written`); continue; }
    writeFileSync(path,
        src.slice(0, start) + JSON.stringify(cleaned, null, 4) + src.slice(end + 3), 'utf8');
}

console.log('');
console.log(`works cleansed  : ${worksTouched}`);
console.log(`works skipped   : ${worksSkipped}`);
console.log(`running heads   : ${totalRemoved}`);
console.log(`characters      : ${totalChars}`);

if (apply && log.length) {
    let previous = [];
    try { previous = JSON.parse(readFileSync(LOG, 'utf8')); } catch { /* first run */ }
    writeFileSync(LOG, JSON.stringify(previous.concat(log), null, 2), 'utf8');
    console.log(`recorded in ${LOG}`);
} else if (!apply) {
    console.log('\nREPORT ONLY. Nothing written. Re-run with --apply.');
}
