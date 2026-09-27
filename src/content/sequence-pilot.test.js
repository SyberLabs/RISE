import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { KEYSTONE_MANIFESTS } from './keystones.js';
import {
  SEQUENCE_PILOT_SCHEMA,
  SEQUENCE_PILOT,
  nextSequencePilot
} from './sequence-pilot.js';

describe('curated sequence pilot', () => {
  it('presents the three admitted Keystone compositions as stable catalog records', () => {
    const catalog = SEQUENCE_PILOT;

    expect(SEQUENCE_PILOT_SCHEMA).toBe('rise.sequence-pilot.v1');
    expect(catalog.map(({ slug, path }) => ({ slug, path }))).toEqual([
      { slug: 'meditations', path: '/keystone/meditations' },
      { slug: 'metamorphoses', path: '/keystone/metamorphoses' },
      { slug: 'tintern', path: '/keystone/tintern' }
    ]);
    for (const record of catalog) {
      expect(record.schema).toBe(SEQUENCE_PILOT_SCHEMA);
      expect(record.manifest).toBe(KEYSTONE_MANIFESTS.find(item => item.slug === record.slug));
      expect(record.version).toBe(1);
      expect(record.id).toBe(`keystone:${record.slug}:v1:${record.manifestFingerprint.slice(0, 24)}`);
      expect(createHash('sha256').update(JSON.stringify(record.manifest)).digest('hex'))
        .toBe(record.manifestFingerprint);
      expect(record.editionId).toBe(record.manifest.source.editionId);
      expect(record.sourceRevision).toBe(record.manifest.source.sourceRevision);
      expect(record.attribution).toEqual({ title: record.title, author: record.author });
      expect(Object.isFrozen(record.attribution)).toBe(true);
      expect(record.promise).toMatch(/^[^.!?]+[.!?]$/u);
      expect(record.promise.trim().split(/\s+/u).length).toBeGreaterThan(5);
    }
    expect(new Set(catalog.map(item => item.promise)).size).toBe(3);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(catalog.every(Object.isFrozen)).toBe(true);
  });

  it('chooses the next admitted composition in a fixed cycle, never the current one', () => {
    expect(nextSequencePilot('meditations')?.slug).toBe('metamorphoses');
    expect(nextSequencePilot('metamorphoses')?.slug).toBe('tintern');
    expect(nextSequencePilot('tintern')?.slug).toBe('meditations');
    expect(nextSequencePilot(null)?.slug).toBe('meditations');
  });
});
