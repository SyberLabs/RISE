import { describe, expect, it } from 'vitest';
import {
  archiveEditionIdentity,
  ARCHIVE_CERTIFICATIONS,
  certificationFor,
  withArchiveReleaseIdentity
} from './certification.js';
import {
  archiveReviewEnabled,
  INGESTED_META,
  releaseArchiveMetadata
} from './index.js';

describe('Archive release certification', () => {
  it('gives every admitted candidate an edition and exact source revision', () => {
    expect(INGESTED_META.length).toBe(15);
    for (const meta of INGESTED_META) {
      const identity = archiveEditionIdentity(meta);
      expect(identity?.workId).toBe(meta.id);
      expect(identity?.editionId).toMatch(/^standard-ebooks:/u);
      expect(identity?.sourceRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
      if (meta.id === 'literary-meditations') {
        expect(meta.certificationStatus).toBe('certified');
      } else {
        expect(meta.certificationStatus).toBe('candidate');
      }
    }
  });

  it('certifies only works with a complete human-reviewed record', () => {
    expect(Object.keys(ARCHIVE_CERTIFICATIONS)).toHaveLength(1);
    const meditations = INGESTED_META.find(meta => meta.id === 'literary-meditations');
    expect(certificationFor(meditations)).toMatchObject({
      workId: 'literary-meditations',
      dispositions: { reviewer: 'Mateo', count: 0 }
    });
    for (const meta of INGESTED_META.filter(m => m.id !== 'literary-meditations')) {
      expect(certificationFor(meta)).toBeNull();
    }
  });

  it('fails closed for a public build and opens only for explicit review', () => {
    expect(releaseArchiveMetadata({ includeCandidates: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'literary-meditations', certificationStatus: 'certified' })
      ])
    );
    expect(releaseArchiveMetadata({ includeCandidates: false }).length).toBe(1);
    expect(releaseArchiveMetadata({ includeCandidates: true })).toHaveLength(15);
    expect(archiveReviewEnabled({ DEV: false })).toBe(false);
    expect(archiveReviewEnabled({ DEV: false, VITE_RISE_ARCHIVE_REVIEW: '1' })).toBe(true);
  });

  it('marks malformed provenance invalid rather than inventing identity', () => {
    expect(withArchiveReleaseIdentity({ id: 'bad', source: { files: [] } }))
      .toMatchObject({ id: 'bad', certificationStatus: 'invalid' });
  });
});
