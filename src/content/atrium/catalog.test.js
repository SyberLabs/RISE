import { describe, expect, it } from 'vitest';
import { ATRIUM_CATALOG } from './catalog.js';
import {
  evaluateAnchorReadiness,
  evaluateJourneyReadiness,
  evaluatePassageReadiness
} from './readiness.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import { HISTORY_CORPUS } from './history.js';
import { validateAtriumCatalog, validateAtriumCorpus } from './validate.js';

describe('Atrium source-readiness pipeline', () => {
  it('promotes only the audited pilot while retaining blocked expansion candidates', () => {
    const report = validateAtriumCatalog();
    expect(report.valid).toBe(true);
    expect(ATRIUM_CATALOG.sources.length).toBeGreaterThanOrEqual(45);
    expect(ATRIUM_CATALOG.passages).toHaveLength(57);
    expect(ATRIUM_CATALOG.sources.filter(source => source.status === 'publishable')).toHaveLength(26);
    expect(ATRIUM_CATALOG.passages.filter(passage => passage.status === 'publishable')).toHaveLength(27);
    expect(ATRIUM_CATALOG.passages.filter(passage => passage.status !== 'publishable').every(passage => (
      passage.payloadPath === null
      && passage.textVerified === false
    ))).toBe(true);
  });

  it('keeps a passage blocked until edition, rights, locator, payload, and text checks pass', () => {
    const passage = ATRIUM_CATALOG.passages.find(item => item.id === 'pass-plato-cosmos');
    const report = evaluatePassageReadiness(passage);
    expect(report.ready).toBe(false);
    expect(report.reasons.map(reason => reason.code)).toEqual(expect.arrayContaining([
      'rights-review',
      'missing-canonical-locator',
      'missing-payload',
      'text-unverified'
    ]));
  });

  it('derives journey readiness from its passage graph and open editorial requirements', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-haiti-freedom-state');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(false);
    expect(report.totalPassages).toBe(2);
    expect(report.reasons).toContainEqual(expect.objectContaining({ code: 'open-editorial-requirement' }));
  });

  it('summarizes point-launch readiness without double-counting shared passages', () => {
    const journeys = PHILOSOPHY_CORPUS.journeys.filter(journey => journey.anchorIds.includes('ph-thinker-plato'));
    const report = evaluateAnchorReadiness(journeys);
    expect(report.totalJourneys).toBe(3);
    expect(report.totalPassages).toBe(8);
    expect(report.readyPassages).toBe(8);
    expect(report.readyJourneys).toBe(3);
    expect(report.ready).toBe(true);
  });

  it('rejects dangling passage sources and globally duplicated ids', () => {
    const brokenCatalog = {
      ...ATRIUM_CATALOG,
      passages: [{ ...ATRIUM_CATALOG.passages[0], sourceId: 'src-missing' }]
    };
    expect(validateAtriumCatalog(brokenCatalog).errors).toContainEqual(
      expect.objectContaining({ code: 'dangling-passage-source' })
    );

    const duplicateHistory = {
      ...HISTORY_CORPUS,
      events: [{ ...HISTORY_CORPUS.events[0], id: PHILOSOPHY_CORPUS.nodes[0].id }]
    };
    expect(validateAtriumCorpus({ history: duplicateHistory }).errors).toContainEqual(
      expect.objectContaining({ code: 'duplicate-id' })
    );
  });

  it('fails malformed collection inputs closed instead of throwing', () => {
    expect(() => evaluateAnchorReadiness(null, null, null)).not.toThrow();
    expect(evaluateAnchorReadiness(null, null, null)).toEqual(expect.objectContaining({
      ready: false,
      totalJourneys: 0,
      totalPassages: 0
    }));

    const malformed = validateAtriumCorpus({ catalog: null });
    expect(malformed.valid).toBe(false);
    expect(malformed.errors).toContainEqual(expect.objectContaining({ code: 'invalid-corpus' }));
  });
});
