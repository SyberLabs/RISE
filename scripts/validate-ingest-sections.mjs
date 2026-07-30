/**
 * Compare the OLD and NEW sectioning rules on real cached artifacts.
 *
 *   node scripts/validate-ingest-sections.mjs
 *
 * The ingest is a migration: running it rewrites every payload and every
 * checksum in the Archive. So the rule change is measured on the actual
 * source bytes BEFORE anything is regenerated, and the measurement is
 * the one that matters — how many section names are headings rather
 * than prose caught mid-sentence.
 *
 * Reads only from .ingest-cache; touches no output.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'literature');

// ── the two rules ────────────────────────────────────────────────
const OLD_RE = /^(VOLUME|VOL\.?|PART|BOOK|CANTO|CHAPTER|ACT|SCENE|DAY|NIGHT|TALE|STORY|ADVENTURE|RUNE|POEM|SECTION)\b[\s.:—-]*(?:[IVXLCDM\d]+|THE\s+\w+)?/i;
const NEW_RE = /^(VOLUME|VOL\.?|PART|BOOK|CANTO|CHAPTER|ACT|SCENE|DAY|NIGHT|TALE|STORY|ADVENTURE|RUNE|POEM|SECTION)\b[\s.:—-]*(?:[IVXLCDM]+|\d{1,4})\b/i;
const MATTER = /^(PREFACE|PROLOGUE|INTRODUCTION|EPILOGUE|APPENDIX|NOTES|GLOSSARY|INDEX)$/i;

const oldHeading = (line) => {
    const v = line.trim();
    if (!v || v.length > 100) return false;
    return OLD_RE.test(v) || MATTER.test(v);
};
const newHeading = (line, prev) => {
    const v = line.trim();
    if (!v || v.length > 100) return false;
    if (prev !== null && prev.trim()) return false;
    return NEW_RE.test(v) || MATTER.test(v);
};

function unwrap(raw) {
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const start = lines.findIndex(l => /^\s*\*{3}\s*START OF/i.test(l));
    const end = lines.findIndex((l, i) =>
        i > Math.max(start, 0) && /^\s*\*{3}\s*END OF/i.test(l));
    return lines.slice(start >= 0 ? start + 1 : 0, end >= 0 ? end : lines.length);
}

/** Does this name read like a heading, or like a sentence? */
const looksLikeProse = (name) =>
    name.length > 70 || /[,;]$/.test(name) || /^[a-z]/.test(name);

const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : readdirSync(CACHE).filter(f => f.endsWith('.txt')).sort().slice(0, 12);

console.log('  OLD hits  prose |  NEW hits  prose | artifact');
let oldTotal = 0, oldProse = 0, newTotal = 0, newProse = 0;

for (const file of files) {
    const path = resolve(CACHE, file);
    if (!existsSync(path)) { console.log(`  (missing) ${file}`); continue; }
    const lines = unwrap(readFileSync(path, 'utf8'));

    const oldNames = [];
    const newNames = [];
    for (let i = 0; i < lines.length; i++) {
        if (oldHeading(lines[i])) oldNames.push(lines[i].trim());
        if (newHeading(lines[i], i > 0 ? lines[i - 1] : null)) newNames.push(lines[i].trim());
    }
    const op = oldNames.filter(looksLikeProse).length;
    const np = newNames.filter(looksLikeProse).length;
    oldTotal += oldNames.length; oldProse += op;
    newTotal += newNames.length; newProse += np;

    console.log(
        `  ${String(oldNames.length).padStart(8)} ${String(op).padStart(6)} | ` +
        `${String(newNames.length).padStart(8)} ${String(np).padStart(6)} | ${file}`);
    if (np) console.log(`      still prose: ${newNames.filter(looksLikeProse).slice(0, 2).map(n => JSON.stringify(n.slice(0, 60))).join(', ')}`);
}

const pct = (a, b) => b ? `${Math.round(a / b * 100)}%` : '—';
console.log(`\n  OLD  ${oldTotal} sections, ${oldProse} named after prose (${pct(oldProse, oldTotal)})`);
console.log(`  NEW  ${newTotal} sections, ${newProse} named after prose (${pct(newProse, newTotal)})`);
