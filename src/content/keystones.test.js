import { describe, expect, it } from 'vitest';
import {
  KEYSTONE_MANIFESTS,
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
        entryId: 116,
        label: 'Book XIII · Story of Polyxena and Hecuba'
      },
      {
        slug: 'tintern',
        entryId: 19,
        label: 'Volume I · Lines Written a Few Miles Above Tintern Abbey, on Revisiting the Banks of the Wye During a Tour'
      }
    ]);
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

  it('fails closed only on human source certification', async () => {
    for (const manifest of KEYSTONE_MANIFESTS) {
      const result = await resolveKeystone(manifest.slug);
      const codes = result.blockers.map(item => item.code);
      expect(result.ready).toBe(false);
      expect(result.reviewable).toBe(false);
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
