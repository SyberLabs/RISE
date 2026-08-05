/**
 * Three defect classes, surveyed exhaustively before anything is decided.
 *
 *   node scripts/audit-text-artifacts.mjs
 *   node scripts/audit-text-artifacts.mjs --class brackets --samples 30
 *
 * Asked for by Mateo, 2026-08-05: shouted words, punctuation in series,
 * and brackets. Each is reported with its SHAPE broken out, because the
 * disposition differs inside a class far more than between them —
 * "[Greek: taxis]" is a transcriber's note, "[Pg 41]" is page furniture,
 * and "[Illustration]" marks something the edition genuinely had.
 *
 * This measures. It changes nothing. Every time this pass has acted on a
 * class before counting it, the count has turned out to contain the
 * work's own structure.
 */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const WORKS_DIR = resolve('src/content/archive/works');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const only = flag('class');
const SAMPLES = Number(flag('samples', '8'));

/** A bucket of findings that keeps a few examples and counts the rest. */
class Bucket {
    constructor(label) { this.label = label; this.count = 0; this.works = new Set(); this.samples = []; }
    add(work, sample) {
        this.count++; this.works.add(work);
        if (this.samples.length < SAMPLES) this.samples.push(`${work}: ${sample}`);
    }
}
const buckets = new Map();
const bucket = (key, label) => {
    if (!buckets.has(key)) buckets.set(key, new Bucket(label));
    return buckets.get(key);
};

// ── The classes ─────────────────────────────────────────────────────

/** Shouted words INSIDE a sentence — not a heading standing alone. */
function shouted(work, line, prev, next) {
    const t = line.trim();
    if (!t || t.length > 200) return;
    // A line that is entirely capitals is a heading candidate, and the
    // compositor already judges those (canon R11). What is asked about
    // here is capitals embedded in running prose.
    if (!/[a-z]/.test(t)) return;
    for (const m of t.matchAll(/\b([A-Z]{2,}(?:[ '’-][A-Z]{2,})*)\b/g)) {
        const word = m[1];
        // Roman numerals and single initials are not shouting.
        if (/^[IVXLCDM]+$/.test(word)) continue;
        if (word.length < 3) continue;
        const key = word.length >= 12 ? 'shout-long' : 'shout-short';
        bucket(key, word.length >= 12
            ? 'ALL-CAPS run of 12+ characters inside prose'
            : 'ALL-CAPS word inside prose')
            .add(work, JSON.stringify(t.slice(Math.max(0, m.index - 40), m.index + word.length + 40)));
    }
}

/** Punctuation in series. */
function punctuationRuns(work, line) {
    const t = line;
    // Ellipses and spaced ellipses are legitimate typography; a run of
    // MIXED or repeated non-period marks is not.
    for (const m of t.matchAll(/([!?;:,])\1{1,}/g)) {
        bucket('punct-repeat', 'the same mark repeated (;; ,, ?? ::)')
            .add(work, JSON.stringify(t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)));
    }
    for (const m of t.matchAll(/[;:,!?]{2,}[.]{2,}|[.]{2,}[;:,!?]{2,}/g)) {
        bucket('punct-mixed', 'mixed run, e.g. ";;;...."')
            .add(work, JSON.stringify(t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)));
    }
    for (const m of t.matchAll(/[.]{4,}/g)) {
        bucket('punct-leaders', 'four or more periods — usually contents dot leaders')
            .add(work, JSON.stringify(t.trim().slice(0, 90)));
    }
}

/** Bracketed material, split by what the bracket actually holds. */
function brackets(work, line) {
    const t = line;
    for (const m of t.matchAll(/\[([^\]]{0,120})\]/g)) {
        const inside = m[1].trim();
        let key = 'bracket-other', label = 'bracketed, unclassified';
        if (/^Pg[ .]?\d+$/i.test(inside)) { key = 'bracket-page'; label = '[Pg 41] — page marker'; }
        else if (/^(Greek|Hebrew|Sanskrit|Arabic|Latin|Transliteration)\s*:/i.test(inside)) {
            key = 'bracket-script'; label = '[Greek: taxis] — transcriber\'s script note';
        } else if (/^Illustration/i.test(inside)) { key = 'bracket-illustration'; label = '[Illustration] — the edition had a plate'; }
        else if (/^Footnote/i.test(inside)) { key = 'bracket-footnote'; label = '[Footnote: …]'; }
        else if (/^\d{1,4}$/.test(inside)) { key = 'bracket-number'; label = '[41] — bare number'; }
        else if (/^Sidenote/i.test(inside)) { key = 'bracket-sidenote'; label = '[Sidenote: …] — marginal gloss'; }
        bucket(key, label).add(work, JSON.stringify(t.trim().slice(0, 100)));
    }
    // An unbalanced closing bracket — the ATHENS] shape.
    const opens = (t.match(/\[/g) || []).length;
    const closes = (t.match(/\]/g) || []).length;
    if (closes > opens) {
        bucket('bracket-orphan', 'unbalanced ] — the ATHENS] shape')
            .add(work, JSON.stringify(t.trim().slice(0, 100)));
    }
}

// ── The sweep ───────────────────────────────────────────────────────

const files = readdirSync(WORKS_DIR).filter(n => n.endsWith('.js') && !n.includes('.test.'));
let lines = 0;

for (const file of files) {
    const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    if (!sections) continue;
    const work = file.replace(/\.js$/, '');

    for (const section of sections) {
        const all = String(section.content || '').split('\n');
        for (let i = 0; i < all.length; i++) {
            lines++;
            const line = all[i];
            if (!line.trim()) continue;
            if (!only || only === 'caps') shouted(work, line, all[i - 1], all[i + 1]);
            if (!only || only === 'punct') punctuationRuns(work, line);
            if (!only || only === 'brackets') brackets(work, line);
        }
    }
}

console.log(`${lines.toLocaleString()} lines across ${files.length} works\n`);
const rows = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [key, b] of rows) {
    console.log(`${String(b.count).padStart(7)}  ${String(b.works.size).padStart(3)} works  ${key}`);
    console.log(`          ${b.label}`);
    for (const s of b.samples) console.log(`          · ${s}`);
    console.log('');
}
console.log('MEASUREMENT ONLY. Nothing written.');
