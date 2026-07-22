import { describe, expect, it } from 'vitest';
import { createChapelHandoff, chapelSensoryConfig } from './handoff.js';
import { findChapelBook } from './corpus/manifest.js';
import { compileSession } from '../../core/session-compiler.js';

describe('Chapel handoff', () => {
  it('refuses a book that does not exist', async () => {
    await expect(createChapelHandoff('gospel-of-thomas')).rejects.toMatchObject({
      name: 'ChapelHandoffError',
      code: 'CHAPEL_BOOK_NOT_FOUND'
    });
  });

  it('refuses a payload whose bytes do not match the manifest checksum', async () => {
    await expect(createChapelHandoff('jude', {
      loadPayload: async () => '[v 1:1] Not the text.'
    })).rejects.toMatchObject({ code: 'CHAPEL_PAYLOAD_INTEGRITY' });
  });

  it('refuses an empty or failed payload without substituting anything', async () => {
    await expect(createChapelHandoff('jude', {
      loadPayload: async () => ''
    })).rejects.toMatchObject({ code: 'CHAPEL_PAYLOAD_MISSING' });

    await expect(createChapelHandoff('jude', {
      loadPayload: async () => { throw new Error('chunk 404'); }
    })).rejects.toMatchObject({ code: 'CHAPEL_PAYLOAD_UNAVAILABLE' });
  });

  it('hands a verified book to the Chamber with the scripture profile and provenance', async () => {
    const handoff = await createChapelHandoff('jude');
    const book = findChapelBook('jude');

    expect(handoff.source).toBe('The Chapel · Jude');
    expect(handoff.text.length).toBe(book.charCount);
    expect(handoff.text.startsWith('[v 1:1] ')).toBe(true);

    expect(handoff.config.sources).toHaveLength(1);
    const source = handoff.config.sources[0];
    expect(source.chunkProfile).toBe('scripture');
    expect(source.name).toBe('Jude — Douay-Rheims · Challoner revision');
    expect(source.provenance).toMatchObject({
      kind: 'chapel-book',
      bookId: 'jude',
      translationId: 'douay-rheims-challoner',
      rightsStatus: 'PUBLIC_DOMAIN',
      checksum: `sha256:${book.checksum}`
    });

    // Contemplative defaults: stillness until the Chapel's own imagery exists
    expect(handoff.config.wpm).toBe(240);
    expect(handoff.config.chunkMode).toBe('phrase');
    expect(handoff.config.soundscape).toBe('aurora');
    expect(handoff.config.visualConfig.visualMode).toBe('off');

    // Wayfinding: the origin chip returns to the Chapel with the book marked
    expect(handoff.config.origin).toMatchObject({
      view: 'chapel',
      name: 'Chapel',
      data: { bookId: 'jude' }
    });
  });

  it('compiles end-to-end: verse numbers are never spoken in the session', async () => {
    const handoff = await createChapelHandoff('jude');
    const session = compileSession({
      sources: handoff.config.sources,
      chunkMode: handoff.config.chunkMode,
      curve: handoff.config.curve,
      wpm: handoff.config.wpm
    });

    const content = session.atoms.filter(atom => atom.content).map(atom => atom.content);
    expect(content.length).toBeGreaterThan(20);
    expect(content.some(value => /\[v \d+:\d+\]/.test(value))).toBe(false);
    expect(content.join(' ')).toContain('Jude, the servant of Jesus Christ');
  });

  it('launches a single chapter sliced from verified bytes, with no bleed across boundaries', async () => {
    const whole = await createChapelHandoff('john');
    const third = await createChapelHandoff('john', { chapter: 3 });

    expect(third.source).toBe('The Chapel · John 3');
    expect(third.text.startsWith('[v 3:1] ')).toBe(true);
    expect(third.text).toContain('[v 3:16] For God so loved the world');
    // No bleed: nothing from chapter 2 or 4 in the slice
    expect(third.text).not.toMatch(/\[v [24]:/);
    // The slice is literally a substring of the verified whole payload
    expect(whole.text.includes(third.text)).toBe(true);

    const source = third.config.sources[0];
    expect(source.id).toBe('chapel-john-3');
    expect(source.chunkProfile).toBe('scripture');
    expect(source.provenance.chapter).toBe(3);
    // Integrity is inherited from the whole book, and says so
    expect(source.provenance.checksum).toBe(whole.config.sources[0].provenance.checksum);
    expect(source.provenance.checksumScope).toBe('book');
    // The origin chip returns to the book open at this chapter
    expect(third.config.origin.data).toEqual({ bookId: 'john', chapter: 3 });
  });

  it('covers both boundary chapters: 1 and the last', async () => {
    const first = await createChapelHandoff('mark', { chapter: 1 });
    expect(first.text.startsWith('[v 1:1] ')).toBe(true);
    expect(first.text).not.toContain('[v 2:');

    const last = await createChapelHandoff('mark', { chapter: 16 });
    expect(last.text.startsWith('[v 16:1] ')).toBe(true);
    // The last chapter runs to the end of the book
    const whole = await createChapelHandoff('mark');
    expect(whole.text.endsWith(last.text)).toBe(true);
  });

  it('refuses a chapter outside the book, before touching any payload', async () => {
    const neverLoads = async () => { throw new Error('should not be called'); };
    await expect(createChapelHandoff('jude', { chapter: 2, loadPayload: neverLoads }))
      .rejects.toMatchObject({ code: 'CHAPEL_CHAPTER_NOT_FOUND' });
    await expect(createChapelHandoff('john', { chapter: 0, loadPayload: neverLoads }))
      .rejects.toMatchObject({ code: 'CHAPEL_CHAPTER_NOT_FOUND' });
    await expect(createChapelHandoff('john', { chapter: 1.5, loadPayload: neverLoads }))
      .rejects.toMatchObject({ code: 'CHAPEL_CHAPTER_NOT_FOUND' });
  });

  it('names a Psalm by its own noun, never "Psalms 23"', async () => {
    const psalm = await createChapelHandoff('psalms', { chapter: 23 });
    expect(psalm.source).toBe('The Chapel · Psalm 23');
    expect(psalm.config.sources[0].name).toContain('Psalm 23 —');
    expect(psalm.config.sources[0].provenance.chapterNoun).toBe('Psalm');
  });

  it('keeps the sensory defaults an honest object each call (no shared mutation)', () => {
    const first = chapelSensoryConfig();
    first.wpm = 999;
    expect(chapelSensoryConfig().wpm).toBe(240);
  });

  it('would have refused the error the sensory config could hide: unknown fields stay out', () => {
    // The sensory config feeds ChamberOrbital.loadText's allowlist —
    // it must contain only fields that path consumes.
    const allowed = new Set(['wpm', 'chunkMode', 'curve', 'soundscape', 'visualConfig']);
    for (const key of Object.keys(chapelSensoryConfig())) {
      expect(allowed.has(key), `unexpected sensory field ${key}`).toBe(true);
    }
  });
});
