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
 * This asks. Four signals, all cheap, none conclusive alone:
 *
 *   APPARATUS  lines shaped like a variorum note — `lemma] variant`,
 *              sigla (Qq, Ff, F2), `conj.`, editor names. This is the
 *              strongest signal and the one that found Hamlet.
 *   GIBBERISH  tokens no English word could be: vowelless runs, digits
 *              welded to letters, stray punctuation islands. Straight
 *              OCR failure.
 *   FURNITURE  running heads and page numbers left in the body —
 *              `8 HAMLET. [act i.`, `VOL. VIII.`, bare folio numbers.
 *   SYMBOLS    non-alphabetic density, which rises with both.
 *
 * Reproduce with `npm run audit:text`.
 */

import { ingestedArchiveTexts } from '../src/content/archive/index.js';

/** Sampled, not exhaustive: 16M words is not the question being asked. */
const SAMPLE_CHARS = 240_000;

/**
 * A critical-apparatus line. The `]` lemma bracket is the giveaway —
 * it is how every variorum prints a reading, and it is vanishingly rare
 * in prose or verse.
 */
const APPARATUS = [
    // "140. at] Ff. om. Qq." — the lemma bracket must arrive EARLY.
    // Without that bound this matched Vitruvius, whose numbered
    // paragraphs happen to contain a bracketed insertion further along:
    // a false positive that would have sent someone to re-source a
    // perfectly good translation.
    /^\s*\d+[.,]\s*\d*[.,]?\s*[^\]]{0,28}\]/,
    /\b(?:Qq|Ff|Q[1-8]|F[1-4])\b/,            // quarto/folio sigla
    /\bconj\./,                                // "Bailey conj."
    /\b(?:om\.|edd\.|ed\.)\s/i,               // "om. Pope."
    /\b(?:Capell|Malone|Theobald|Steevens|Warburton|Hanmer|Rowe|Dyce|Collier)\b/
];

/** Publisher furniture that belongs to the page, not the work. */
const FURNITURE = [
    /^\s*\d{1,4}\s+[A-Z][A-Z' .]{3,}\s*[.[]/,  // "8 HAMLET. [act i."
    /^\s*[A-Z][A-Z' .]{3,}\.\s*\d{1,4}\s*$/,   // "HAMLET. 11"
    /^\s*VOL\.\s*[IVXL]+/i,
    /^\s*\d{1,4}\s*$/,                          // a bare folio number
    /^\s*[A-Z]\s*\d?\s*$/                       // signature marks: "B", "B 2"
];

const WORD = /[A-Za-z][A-Za-z'’-]*/g;

function gibberishRate(text) {
    const tokens = text.match(WORD) || [];
    if (!tokens.length) return 1;
    let bad = 0;
    for (const token of tokens) {
        const lower = token.toLowerCase();
        if (lower.length > 3 && !/[aeiouy]/.test(lower)) { bad += 1; continue; }
        // Case shredded mid-word — "QqFf", "F3F4" survive the sigla test
        // above, but "sonice" or "th'^e" style damage shows here.
        if (/[a-z][A-Z]{2,}/.test(token)) { bad += 1; continue; }
        if (token.length === 1 && !/[aAiIoO]/.test(token)) { bad += 1; }
    }
    return bad / tokens.length;
}

function lineRates(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { apparatus: 0, furniture: 0, lines: 0 };
    let apparatus = 0;
    let furniture = 0;
    for (const line of lines) {
        if (APPARATUS.some(re => re.test(line))) apparatus += 1;
        else if (FURNITURE.some(re => re.test(line))) furniture += 1;
    }
    return { apparatus: apparatus / lines.length, furniture: furniture / lines.length, lines: lines.length };
}

function symbolRate(text) {
    const total = text.length || 1;
    const odd = (text.match(/[^\w\s.,;:!?'"()\[\]—–\-’‘“”]/g) || []).length;
    return odd / total;
}

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
        text = body.map(e => e.content || '').join('\n\n').slice(0, SAMPLE_CHARS);
    } catch (error) {
        rows.push({ id: work.id, error: error?.message || 'unreadable' });
        continue;
    }
    if (!text.trim()) { rows.push({ id: work.id, error: 'empty' }); continue; }

    const { apparatus, furniture } = lineRates(text);
    const gibberish = gibberishRate(text);
    const symbols = symbolRate(text);
    // Weighted so apparatus dominates: a variorum is a different EDITION
    // problem, where gibberish is a scan-quality problem. Both matter,
    // but they have different remedies.
    const score = apparatus * 100 + gibberish * 60 + furniture * 30 + symbols * 40;
    rows.push({ id: work.id, title: work.title, apparatus, gibberish, furniture, symbols, score });
}

rows.sort((a, b) => (b.score || 0) - (a.score || 0));

const pc = n => `${(n * 100).toFixed(1)}%`;
console.log('\n  score  apparat  gibber  furnit  symbol   work');
console.log('  ' + '─'.repeat(74));
for (const r of rows) {
    if (r.error) { console.log(`  ERROR  ${''.padEnd(30)} ${r.id} — ${r.error}`); continue; }
    const flag = r.score > 12 ? '!!' : r.score > 6 ? ' !' : '  ';
    console.log(`${flag}${r.score.toFixed(1).padStart(6)}  ${pc(r.apparatus).padStart(7)} `
        + `${pc(r.gibberish).padStart(7)} ${pc(r.furniture).padStart(7)} ${pc(r.symbols).padStart(7)}   `
        + `${r.id}`);
}

const bad = rows.filter(r => !r.error && r.score > 12);
const watch = rows.filter(r => !r.error && r.score > 6 && r.score <= 12);
console.log(`\n  ${bad.length} works score above 12 (likely wrong edition or bad scan)`);
console.log(`  ${watch.length} more between 6 and 12 (worth a human look)`);
console.log(`  ${rows.length - bad.length - watch.length} appear clean\n`);
