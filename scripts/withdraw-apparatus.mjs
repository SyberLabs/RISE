/**
 * Apparatus in the reading stream — detect, report, and only then trim.
 *
 *   node scripts/withdraw-apparatus.mjs              # report
 *   node scripts/withdraw-apparatus.mjs --apply
 *
 * ARCHIVE-CLEANSING-SPEC, Phase 10. Two divisions turned up BY ACCIDENT
 * while sampling for the phrase-floor study: the Ramayan serving a title
 * page, `a-hundred-verses-from-old-japan` serving an INDEX. Nothing was
 * looking for them. This is what looking finds.
 *
 * TWO DEFECTS, AND THEY WANT OPPOSITE ACTS.
 *
 *   A. The division IS apparatus — an index, a glossary, a contents
 *      page. It is WITHDRAWN whole, because none of it was a reading.
 *
 *   B. An imprint sits at the HEAD of a genuine division — "printed by",
 *      "Trübner & Co." above 177,675 words of Burton. Only the preamble
 *      is TRIMMED. Withdrawing these would delete the book.
 *
 * Conflating them is how a report of "104 divisions, 1,886,819 words"
 * gets written about work that is really 84 small removals and 20 small
 * trims. The counts are kept apart everywhere below.
 *
 * THE EVIDENCE IS CHECKED BEFORE THE CUT. Class A needs a name that
 * announces apparatus OR a body that is mostly index-shaped lines; class
 * B needs an imprint AND a body that is overwhelmingly not one, so a
 * genuine reading is never mistaken for its own title page. Anything
 * that fails its test is reported and left alone.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rewriteSections } from '../src/content/archive/payload-writer.js';

const DIR = fileURLToPath(new URL('../src/content/archive/works/', import.meta.url));
const APPLY = process.argv.includes('--apply');

/** A division whose NAME announces it is apparatus. */
const APPARATUS_NAME = /^(index|contents?|table of contents|errata|colophon|bibliograph|glossar|appendix|footnotes?|list of (illustrations|plates)|advertisement|transcriber)/i;

/** "If I had made thy proffered arm,  67." — an index entry's shape. */
const INDEX_LINE = /^.{4,60},\s*\d{1,4}\.?\s*$/;

/**
 * A printer's imprint — SET PHRASES ONLY.
 *
 * The first version also matched publisher NAMES (Trübner, Longmans,
 * Macmillan), and a publisher's name appears in two places: on a title
 * page and inside a citation. It matched Burton's endnote — *"The Arabian
 * Nights' Entertainments (London: Longmans, 1811) by Jonathan Scott"* —
 * and would have trimmed 42 words of real annotation off 3,350 words of
 * scholarship. A name is evidence of a publisher; only a set phrase is
 * evidence of an imprint.
 */
const IMPRINT = /\b(printed (by|for)\b|published by\b|all rights reserved\b|for private subscribers)/i;

const words = (s) => s.split(/\s+/u).filter(Boolean).length;

/**
 * An imprint IN IMPRINT POSITION, not merely the words somewhere.
 *
 * `the-no-plays-of-japan §CHAPTER VI` is a genuine editorial note on two
 * Nō plays, and it matched on *"though printed by both Ōwada and Haga,
 * has probably not been staged for many centuries"*. The phrase is
 * ordinary prose there. What distinguishes a colophon is not its words
 * but its TYPESETTING: it is set short and alone, while prose wraps to
 * the measure. So the line carrying the phrase must be a colophon line.
 *
 * THE THRESHOLD IS MEASURED, AND ITS TWO BOUNDARY CASES ARE NAMED so a
 * later reader can judge it rather than trust it. It is not a principle;
 * it is the widest colophon seen against the narrowest prose line seen.
 *
 *   "PRINTED BY THE BURTON CLUB FOR PRIVATE SUBSCRIBERS ONLY"  55 — colophon
 *   "_Tanikō_ is still played; but _Ikeniye_, though printed…"  69 — prose
 *
 * At 45 the first was rejected and nine of Burton's ten title pages
 * vanished — a false negative produced by the fix for a false positive,
 * which is the ordinary way a filter goes wrong. Anything landing
 * between 56 and 68 deserves an eye rather than a verdict.
 */
const COLOPHON_LINE = 60;

function imprintAt(text, limit = Infinity) {
    // EVERY match within the limit, not just the first. Testing only the
    // first let a later prose "printed by" mask a real colophon above it,
    // and nine of Burton's ten title pages vanished from the report
    // because of it — a false NEGATIVE produced by the fix for a false
    // positive, which is the ordinary way a filter goes wrong.
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
 * A NAME ALONE IS NOT ENOUGH FOR A LONG DIVISION. "Appendix" can head a
 * real essay; a 40,000-word appendix is a reading someone may want. The
 * name is trusted only while the division is small, and a large one must
 * prove itself by shape.
 */
function isApparatus(name, text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const indexish = lines.filter(l => INDEX_LINE.test(l)).length;
    const shaped = lines.length > 6 && indexish / lines.length > 0.5;
    if (shaped) return { yes: true, why: `${indexish}/${lines.length} index-shaped lines` };
    if (APPARATUS_NAME.test(name.trim()) && words(text) <= 4000) {
        return { yes: true, why: `name "${name.trim()}", ${words(text)}w` };
    }
    // A SMALL DIVISION THAT IS ENTIRELY A TITLE PAGE. `faust §VOL. I.` is
    // 72 words — an epigraph, "BOSTON AND NEW YORK", Houghton Mifflin, two
    // copyright lines, ALL RIGHTS RESERVED, "Contents." Its NAME announces
    // nothing, so the name test misses it, and it is too small for the
    // preamble trim to leave a reading behind. It is not a reading with
    // furniture on top; it is furniture.
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
    // The SAME colophon-position test class A uses. Testing only for the
    // phrase here would trim Burton's endnote on a citation, and the two
    // paths must not disagree about what an imprint is.
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
 * This is REPORTED, NEVER CUT, and the reason is a pair of divisions with
 * the same name and opposite natures. `the-ramayan-of-valmiki §Front
 * matter` is a title page above "CONTENTS / Invocation. / Book I. / Canto
 * I. Nárad." — apparatus entire. `crime-and-punishment §Front matter` is
 * a critical introduction: "Dostoevsky was the son of a doctor. His
 * parents were very hard-working and deeply religious people…" — a
 * reading somebody may want.
 *
 * A name that means opposite things in two works is not evidence, so this
 * hands the pair to a human instead of guessing at 799 words.
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
    const mod = await import(DIR + file);
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
