/**
 * The fifteen flagged divisions, after a human read them.
 *
 *   node scripts/withdraw-apparatus-reviewed.mjs            # report
 *   node scripts/withdraw-apparatus-reviewed.mjs --apply
 *
 * `withdraw-apparatus.mjs` flagged these and cut none of them, because
 * the name "Front matter" holds a title page in one work and a critical
 * introduction in another. Mateo read all fifteen and ruled on 2026-08-06:
 *
 *   1. Pure apparatus — WITHDRAW.
 *   2. Apparatus with the reading inside it — TRIM at the turn.
 *   3. "Scholarship is not the text the reader expects: fair to cut" —
 *      so a translator's preface, a critical introduction and a
 *      prefatory note all WITHDRAW, on the same footing as a contents
 *      page. This is the precedent the Dow header already stated and the
 *      first pass had not applied consistently.
 *   4. Moby-Dick's Epilogue at division 2 — REORDER.
 *
 * EVERY BOUNDARY IS NAMED, not computed. A detector earned its cuts by
 * evidence; these are individual editorial judgments about fourteen
 * specific divisions, and a rule inferred from fourteen cases would be a
 * rule fitted to fourteen cases. The line each trim keeps is written
 * down so the cut can be checked without re-reading the work.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rewriteSections } from '../src/content/archive/payload-writer.js';

const DIR = fileURLToPath(new URL('../src/content/archive/works/', import.meta.url));
const APPLY = process.argv.includes('--apply');

/** Divisions withdrawn whole. Each notes what it actually held. */
const WITHDRAW = [
    ['war-and-peace', 'Front matter', 'title page + contents'],
    ['sacred-zen-koans', 'Opening', 'title page, Luzac imprint, contents'],
    ['sacred-corpus-hermeticum', 'Volume 3 — Opening', 'title page + contents'],
    ['sacred-corpus-hermeticum', 'Volume 1 — III.', 'an index fragment wearing a chapter name'],
    ['moby-dick-or-the-whale', 'Front matter', 'title page + contents'],
    ['middlemarch', 'Front matter', 'title page, dedication to G. H. Lewes, contents'],
    ['middlemarch', 'BOOK VIII. SUNSET AND SUNRISE.', 'NOT Book VIII — the tail of the contents list'],
    ['the-brothers-karamazov', 'Part I', 'NOT Part I — the title page'],
    ['the-no-plays-of-japan', 'Front matter', 'title page, publisher advertisement, contents'],
    ['the-storm-of-steel', 'THE STORM OF STEEL', 'Phoenix Library title page + contents'],
    // Ruling 3 — scholarship.
    ['the-iliad', 'Front matter', 'title page, contents, translators’ prefatory note, two dedicatory sonnets by A.L. and E.M. — none of it Homer'],
    ['the-odyssey', 'Front matter', 'Butler’s prefaces, signed Henry Festing Jones, 1921'],
    ['translations-of-shakuntala-and-other-works', 'INTRODUCTION', 'a critical essay on Kalidasa’s life and writings'],
    ['crime-and-punishment', 'Front matter', 'a biographical introduction — ends on the title, so the reading starts in the next division']
];

/**
 * Divisions trimmed at a named line. The kept text must BEGIN with it, so
 * a cut that lands anywhere else fails loudly instead of quietly.
 */
const TRIM = [
    ['paradise-lost', 'Book I', 'Book I\n', null,
        'a contents list above the poem — kept from the Book I heading, matching Book II and Book III'],
    // A TRIM CAN LEAVE A NAME DESCRIBING WHAT WAS REMOVED. Once the
    // apparatus is gone, "Front matter" holds Válmíki's invocation and
    // "ACT I." holds the dramatis personae — while the NEXT division is
    // also called "ACT I". A division whose name outlives its contents is
    // the Mahabharata's fault in miniature: a reading presented under a
    // name that no longer describes it.
    ['the-ramayan-of-valmiki', 'Front matter', 'INVOCATION.(1)', 'Invocation',
        'title page and contents above Válmíki’s own invocation, which is the poem opening and stays'],
    ['a-doll-s-house', 'ACT I.', 'DRAMATIS PERSONAE', 'Dramatis Personae',
        'NOT Act I — a title page and contents above the dramatis personae, which belongs to the play']
];

/**
 * MOBY-DICK HAS TWO DIVISIONS NAMED "Epilogue" AND ONE OF THEM IS NOT.
 *
 * I first read division 2 as the ending served second and moved it to the
 * back. It contains no epilogue. "The drama's done" and "another orphan"
 * are in division 152, which is the real one; division 2 is Gutenberg's
 * transcriber notes followed by ETYMOLOGY and EXTRACTS — Melville's own
 * opening apparatus, which belongs BEFORE Loomings and which the moving
 * had sent to the back of the book.
 *
 * The label came from the contents list, whose last entry is "Epilogue",
 * so the ingest's heading detector took the wrong line. The correction is
 * therefore three acts on one division and not a reorder at all: trim the
 * transcriber notes, restore the name the contents took away, and put it
 * where Melville put it.
 */
