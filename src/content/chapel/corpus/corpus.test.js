import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHAPEL_TRANSLATION,
  CHAPEL_GROUPINGS,
  CHAPEL_BOOKS,
  findChapelBook,
  chapelBooksInGrouping
} from './manifest.js';

// The full Catholic canon — 73 books with their canonical chapter counts
// (Douay-Rheims naming). This is ground truth independent of the ingest:
// if the ingestion misread the source (as it once did, when file order
// diverged from canonical order and Esther swallowed Job through
// Malachias), these numbers catch it.
const CANONICAL_CHAPTERS = Object.freeze({
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  josue: 24, judges: 21, ruth: 4, 'kings-1': 31, 'kings-2': 24,
  'kings-3': 22, 'kings-4': 25, 'paralipomenon-1': 29, 'paralipomenon-2': 36,
  'esdras-1': 10, nehemias: 13, tobias: 14, judith: 16, esther: 16,
  'machabees-1': 16, 'machabees-2': 15,
  job: 42, psalms: 150, proverbs: 31, ecclesiastes: 12, canticles: 8,
  wisdom: 19, ecclesiasticus: 51,
  isaias: 66, jeremias: 52, lamentations: 5, baruch: 6, ezechiel: 48,
  daniel: 14, osee: 14, joel: 3, amos: 9, abdias: 1, jonas: 4, micheas: 7,
  nahum: 3, habacuc: 3, sophonias: 3, aggeus: 2, zacharias: 14, malachias: 4,
  matthew: 28, mark: 16, luke: 24, john: 21, acts: 28,
  romans: 16, 'corinthians-1': 16, 'corinthians-2': 13, galatians: 6,
  ephesians: 6, philippians: 4, colossians: 4, 'thessalonians-1': 5,
  'thessalonians-2': 3, 'timothy-1': 6, 'timothy-2': 4, titus: 3,
  philemon: 1, hebrews: 13,
  james: 5, 'peter-1': 5, 'peter-2': 3, 'john-1': 5, 'john-2': 1,
  'john-3': 1, jude: 1, apocalypse: 22
});

const VERSE_SENTINEL = /^\[v (\d+):(\d+)\] \S/;

async function loadBookText(id) {
  const module = await import(`./books/${id}.js`);
  const keys = Object.keys(module);
  expect(keys).toHaveLength(1);
  return module[keys[0]];
}

