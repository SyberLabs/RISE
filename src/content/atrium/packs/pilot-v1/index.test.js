import { describe, expect, it } from 'vitest';
import { ATRIUM_PASSAGES, ATRIUM_SOURCES } from '../../catalog.js';
import { createAtriumJourneyHandoff, calculateAtriumPayloadChecksum } from '../../handoff.js';
import { HISTORY_CORPUS } from '../../history.js';
import { PHILOSOPHY_CORPUS } from '../../philosophy.js';
import { evaluateJourneyReadiness, evaluateSourceReadiness } from '../../readiness.js';
import {
  ATRIUM_PASSAGE_AUDITS,
  ATRIUM_PILOT_EXCLUSIONS,
  ATRIUM_PILOT_INTEGRITY,
  ATRIUM_PILOT_PACK,
  ATRIUM_PILOT_PAYLOADS,
  ATRIUM_SOURCE_AUDITS,
  HISTORY_PILOT_JOURNEY_IDS,
  HISTORY_PILOT_PASSAGE_IDS,
  PHILOSOPHY_PILOT_JOURNEY_IDS,
  PHILOSOPHY_PILOT_PASSAGE_IDS
} from './index.js';

const allJourneys = [...PHILOSOPHY_CORPUS.journeys, ...HISTORY_CORPUS.journeys];
const pilotJourneyIds = [...PHILOSOPHY_PILOT_JOURNEY_IDS, ...HISTORY_PILOT_JOURNEY_IDS];

describe('Atrium pilot content pack', () => {
  it('contains the accepted domain coverage without leaking draft payloads', () => {
    expect(PHILOSOPHY_PILOT_PASSAGE_IDS).toHaveLength(13);
    expect(HISTORY_PILOT_PASSAGE_IDS).toHaveLength(14);
    expect(PHILOSOPHY_PILOT_JOURNEY_IDS).toHaveLength(4);
    expect(HISTORY_PILOT_JOURNEY_IDS).toHaveLength(4);
    expect(Object.keys(ATRIUM_PILOT_PAYLOADS).sort())
      .toEqual(Object.keys(ATRIUM_PASSAGE_AUDITS).sort());
    expect(ATRIUM_PILOT_PACK.payloadIds).toHaveLength(27);
    expect(ATRIUM_PILOT_PACK.rightsJurisdiction).toBe('US');
  });

  it('recomputes every payload and source acquisition checksum', async () => {
    for (const [passageId, text] of Object.entries(ATRIUM_PILOT_PAYLOADS)) {
      const integrity = ATRIUM_PILOT_INTEGRITY[passageId];
      expect(await calculateAtriumPayloadChecksum(text)).toBe(integrity.checksum);
      expect(text.trim().split(/\s+/u)).toHaveLength(integrity.words);
    }

    for (const audit of Object.values(ATRIUM_SOURCE_AUDITS)) {
      const acquisitionUnit = audit.sourcePayloadIds
        .map(passageId => ATRIUM_PILOT_PAYLOADS[passageId])
        .join('\n\n');
      expect(await calculateAtriumPayloadChecksum(acquisitionUnit)).toBe(audit.checksum);
    }
  });

  it('requires exact source, rights, locator, and jurisdiction metadata', () => {
    const auditedSources = ATRIUM_SOURCES.filter(source => source.status === 'publishable');
    expect(auditedSources).toHaveLength(Object.keys(ATRIUM_SOURCE_AUDITS).length);
    auditedSources.forEach(source => {
      expect(evaluateSourceReadiness(source).ready).toBe(true);
      expect(source.rights.evidenceUrl).toMatch(/^https:\/\//);
      expect(source.acquisitionScope).toBe('selected-excerpt-unit');
    });

    ATRIUM_PASSAGES.filter(passage => passage.status === 'publishable').forEach(passage => {
      expect(passage.canonicalLocator).toBeTruthy();
      expect(passage.payloadPath).toContain(passage.id);
      expect(passage.textVerified).toBe(true);
    });
  });

  it('compiles all eight cleared journeys and leaves every other journey blocked', async () => {
    for (const journey of allJourneys) {
      const expectedReady = pilotJourneyIds.includes(journey.id);
      expect(evaluateJourneyReadiness(journey).ready).toBe(expectedReady);
      if (expectedReady) {
        const handoff = await createAtriumJourneyHandoff(journey.id);
        expect(handoff.config.provenance).toMatchObject({
          contentPackId: ATRIUM_PILOT_PACK.id,
          contentPackVersion: ATRIUM_PILOT_PACK.version,
          rightsJurisdiction: 'US'
        });
        expect(handoff.config.sources).toHaveLength(journey.segments.length);
      }
    }
  });

  it('keeps the exclusions log stable and reviewable', () => {
    const ids = ATRIUM_PILOT_EXCLUSIONS.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ATRIUM_PILOT_EXCLUSIONS.every(item => (
      item.decision === 'excluded' && item.reason.length > 20
    ))).toBe(true);
  });
});
