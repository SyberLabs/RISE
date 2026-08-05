/**
 * Withdraw divisions that are not the work they are shelved under.
 *
 *   node scripts/withdraw-foreign-divisions.mjs            # report
 *   node scripts/withdraw-foreign-divisions.mjs --apply
 *
 * ARCHIVE-CLEANSING-SPEC §1b. The Mahabharata's last five "volumes" are
 * the New York Times Current History of the European War (1915): the
 * ingest declared nine Gutenberg artifacts #15474–#15482 as "Ganguli
 * volume N" and assumed a contiguous identifier range. Ganguli occupies
 * #15474–#15477.
 *
 * THIS IS A DIFFERENT ACT FROM TRIMMING FURNITURE, and the difference is
 * worth stating. Furniture is removed from inside a reading; this removes
 * whole readings, and it changes what the work IS. So the provenance is
 * edited in the same breath: the artifact list loses the records that
 * were never this work, the rights evidence stops claiming nine, and the
 * edition statement says what is actually shelved. A payload trimmed
 * without its dossier following is a book presented under a name that no
 * longer describes it — the Hamlet failure from the other direction.
 *
 * THE EVIDENCE IS CHECKED BEFORE THE CUT, not asserted. A division is
 * only withdrawn if it is DEVOID of the work's own vocabulary while the
 * work is dense in it. If any candidate fails that test, nothing is
 * written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const LOG = resolve('src/content/archive/cleanse-log.json');

/**
 * One case, stated explicitly rather than discovered by a rule. A tool
 * that hunts for foreign divisions across the shelf would be guessing;
 * this withdraws a thing that has been measured.
 */
const CASES = [{
    workId: 'the-mahabharata-of-krishna-dwaipayana-vyasa',
    // Divisions to withdraw, by the prefix the ingest gave them.
    withdraw: /^Volume [56789]\b/,
    // The work's own vocabulary. A division of the Mahabharata that
    // contains none of these across a hundred thousand words is not a
    // division of the Mahabharata.
    vocabulary: /\b(Bharata|Kuru|Pandava|Arjuna|Krishna|Yudhishthira|Parva|Rishi|Brahmana)\b/g,
    // Gutenberg records that are not this work.
    artifacts: [15478, 15479, 15480, 15481, 15482],
    reason: 'Project Gutenberg #15478–#15482 are not Ganguli\'s Mahabharata. '
        + 'They carry the New York Times Current History of the European War (1915). '
        + 'The ingest assumed a contiguous identifier range; Ganguli occupies #15474–#15477.',
    edition: 'trans. Kisari Mohan Ganguli, 1883–96 (Gutenberg volumes 1–4; the remaining volumes await re-sourcing)',
    evidence: 'trans. Kisari Mohan Ganguli, 1883–96. Four Gutenberg records (#15474–#15477) '
        + 'identify Ganguli\'s prose translation; the title pages and translator\'s preface name him. '
        + 'Five further records were withdrawn 2026-08-05 as a different work — see source.withdrawn.'
}];

const apply = process.argv.includes('--apply');
const log = [];

for (const c of CASES) {
    const path = resolve('src/content/archive/works', `${c.workId}.js`);
    const mod = await import(pathToFileURL(path).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    const metaKey = Object.keys(mod).find(k => k.endsWith('_META'));

    const doomed = sections.filter(s => c.withdraw.test(String(s.name || '')));
    const kept = sections.filter(s => !c.withdraw.test(String(s.name || '')));

    const words = (list) => list.reduce(
        (n, s) => n + String(s.content || '').split(/\s+/).filter(Boolean).length, 0);
    const hits = (list) => list.reduce(
        (n, s) => n + (String(s.content || '').match(c.vocabulary) || []).length, 0);

    const doomedHits = hits(doomed), keptHits = hits(kept);
    const doomedWords = words(doomed), keptWords = words(kept);

    console.log(`${c.workId}`);
    console.log(`  keeping    ${String(kept.length).padStart(5)} sections  ${String(keptWords).padStart(9)} words  ${keptHits} of its own vocabulary`);
    console.log(`  withdrawing${String(doomed.length).padStart(5)} sections  ${String(doomedWords).padStart(9)} words  ${doomedHits} of its own vocabulary`);

    // THE GATE. Withdraw only what is devoid of the work while the work
    // is dense in it. Anything else is a judgement, not a measurement.
    if (!doomed.length) { console.log('  nothing to withdraw'); continue; }
    if (doomedHits !== 0) {
        console.log(`  REFUSED: a doomed division carries ${doomedHits} of the work's own words.`);
        continue;
    }
    if (keptHits < 1000) {
        console.log('  REFUSED: the remainder is not dense enough in its own vocabulary to judge by.');
        continue;
    }

    log.push({
        workId: c.workId, when: new Date().toISOString().slice(0, 10),
        class: 'wrong-work', basis: 'ARCHIVE-CLEANSING-SPEC §1b',
        disposition: 'withdraw-divisions',
        sections: doomed.length, words: doomedWords,
        reason: c.reason,
        withdrawn: doomed.map(s => s.name),
        note: 'source.sha256 still digests the original nine-artifact fetch and is '
            + 'kept as the record of what was ingested. Re-source is queued.'
    });

    if (!apply) continue;

    let src = readFileSync(path, 'utf8');

    // 1 — the sections.
    const marker = src.match(/export const [A-Z0-9_]+_SECTIONS = \[/);
    const start = marker.index + marker[0].length - 1;
    const end = src.indexOf('\n];', start);
    src = src.slice(0, start) + JSON.stringify(kept, null, 4) + src.slice(end + 3);

    // 2 — the provenance must follow the payload.
    const meta = structuredClone(mod[metaKey]);
    const gone = meta.source.artifacts.filter(a => c.artifacts.some(id => String(a.canonicalUrl || '').endsWith(String(id))));
    meta.source.artifacts = meta.source.artifacts.filter(a => !gone.includes(a));
    meta.source.withdrawn = gone.map(a => ({ ...a, withdrawnOn: '2026-08-05', reason: c.reason }));
    meta.edition = { ...meta.edition, statement: c.edition };
    meta.rights = { ...meta.rights, evidence: c.evidence };

    const mIndex = src.lastIndexOf(`export const ${metaKey} = Object.freeze(`);
    const mStart = src.indexOf('{', mIndex);
    const mEnd = src.lastIndexOf('});');
    src = src.slice(0, mStart) + JSON.stringify(meta, null, 4) + src.slice(mEnd + 1);

    writeFileSync(path, src, 'utf8');
    console.log(`  written — ${gone.length} artifacts withdrawn, edition and evidence corrected`);
}

if (apply && log.length) {
    let previous = [];
    try { previous = JSON.parse(readFileSync(LOG, 'utf8')); } catch { /* first */ }
    writeFileSync(LOG, JSON.stringify(previous.concat(log), null, 2), 'utf8');
    console.log(`\nrecorded in ${LOG}`);
} else if (!apply) {
    console.log('\nREPORT ONLY. Nothing written. Re-run with --apply.');
}