describe('Chapel corpus manifest', () => {
  it('declares one named public-domain translation with provenance', () => {
    expect(CHAPEL_TRANSLATION.id).toBe('douay-rheims-challoner');
    expect(CHAPEL_TRANSLATION.rights).toBe('PUBLIC_DOMAIN');
    expect(CHAPEL_TRANSLATION.source).toContain('Gutenberg');
    expect(CHAPEL_TRANSLATION.sourceUrl).toMatch(/^https:\/\//);
  });

  it('holds exactly the 73 books of the Catholic canon with canonical chapter counts', () => {
    expect(CHAPEL_BOOKS).toHaveLength(73);
    expect(Object.keys(CANONICAL_CHAPTERS)).toHaveLength(73);
    for (const book of CHAPEL_BOOKS) {
      expect(CANONICAL_CHAPTERS[book.id], `unknown book id ${book.id}`).toBeDefined();
      expect(book.chapters, `${book.id} chapter count`).toBe(CANONICAL_CHAPTERS[book.id]);
      expect(book.verses).toBeGreaterThanOrEqual(book.chapters);
      expect(book.charCount).toBeGreaterThan(500);
    }
  });

  it('assigns every book to a declared grouping and every grouping is non-empty', () => {
    const groupingIds = new Set(CHAPEL_GROUPINGS.map(grouping => grouping.id));
    for (const book of CHAPEL_BOOKS) {
      expect(groupingIds.has(book.grouping), `${book.id} grouping ${book.grouping}`).toBe(true);
    }
    for (const grouping of CHAPEL_GROUPINGS) {
      expect(chapelBooksInGrouping(grouping.id).length, grouping.id).toBeGreaterThan(0);
    }
    expect(findChapelBook('psalms')?.chapters).toBe(150);
    expect(findChapelBook('not-a-book')).toBeNull();
  });

  it('is metadata-only: the manifest imports no payload modules', () => {
    const source = readFileSync(resolve('src/content/chapel/corpus/manifest.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.\/books\//);
    expect(source).not.toMatch(/import\s*\(/);
  });

  it('has one payload module on disk per manifest entry, and no strays', () => {
    const onDisk = readdirSync(resolve('src/content/chapel/corpus/books'))
      .filter(name => name.endsWith('.js'))
      .map(name => name.replace(/\.js$/, ''))
      .sort();
    const declared = CHAPEL_BOOKS.map(book => book.id).sort();
    expect(onDisk).toEqual(declared);
  });
});

describe('Chapel corpus payload integrity', () => {
  it('every payload matches its manifest checksum and char count', async () => {
    for (const book of CHAPEL_BOOKS) {
      const text = await loadBookText(book.id);
      const checksum = createHash('sha256').update(text, 'utf8').digest('hex');
      expect(checksum, `${book.id} checksum`).toBe(book.checksum);
      expect(text.length, `${book.id} charCount`).toBe(book.charCount);
    }
  }, 60_000);

  it('carries verses only: every paragraph opens with a verse sentinel', async () => {
    // Challoner's annotations and book introductions are commentary,
    // deliberately excluded. An unnumbered paragraph means leakage.
    for (const id of ['genesis', 'esther', 'psalms', 'malachias', 'machabees-2', 'john', 'apocalypse']) {
      const text = await loadBookText(id);
      const paragraphs = text.split(/\n\s*\n/).filter(paragraph => paragraph.trim());
      expect(paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of paragraphs) {
        expect(paragraph, `${id}: paragraph without verse sentinel`).toMatch(VERSE_SENTINEL);
      }
    }
  }, 30_000);

  it('spans each book: chapter 1 verse 1 through the last canonical chapter', async () => {
    for (const book of CHAPEL_BOOKS) {
      const text = await loadBookText(book.id);
      expect(text.startsWith('[v 1:1] '), `${book.id} opening`).toBe(true);
      expect(text.includes(`[v ${book.chapters}:1]`), `${book.id} last chapter`).toBe(true);
      expect(text.includes(`[v ${book.chapters + 1}:`), `${book.id} beyond-canon chapter`).toBe(false);
    }
  }, 60_000);

  it('every INTERMEDIATE chapter boundary is present — a missing sentinel would silently widen its predecessor', async () => {
    // The slicer refuses an unbounded slice, but refusal at read time
    // is a degraded Chapel; the corpus itself must prove every
    // boundary here, at build time (2026-07 review, finding 8: the
    // prior span test checked only the first and last chapters).
    // A chapter's first sentinel may open at any verse — the Vulgate
    // carries Hebrew verse numbers through the split psalms, so
    // Psalm 115 rightly opens at [v 115:10]. What must exist is SOME
    // sentinel for every canonical chapter.
    for (const book of CHAPEL_BOOKS) {
      const text = await loadBookText(book.id);
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        expect(new RegExp(`\\[v ${chapter}:\\d+\\] `).test(text),
          `${book.id} chapter ${chapter} sentinel`).toBe(true);
      }
    }
  }, 120_000);

  it('preserves exact Douay-Rheims wording at known anchors', async () => {
    const genesis = await loadBookText('genesis');
    expect(genesis).toContain('[v 1:1] In the beginning God created heaven, and earth.');

    const john = await loadBookText('john');
    // Exact #1581 punctuation — colon after "Son", no comma before "may"
    expect(john).toContain(
      '[v 3:16] For God so loved the world, as to give his only begotten Son: '
      + 'that whosoever believeth in him may not perish, but may have life everlasting.'
    );

    const malachias = await loadBookText('malachias');
    expect(malachias.trimEnd()).toMatch(/strike the earth with anathema\.$/);
  });
});
