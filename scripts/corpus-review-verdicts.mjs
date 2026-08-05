/**
 * Check a batch of reviewer verdicts before anything is applied.
 *
 *   node scripts/corpus-review-verdicts.mjs verdicts.json --key jobs.key.json
 *
 * NOTHING FROM A REVIEWER IS TRUSTED ON ARRIVAL. This reads a batch,
 * validates every verdict against the schema and the disposition rules
 * in CORPUS-REVIEWER-PROMPT.md §2, scores the hidden controls, and
 * reports the trim rate against a baseline you supply.
 *
 * It applies nothing. Applying is a separate act with a dossier record
 * (ARCHIVE-CLEANSING-SPEC §5), and it must not be reachable by accident
 * from a script whose job is to doubt.
 *
 * A BATCH FAILS WHOLE. If a control comes back wrong, the batch is
 * discarded rather than corrected — a reviewer that got a known answer
 * wrong has told you nothing reliable about the unknown ones, and
 * repairing its output is the same failure as the reviewer rewriting
 * prose: afterwards nobody can tell what was actually decided.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERDICTS = new Set([
    'book', 'running-head', 'page-furniture', 'apparatus', 'front-matter', 'ocr-corruption'
]);
const SPANS = new Set(['exact', 'too_big', 'too_small']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const DISPOSITIONS = new Set(['keep', 'trim', 'flag']);
const ALLOWED_KEYS = new Set([
    'workId', 'locator', 'verdict', 'span', 'confidence', 'disposition', 'note'
]);

/**
 * DRIFT IS MEASURED AGAINST A BASELINE YOU SUPPLY, AND THERE IS NO
 * DEFAULT ON PURPOSE.
 *
 * The first version of this compared every batch against §2b's 16% —
 * 293 positionally-proven running heads out of 1,869 candidates — and
 * promptly rejected a batch of perfectly correct verdicts. That figure
 * is over the WRONG DENOMINATOR: the 16% describes all candidates, and
 * the jobs a reviewer actually receives are the ones position could NOT
 * settle, a population whose true trim rate is unknown and certainly
 * higher. Storm of Steel alone is 109 settled against 30 sent.
 *
 * So a number carried over from a different population is not a
 * baseline, it is a coincidence waiting to fire. Until enough batches
 * exist to know the real rate, this REPORTS the rate and rejects
 * nothing on it. Pass `--baseline <0-1>` once that number is earned.
 */
const DRIFT_FACTOR = 1.6;

/** The disposition rules, restated as a check rather than as a hope. */
function dispositionShouldBe(v) {
    if (v.verdict === 'book') return 'keep';
    if (v.span !== 'exact') return 'keep';
    if (v.confidence === 'low') return 'keep';
    if (v.verdict === 'ocr-corruption') return 'flag';
    return 'trim';
}

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const keyIndex = args.indexOf('--key');
const keyFile = keyIndex >= 0 ? args[keyIndex + 1] : null;
const baseIndex = args.indexOf('--baseline');
const baseline = baseIndex >= 0 ? Number(args[baseIndex + 1]) : null;

if (!file) {
    console.error('usage: node scripts/corpus-review-verdicts.mjs <verdicts.json> [--key <key.json>]');
    process.exit(1);
}

let verdicts;
try {
    verdicts = JSON.parse(readFileSync(resolve(file), 'utf8'));
} catch (err) {
    console.error(`Could not read ${file} as JSON: ${err.message}`);
    process.exit(1);
}
if (!Array.isArray(verdicts)) verdicts = [verdicts];

const malformed = [];
const illegal = [];
let trims = 0, keeps = 0, flags = 0;
const actionable = [];