const RESTORE = [{
    file: 'moby-dick-or-the-whale',
    // MATCHED ON CONTENT, NOT POSITION. An index is only true until an
    // earlier step moves something: the withdrawal above removes division
    // 1, so `i === 1` had already stopped meaning what it was written to
    // mean by the time this ran. What identifies this division is that it
    // holds Melville's Etymology, which no other division does.
    match: (s) => /ETYMOLOGY/.test(String(s.content)) && !/CHAPTER 1\./.test(String(s.content)),
    keepFrom: 'ETYMOLOGY',
    rename: 'Etymology and Extracts',
    to: 0,
    why: 'transcriber notes trimmed; Melville’s Etymology and Extracts restored to the front, where the real Epilogue’s name had displaced them'
}];

const words = (t) => t.split(/\s+/u).filter(Boolean).length;
const files = new Map();

async function sectionsOf(file) {
    if (!files.has(file)) {
        const mod = await import(DIR + file + '.js');
        const key = Object.keys(mod).find(k => k.endsWith('_SECTIONS'));
        files.set(file, { key, sections: [...mod[key]] });
    }
    return files.get(file);
}

const done = [];
const failed = [];

for (const [file, name, why] of WITHDRAW) {
    const entry = await sectionsOf(file);
    const i = entry.sections.findIndex(s => String(s.name).trim().startsWith(name));
    if (i < 0) { failed.push(`${file} §${name} — not found`); continue; }
    const lost = words(String(entry.sections[i].content));
    entry.sections.splice(i, 1);
    done.push({ act: 'withdraw', file, name, lost, why });
}

for (const [file, name, keepFrom, rename, why] of TRIM) {
    const entry = await sectionsOf(file);
    const i = entry.sections.findIndex(s => String(s.name).trim().startsWith(name));
    if (i < 0) { failed.push(`${file} §${name} — not found`); continue; }
    const text = String(entry.sections[i].content);
    const at = text.indexOf(keepFrom);
    if (at < 0) { failed.push(`${file} §${name} — keep-line "${keepFrom.trim()}" not present`); continue; }
    const kept = text.slice(at);
    entry.sections[i] = {
        ...entry.sections[i],
        ...(rename ? { name: rename } : {}),
        content: kept
    };
    done.push({ act: 'trim', file, name, rename,
        lost: words(text) - words(kept), kept: words(kept), why });
}

for (const spec of RESTORE) {
    const entry = await sectionsOf(spec.file);
    const i = entry.sections.findIndex((s, idx) => spec.match(s, idx));
    if (i < 0) { failed.push(`${spec.file} — restore target not found`); continue; }
    const text = String(entry.sections[i].content);
    const at = text.indexOf(spec.keepFrom);
    if (at < 0) { failed.push(`${spec.file} — "${spec.keepFrom}" not present`); continue; }
    const kept = text.slice(at);
    const [moved] = entry.sections.splice(i, 1);
    entry.sections.splice(spec.to, 0, { ...moved, name: spec.rename, content: kept });
    done.push({ act: 'restore', file: spec.file, name: String(moved.name).trim(),
        rename: spec.rename, from: i + 1, to: spec.to + 1,
        lost: words(text) - words(kept), kept: words(kept), why: spec.why });
}

for (const row of done) {
    const head = `${row.act.toUpperCase().padEnd(9)} ${row.file} §${row.name}`;
    console.log(head);
    if (row.act === 'withdraw') console.log(`          −${row.lost.toLocaleString()}w   ${row.why}`);
    if (row.act === 'trim') {
        console.log(`          −${row.lost.toLocaleString()}w, ${row.kept.toLocaleString()}w kept   ${row.why}`);
        if (row.rename) console.log(`          renamed §${row.name} → §${row.rename}`);
    }
    if (row.act === 'restore') {
        console.log(`          −${row.lost.toLocaleString()}w, ${row.kept.toLocaleString()}w kept`
            + `   division ${row.from} → ${row.to}, renamed §${row.name} → §${row.rename}`);
        console.log(`          ${row.why}`);
    }
}

if (failed.length) {
    console.log('\nFAILED — nothing is written when a boundary cannot be found:');
    for (const f of failed) console.log(`  ${f}`);
    process.exit(1);
}

const withdrawn = done.filter(d => d.act === 'withdraw');
const trimmed = done.filter(d => d.act === 'trim');
console.log(`\n${withdrawn.length} withdrawn (${withdrawn.reduce((a, d) => a + d.lost, 0).toLocaleString()}w)`
    + `, ${trimmed.length} trimmed (${trimmed.reduce((a, d) => a + d.lost, 0).toLocaleString()}w)`
    + `, ${done.filter(d => d.act === 'restore').length} restored`);

if (!APPLY) {
    console.log('\nREPORT ONLY. Nothing was written. Re-run with --apply.');
    process.exit(0);
}

for (const [file, entry] of files) {
    rewriteSections(DIR + file + '.js', entry.sections);
    console.log(`rewrote ${file}.js`);
}
