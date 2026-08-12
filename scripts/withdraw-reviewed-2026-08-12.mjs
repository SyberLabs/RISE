/**
 * The 2026-08-12 rulings, after the evidence was read.
 *
 *   node scripts/withdraw-reviewed-2026-08-12.mjs            # report
 *   node scripts/withdraw-reviewed-2026-08-12.mjs --apply
 *
 * Follows `withdraw-apparatus-reviewed.mjs`: every boundary is NAMED, never
 * computed, and each cut records the line that must survive it — so the trim
 * can be checked later without re-reading the work.
 *
 * Two rulings, two shapes:
 *
 *   A. `a-hundred-and-seventy-chinese-poems` — six sections are the book's
 *      table of contents, four of them wearing chapter names. Confirmed
 *      independently by the §2f line detector and the §3c runt measure, and
 *      read before cutting: each opens with a heading and continues in
 *      `title … page-number` lines. Withdrawn whole; none of it was a
 *      reading, and every poem it lists is served by the division that holds
 *      the poems themselves.
 *
 *   B. `anna-karenina` — a contents preamble fused ahead of genuine Chapter 1
 *      (§2g). The division stays; only the navigation run is cut.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rewriteSections } from '../src/content/archive/payload-writer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKS = join(HERE, '..', 'src', 'content', 'archive', 'works');
const APPLY = process.argv.includes('--apply');

const words = (text) => String(text || '').trim().split(/\s+/u).filter(Boolean).length;

/** A contents line is a title followed by run-out and a page number. */
const CONTENTS_LINE = /\S\s{2,}\d{1,4}(\s*[-–]\s*\d{1,4})?\s*$/u;

function isContentsSection(section) {
    const lines = String(section?.content || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 5) return false;
    return lines.filter(line => CONTENTS_LINE.test(line)).length / lines.length >= 0.5;
}

async function load(id) {
    const path = join(WORKS, `${id}.js`);
    const module = await import(pathToFileURL(path).href);
    return { path, sections: Object.values(module).find(value => Array.isArray(value)) };
}

/**
 * `payload-writer` replaces the SECTIONS array and leaves the rest of the file
 * alone. A hand-rolled writer here truncated each payload at its first export
 * and destroyed the `_META` beside it; the archive suite caught it within the
 * minute. The lesson is the ordinary one — the canonical statement of this act
 * already existed and should have been imported rather than rewritten.
 */
function write({ path }, sections) {
    const result = rewriteSections(path, sections);
    if (!result.ok) throw new Error(`${path}: ${result.reason}`);
}

const report = [];

// ── A. the Chinese poems' contents, served as chapters ──────────────────────
{
    const work = await load('a-hundred-and-seventy-chinese-poems');
    const kept = [];
    const cut = [];
    for (const section of work.sections) {
        (isContentsSection(section) ? cut : kept).push(section);
    }
    report.push({
        work: 'a-hundred-and-seventy-chinese-poems',
        act: cut.length ? 'withdrawn whole' : 'nothing to cut',
        sections: cut.length,
        removed: cut.reduce((sum, section) => sum + words(section.content), 0),
        detail: cut.map(section => `${section.name} · ${words(section.content)}w`),
        // Checked after the first run: the poems carry their titles in caps in
        // the body, so removing the contents removes a listing and not a name.
        survives: 'CHAPTER II · SATIRE ON PAYING CALLS IN AUGUST, as a poem'
    });
    if (APPLY && cut.length) write(work, kept);
}

// ── B. Karenina's contents preamble, fused ahead of Chapter 1 ───────────────
{
    const work = await load('anna-karenina');
    const body = String(work.sections[0]?.content || '');

    // THE TITLE BLOCK STAYS. §2g proposed cutting to the last `PART ONE`
    // before `Chapter 1`, which also takes "ANNA KARENINA / by Leo Tolstoy" —
    // and that is the only place this work names itself in its opening pages,
    // so `identity.test.js` failed the moment it went. Cutting from `Contents`
    // instead removes the navigation run, which is the actual defect, and
    // leaves the work able to answer for itself. The alternative was a
    // nineteenth entry on an exemption list already too long.
    const chapterOne = body.search(/\bChapter\s+1\b/u);
    const partOne = chapterOne > 0 ? body.lastIndexOf('PART ONE', chapterOne) : -1;
    const contents = partOne > 0 ? body.lastIndexOf('Contents', partOne) : -1;
    const preamble = contents >= 0 && partOne > contents ? body.slice(contents, partOne) : '';
    const evidenced = Boolean(preamble) && /PART EIGHT/u.test(preamble);

    report.push({
        work: 'anna-karenina',
        act: evidenced ? 'navigation run cut' : 'REFUSED — evidence absent',
        sections: evidenced ? 1 : 0,
        removed: evidenced ? words(preamble) : 0,
        detail: evidenced
            ? [JSON.stringify(preamble.replace(/\s+/gu, ' ').slice(0, 90))]
            : ['no Contents … PART EIGHT run ahead of Chapter 1'],
        survives: 'ANNA KARENINA / by Leo Tolstoy … PART ONE / Chapter 1'
    });

    if (APPLY && evidenced) {
        write(work, work.sections.map((section, index) => (index === 0
            ? { ...section, content: body.slice(0, contents) + body.slice(partOne) }
            : section)));
    }
}

for (const entry of report) {
    console.log(`\n${entry.work} — ${entry.act}`);
    console.log(`  ${entry.sections} section(s), ${entry.removed}w removed`);
    entry.detail.forEach(line => console.log(`    − ${line}`));
    console.log(`  must survive: ${entry.survives}`);
}
console.log(APPLY ? '\napplied.' : '\nREPORT ONLY. Nothing was written. Re-run with --apply.');
