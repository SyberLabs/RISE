/**
 * How a work from a structured edition proves it is itself.
 *
 * identity.test.js looks for a work's title inside its own opening pages,
 * which is a good proxy when the source is an undifferentiated download. A
 * clean edition keeps its title in metadata and opens the bodymatter on the
 * first poem, so that instrument does not apply — and these works answer the
 * same question with better evidence: a digest for every source file, and a
 * recorded shape the payload must still have.
 */
import { describe, expect, it } from 'vitest';
import { INGESTED_META } from './index.js';

const STRUCTURED = ['spoon-river-anthology', 'literary-walden', 'middlemarch', 'the-brothers-karamazov',
    'literary-meditations', 'sacred-tao-te-ching', 'the-iliad', 'the-divine-comedy',
    'metamorphoses', 'paradise-lost', 'ulysses'];

describe('a structured acquisition proves itself by provenance', () => {
  it.each(STRUCTURED)('%s records a digest for every source file', async (id) => {
    const mod = await import(`./works/${id}.js`);
    const meta = mod[`${id.toUpperCase().replace(/-/gu, '_')}_META`];
    expect(meta.source.repo).toMatch(/^https:\/\//u);
    expect(meta.source.files.length).toBeGreaterThan(0);
    for (const entry of meta.source.files) expect(entry).toMatch(/^\S+ [0-9a-f]{64}$/u);
  });

  it.each(STRUCTURED)('%s still has the shape its ingest recorded', async (id) => {
    const mod = await import(`./works/${id}.js`);
    const meta = mod[`${id.toUpperCase().replace(/-/gu, '_')}_META`];
    const sections = mod[`${id.toUpperCase().replace(/-/gu, '_')}_SECTIONS`];
    // The count the ingest wrote down, against the payload beside it. A
    // payload edited by hand, or an import that lost a part, says so here.
    expect(sections).toHaveLength(meta.parts);
    expect(meta.slugs).toHaveLength(meta.parts);
    expect(sections.reduce((n, s) => n + s.content.length, 0)).toBe(meta.chars);
  });

  it.each(STRUCTURED)('%s names a territory rather than claiming the world', async (id) => {
    const mod = await import(`./works/${id}.js`);
    const meta = mod[`${id.toUpperCase().replace(/-/gu, '_')}_META`];
    // Standard Ebooks makes United States determinations, and a work in the
    // public domain there may not be elsewhere. "Public domain" is not a
    // boolean and the record may not pretend it is.
    expect(meta.rights.territory).toBe('US');
    expect(meta.rights.evidence.length).toBeGreaterThan(80);
  });

  it('every structured work is on the shelf', () => {
    for (const id of STRUCTURED) {
      expect(INGESTED_META.some(meta => meta.id === id), id).toBe(true);
    }
  });
});

describe('a declared scheme is not re-derived', () => {
  it('gives one division per part the edition marked', async () => {
    const index = (await import('./division-index.json')).default;
    // Everything divisions.js does below the `declared` gate is archaeology:
    // it reads section names as evidence and reconstructs a scheme, because a
    // flat ingest left it no choice. Running it over a declared scheme cut
    // Walden's eighteen chapters into thirty-eight pieces and absorbed one of
    // Spoon River's poems into its neighbour.
    for (const id of STRUCTURED) {
      const mod = await import(`./works/${id}.js`);
      const sections = mod[`${id.toUpperCase().replace(/-/gu, '_')}_SECTIONS`];
      expect(index[id].reason, `${id} scheme`).toBe('declared');
      expect(index[id].count, `${id}: in must equal out`).toBe(sections.length);
      // Labels ride only where they say more than a number, so a work whose
      // parts are called "Book I" sends none — and where they do ride, there
      // is one per part.
      if (index[id].labels) {
        expect(index[id].labels, `${id} labels`).toHaveLength(sections.length);
      }
    }
  });

  it('keeps a long chapter whole, because it is the author\'s chapter', async () => {
    const index = (await import('./division-index.json')).default;
    const walden = index['literary-walden'];
    expect(walden.count).toBe(18);
    expect(walden.labels[0]).toBe('Economy');
    expect(walden.labels.at(-1)).toBe('Conclusion');
    // Economy runs to 25,000 words and stays one division. How much of it to
    // read is a question for the extent grammar, not for the divider.
  });

  it('holds the line the old ingest deleted', async () => {
    // "And mercurial trout," matched Walden's heading pattern, and a heading
    // is removed from the body once used as a title. It was gone, and no
    // detector could find it (ARCHIVE-CLEANSING-SPEC §2j).
    const mod = await import('./works/literary-walden.js');
    const text = mod.LITERARY_WALDEN_SECTIONS.map(s => s.content).join('\n');
    expect(text).toContain('And mercurial trout,');
    expect(text).toContain('By gliding musquash undertook,');
  });
});
