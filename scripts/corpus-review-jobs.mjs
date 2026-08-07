/**
 * Build review jobs for the corpus reviewer.
 *
 *   node scripts/corpus-review-jobs.mjs --work the-storm-of-steel
 *   node scripts/corpus-review-jobs.mjs --all --limit 200 --out jobs.json
 *
 * Feeds passages to `CORPUS-REVIEWER-PROMPT.md` (the system prompt alone
 * has nothing to judge).
 *
 * Omits running heads that `ARCHIVE-CLEANSING-SPEC` §2b settles from
 * position — furniture between an unfinished clause and a lower-case
 * continuation. Only the ambiguous remainder reaches a reviewer: the
 * same shape can be a real division heading, and nothing a regex could
 * settle should be delegated.
 *
 * Roughly one job in ten is a known-answer control from the prompt's
 * worked examples, shuffled in and unlabelled. The answer key is
 * separate; a batch whose controls fail is discarded whole.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Shared detector — same module the cleanser and tests import.
import { stemsOf, furnitureIn, isProven } from '../src/content/archive/furniture.js';
import { keepIdentity } from '../src/content/archive/keep-identity.js';

const WORKS_DIR = resolve('src/content/archive/works');

/**
 * Passages already reviewed and kept. A keep is a decision: without this
 * record, settled candidates reappear in every batch.
 */
let KEPT = new Set();
try {
    KEPT = new Set(JSON.parse(readFileSync(resolve('src/content/archive/cleanse-keeps.json'), 'utf8'))
        .map(k => k.id).filter(Boolean));
} catch { /* nothing kept yet */ }

/**
 * Control set from CORPUS-REVIEWER-PROMPT.md §4. Real shelf passages,
 * not invented ones — an invented control only tests the author.
 */
const CONTROLS = [
    {
        workId: '__control-a', edition: 'control',
        before: 'commonly called the Indo-European, the Semitic, and',
        passage: 'INTRODUCTION  7',
        after: 'the Turanian respectively. It is with peoples of the',
        suspicion: 'running-head',
        expect: { disposition: 'trim', verdict: 'running-head' }
    },
    {
        workId: '__control-b', edition: 'control',
        before: 'Krishna-Dwaipayana Vyasa',
        passage: 'BOOK 1',
        after: 'ADI PARVA',
        suspicion: 'running-head',
        expect: { disposition: 'keep', verdict: 'book' }
    },
    {
        workId: '__control-c', edition: 'control',
        before: 'Enter Hamlet, reading on a Booke.',
        passage: '140. at] Ff. om. Qq.',
        after: 'My lord, I have news to tell you.',
        suspicion: 'apparatus',
        expect: { disposition: 'trim', verdict: 'apparatus' }
    },
    {
        workId: '__control-d', edition: 'control',
        before: 'He turned to us with the calm of a man already decided.',
        passage: 'I HAVE DRAWN UP DEFINITE RULES.',
        after: 'And with that he left the dug-out.',
        suspicion: 'marginalia',
        expect: { disposition: 'keep', verdict: 'book' }
    },
    {
        workId: '__control-e', edition: 'control',
        before: 'CHAPTER  III.  :  TEXT  AND  TRANSLATION  ....  76',
        passage: 'LIST  OF  PREVIOUS  TRANSLATORS 87',
        after: 'ANCIENT  PERSIAN  CALENDAR  .  .  .  .  88',
        suspicion: 'running-head',
        expect: { disposition: 'keep', verdict: 'front-matter' }
    }
];

/** Characters of context on each side. Two paragraphs is too much to read. */
const CONTEXT = 220;

/**
 * Every candidate in a work, with the context a reviewer needs.
 *
 * `furnitureIn` returns spans only; identifying furniture and presenting
 * it are different jobs. `before`/`after` must be filled here — position
 * is the evidence the prompt asks the reviewer to judge by.
 */
