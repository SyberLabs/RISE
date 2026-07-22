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
