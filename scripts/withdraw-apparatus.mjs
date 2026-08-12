/**
 * Apparatus in the reading stream — detect, report, and only then trim.
 *
 *   node scripts/withdraw-apparatus.mjs              # report
 *   node scripts/withdraw-apparatus.mjs --apply
 *
 * ARCHIVE-CLEANSING-SPEC, Phase 10. Two defects, opposite acts:
 *
 *   A. The division is apparatus — index, glossary, contents page.
 *      Withdrawn whole; none of it was a reading.
 *
 *   B. An imprint sits at the head of a genuine division. Only the
 *      preamble is trimmed; withdrawing would delete the book.
 *
 * Counts are kept apart everywhere below. Evidence is checked before the
 * cut: class A needs a name that announces apparatus or a body mostly
 * index-shaped; class B needs an imprint and a body that is overwhelmingly
 * not one. Anything that fails its test is reported and left alone.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rewriteSections } from '../src/content/archive/payload-writer.js';

const DIR = fileURLToPath(new URL('../src/content/archive/works/', import.meta.url));
const APPLY = process.argv.includes('--apply');

/** A division whose name announces it is apparatus. */
const APPARATUS_NAME = /^(index|contents?|table of contents|errata|colophon|bibliograph|glossar|appendix|footnotes?|list of (illustrations|plates)|advertisement|transcriber)/i;

/** Index-entry shape: short line ending in a page number. */
const INDEX_LINE = /^.{4,60},\s*\d{1,4}\.?\s*$/;

/**
 * A printer's imprint — set phrases only.
 *
 * Publisher names appear in citations as well as on title pages; only a
 * set phrase is evidence of an imprint.
 */
const IMPRINT = /\b(printed (by|for)\b|published by\b|all rights reserved\b|for private subscribers)/i;

const words = (s) => s.split(/\s+/u).filter(Boolean).length;

/**
 * An imprint in imprint position, not merely the words somewhere.
 *
 * What distinguishes a colophon is typesetting: short and alone, while
 * prose wraps to the measure. The line carrying the phrase must be a
 * colophon line.
 *
 * Threshold is measured (widest colophon vs narrowest prose line seen):
 *   ~55 chars — colophon
 *   ~69 chars — prose
 * Anything between 56 and 68 deserves an eye rather than a verdict.
 */
const COLOPHON_LINE = 60;

function imprintAt(text, limit = Infinity) {
    // Every match within the limit, not just the first — a later prose
    // hit must not mask a real colophon above it.
    const scan = new RegExp(IMPRINT.source, 'gi');
    for (const match of text.matchAll(scan)) {
        if (match.index > limit) break;
        const start = text.lastIndexOf('\n', match.index) + 1;
        const end = text.indexOf('\n', match.index);
        const line = text.slice(start, end < 0 ? text.length : end).trim();
        if (line.length <= COLOPHON_LINE) return { index: match.index, line };
    }
    return null;
}

/** Above this a division carrying an imprint is a reading, not a title page. */
const TITLE_PAGE_WORDS = 250;

/**
 * Class A — is this division apparatus entire?
 *
 * A name alone is not enough for a long division: "Appendix" can head a
 * real essay. Trust the name only while the division is small; a large
 * one must prove itself by shape.
 */
function isApparatus(name, text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const indexish = lines.filter(l => INDEX_LINE.test(l)).length;
    const shaped = lines.length > 6 && indexish / lines.length > 0.5;
    if (shaped) return { yes: true, why: `${indexish}/${lines.length} index-shaped lines` };
    if (APPARATUS_NAME.test(name.trim()) && words(text) <= 4000) {
        return { yes: true, why: `name "${name.trim()}", ${words(text)}w` };
    }
    // Small division that is entirely a title page (imprint + short body,
    // name announces nothing). Furniture entire, not a reading with
    // furniture on top.
    const colophon = imprintAt(text);
    if (colophon && words(text) <= TITLE_PAGE_WORDS) {
        return { yes: true, why: `title page entire, ${words(text)}w ("${colophon.line}")` };
    }
    return { yes: false };
}


/**
 * Class B — an imprint at the head of a real reading.
 *
 * The cut lands at the first blank line after the imprint, which is the
 * boundary the text itself supplies. If the imprint is not inside the
 * first few paragraphs, this is not a title page and nothing is trimmed.
 */
const PREAMBLE_LIMIT = 900;

function imprintPreamble(text) {
    // Same colophon-position test as class A — the two paths must agree
    // on what an imprint is.
    const match = imprintAt(text, PREAMBLE_LIMIT);
    if (!match) return null;
    // End of the paragraph the imprint sits in.
    const blank = text.indexOf('\n\n', match.index);
    if (blank < 0 || blank > PREAMBLE_LIMIT) return null;
    const cut = blank + 2;
    const remaining = text.slice(cut);
    // A reading must survive the trim, and survive it overwhelmingly.
    if (words(remaining) < 200 || words(remaining) < words(text) * 0.5) return null;
    return { cut, preamble: text.slice(0, cut).trim(), remaining };
}

