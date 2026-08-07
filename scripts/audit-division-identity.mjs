/**
 * Which divisions look least like the work that shelves them?
 *
 *   node scripts/audit-division-identity.mjs
 *   node scripts/audit-division-identity.mjs --floor 0.1
 *
 * Rung 2 of ARCHIVE-CLEANSING-SPEC §3: suspicions, not verdicts. Work-
 * level identity can pass while a foreign division is served. Across the
 * shelf, score distributions overlap (genuine low-signal chapters vs
 * intruders), so this ranks for a person — it is not a pass/fail gate.
 */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const WORKS_DIR = resolve('src/content/archive/works');
const LONG_ENOUGH = 8000;
const SIGNATURE = 40;

const STOPWORDS = new Set([
    'The', 'And', 'But', 'For', 'His', 'Her', 'They', 'That', 'This', 'With',
    'When', 'Then', 'There', 'These', 'Those', 'From', 'Into', 'Upon', 'What',
    'Who', 'Which', 'Now', 'Not', 'All', 'One', 'Two', 'It', 'He', 'She', 'You',
    'We', 'In', 'On', 'At', 'To', 'Of', 'As', 'By', 'So', 'If', 'Is', 'Was',
    'Chapter', 'Book', 'Part', 'Section', 'Volume', 'Page', 'Note', 'Project',
    'Gutenberg', 'English', 'London', 'New', 'York', 'Translated'
]);

/**
 * A work's signature: its commonest capitalised words, which in a
 * translated epic are its own names.
 *
 * A word must RECUR ACROSS DIVISIONS. Without that the measure defeats
 * itself — a foreign block large enough to matter is large enough to
 * push its own vocabulary into the signature, and then it passes by
 * being big. A work's names recur through it; an intruder's are confined
 * to it.
 */
function signatureOf(sections) {
    const counts = new Map(), divisions = new Map();
    for (const s of sections) {
        const here = new Set();
        for (const w of String(s.content || '').match(/\b[A-Z][a-z]{2,}\b/g) || []) {
            if (STOPWORDS.has(w)) continue;
            counts.set(w, (counts.get(w) || 0) + 1);
            here.add(w);
        }
        for (const w of here) divisions.set(w, (divisions.get(w) || 0) + 1);
    }
    const mustRecurIn = Math.max(2, Math.ceil(sections.length * 0.05));
    return [...counts.entries()]
        .filter(([w]) => (divisions.get(w) || 0) >= mustRecurIn)
        .sort((a, b) => b[1] - a[1]).slice(0, SIGNATURE).map(([w]) => w);
}

function density(content, signature) {
    const text = String(content || '');
    const words = text.split(/\s+/).filter(Boolean).length;
    if (!words) return 0;
    let hits = 0;
    for (const w of signature) {
        let i = text.indexOf(w);
        while (i !== -1) { hits++; i = text.indexOf(w, i + w.length); }
    }
    return hits / words * 10000;
}

const median = (list) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const args = process.argv.slice(2);
const fi = args.indexOf('--floor');
const FLOOR = fi >= 0 ? Number(args[fi + 1]) : 0.2;

const suspicions = [];
for (const file of readdirSync(WORKS_DIR).filter(n => n.endsWith('.js') && !n.includes('.test.'))) {
    const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
    const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
    if (!sections || sections.length < 2) continue;

    const signature = signatureOf(sections);
    if (signature.length < 10) continue;
    const long = sections.filter(s => String(s.content || '').length >= LONG_ENOUGH);
    if (long.length < 4) continue;

    const scored = long.map(s => ({ name: s.name, d: density(s.content, signature),
        opens: String(s.content).replace(/\s+/g, ' ').slice(0, 80) }));
    const norm = median(scored.map(s => s.d));
    if (!norm) continue;

    for (const s of scored) {
        if (s.d >= norm * FLOOR) continue;
        suspicions.push({ work: file.replace(/\.js$/, ''), ...s, norm, ratio: s.d / norm });
    }
}

suspicions.sort((a, b) => a.ratio - b.ratio);
console.log(`${suspicions.length} divisions below ${FLOOR * 100}% of their work's median density\n`);
for (const s of suspicions) {
    console.log(`${(s.ratio * 100).toFixed(1).padStart(5)}%  ${s.work} / ${s.name}`);
    console.log(`        ${s.d.toFixed(1)} per 10k vs median ${s.norm.toFixed(1)}`);
    console.log(`        ${JSON.stringify(s.opens)}`);
}
console.log('\nSUSPICIONS, NOT VERDICTS. An interpolated tale and a glossary belong');
console.log('here too. Read the top of the list; do not act on the length of it.');
