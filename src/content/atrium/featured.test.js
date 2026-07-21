import { describe, expect, it } from 'vitest';
import { featuredAtriumPoint } from './featured.js';
import { evaluateJourneyReadiness } from './readiness.js';
import { ATRIUM_POINT_LAUNCHES } from './launches.js';

describe('Atrium featured sequence (portal door)', () => {
  it('features only launchable sequences, every day of the year', () => {
    // A doorway must never invite the reader to a gated sequence
    for (let day = 0; day < 365; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day, 12));
      const featured = featuredAtriumPoint(date);
      expect(featured).not.toBeNull();
      const point = ATRIUM_POINT_LAUNCHES.find(
        p => p.title === featured.title && p.domain === featured.domain
      );
      expect(point).toBeTruthy();
      expect(evaluateJourneyReadiness(point).ready).toBe(true);
    }
  });

  it('is stable within a day and rolls across days', () => {
    const morning = new Date(Date.UTC(2026, 6, 20, 0, 30));
    const evening = new Date(Date.UTC(2026, 6, 20, 23, 30));
    expect(featuredAtriumPoint(morning).title).toBe(featuredAtriumPoint(evening).title);

    // Across a fortnight the pick must actually vary
    const titles = new Set();
    for (let day = 0; day < 14; day++) {
      titles.add(featuredAtriumPoint(new Date(Date.UTC(2026, 6, 1 + day, 12))).title);
    }
    expect(titles.size).toBeGreaterThan(1);
  });

  it('reports the launchable count the door can surface', () => {
    const featured = featuredAtriumPoint(new Date());
    expect(featured.launchableCount).toBeGreaterThan(0);
  });
});
