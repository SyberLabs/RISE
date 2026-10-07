/**
 * Chapel corpus ingestion — Gutenberg #1581 → 73 book payload modules.
 *
 * The Douay-Rheims, Challoner revision, is the only complete Catholic
 * Bible unambiguously in the public domain. Gutenberg #1581 (the
 * "improved and more complete edition" that #8300 itself points to)
 * carries clean structural markup:
 *
 *   THE BOOK OF GENESIS          — book header (all caps, own line)
 *   Genesis Chapter 1            — chapter header
 *   1:1. In the beginning...     — verse, `C:V.` prefix
 *   A firmament.... By this...   — Challoner annotation (no verse prefix)
 *
 * EDITORIAL DECISIONS, recorded because they shape what a reader sees:
 *
 * 1. VERSES ONLY. Challoner's annotations are commentary, not
 *    Scripture. The reading stream carries the sacred text; the
 *    annotations belong to a future study surface. The book
 *    introductions (the paragraph under each book header) are likewise
 *    excluded from the rhythm stream.
 * 2. CANON BOUNDARY. #1581 appends "THE THIRD BOOKE OF ESDRAS" and
 *    other apocrypha in 16th-century spelling after the Apocalypse.
 *    They are not part of the 73-book canon and are not ingested.
 * 3. VERSE MARKERS become `[v C:V]` sentinels in the payload — machine
 *    boundaries the scripture chunk profile understands, stripped from
 *    display, preserved for navigation. The words between them are
 *    untouched.
 * 4. CHECKSUMS are computed over the final payload text (the exact
 *    string a session will receive), per the Atrium's discipline: the
 *    manifest's checksum IS the integrity contract.
 *
 * Usage: node scripts/chapel-ingest.mjs <path-to-pg1581.txt>
 * Writes: src/content/chapel/corpus/books/*.js + manifest data to stdout
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// The 73 books of the Catholic canon, in canonical order, keyed by the
// exact header line #1581 uses. Display names use the Douay naming the
// translation itself uses (Josue, Paralipomenon, Apocalypse), because a
// translation's identity includes its names.
const CANON = [
  // ── Old Testament: Pentateuch ──
  ['THE BOOK OF GENESIS', 'genesis', 'Genesis', 'ot', 'pentateuch'],
  ['THE BOOK OF EXODUS', 'exodus', 'Exodus', 'ot', 'pentateuch'],
  ['THE BOOK OF LEVITICUS', 'leviticus', 'Leviticus', 'ot', 'pentateuch'],
  ['THE BOOK OF NUMBERS', 'numbers', 'Numbers', 'ot', 'pentateuch'],
  ['THE BOOK OF DEUTERONOMY', 'deuteronomy', 'Deuteronomy', 'ot', 'pentateuch'],
  // ── Historical ──
  ['THE BOOK OF JOSUE', 'josue', 'Josue', 'ot', 'historical'],
  ['THE BOOK OF JUDGES', 'judges', 'Judges', 'ot', 'historical'],
  ['THE BOOK OF RUTH', 'ruth', 'Ruth', 'ot', 'historical'],
  ['THE FIRST BOOK OF SAMUEL, OTHERWISE CALLED THE FIRST BOOK OF KINGS', 'kings-1', '1 Kings (1 Samuel)', 'ot', 'historical'],
  ['THE SECOND BOOK OF SAMUEL, OTHERWISE CALLED THE SECOND BOOK OF KINGS', 'kings-2', '2 Kings (2 Samuel)', 'ot', 'historical'],
  ['THE THIRD BOOK OF KINGS', 'kings-3', '3 Kings', 'ot', 'historical'],
  ['THE FOURTH BOOK OF KINGS', 'kings-4', '4 Kings', 'ot', 'historical'],
  ['THE FIRST BOOK OF PARALIPOMENON', 'paralipomenon-1', '1 Paralipomenon', 'ot', 'historical'],
  ['THE SECOND BOOK OF PARALIPOMENON', 'paralipomenon-2', '2 Paralipomenon', 'ot', 'historical'],
  ['THE FIRST BOOK OF ESDRAS', 'esdras-1', '1 Esdras', 'ot', 'historical'],
  ['THE BOOK OF NEHEMIAS, WHICH IS CALLED THE SECOND OF ESDRAS', 'nehemias', 'Nehemias (2 Esdras)', 'ot', 'historical'],
  ['THE BOOK OF TOBIAS', 'tobias', 'Tobias', 'ot', 'historical'],
  ['THE BOOK OF JUDITH', 'judith', 'Judith', 'ot', 'historical'],
  ['THE BOOK OF ESTHER', 'esther', 'Esther', 'ot', 'historical'],
  ['THE FIRST BOOK OF MACHABEES', 'machabees-1', '1 Machabees', 'ot', 'historical'],
  ['THE SECOND BOOK OF MACHABEES', 'machabees-2', '2 Machabees', 'ot', 'historical'],
  // ── Wisdom ──
  ['THE BOOK OF JOB', 'job', 'Job', 'ot', 'wisdom'],
  ['THE BOOK OF PSALMS', 'psalms', 'Psalms', 'ot', 'wisdom'],
  ['THE BOOK OF PROVERBS', 'proverbs', 'Proverbs', 'ot', 'wisdom'],
  ['ECCLESIASTES', 'ecclesiastes', 'Ecclesiastes', 'ot', 'wisdom'],
  // NB: #1581 uses a typographic apostrophe (U+2019) in this header
  ['SOLOMON’S CANTICLE OF CANTICLES', 'canticles', 'Canticle of Canticles', 'ot', 'wisdom'],
  ['THE BOOK OF WISDOM', 'wisdom', 'Wisdom', 'ot', 'wisdom'],
  ['ECCLESIASTICUS', 'ecclesiasticus', 'Ecclesiasticus', 'ot', 'wisdom'],
  // ── Prophets ──
  ['THE PROPHECY OF ISAIAS', 'isaias', 'Isaias', 'ot', 'prophets'],
  ['THE PROPHECY OF JEREMIAS', 'jeremias', 'Jeremias', 'ot', 'prophets'],
  ['THE LAMENTATIONS OF JEREMIAS', 'lamentations', 'Lamentations', 'ot', 'prophets'],
  ['THE PROPHECY OF BARUCH', 'baruch', 'Baruch', 'ot', 'prophets'],
  ['THE PROPHECY OF EZECHIEL', 'ezechiel', 'Ezechiel', 'ot', 'prophets'],
  ['THE PROPHECY OF DANIEL', 'daniel', 'Daniel', 'ot', 'prophets'],
  ['THE PROPHECY OF OSEE', 'osee', 'Osee', 'ot', 'prophets'],
  ['THE PROPHECY OF JOEL', 'joel', 'Joel', 'ot', 'prophets'],
  ['THE PROPHECY OF AMOS', 'amos', 'Amos', 'ot', 'prophets'],
  ['THE PROPHECY OF ABDIAS', 'abdias', 'Abdias', 'ot', 'prophets'],
  ['THE PROPHECY OF JONAS', 'jonas', 'Jonas', 'ot', 'prophets'],
  ['THE PROPHECY OF MICHEAS', 'micheas', 'Micheas', 'ot', 'prophets'],
  ['THE PROPHECY OF NAHUM', 'nahum', 'Nahum', 'ot', 'prophets'],
  ['THE PROPHECY OF HABACUC', 'habacuc', 'Habacuc', 'ot', 'prophets'],
  ['THE PROPHECY OF SOPHONIAS', 'sophonias', 'Sophonias', 'ot', 'prophets'],
  ['THE PROPHECY OF AGGEUS', 'aggeus', 'Aggeus', 'ot', 'prophets'],
  ['THE PROPHECY OF ZACHARIAS', 'zacharias', 'Zacharias', 'ot', 'prophets'],
  ['THE PROPHECY OF MALACHIAS', 'malachias', 'Malachias', 'ot', 'prophets'],
  // ── New Testament: Gospels & Acts ──
  ['THE HOLY GOSPEL OF JESUS CHRIST ACCORDING TO SAINT MATTHEW', 'matthew', 'Matthew', 'nt', 'gospels'],
  ['THE HOLY GOSPEL OF JESUS CHRIST ACCORDING TO ST. MARK', 'mark', 'Mark', 'nt', 'gospels'],
  ['THE HOLY GOSPEL OF JESUS CHRIST ACCORDING TO ST. LUKE', 'luke', 'Luke', 'nt', 'gospels'],
  ['THE HOLY GOSPEL OF JESUS CHRIST ACCORDING TO ST. JOHN', 'john', 'John', 'nt', 'gospels'],
  ['THE ACTS OF THE APOSTLES', 'acts', 'Acts of the Apostles', 'nt', 'acts'],
  // ── Pauline epistles ──
  ['THE EPISTLE OF ST. PAUL THE APOSTLE TO THE ROMANS', 'romans', 'Romans', 'nt', 'pauline'],
  ['THE FIRST EPISTLE OF ST. PAUL TO THE CORINTHIANS', 'corinthians-1', '1 Corinthians', 'nt', 'pauline'],
  ['THE SECOND EPISTLE OF ST. PAUL TO THE CORINTHIANS', 'corinthians-2', '2 Corinthians', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO THE GALATIANS', 'galatians', 'Galatians', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO THE EPHESIANS', 'ephesians', 'Ephesians', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO THE PHILIPPIANS', 'philippians', 'Philippians', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO THE COLOSSIANS', 'colossians', 'Colossians', 'nt', 'pauline'],
  ['THE FIRST EPISTLE OF ST. PAUL TO THE THESSALONIANS', 'thessalonians-1', '1 Thessalonians', 'nt', 'pauline'],
  ['THE SECOND EPISTLE OF ST. PAUL TO THE THESSALONIANS', 'thessalonians-2', '2 Thessalonians', 'nt', 'pauline'],
  ['THE FIRST EPISTLE OF ST. PAUL TO TIMOTHY', 'timothy-1', '1 Timothy', 'nt', 'pauline'],
  ['THE SECOND EPISTLE OF ST. PAUL TO TIMOTHY', 'timothy-2', '2 Timothy', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO TITUS', 'titus', 'Titus', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO PHILEMON', 'philemon', 'Philemon', 'nt', 'pauline'],
  ['THE EPISTLE OF ST. PAUL TO THE HEBREWS', 'hebrews', 'Hebrews', 'nt', 'pauline'],
  // ── Catholic epistles & Apocalypse ──
  ['THE CATHOLIC EPISTLE OF ST. JAMES THE APOSTLE', 'james', 'James', 'nt', 'catholic-epistles'],
  ['THE FIRST EPISTLE OF ST. PETER THE APOSTLE', 'peter-1', '1 Peter', 'nt', 'catholic-epistles'],
  ['THE SECOND EPISTLE OF ST. PETER THE APOSTLE', 'peter-2', '2 Peter', 'nt', 'catholic-epistles'],
  ['THE FIRST EPISTLE OF ST. JOHN THE APOSTLE', 'john-1', '1 John', 'nt', 'catholic-epistles'],
  ['THE SECOND EPISTLE OF ST. JOHN THE APOSTLE', 'john-2', '2 John', 'nt', 'catholic-epistles'],
  ['THE THIRD EPISTLE OF ST. JOHN THE APOSTLE', 'john-3', '3 John', 'nt', 'catholic-epistles'],
  ['THE CATHOLIC EPISTLE OF ST. JUDE', 'jude', 'Jude', 'nt', 'catholic-epistles'],
  ['THE APOCALYPSE OF ST. JOHN THE APOSTLE', 'apocalypse', 'Apocalypse', 'nt', 'apocalypse']
];

// Everything after the Apocalypse's text is post-canonical appendix
const CANON_END = 'THE THIRD BOOKE OF ESDRAS.';

const VERSE = /^(\d+):(\d+)\.\s*(.*)$/;
const CHAPTER = /^[A-Za-z0-9 .']+ Chapter (\d+)\s*$/;

function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error('usage: node scripts/chapel-ingest.mjs <pg1581.txt>');
    process.exit(1);
  }
  const raw = readFileSync(inputPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  // Locate every canonical book header by exact line match
  const headerAt = new Map();
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    for (const [header] of CANON) {
      if (trimmed === header) headerAt.set(header, i);
    }
  });

  const missing = CANON.filter(([h]) => !headerAt.has(h)).map(([h]) => h);
  if (missing.length) {
    console.error('MISSING BOOK HEADERS — refusing to ingest a partial canon:');
    missing.forEach(h => console.error('  ' + h));
    process.exit(1);
  }

  const canonEndLine = lines.findIndex(l => l.trim() === CANON_END);

  const outDir = resolve('src/content/chapel/corpus/books');
  mkdirSync(outDir, { recursive: true });

  const manifest = [];

  // A book ends at the nearest FOLLOWING header in the FILE, not at the
  // next book in canonical order. The two differ: the canon places
  // Machabees at the end of the historical books, but #1581 prints them
  // after Malachias — computing ends from canonical order made Esther
  // swallow Job through Malachias (1.76M chars, 13k verses) before this
  // was caught by a size audit.
  const headerLines = [...headerAt.values()].sort((a, b) => a - b);
  const fileEnd = canonEndLine > 0 ? canonEndLine : lines.length;

  CANON.forEach(([header, id, name, testament, grouping]) => {
    const start = headerAt.get(header);
    const next = headerLines.find(l => l > start) ?? fileEnd;

    // Extract VERSES ONLY. A verse may wrap across lines; continuation
    // lines belong to the open verse until a blank line, a new verse,
    // a chapter header, or an annotation paragraph begins.
    const paragraphs = [];
    let chapter = 0;
    let open = null; // { c, v, text }
    const closeVerse = () => {
      if (!open) return;
      const text = open.text.replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push(`[v ${open.c}:${open.v}] ${text}`);
      open = null;
    };

    for (let i = start + 1; i < next; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') { closeVerse(); continue; }

      const ch = CHAPTER.exec(trimmed);
      if (ch) { closeVerse(); chapter = Number(ch[1]); continue; }

      const v = VERSE.exec(trimmed);
      if (v) {
        closeVerse();
        open = { c: Number(v[1]), v: Number(v[2]), text: v[3] };
        continue;
      }

      if (open) {
        // continuation of the open verse
        open.text += ' ' + trimmed;
      }
      // else: book introduction or Challoner annotation — excluded
    }
    closeVerse();

    const text = paragraphs.join('\n\n');
    const checksum = createHash('sha256').update(text, 'utf8').digest('hex');
    const verses = paragraphs.length;
    const chapters = chapter;
    const constName = 'BOOK_' + id.toUpperCase().replace(/-/g, '_');

    const module = `/**
 * ${name} — Douay-Rheims, Challoner revision.
 * Source: Project Gutenberg #1581 (public domain).
 * Verses only; Challoner's annotations and the book introduction are
 * commentary and are deliberately not part of the reading stream.
 * GENERATED by scripts/chapel-ingest.mjs — do not hand-edit; the
 * manifest checksum is the integrity contract.
 */
export const ${constName} = ${JSON.stringify(text)};
`;
    writeFileSync(resolve(outDir, `${id}.js`), module);

    manifest.push({
      id, name, testament, grouping, chapters, verses,
      charCount: text.length, checksum, constName
    });
    console.error(
      `${id.padEnd(18)} ch:${String(chapters).padStart(3)}  vv:${String(verses).padStart(5)}  ` +
      `${String(text.length).padStart(7)} chars  ${checksum.slice(0, 12)}…`
    );
  });

  // Manifest data to stdout for embedding
  console.log(JSON.stringify(manifest, null, 2));
}

main();