function candidatesIn(sections) {
    const stems = stemsOf(sections);
    const out = [];
    sections.forEach((section, index) => {
        const content = String(section?.content || '');
        for (const f of furnitureIn(content, stems)) {
            out.push({
                ...f,
                // Section index, not name: division names are not unique
                // within a work, so a name-keyed locator can point offsets
                // at the wrong section.
                section: index,
                division: section.name || null,
                before: content.slice(Math.max(0, f.start - CONTEXT), f.start).trim(),
                after: content.slice(f.end, f.end + CONTEXT).trim()
            });
        }
    });
    return out;
}

function jobsFor(workId, edition, sections) {
    return candidatesIn(sections)
        // §2b settles these without a reviewer.
        .filter(c => !isProven(c))
        .filter(c => !KEPT.has(keepIdentity({ workId, section: c.section, passage: c.text,
            before: c.before, after: c.after })))
        .map(c => ({
            workId,
            edition,
            locator: {
                section: c.section, division: c.division,
                charStart: c.start, charEnd: c.end,
                // What replaces the span if it is trimmed. Carried in the
                // locator rather than decided at apply time, so the
                // verdict and the edit describe the same act.
                rejoin: c.rejoin
            },
            before: c.before,
            passage: c.text,
            after: c.after,
            suspicion: 'running-head'
        }));
}

/** Deterministic shuffle, so a batch is reproducible when something goes wrong. */
function shuffle(list, seed = 7) {
    let s = seed;
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const only = flag('work');
const limit = Number(flag('limit', '0')) || 0;
const out = flag('out', 'corpus-review-jobs.json');

const files = readdirSync(WORKS_DIR)
    .filter(n => n.endsWith('.js') && !n.includes('.test.'))
    .filter(n => !only || n.startsWith(only));

if (!files.length) {
    console.error(`No work matched --work ${only}`);
    process.exit(1);
}

let jobs = [];
let provenTotal = 0;

for (const file of files) {
    const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    const meta = Object.values(mod).find(v => v && v.id && v.edition);
    if (!sections) continue;

    const workId = file.replace(/\.js$/, '');
    // An edition names itself one of two ways and they must not be
    // concatenated — a `statement` already carries its year, which is how
    // the Library once produced "Homer · 1883, 1883".
    const e = meta?.edition;
    const edition = e?.statement
        ? e.statement
        : (e ? [e.translator, e.publisher, e.year].filter(Boolean).join(', ') : 'unrecorded');

    const all = candidatesIn(sections);
    const proven = all.filter(isProven).length;
    provenTotal += proven;

    const mine = jobsFor(workId, edition, sections);
    if (mine.length || proven) {
        console.log(`${workId}: ${all.length} candidates — ${proven} settled by position, ${mine.length} for review`);
    }
    jobs.push(...mine);
}

jobs = shuffle(jobs);
if (limit) jobs = jobs.slice(0, limit);

// One control in ten, shuffled in and unlabelled.
const wanted = Math.max(CONTROLS.length, Math.round(jobs.length / 10));
const controls = [];
for (let i = 0; i < wanted; i++) controls.push(CONTROLS[i % CONTROLS.length]);

const key = [];
const batch = shuffle(jobs.concat(controls.map((c, i) => {
    const id = `ctl-${i}`;
    key.push({ id, ...c.expect });
    return {
        workId: c.workId, edition: c.edition,
        locator: { division: null, charStart: 0, charEnd: c.passage.length, control: id },
        before: c.before, passage: c.passage, after: c.after, suspicion: c.suspicion
    };
})), 13);

writeFileSync(out, JSON.stringify(batch, null, 2));
writeFileSync(out.replace(/\.json$/, '') + '.key.json', JSON.stringify(key, null, 2));

console.log('');
console.log(`settled by position, no reviewer needed : ${provenTotal}`);
console.log(`jobs for review                         : ${jobs.length}`);
console.log(`controls mixed in                       : ${controls.length}`);
console.log(`wrote ${out} and ${out.replace(/\.json$/, '')}.key.json`);
console.log('');
console.log('Send CORPUS-REVIEWER-PROMPT.md §2 as the SYSTEM prompt and one');
console.log('job object as the entire user message. No tools. No repository.');
