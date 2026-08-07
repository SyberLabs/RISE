/**
 * Apply accepted reviewer verdicts to the payloads.
 *
 *   node scripts/corpus-review-apply.mjs jobs.json verdicts.json        # report
 *   node scripts/corpus-review-apply.mjs jobs.json verdicts.json --apply
 *
 * Refuses to start unless every verdict passes `corpus-review-verdicts.mjs`
 * (schema, disposition rules, controls). Applying is a separate act from
 * judging and must not be reachable by accident.
 *
 * Offsets go stale: a job records where its passage sat when the batch
 * was built. If the payload has changed since, those offsets point at
 * different characters. Every span is checked against its recorded text
 * before it is touched; a work with even one mismatch is skipped whole.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { rewriteSections } from '../src/content/archive/payload-writer.js';
import { keepIdentity } from '../src/content/archive/keep-identity.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const WORKS_DIR = resolve('src/content/archive/works');
const LOG = resolve('src/content/archive/cleanse-log.json');
/**
 * Keep decisions for passages the detector cannot settle. Without this
 * record, a "keep" returns in every later batch.
 */
const KEEPS = resolve('src/content/archive/cleanse-keeps.json');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const files = args.filter(a => !a.startsWith('--'));
const [jobsFile, verdictsFile] = files;

if (!jobsFile || !verdictsFile) {
    console.error('usage: node scripts/corpus-review-apply.mjs <jobs.json> <verdicts.json> [--apply]');
    process.exit(1);
}

// ── Gate 1: the batch must have passed validation ───────────────────
const keyFile = jobsFile.replace(/\.json$/, '') + '.key.json';
try {
    execFileSync(process.execPath,
        ['scripts/corpus-review-verdicts.mjs', verdictsFile,
         '--key', keyFile, '--jobs', jobsFile],
        { stdio: 'pipe' });
} catch (err) {
    console.error('The batch does not pass validation. Nothing applied.\n');
    console.error(String(err.stdout || err.message));
    process.exit(1);
}
console.log('validation passed\n');

const jobs = JSON.parse(readFileSync(resolve(jobsFile), 'utf8'));
const verdicts = JSON.parse(readFileSync(resolve(verdictsFile), 'utf8'));

/** Pair each verdict with the job it answers, by locator. */
// Matching key includes section index: division names are not unique
// within a work, so name+offset alone can collide across sections.
const keyOf = (j) => [j.workId, j.locator?.section, j.locator?.division,
    j.locator?.charStart, j.locator?.charEnd].join('|');
const byKey = new Map(jobs.map(j => [keyOf(j), j]));

const accepted = [];
const kept = [];
let unmatched = 0;
for (const v of verdicts) {
    if (v.disposition === 'keep' && !v.locator?.control) {
        const job = byKey.get(keyOf(v));
        if (job) kept.push({
            id: keepIdentity(job),
            workId: job.workId, section: job.locator?.section ?? null,
            passage: String(job.passage).replace(/\s+/g, ' ').trim(),
            verdict: v.verdict, note: v.note, when: new Date().toISOString().slice(0, 10)
        });
        continue;
    }
    if (v.disposition !== 'trim') continue;
    if (v.locator?.control) continue;          // controls are never applied
    const job = byKey.get(keyOf(v));
    if (!job) { unmatched++; continue; }
    accepted.push({ job, verdict: v });
}

console.log(`verdicts        : ${verdicts.length}`);
console.log(`trims accepted  : ${accepted.length}`);
console.log(`keeps recorded  : ${kept.length}`);
if (unmatched) console.log(`unmatched       : ${unmatched}  (verdict with no job — ignored)`);

// ── Group by work, latest offset first ──────────────────────────────
const byWork = new Map();
for (const a of accepted) {
    if (!byWork.has(a.job.workId)) byWork.set(a.job.workId, []);
    byWork.get(a.job.workId).push(a);
}

const log = [];
let applied = 0, skippedWorks = 0;

for (const [workId, items] of byWork) {
    const path = resolve(WORKS_DIR, `${workId}.js`);
    const mod = await import(pathToFileURL(path).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    if (!sections) { console.log(`SKIPPED ${workId}: no sections`); skippedWorks++; continue; }

    // Work within each division, deleting from the end so earlier
    // offsets stay valid.
    const cleaned = sections.map(s => ({ ...s }));
    const byDivision = new Map();
    for (const it of items) {
        // Keyed by section index; division names are not unique within a work.
        const d = it.job.locator.section ?? it.job.locator.division;
        if (!byDivision.has(d)) byDivision.set(d, []);
        byDivision.get(d).push(it);
    }

    let stale = null;
    const removals = [];

    for (const [division, list] of byDivision) {
        const section = typeof division === 'number'
            ? cleaned[division]
            : cleaned.find(s => (s.name || null) === division);
        if (!section) { stale = `section ${JSON.stringify(division)} not found`; break; }

        list.sort((a, b) => b.job.locator.charStart - a.job.locator.charStart);
        for (const { job } of list) {
            const { charStart, charEnd, rejoin } = job.locator;
            const span = String(section.content).slice(charStart, charEnd);
            // Stale-offset gate: current text must match the job's recorded passage.
            const here = span.replace(/\s+/g, ' ').trim();
            const said = String(job.passage).replace(/\s+/g, ' ').trim();
            if (here !== said) {
                stale = `offset ${charStart} holds ${JSON.stringify(here.slice(0, 50))}, `
                    + `job recorded ${JSON.stringify(said.slice(0, 50))}`;
                break;
            }
            section.content = section.content.slice(0, charStart)
                + (rejoin ?? '\n\n') + section.content.slice(charEnd);
            removals.push({ kind: 'running-head', division, removed: said, at: charStart,
                rejoined: (rejoin ?? '\n\n') === ' ' ? 'sentence' : 'paragraph' });
        }
        if (stale) break;
    }

    if (stale) {
        console.log(`SKIPPED ${workId}: ${stale}`);
        console.log('        The payload changed since this batch was built. Rebuild the jobs.');
        skippedWorks++;
        continue;
    }

    console.log(`${workId}: ${removals.length} trims`);
    applied += removals.length;
    log.push({ workId, when: new Date().toISOString().slice(0, 10),
        class: 'running-head', basis: 'ARCHIVE-CLEANSING-SPEC §4 reviewer verdict',
        reviewer: 'see batch', count: removals.length, removals });

    if (!apply) continue;

    const written = rewriteSections(path, cleaned);
    if (!written.ok) console.log(`  ! ${workId}: ${written.reason}; not written`);
}

console.log('');
console.log(`works skipped   : ${skippedWorks}`);
console.log(`trims applied   : ${applied}`);

if (apply && kept.length) {
    let previous = [];
    try { previous = JSON.parse(readFileSync(KEEPS, 'utf8')); } catch { /* first */ }
    const seen = new Set(previous.map(k => k.id));
    const fresh = kept.filter(k => !seen.has(k.id));
    writeFileSync(KEEPS, JSON.stringify(previous.concat(fresh), null, 2), 'utf8');
    console.log(`${fresh.length} keeps recorded in ${KEEPS}`);
}

if (apply && log.length) {
    let previous = [];
    try { previous = JSON.parse(readFileSync(LOG, 'utf8')); } catch { /* first */ }
    writeFileSync(LOG, JSON.stringify(previous.concat(log), null, 2), 'utf8');
    console.log(`recorded in ${LOG}`);
} else if (!apply) {
    console.log('\nREPORT ONLY. Nothing written. Re-run with --apply.');
}
