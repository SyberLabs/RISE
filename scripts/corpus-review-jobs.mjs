/**
 * Build review jobs for the corpus reviewer.
 *
 *   node scripts/corpus-review-jobs.mjs --work the-storm-of-steel
 *   node scripts/corpus-review-jobs.mjs --all --limit 200 --out jobs.json
 *
 * WHAT THIS IS FOR
 * ────────────────
 * `CORPUS-REVIEWER-PROMPT.md` is a SYSTEM prompt. It is useless on its
 * own: it describes how to judge one passage, and something has to hand
 * it the passage. This is that something.
 *
 * WHAT IT DELIBERATELY DOES NOT SEND
 * ──────────────────────────────────
 * The running heads that `ARCHIVE-CLEANSING-SPEC` §2b can prove from
 * POSITION — furniture standing between an unfinished clause and a
 * lower-case continuation — are settled deterministically and are not
 * jobs. §3's economy is that nothing reaches a reviewer a regex could
 * have settled, and there is a second reason here: a reviewer fed twenty
 * obvious running heads in a row learns to answer "trim" by reflex, and
 * the twenty-first is a chapter title.
 *
 * So the jobs are the AMBIGUOUS remainder — the ~1,576 where the same
 * shape is also the shape of a real division heading. That is the work
 * only a reader can do, which is why it is the work being delegated.
 *
 * CONTROLS
 * ────────
 * Roughly one job in ten is a known-answer passage from the prompt's
 * worked examples, shuffled in and indistinguishable from real work.
 * They are recorded in a separate answer key that the reviewer never
 * sees. A batch whose controls come back wrong is discarded whole.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const WORKS_DIR = resolve('src/content/archive/works');

/** A running head: a short line of capitals ending in a page number. */
const HEAD = /^([A-Z][A-Z'’ .,\-]{2,44}?)\s+(\d{1,4})$/;
/** A finished sentence says so; closing quotes and brackets count. */
const ENDS_A_SENTENCE = /[.!?…][")'\]]*$/;
/** How many times a stem must repeat before it looks like a header at all. */
const MIN_REPEATS = 3;
/** Characters of context on each side. Two paragraphs is too much to read. */
const CONTEXT = 220;

/**
 * The control set, verbatim from CORPUS-REVIEWER-PROMPT.md §4. Their
 * whole value is that they are real passages from this shelf: an
 * invented control tests the reviewer against my imagination.
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

/** A line that is nothing but a page number — the verso half of the furniture. */
const BARE_NUMERAL = /^\d{1,4}$/;

/**
 * Every heading-shaped line in a work, with the evidence around it.
 *
 * THE SPAN IS THE WHOLE FURNITURE RUN, NOT THE HEAD ALONE, and this was
 * wrong in the first version — caught by the reviewer, which is the loop
 * working. A printed opening leaves BOTH numbers behind: the verso page
 * number and then the recto running head, arriving as
 *
 *     …set up an observation post. \n130\n\n\nIN THE VILLAGE OF FRESNOY 131\n\n\nI took a few men…
 *
 * Spanning only the head would delete `IN THE VILLAGE OF FRESNOY 131`
 * and leave a naked `130` sitting in the prose — furniture half-removed,
 * which looks exactly as broken as furniture left alone. The reviewer
 * refused all five of these with `span: "too_small"` and was right;
 * ARCHIVE-CLEANSING-SPEC §2b had said so and the code had not.
 *
 * So the span runs from the end of the last real line of text to the
 * start of the next one, swallowing the blank lines and any bare numeral
 * between.
 */
function candidatesIn(sections) {
    const stems = new Map();
    const found = [];

    for (const section of sections) {
        const content = String(section?.content || '');
        const lines = content.split('\n');
        // Where each line begins in `content`.
        const at = [];
        let cursor = 0;
        for (const line of lines) { at.push(cursor); cursor += line.length + 1; }

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i].trim();
            const m = raw.match(HEAD);
            if (!m) continue;

            // Walk back over blanks and an adjacent verso numeral.
            let first = i;
            let p = i - 1;
            while (p >= 0 && !lines[p].trim()) p--;
            if (p >= 0 && BARE_NUMERAL.test(lines[p].trim())) { first = p; p--; }
            while (p >= 0 && !lines[p].trim()) p--;

            let n = i + 1;
            while (n < lines.length && !lines[n].trim()) n++;

            const unfinished = p >= 0 && !ENDS_A_SENTENCE.test(lines[p].trim());
            const resumes = n < lines.length && /^[a-z]/.test(lines[n].trim());

            // From just after the previous real line to the start of the
            // next one, so a trim takes the paragraph break the furniture
            // introduced along with it.
            const spanStart = p >= 0 ? at[p] + lines[p].replace(/\s+$/, '').length : 0;
            const spanEnd = n < lines.length ? at[n] : content.length;

            stems.set(m[1], (stems.get(m[1]) || 0) + 1);
            found.push({
                division: section.name || null,
                line: raw, stem: m[1],
                charStart: spanStart,
                charEnd: spanEnd,
                // What the reviewer judges: the furniture as printed,
                // both halves, without the surrounding whitespace.
                passage: lines.slice(first, i + 1)
                    .map(l => l.trim()).filter(Boolean).join('\n'),
                // POSITIONAL PROOF, §2b. Both halves required.
                proven: unfinished && resumes,
                // A SENTENCE INTERRUPTED REJOINS WITH A SPACE; a break
                // that was already there stays a break. We know the
                // furniture was inserted — we do not know that the
                // paragraphs around it were ever one.
                //
                // This asks LESS than `proven` does, on purpose. Proof
                // requires a lower-case continuation because it licenses
                // deletion with no reviewer, and it must be conservative.
                // Rejoining only asks whether the sentence had ended —
                // "…furnished by the canteen at / 12 / FROM BAZANCOURT TO
                // HATTONCHATEL 13 / Montcornet." is plainly one sentence,
                // and the capital is a place name, not a new paragraph.
                rejoin: unfinished ? ' ' : '\n\n',
                before: content.slice(Math.max(0, spanStart - CONTEXT), spanStart).trim(),
                after: content.slice(spanEnd, spanEnd + CONTEXT).trim()
            });
        }
    }
    // A stem seen once is not a header, it is a line.
    return found.filter(c => (stems.get(c.stem) || 0) >= MIN_REPEATS);
}

function jobsFor(workId, edition, sections) {
    return candidatesIn(sections)
        // §2b settles these without a reviewer.
        .filter(c => !c.proven)
        .map(c => ({
            workId,
            edition,
            locator: {
                division: c.division, charStart: c.charStart, charEnd: c.charEnd,
                // What replaces the span if it is trimmed. Carried in the
                // locator rather than decided at apply time, so the
                // verdict and the edit describe the same act.
                rejoin: c.rejoin
            },
            before: c.before,
            passage: c.passage,
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
    const proven = all.filter(c => c.proven).length;
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
