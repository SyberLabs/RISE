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

  it('admits editorial compositions; certified sources clear the publication gate', async () => {
    const meditations = await resolveKeystone('meditations');
    expect(meditations.ready).toBe(true);
    expect(meditations.admitted).toBe(true);
    expect(meditations.reviewable).toBe(true);
    expect(meditations.sessionInput).toBeTruthy();
    expect(meditations.blockers.map(item => item.code)).not.toContain('KEYSTONE_SOURCE_UNCERTIFIED');
    expect(meditations.coverage.complete).toBe(true);

    for (const slug of ['metamorphoses', 'tintern']) {
      const result = await resolveKeystone(slug);
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
