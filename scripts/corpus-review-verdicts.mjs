/**
 * Check a batch of reviewer verdicts before anything is applied.
 *
 *   node scripts/corpus-review-verdicts.mjs verdicts.json --key jobs.key.json
 *
 * Validates every verdict against the schema and disposition rules in
 * CORPUS-REVIEWER-PROMPT.md §2, scores hidden controls, and reports trim
 * rate against an optional baseline. Applies nothing — applying is a
 * separate act with a dossier record (ARCHIVE-CLEANSING-SPEC §5).
 *
 * A batch fails whole: if a control is wrong, discard rather than patch.
 * A reviewer that missed a known answer has said nothing reliable about
 * the unknowns.
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
 * Drift is measured against a baseline you supply; there is no default.
 *
 * §2b's ~16% is over all candidates (including positionally proven
 * heads). Reviewer jobs are only the unsettled remainder, whose trim
 * rate is unknown and higher. Until enough batches earn a real baseline,
 * this reports the rate and rejects nothing on it. Pass `--baseline <0-1>`
 * once that number is known.
 */
const DRIFT_FACTOR = 1.6;

/** Disposition rules restated as a check. */
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
const jobsIndex = args.indexOf('--jobs');
const jobsFile = jobsIndex >= 0 ? args[jobsIndex + 1] : null;
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

    // A note that describes an action rather than an identity means the
    // reviewer has started editing.
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

// ── Controls and batch shape ─────────────────────────────────────────
//
// Every job gets exactly one verdict; every verdict answers a known job;
// every control is present exactly once and must match on both verdict
// and disposition. Omitting controls or scoring disposition alone would
// let a batch pass without a real check.
const controlFailures = [];
const shape = [];
let controlsSeen = 0;

const locatorKey = (o) => [o?.workId, o?.locator?.section, o?.locator?.division,
    o?.locator?.charStart, o?.locator?.charEnd, o?.locator?.control].join('|');

if (jobsFile) {
    const jobs = JSON.parse(readFileSync(resolve(jobsFile), 'utf8'));
    const jobKeys = new Map();
    for (const j of jobs) jobKeys.set(locatorKey(j), (jobKeys.get(locatorKey(j)) || 0) + 1);

    const answered = new Map();
    for (const v of verdicts) answered.set(locatorKey(v), (answered.get(locatorKey(v)) || 0) + 1);

    for (const [k, n] of answered) {
        if (!jobKeys.has(k)) shape.push(`a verdict answers no job in this batch: ${k}`);
        else if (n > 1) shape.push(`${n} verdicts for one job: ${k}`);
    }
    for (const [k] of jobKeys) {
        if (!answered.has(k)) shape.push(`no verdict for job: ${k}`);
    }
} else {
    shape.push('no --jobs given; the batch shape was not checked at all');
}

if (keyFile) {
    const key = JSON.parse(readFileSync(resolve(keyFile), 'utf8'));
    const byId = new Map(key.map(k => [k.id, k]));
    const seenIds = new Map();
    for (const v of verdicts) {
        const id = v?.locator?.control;
        if (!id) continue;
        seenIds.set(id, (seenIds.get(id) || 0) + 1);
        if (!byId.has(id)) { controlFailures.push(`${id}: not a control in this key`); continue; }
        controlsSeen++;
        const want = byId.get(id);
        if (v.disposition !== want.disposition || v.verdict !== want.verdict) {
            controlFailures.push(
                `${id}: expected ${want.verdict}/${want.disposition}, got ${v.verdict}/${v.disposition} — "${v.note}"`);
        }
    }
    // Every control must be answered exactly once.
    for (const k of key) {
        const n = seenIds.get(k.id) || 0;
        if (n === 0) controlFailures.push(`${k.id}: control omitted from the verdict file`);
        else if (n > 1) controlFailures.push(`${k.id}: control answered ${n} times`);
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

if (shape.length) {
    fatal = true;
    console.log(`SHAPE — ${shape.length} problems with the batch itself:`);
    shape.slice(0, 10).forEach(m => console.log('  ' + m));
    if (shape.length > 10) console.log(`  …and ${shape.length - 10} more`);
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
