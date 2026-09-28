import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MODERN_READINGS } from './modern-readings.js';
import modernManifest from './modern-readings-manifest.json' with { type: 'json' };
import { getTextById } from './library.js';
import { READING_LIMITS } from '../core/reading-limits.js';

describe('released original readings', () => {
  it('ships distinct, playable text with exact release identities', async () => {
    expect(MODERN_READINGS).toHaveLength(16);
    expect(Object.keys(modernManifest)).toHaveLength(MODERN_READINGS.length);
    expect(new Set(MODERN_READINGS.map(item => item.id)).size).toBe(MODERN_READINGS.length);
    for (const reading of MODERN_READINGS) {
      const released = modernManifest[reading.id];
      const text = getTextById(reading.id);
      expect(reading.content.trim().split(/\s+/u).length).toBeGreaterThanOrEqual(100);
      expect(reading.content.length).toBeLessThan(READING_LIMITS.maxTextCharacters);
      expect(released.editionId).toBe(`rise-original:${reading.id}`);
      expect(released.sourceRevision).toBe(`sha256:${createHash('sha256')
        .update(reading.content, 'utf8').digest('hex')}`);
      expect(text).toMatchObject({ category: 'composed', division: 'technology',
        provider: 'rise-original', editionId: released.editionId,
        sourceRevision: released.sourceRevision });
      expect((await text.getDivisions()).entries[0].content).toBe(reading.content);
    }
  });
});
