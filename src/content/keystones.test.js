import { describe, expect, it } from 'vitest';
import {
  KEYSTONE_MANIFESTS,
  TRY_RISE_PATH,
  isTryRisePath,
  keystonePath,
  keystoneSlugFromPath,
  resolveKeystone
} from './keystones.js';

describe('release Keystone manifests', () => {
  it('have unique stable routes', () => {
    const paths = KEYSTONE_MANIFESTS.map(item => keystonePath(item.slug));
    expect(paths).toEqual([
      '/keystone/meditations',
      '/keystone/metamorphoses',
      '/keystone/tintern'
    ]);
    expect(new Set(paths).size).toBe(paths.length);
    expect(keystoneSlugFromPath('/keystone/tintern/')).toBe('tintern');
    expect(keystoneSlugFromPath('/keystone/unknown')).toBeNull();
    expect(TRY_RISE_PATH).toBe('/try-rise');
    expect(isTryRisePath('/try-rise/')).toBe(true);
  });

  it('locks the editorially selected release divisions', () => {
    expect(KEYSTONE_MANIFESTS.map(({ slug, source }) => ({
      slug,
      entryId: source.entryId,
      label: source.expectedLabel
    }))).toEqual([
      { slug: 'meditations', entryId: 1, label: 'Book II' },
      {
        slug: 'metamorphoses',
        entryId: 0,
        label: 'Book I · Creation of the World'
      },
      {
        slug: 'tintern',
        entryId: 19,
        label: 'Volume I · Lines Written a Few Miles Above Tintern Abbey, on Revisiting the Banks of the Wye During a Tour'
      }
    ]);
  });

  // THE OVID KEYSTONE IS THE OPENING OF BOOK I, NOT A DEATH IN BOOK XIII.
  //
  // Structural rather than phrase-matched: the span is a division boundary the
  // edition already draws, so what is asserted is WHICH division, and that the
  // Four Ages begin in the next one rather than inside this one.
  it('opens the Ovid keystone on Book I, and stops before the Four Ages', async () => {
    const manifest = KEYSTONE_MANIFESTS.find(item => item.slug === 'metamorphoses');
    expect(manifest.source.expectedLabel).toBe('Book I · Creation of the World');

    const result = await resolveKeystone('metamorphoses', { allowIncomplete: true });
    expect(result.blockers.map(item => item.code)).not.toContain('KEYSTONE_ENTRY_CHANGED');

    const text = String(result.sessionInput?.text || '');
    expect(text.length, 'the division resolves to real text').toBeGreaterThan(1000);
    // Through the creation of humanity, and no further: the Ages are their own
    // divisions and must not have been swept in.
    expect(text).toContain('metamorphosed into man');
    for (const age of ['Golden Age', 'Silver Age', 'Brazen Age', 'Iron Age']) {
      expect(text, `${age} belongs to the next division`).not.toContain(age);
    }
  });

  it('leaves no keystone pointed at Book XIII', () => {
    for (const manifest of KEYSTONE_MANIFESTS) {
      expect(manifest.source.expectedLabel).not.toContain('Polyxena');
      expect(manifest.source.expectedLabel).not.toContain('Book XIII');
    }
  });

  it('pins every composition to the exact expected source division', async () => {
    for (const manifest of KEYSTONE_MANIFESTS) {
      const result = await resolveKeystone(manifest.slug, { allowIncomplete: true });
      expect(result.blockers.map(item => item.code)).not.toContain('KEYSTONE_SOURCE_MISSING');
      expect(result.blockers.map(item => item.code)).not.toContain('KEYSTONE_SOURCE_CHANGED');
      expect(result.blockers.map(item => item.code)).not.toContain('KEYSTONE_ENTRY_MISSING');
      expect(result.blockers.map(item => item.code)).not.toContain('KEYSTONE_ENTRY_CHANGED');
    }
  });

  it('admits the editorial compositions while keeping certification fail-closed', async () => {
    for (const manifest of KEYSTONE_MANIFESTS) {
      const result = await resolveKeystone(manifest.slug);
      const codes = result.blockers.map(item => item.code);
      expect(result.ready).toBe(false);
      expect(result.admitted).toBe(true);
      expect(result.reviewable).toBe(true);
      expect(result.sessionInput).toBeTruthy();
      expect(codes).toContain('KEYSTONE_SOURCE_UNCERTIFIED');
      expect(codes).not.toContain('KEYSTONE_RECITATION_INCOMPLETE');
      expect(result.coverage.complete).toBe(true);
    }

    const tintern = await resolveKeystone('tintern');
    expect(tintern.blockers.map(item => item.code)).not.toContain('KEYSTONE_VISUAL_MISSING');

    const tinternReview = await resolveKeystone('tintern', { allowIncomplete: true });
    expect(tinternReview.reviewable).toBe(true);
    expect(tinternReview.sessionInput.visualConfig.interlocution.sourced)
      .toEqual(['aic-landscapes']);
  });

  it('lowers exact reviewable compositions through the canonical compiler', async () => {
    const result = await resolveKeystone('metamorphoses', { allowIncomplete: true });
    expect(result.reviewable).toBe(true);
    expect(result.sessionInput.revealMode).toBe('progressive');
    expect(result.sessionInput.recitation.enabled).toBe(true);
    expect(result.sessionInput.visualConfig.interlocution.procedural).toEqual(['ostensoria']);
    expect(result.sessionInput.provenance.sourceRevision)
      .toBe(result.manifest.source.sourceRevision);
  });
});
