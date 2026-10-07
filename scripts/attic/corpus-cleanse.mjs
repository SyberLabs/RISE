/**
 * Remove page furniture from the shelved payloads.
 *
 *   node scripts/corpus-cleanse.mjs                 # report only
 *   node scripts/corpus-cleanse.mjs --apply         # write the payloads
 *   node scripts/corpus-cleanse.mjs --apply --work the-storm-of-steel
 *
 * Removes only running heads with positional proof
 * (`ARCHIVE-CLEANSING-SPEC` §2b): a short line of capitals ending in a
 * page number, whose stem repeats across the work, standing between a
 * clause that has not ended and a word that continues it — plus the
 * verso numeral travelling with it.
 *
 * Does not touch the ambiguous remainder (ended sentences that may be
 * real chapter titles); those go to a reviewer via
 * `corpus-review-jobs.mjs`.
 *
 * Safety is in the tool: every removal is verified as a strict deletion
 * before write — collapsed whitespace must match the furniture pattern
 * exactly. One bad span skips the work whole. Nothing is repaired,
 * narrowed, or approximated. Removals are recorded in cleanse-log.json
 * (§5); a trim with no record is indistinguishable from corruption later.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Detector shared with the job builder and tests.
import { stemsOf, furnitureIn, isStrictlyFurniture, isProven,
         illustrationStubsIn, isIllustrationStub,
         orphanCaptionsIn, isOrphanCaption } from '../src/content/archive/furniture.js';

/**
 * Works whose orphaned `]` lines have been read and found to be plate
 * captions. By name — the class is not one class (see furniture.js).
 * Add a work only after its lines have been inspected.
 */
const ORPHAN_CAPTION_WORKS = new Set(['vitruvius-architecture']);
// Shared payload writer (see payload-writer.js).
import { rewriteSections } from '../src/content/archive/payload-writer.js';

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
        // Two classes, one pass. Latest first, so splicing cannot
        // invalidate the offsets behind it.
        const spans = [
            ...furnitureIn(before, stems).filter(isProven).map(f => ({ ...f, kind: 'running-head' })),
            ...illustrationStubsIn(before).map(f => ({ ...f, kind: 'illustration-stub' })),
            ...(ORPHAN_CAPTION_WORKS.has(workId)
                ? orphanCaptionsIn(before).map(f => ({ ...f, kind: 'orphan-caption' }))
                : [])
        ].sort((a, b) => b.start - a.start);
        if (!spans.length) { cleaned.push(section); continue; }

        let after = before;
        for (const span of spans) {
            const taken = after.slice(span.start, span.end);
            // Strict deletion: collapsed span must be furniture and nothing else.
            const proves = span.kind === 'illustration-stub' ? isIllustrationStub
                : span.kind === 'orphan-caption' ? isOrphanCaption
                : isStrictlyFurniture;
            if (!proves(taken)) {
                refused = `${section.name}: span would take ` +
                    JSON.stringify(taken.replace(/\s+/g, ' ').trim().slice(0, 70));
                break;
            }
            after = after.slice(0, span.start) + span.rejoin + after.slice(span.end);
            removals.push({
                kind: span.kind,
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
    const heads = removals.filter(r => r.kind === 'running-head').length;
    const stubs = removals.filter(r => r.kind === 'illustration-stub').length;
    const caps = removals.filter(r => r.kind === 'orphan-caption').length;
    console.log(`${workId}: ${heads} running heads, ${stubs} stubs, ${caps} orphan captions, ${chars} characters`);
    log.push({ workId, when: new Date().toISOString().slice(0, 10),
        class: [heads && 'running-head', stubs && 'illustration-stub'].filter(Boolean).join('+'),
        basis: 'ARCHIVE-CLEANSING-SPEC §2b positional proof; §2c illustration stub',
        count: removals.length, characters: chars, removals });

    if (!apply) continue;

    const written = rewriteSections(path, cleaned);
    if (!written.ok) console.log(`  ! ${workId}: ${written.reason}; not written`);
}

console.log('');
console.log(`works cleansed  : ${worksTouched}`);
console.log(`works skipped   : ${worksSkipped}`);
console.log(`removals        : ${totalRemoved}`);
console.log(`characters      : ${totalChars}`);

if (apply && log.length) {
    let previous = [];
    try { previous = JSON.parse(readFileSync(LOG, 'utf8')); } catch { /* first run */ }
    writeFileSync(LOG, JSON.stringify(previous.concat(log), null, 2), 'utf8');
    console.log(`recorded in ${LOG}`);
} else if (!apply) {
    console.log('\nREPORT ONLY. Nothing written. Re-run with --apply.');
}
