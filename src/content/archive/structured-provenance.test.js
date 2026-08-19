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

const STRUCTURED = ['spoon-river-anthology'];

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