/**
 * A CONTENTS block — a `CONTENTS` heading over a run of short entries.
 *
 * Reported, never cut: the same division name can hold apparatus in one
 * work and a critical introduction in another. Hand the pair to a human.
 */
function contentsBlock(text) {
    const at = text.search(/^\s*CONTENTS\s*$/mi);
    if (at < 0) return null;
    const after = text.slice(at).split('\n').map(l => l.trim()).filter(Boolean).slice(1, 40);
    if (after.length < 8) return null;
    const shortEntries = after.filter(l => l.length <= 48 && !/[.!?]["')\]]?\s*$|,$/.test(l.replace(/\.$/, ''))).length;
    return shortEntries / after.length > 0.6
        ? { entries: after.length, short: shortEntries }
        : null;
}

const withdrawn = [];
const trimmed = [];
const refused = [];
const flagged = [];
const edited = new Map();   // file -> sections

for (const file of readdirSync(DIR).filter(f => f.endsWith('.js')).sort()) {
    const mod = await import(pathToFileURL(DIR + file).href);
    const key = Object.keys(mod).find(k => k.endsWith('_SECTIONS'));
    if (!key || !Array.isArray(mod[key])) continue;

    const next = [];
    let touched = false;
    for (const section of mod[key]) {
        const name = String(section.name || '');
        const text = String(section.content || '');

        const apparatus = isApparatus(name, text);
        if (apparatus.yes) {
            withdrawn.push({ file, name, words: words(text), why: apparatus.why });
            touched = true;
            continue;
        }

        const preamble = imprintPreamble(text);
        if (preamble) {
            trimmed.push({
                file, name,
                lost: words(preamble.preamble),
                kept: words(preamble.remaining),
                head: preamble.preamble.replace(/\s+/g, ' ').slice(0, 90)
            });
            next.push({ ...section, content: preamble.remaining });
            touched = true;
            continue;
        }

        // Named as apparatus but too large to trust the name — reported,
        // never cut. A 37,000-word "Front matter" is somebody's edition.
        if (APPARATUS_NAME.test(name.trim()) || imprintAt(text, PREAMBLE_LIMIT)) {
            refused.push({ file, name, words: words(text) });
        }
        const contents = contentsBlock(text);
        if (contents && words(text) <= 6000) {
            flagged.push({ file, name, words: words(text),
                why: `${contents.short}/${contents.entries} contents-shaped entries` });
        }
        next.push(section);
    }
    if (touched) edited.set({ file, key }, next);
}

const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
console.log(`A · withdrawn whole      ${String(withdrawn.length).padStart(4)} divisions`
    + `  ${sum(withdrawn, w => w.words).toLocaleString()}w`);
console.log(`B · imprint trimmed      ${String(trimmed.length).padStart(4)} divisions`
    + `  ${sum(trimmed, t => t.lost).toLocaleString()}w removed`
    + `, ${sum(trimmed, t => t.kept).toLocaleString()}w kept`);
console.log(`  · refused (too large)  ${String(refused.length).padStart(4)} divisions — reported, never cut`);

const byWork = {};
for (const w of withdrawn) (byWork[w.file] ||= []).push(w);
console.log('\nA · by work:');
for (const [f, list] of Object.entries(byWork).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(3)}  ${f.replace('.js', '')}`);
    for (const w of list.slice(0, 2)) console.log(`         §${w.name.slice(0, 34).padEnd(34)} ${String(w.words).padStart(6)}w  ${w.why}`);
}

console.log('\nB · every trim, with what it removes:');
for (const t of trimmed) {
    console.log(`  ${t.file.replace('.js', '')} §${t.name.slice(0, 26)}`);
    console.log(`      −${String(t.lost).padStart(4)}w of ${t.kept.toLocaleString()}w   "${t.head}…"`);
}

if (refused.length) {
    console.log('\n  · refused, and why they are left alone:');
    for (const r of refused) console.log(`  ${r.file.replace('.js', '')} §${r.name.slice(0, 30)}  ${r.words.toLocaleString()}w — too large to trust a name`);
}

if (flagged.length) {
    console.log('\n  · FLAGGED FOR A HUMAN — a contents block inside a division, never cut:');
    for (const f of flagged) {
        console.log(`  ${f.file.replace('.js', '')} §${f.name.slice(0, 30)}  ${f.words.toLocaleString()}w  ${f.why}`);
    }
    console.log('    "Front matter" holds a title page in one work and a critical');
    console.log('    introduction in another, so the name is not evidence.');
}

if (!APPLY) {
    console.log('\nREPORT ONLY. Nothing was written. Re-run with --apply.');
    process.exit(0);
}

for (const [{ file, key }, sections] of edited) {
    rewriteSections(DIR + file, sections);
    console.log(`rewrote ${file}`);
}
console.log(`\napplied: ${withdrawn.length} withdrawn, ${trimmed.length} trimmed`);
