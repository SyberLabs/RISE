/**
 * Text quality audit — what did we actually shelve?
 *
 * Prompted by Hamlet, which is not a text of Hamlet. It is the
 * Cambridge variorum, and the OCR folded its critical apparatus into
 * the play:
 *
 *     140. at] Ff. om. Qq.
 *     63. smote] smot Q2Q3FIF2F3.
 *
 * That is scholarship about the text, printed under the text's name. A
 * reader who opens it gets pages of sigla before a line of verse, and
 * every ingest check we have — checksums, division detection, word
 * counts — passed it, because all of them ask whether the bytes are
 * stable and none asks whether they are the work.
 *
 * The signals live in `src/core/archive-text-inspect.js` so agent
 * acquisition cannot invent a faster path around the same questions.
 *
 * Reproduce with `npm run audit:text`.
 */

import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import {
    ARCHIVE_TEXT_REFUSE_SCORE,
    ARCHIVE_TEXT_SAMPLE_CHARS,
    ARCHIVE_TEXT_WATCH_SCORE,
    inspectArchiveText
} from '../src/core/archive-text-inspect.js';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';
// A Node process has no origin, so `/content/...` is not a URL it can fetch.
// Installed at the entry rather than inside the store: the store fetches a URL
// and checks the bytes against the digest that URL names, and teaching it about
// a filesystem would give the corpus a second code path where the point of this
// seam is that there is one. `_fetch` is read at call time, so installing after
// ESM has hoisted every import is in time — provided no import did the reading
// itself. See release-voice-evidence.mjs for the one that did.
installContentPlaneFetch();

const works = ingestedArchiveTexts();
const rows = [];

for (const work of works) {
    let text = '';
    try {
        const divisions = await work.getDivisions();
        const entries = divisions?.entries || [];
        // Skip entry 0 where possible: it is usually front matter, and
        // front matter is noisy in every edition. The question is
        // whether the BODY is corrupt.
        const body = entries.length > 1 ? entries.slice(1) : entries;
        text = body.map(e => e.content || '').join('\n\n').slice(0, ARCHIVE_TEXT_SAMPLE_CHARS);
    } catch (error) {
        rows.push({ id: work.id, error: error?.message || 'unreadable' });
        continue;
    }
    if (!text.trim()) { rows.push({ id: work.id, error: 'empty' }); continue; }

    const report = inspectArchiveText(text, { sampleChars: ARCHIVE_TEXT_SAMPLE_CHARS });
    rows.push({
        id: work.id,
        title: work.title,
        apparatus: report.apparatus,
        gibberish: report.gibberish,
        furniture: report.furniture,
        symbols: report.symbols,
        score: report.score
    });
}

rows.sort((a, b) => (b.score || 0) - (a.score || 0));

const pc = n => `${(n * 100).toFixed(1)}%`;
console.log('\n  score  apparat  gibber  furnit  symbol   work');
console.log('  ' + '─'.repeat(74));
for (const r of rows) {
    if (r.error) { console.log(`  ERROR  ${''.padEnd(30)} ${r.id} — ${r.error}`); continue; }
    const flag = r.score > ARCHIVE_TEXT_REFUSE_SCORE ? '!!'
        : r.score > ARCHIVE_TEXT_WATCH_SCORE ? ' !' : '  ';
    console.log(`${flag}${r.score.toFixed(1).padStart(6)}  ${pc(r.apparatus).padStart(7)} `
        + `${pc(r.gibberish).padStart(7)} ${pc(r.furniture).padStart(7)} ${pc(r.symbols).padStart(7)}   `
        + `${r.id}`);
}

const bad = rows.filter(r => !r.error && r.score > ARCHIVE_TEXT_REFUSE_SCORE);
const watch = rows.filter(r => !r.error && r.score > ARCHIVE_TEXT_WATCH_SCORE
    && r.score <= ARCHIVE_TEXT_REFUSE_SCORE);
console.log(`\n  ${bad.length} works score above ${ARCHIVE_TEXT_REFUSE_SCORE} (likely wrong edition or bad scan)`);
console.log(`  ${watch.length} more between ${ARCHIVE_TEXT_WATCH_SCORE} and ${ARCHIVE_TEXT_REFUSE_SCORE} (worth a human look)`);
console.log(`  ${rows.length - bad.length - watch.length} appear clean\n`);