verdicts.forEach((v, i) => {
    const where = `#${i}${v?.workId ? ` (${v.workId})` : ''}`;

    if (!v || typeof v !== 'object') { malformed.push(`${where}: not an object`); return; }
    for (const k of Object.keys(v)) {
        if (!ALLOWED_KEYS.has(k)) malformed.push(`${where}: unexpected key "${k}"`);
    }
    if (!VERDICTS.has(v.verdict)) malformed.push(`${where}: verdict "${v.verdict}"`);
    if (!SPANS.has(v.span)) malformed.push(`${where}: span "${v.span}"`);
    if (!CONFIDENCE.has(v.confidence)) malformed.push(`${where}: confidence "${v.confidence}"`);
    if (!DISPOSITIONS.has(v.disposition)) malformed.push(`${where}: disposition "${v.disposition}"`);
    if (typeof v.note !== 'string' || !v.note.trim()) malformed.push(`${where}: no note`);

    // A note that describes an ACTION rather than an identity is the
    // signature of a reviewer that has started editing.
    if (typeof v.note === 'string' && /\b(remove|delete|should be|fix|correct|trim)\b/i.test(v.note)) {
        illegal.push(`${where}: note describes an action — "${v.note.slice(0, 60)}"`);
    }

    const ought = dispositionShouldBe(v);
    if (DISPOSITIONS.has(v.disposition) && v.disposition !== ought) {
        illegal.push(`${where}: disposition "${v.disposition}" but the rules give "${ought}"`);
    }

    if (v.disposition === 'trim') { trims++; actionable.push(v); }
    else if (v.disposition === 'flag') flags++;
    else keeps++;
});

// ── Controls ────────────────────────────────────────────────────────
const controlFailures = [];
let controlsSeen = 0;
if (keyFile) {
    const key = JSON.parse(readFileSync(resolve(keyFile), 'utf8'));
    const byId = new Map(key.map(k => [k.id, k]));
    for (const v of verdicts) {
        const id = v?.locator?.control;
        if (!id || !byId.has(id)) continue;
        controlsSeen++;
        const want = byId.get(id);
        if (v.disposition !== want.disposition) {
            controlFailures.push(
                `${id}: expected ${want.disposition} (${want.verdict}), got ${v.disposition} (${v.verdict}) — "${v.note}"`);
        }
    }
}

const judged = trims + keeps + flags;
const rate = judged ? trims / judged : 0;

console.log('');
console.log(`verdicts read      : ${verdicts.length}`);
console.log(`  keep             : ${keeps}`);
console.log(`  trim             : ${trims}`);
console.log(`  flag             : ${flags}`);
console.log(`trim rate          : ${(rate * 100).toFixed(1)}%${
    Number.isFinite(baseline) ? `  (baseline ${(baseline * 100).toFixed(0)}%)` : '  (no baseline yet — reported, not judged)'}`);
console.log(`controls checked   : ${controlsSeen}${keyFile ? '' : '  (no --key given)'}`);
console.log('');

let fatal = false;

if (malformed.length) {
    fatal = true;
    console.log(`SCHEMA — ${malformed.length} malformed:`);
    malformed.slice(0, 12).forEach(m => console.log('  ' + m));
    if (malformed.length > 12) console.log(`  …and ${malformed.length - 12} more`);
    console.log('');
}

if (illegal.length) {
    fatal = true;
    console.log(`RULES — ${illegal.length} verdicts the reviewer was not permitted to give:`);
    illegal.slice(0, 12).forEach(m => console.log('  ' + m));
    if (illegal.length > 12) console.log(`  …and ${illegal.length - 12} more`);
    console.log('');
}

if (controlFailures.length) {
    fatal = true;
    console.log(`CONTROLS — ${controlFailures.length} of ${controlsSeen} wrong. DISCARD THE BATCH.`);
    controlFailures.forEach(m => console.log('  ' + m));
    console.log('');
    console.log('  A reviewer that missed a known answer has said nothing reliable');
    console.log('  about the unknown ones. Re-run cold; do not correct these.');
    console.log('');
} else if (!keyFile) {
    console.log('NO CONTROLS CHECKED. Pass --key; an unchecked batch is not a measured one.');
    console.log('');
}

if (!fatal && Number.isFinite(baseline) && rate > baseline * DRIFT_FACTOR) {
    fatal = true;
    console.log(`DRIFT — trim rate ${(rate * 100).toFixed(1)}% is more than ${DRIFT_FACTOR}× the baseline`);
    console.log(`  of ${(baseline * 100).toFixed(0)}%. A reviewer that has seen many running heads in a`);
    console.log('  row starts seeing them everywhere. Re-run cold before accepting it.');
    console.log('');
}

if (fatal) {
    console.log('BATCH REJECTED. Nothing applied.');
    process.exit(1);
}

console.log(`BATCH ACCEPTED for review — ${actionable.length} trims proposed.`);
console.log('Nothing has been applied. Applying is a separate act, dossier-recorded');
console.log('per ARCHIVE-CLEANSING-SPEC §5, and deliberately not reachable from here.');
