/**
 * Precompute each work's divisions so a card can say what it holds, and so a
 * curator can spend a word budget on part of a work rather than only on all
 * of it.
 *
 *   node scripts/build-division-index.mjs
 *
 * Archive payloads stay lazy (whole books). Division counts, labels and
 * per-division lengths are derived once here from committed bytes so cards
 * need not download a work to report chapters and the Scriptorium's gate need
 * not load one to measure `sacred-tao-te-ching#40`. Re-run after any ingest;
 * the archive test asserts the index still agrees with the works.
 *
 * ONE PASS, ONE FILE PER SHELF STATE. The per-division word counts spent a
 * while in a sibling `division-words.json` written by a second script, because
 * the two could not be regenerated in one change. They can now, and they are:
 * two artifacts from one `divideSections` call could disagree, and the only
 * thing that ever kept them honest was a test remembering to compare them.
 *
 * The split below is not that split. It is the SHELF, and it exists because a
 * runtime filter cannot remove a build-time dependency — the static import IS
 * the dependency. `buildLibraryCatalogue` walks the released works and drops
 * the rest, and every one of the eighty withheld works still rode into every
 * reader's bundle behind that filter: 49 KiB of counts, nouns and per-division
 * word lists for books nobody can name. (This codebase has paid for that
 * lesson once at 82 MB.)
 *
 * That 49 KiB is `division-index.withheld.json` as a bundler embeds it — the
 * parsed JSON, without the indentation the committed file carries, which is
 * 53 KiB. The two figures were stated in three places and agreed in none, so
 * both now live in SCRIPTORIUM-SPEC §7 with the measurement each one is, and
 * scriptorium-spec.test.js re-measures the files against them.
 *
 * So the served shelf is one file and the withheld corpus is another, written
 * in the same pass from the same call, with the same shape. Only the first is
 * imported by anything under src/ that is not a test, and a guard in
 * divisions.test.js says so.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
    divideSections,
    firstBodyOrdinal,
    isInformativeLabel
} from '../src/content/archive/divisions.js';
import { CANON_IDS, STRUCTURED_IDS } from '../src/content/archive/canon.js';

/**
 * Labels are sent to a curator so it can choose a division by what it is
 * rather than by its number. They ride WHOLE or not at all: a truncated list
 * would read as the work's complete scheme and send the model past the end.
 *
 * Whole also means UNCUT. A 60-character cap used to shorten one label in
 * four of Lyrical Ballads mid-word, which reads as the edition's own title
 * and is not one; the longest label on the shelf is 158 characters and the
 * curator context bounds catalogue text at 400, so the cap bought nothing
 * that was not already bounded.
 */
const MAX_LABELLED_DIVISIONS = 300;

const WORKS_DIR = resolve('src/content/archive/works');
/** What the shelf serves. Imported by the app. */
const OUT = resolve('src/content/archive/division-index.json');
/**
 * What the shelf holds back. Imported by corpus audits only — the withheld
 * payloads are where the hard front-matter and division cases live, and
 * deleting the record would make those tests untestable rather than passing.
 */
const OUT_WITHHELD = resolve('src/content/archive/division-index.withheld.json');

const index = {};
const withheld = {};
let divided = 0;

for (const file of readdirSync(WORKS_DIR).filter(f => f.endsWith('.js')).sort()) {
    const id = file.replace(/\.js$/, '');
    const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
    const key = Object.keys(mod).find(k => k.endsWith('_SECTIONS'));
    if (!key) {
        console.warn(`  ! ${id}: no SECTIONS export`);
        continue;
    }
    const { divided: isDivided, noun, reason, entries } = divideSections(mod[key],
        { declared: STRUCTURED_IDS.has(id) });
    const divisionWords = entries.map(e => e.words);
    const words = divisionWords.reduce((n, w) => n + w, 0);
    const labels = entries.map(e => String(e.label || '').trim());
    // Ordinals are positions, so the first division that is the work itself.
    const bodyFrom = firstBodyOrdinal(entries, { noun });
    const authored = Boolean(reason) && reason !== 'measured';
    // WHOSE NUMBER IS IT. "Book I" was rejected as a number restated, which
    // is true of RISE's own "Reading 3" and false of the author's: a work's
    // own ordinal is precisely the thing its ARRAY POSITION is not. Dante's
    // Purgatorio Canto I is division 37, and a curator told nothing sends a
    // reader to Inferno. So an authored scheme ships its labels whether or
    // not they say more than a number, and a measured one still ships only
    // where a label names something.
    //
    // Only for a work the shelf offers. Labels are read by exactly one
    // consumer, `buildLibraryCatalogue`, which walks the released works; a
    // withheld work's card wants a count and a noun and nothing else. Sending
    // the other eighty would put the withheld half's 49 KiB of embedded JSON in
    // every reader's bundle to name divisions nobody can address — the figure
    // and its measurement are in SCRIPTORIUM-SPEC §7, catalogue size, which is
    // where the guard reads them from. This comment, the header above and §7
    // each stated a different figure, and none of the three said which quantity
    // it was measuring — which is how they could all sound like one claim.
    const served = CANON_IDS.has(id);
    const worthSending = served
        && labels.length > 0
        && labels.length <= MAX_LABELLED_DIVISIONS
        && labels.every(Boolean)
        && (authored || labels.some(isInformativeLabel));
    (served ? index : withheld)[id] = {
        divided: isDivided,
        // Titled schemes have no division noun (named places, not
        // numbered chapters) — record rather than invent.
        titled: reason === 'titled',
        // titled | scheme | inline | measured | short | …
        // `measured` means RISE cut the text; everything else is the
        // author's (or the edition's) own scheme.
        reason: reason || null,
        authored,
        // The work's own word for its divisions ("chapters", "books", …).
        noun: noun || null,
        count: entries.length,
        // Where the work starts, when something precedes it.
        ...(bodyFrom > 1 ? { bodyFrom } : {}),
        ...(worthSending ? { labels } : {}),
        // HOW LONG EACH DIVISION IS, in the same order as `labels`. The total
        // below answers "does this work fit"; only this answers "does this
        // chapter fit", which is the question every extent id asks.
        divisionWords,
        words
    };
    if (isDivided) divided++;
    console.log(
        `  ${String(entries.length).padStart(4)} ${(noun || '—').padEnd(8)} ` +
        `${String(words).padStart(9)}w  ${id}`);
}

// Indented for the labels, which a person reads in a diff, and flat for the
// word counts, which nobody does: 9,403 numbers one per line is a third of a
// megabyte of file for the same bytes on the wire.
const INLINE = /"@@(\[[^\]]*\])@@"/gu;
const write = (path, entries) => {
    const text = JSON.stringify(entries, (key, value) =>
        (key === 'divisionWords' ? `@@${JSON.stringify(value)}@@` : value), 2)
        .replace(INLINE, '$1');
    writeFileSync(path, `${text}\n`);
    const total = Object.values(entries).reduce((n, v) => n + v.words, 0);
    console.log(`${String(Object.keys(entries).length).padStart(4)} works, `
        + `${total.toLocaleString().padStart(11)} words → ${path}`);
};

console.log(`\n${divided} of ${Object.keys(index).length + Object.keys(withheld).length} `
    + 'works divided\n');
write(OUT, index);
write(OUT_WITHHELD, withheld);
