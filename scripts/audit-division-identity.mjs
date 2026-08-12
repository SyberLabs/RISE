/**
 * Per-division identity — ARCHIVE-CLEANSING-SPEC §1b, rung 2.
 *
 * `identity.test.js` asks whether a WORK names itself in its own pages, and a
 * reading is served at the DIVISION. The Mahabharata passed its identity test
 * seventeen thousand times while five of its volumes were a 1915 war
 * periodical. This asks the question at the level the reading is served:
 *
 *   > No division may be devoid of the vocabulary its own work is dense in.
 *
 * The measure is deliberately not "frequent words". Every division of every
 * English book is dense in `said` and `great`; the war volumes were too. What
 * separates a work is vocabulary that is common INSIDE it and rare across the
 * rest of the shelf — Pandava, Yudhishthira, Parva. So characteristic terms are
 * chosen by document frequency across the corpus, not by count alone.
 *
 *   node scripts/audit-division-identity.mjs           report
 *   node scripts/audit-division-identity.mjs --write   commit the artifact
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { divideSections } from '../src/content/archive/divisions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKS_DIR = join(HERE, '..', 'src', 'content', 'archive', 'works');
const ARTIFACT = join(HERE, '..', 'src', 'content', 'archive', 'division-identity.json');

/** Common enough to identify nothing, in any book. */
const STOP = new Set([
  'the', 'and', 'that', 'with', 'was', 'his', 'her', 'for', 'not', 'but', 'they',
  'this', 'have', 'from', 'had', 'she', 'him', 'all', 'were', 'their', 'been',
  'which', 'said', 'would', 'there', 'when', 'what', 'them', 'then', 'who',
  'into', 'more', 'will', 'one', 'upon', 'has', 'are', 'you', 'your', 'its',
  'shall', 'such', 'only', 'these', 'those', 'other', 'than', 'may', 'can',
  'must', 'like', 'very', 'own', 'came', 'come', 'made', 'make', 'himself',
  'thou', 'thee', 'thy', 'unto', 'hath', 'doth'
]);

const tokenize = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/gu, '')
  .replace(/[^a-z\s'-]/gu, ' ')
  .split(/\s+/u)
  .filter(word => word.length > 3 && !STOP.has(word));

/**
 * CHOSEN FROM THE CORPUS, NOT GUESSED. Swept 2026-08-12 over all 91 works:
 * 107 divisions score zero at 400 words, 52 at 2,000, and **none at 5,000**.
 * The ones below that floor are aphoristic and translated works — Epictetus,
 * Boethius, Kwaidan, Leaves of Grass — where a chapter may genuinely not use
 * its book's distinctive nouns. A lower floor would make this instrument lie.
 *
 * The defect it exists to catch was 115,312 words with zero hits, so the
 * margin is twenty-three fold. Contents pages and apparatus are a different
 * class with their own detector (§2e, §2f); this one is for a whole division
 * that is a different book.
 */
const MIN_DIVISION_WORDS = Number(process.env.FLOOR || 5_000);

/** Rare across the shelf is what makes a term this work's own. */
const MAX_DOCUMENT_SHARE = 0.15;
const MIN_TERM_COUNT = 20;
const CHARACTERISTIC_TERMS = Number(process.env.TERMS || 120);

function sectionsToText(sections) {
  if (!Array.isArray(sections)) return '';
  return sections.map(section => (typeof section === 'string'
    ? section
    : (typeof section?.content === 'string' ? section.content : ''))).join('\n\n');
}

async function loadWorks() {
  const files = readdirSync(WORKS_DIR).filter(name => name.endsWith('.js'));
  const works = [];
  for (const file of files) {
    const module = await import(pathToFileURL(join(WORKS_DIR, file)).href);
    const sections = Object.values(module).find(value => Array.isArray(value));
    if (!sections) continue;
    works.push({ id: file.replace(/\.js$/u, ''), sections });
  }
  return works;
}

function main(works) {
  // Pass one: how many works use each term at all.
  const documentFrequency = new Map();
  const perWork = new Map();
  for (const work of works) {
    const counts = new Map();
    for (const token of tokenize(sectionsToText(work.sections))) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    perWork.set(work.id, counts);
    for (const token of counts.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }

  const maxDocuments = Math.max(1, Math.floor(works.length * MAX_DOCUMENT_SHARE));
  const report = { works: {}, violations: [] };

  for (const work of works) {
    const counts = perWork.get(work.id);
    const characteristic = [...counts.entries()]
      .filter(([token, count]) => count >= MIN_TERM_COUNT
        && (documentFrequency.get(token) || 0) <= maxDocuments)
      .sort((left, right) => right[1] - left[1])
      .slice(0, CHARACTERISTIC_TERMS)
      .map(([token]) => token);

    const divided = divideSections(work.sections);
    const entries = divided?.entries || [];
    const terms = new Set(characteristic);
    const divisions = [];

    for (const entry of entries) {
      const text = String(entry.text ?? entry.content ?? entry.body ?? '');
      const tokens = tokenize(text);
      const words = text.trim().split(/\s+/u).filter(Boolean).length;
      let hits = 0;
      for (const token of tokens) if (terms.has(token)) hits += 1;
      divisions.push({ name: entry.name ?? entry.title ?? '', words, hits });
      // A work with no characteristic vocabulary scores zero everywhere, so
      // every division would 'violate'. That is a statement about the
      // instrument, not the text.
      if (terms.size > 0 && words >= MIN_DIVISION_WORDS && hits === 0) {
        report.violations.push({
          work: work.id, division: entry.name ?? entry.title ?? '', words
        });
      }
    }

    report.works[work.id] = {
      characteristic: characteristic.slice(0, 12),
      divisions: divisions.length,
      // A work with no characteristic vocabulary at all cannot be checked, and
      // that is itself worth seeing rather than passing silently.
      checkable: characteristic.length > 0,
      leanest: divisions
        .filter(division => division.words >= MIN_DIVISION_WORDS)
        .sort((left, right) => (left.hits / left.words) - (right.hits / right.words))
        .slice(0, 1)
        .map(division => ({ name: division.name, words: division.words, hits: division.hits }))[0] || null
    };
  }
  return report;
}

const works = await loadWorks();
const report = main(works);
const uncheckable = Object.entries(report.works).filter(([, entry]) => !entry.checkable);

console.log(`works ${works.length} · divisions ${Object.values(report.works).reduce((sum, w) => sum + w.divisions, 0)}`);
console.log(`uncheckable (no characteristic vocabulary): ${uncheckable.length}`);
uncheckable.slice(0, 10).forEach(([id]) => console.log(`  ? ${id}`));
console.log(`violations (>= ${MIN_DIVISION_WORDS} words, zero characteristic terms): ${report.violations.length}`);
for (const floor of [400, 1000, 2000, 5000, 10000, 20000]) {
  const n = report.violations.filter(v => v.words >= floor).length;
  console.log(`  at >= ${floor}w: ${n}`);
}
for (const violation of report.violations.filter(v => v.words >= 2000).slice(0, 25)) {
  console.log(`  ! ${violation.work} | ${JSON.stringify(violation.division)} | ${violation.words}w`);
}

if (process.argv.includes('--write')) {
  writeFileSync(ARTIFACT, `${JSON.stringify({
    generatedBy: 'scripts/audit-division-identity.mjs',
    minDivisionWords: MIN_DIVISION_WORDS,
    works: Object.fromEntries(Object.entries(report.works)
      .map(([id, entry]) => [id, { divisions: entry.divisions, checkable: entry.checkable }])),
    violations: report.violations
  }, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${ARTIFACT}`);
}
