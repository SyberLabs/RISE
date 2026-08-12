/**
 * The fifteen flagged divisions, after a human read them.
 *
 *   node scripts/withdraw-apparatus-reviewed.mjs            # report
 *   node scripts/withdraw-apparatus-reviewed.mjs --apply
 *
 * `withdraw-apparatus.mjs` flagged these and cut none — the name "Front
 * matter" can hold a title page or a critical introduction. Editorial
 * rulings (2026-08-06):
 *
 *   1. Pure apparatus — withdraw.
 *   2. Apparatus with the reading inside — trim at the turn.
 *   3. Scholarship that is not the expected text (translator's preface,
 *      critical introduction, prefatory note) — withdraw, same footing
 *      as a contents page.
 *   4. Moby-Dick's mislabelled Epilogue at division 2 — restore.
 *
 * Every boundary is named, not computed: these are individual judgments
 * about specific divisions. Each trim's kept line is written down so the
 * cut can be checked without re-reading the work.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
    // After apparatus is gone, a name like "Front matter" or "ACT I." may
    // describe what was removed; rename so the division matches what it
    // now holds (and does not collide with the next division's name).
    ['the-ramayan-of-valmiki', 'Front matter', 'INVOCATION.(1)', 'Invocation',
        'title page and contents above Válmíki’s own invocation, which is the poem opening and stays'],
    ['a-doll-s-house', 'ACT I.', 'DRAMATIS PERSONAE', 'Dramatis Personae',
        'NOT Act I — a title page and contents above the dramatis personae, which belongs to the play']
];

/**
 * Moby-Dick: two divisions named "Epilogue"; division 2 is not one.
 *
 * Division 152 holds the real epilogue. Division 2 is Gutenberg
 * transcriber notes plus Melville's Etymology and Extracts — opening
 * apparatus that belongs before Loomings. The ingest took the contents
 * list's last "Epilogue" line as the heading. Correction: trim
 * transcriber notes, restore the name, place at the front.
 */
const RESTORE = [{
    file: 'moby-dick-or-the-whale',
    // Match on content, not position: earlier withdrawals shift indices.
    // This division is the one that holds Melville's Etymology.
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
        const mod = await import(pathToFileURL(DIR + file + '.js').href);
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
