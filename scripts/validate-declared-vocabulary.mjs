/**
 * What honouring the curator's structure line actually buys.
 *
 *   node scripts/validate-declared-vocabulary.mjs
 *
 * For every dossier entry with a cached artifact, this finds the
 * headings the GLOBAL word list matches and those the work's own
 * declared vocabulary matches, and scores each by how much of it
 * ASCENDS — because a book's numbering counts up and a coincidence
 * does not.
 *
 * Scoring, rather than counting, is the whole point. The Kalevala's
 * curator declared "one runo"; its translator titled the divisions
 * RUNE. Searching for `runo` finds four stray mentions in the preface,
 * which passes any "at least three hits" test and would have cut a
 * fifty-runo epic into four pieces. Its ascending run is zero, and the
 * global list's is fifty.
 *
 * Reads only from .ingest-cache; writes nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDossier, parseLiteratureDossier } from './archive-dossier.mjs';
import { headingVocabulary } from '../src/content/archive/divisions.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'literature');

const GLOBAL_WORDS = [
    'VOLUME', 'VOL\\.?', 'PART', 'BOOK', 'CANTO', 'CHAPTER', 'ACT', 'SCENE',
    'DAY', 'NIGHT', 'TALE', 'STORY', 'ADVENTURE', 'RUNE', 'POEM', 'SECTION'
];
const pattern = (words) => new RegExp(
    `^(${words.join('|')})\\b[\\s.:—-]*(?:[IVXLCDM]+|\\d{1,4})\\b`, 'i');
const MATTER = /^(PREFACE|PROLOGUE|INTRODUCTION|EPILOGUE|APPENDIX|NOTES|GLOSSARY|INDEX)$/i;

// The ordinal FOLLOWS the division word. Unanchored, the "C" of CHAPTER
// is itself a Roman numeral and every heading scores 100.
const ORDINAL = /^[A-Za-z.']+\s+([IVXLCDM]+|\d{1,4})\b/i;

function unwrap(raw) {
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const start = lines.findIndex(l => /^\s*\*{3}\s*START OF/i.test(l));
    const end = lines.findIndex((l, i) =>
        i > Math.max(start, 0) && /^\s*\*{3}\s*END OF/i.test(l));
    return lines.slice(start >= 0 ? start + 1 : 0, end >= 0 ? end : lines.length);
}

function hitIndices(lines, re) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const v = lines[i].trim();
        if (!v || v.length > 100) continue;
        if (i > 0 && lines[i - 1].trim()) continue;
        if (re.test(v) || MATTER.test(v)) out.push(i);
    }
    return out;
}

function romanValue(text) {
    const V = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
    const s = text.toUpperCase();
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        total += (V[s[i + 1]] > V[s[i]] ? -V[s[i]] : V[s[i]]) || 0;
    }
    return total;
}

/** How many of these headings step up by exactly one from the last. */
function ascendingRun(lines, indices) {
    const ordinals = [];
    for (const i of indices) {
        const m = lines[i].trim().match(ORDINAL);
        if (!m) continue;
        const value = /^\d+$/.test(m[1]) ? Number(m[1]) : romanValue(m[1]);
        if (value > 0) ordinals.push(value);
    }
    let steps = 0;
    for (let i = 1; i < ordinals.length; i++) {
        if (ordinals[i] === ordinals[i - 1] + 1) steps++;
    }
    return steps;
}

const cached = readdirSync(CACHE);
const entries = assertDossier(parseLiteratureDossier());
const GLOBAL = pattern(GLOBAL_WORDS);

const rows = [];
for (const entry of entries) {
    const file = cached.find(f =>
        f.startsWith(`${entry.code.toLowerCase()}-1`) && /\.(txt|xml)$/.test(f));
    if (!file) continue;
    const lines = unwrap(readFileSync(resolve(CACHE, file), 'utf8'));
    const vocab = headingVocabulary(entry.structure);

    const gi = hitIndices(lines, GLOBAL);
    const di = vocab.length ? hitIndices(lines, pattern(vocab.map(w => w.toUpperCase()))) : [];
    const gs = ascendingRun(lines, gi);
    const ds = ascendingRun(lines, di);

    rows.push({
        title: entry.title, vocab,
        g: gi.length, gs, d: di.length, ds,
        used: ds > gs ? 'declared' : 'global'
    });
}

rows.sort((a, b) => (b.ds - b.gs) - (a.ds - a.gs));

console.log('  GLOBAL hits(run)   DECLARED hits(run)  USED      VOCAB       WORK');
for (const r of rows) {
    const mark = r.used === 'declared' ? ' *' : '  ';
    console.log(
        `${mark}${String(r.g).padStart(7)}(${String(r.gs).padStart(3)})  ` +
        `${String(r.d).padStart(11)}(${String(r.ds).padStart(3)})  ` +
        `${r.used.padEnd(9)} ${(r.vocab.join(',') || '—').slice(0, 11).padEnd(12)}${r.title.slice(0, 32)}`);
}

const declared = rows.filter(r => r.used === 'declared');
console.log(`\n  ${rows.length} works with a cached artifact`);
console.log(`  ${declared.length} score better on their DECLARED vocabulary`);
console.log(`  ${rows.length - declared.length} fall back to the global list`);
console.log(`  worst regression prevented: ${
    rows.filter(r => r.ds < r.gs).sort((a, b) => (a.ds - a.gs) - (b.ds - b.gs))[0]?.title || 'none'}`);
