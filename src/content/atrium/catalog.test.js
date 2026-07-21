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
    expect(ATRIUM_CATALOG.passages).toHaveLength(104);
    expect(ATRIUM_CATALOG.sources.filter(source => source.status === 'publishable')).toHaveLength(94);
    expect(ATRIUM_CATALOG.passages.filter(passage => passage.status === 'publishable')).toHaveLength(101);
    expect(ATRIUM_CATALOG.passages.filter(passage => passage.status !== 'publishable').every(passage => (
      passage.payloadPath === null
      && passage.textVerified === false
    ))).toBe(true);
  });

  it('keeps a passage blocked until edition, rights, locator, payload, and text checks pass', () => {
    const passage = ATRIUM_CATALOG.passages.find(item => item.id === 'pass-porphyry-life-14');
    const report = evaluatePassageReadiness(passage);
    expect(report.ready).toBe(false);
    expect(report.reasons.map(reason => reason.code)).toEqual(expect.arrayContaining([
      'rights-review',
      'missing-canonical-locator',
      'missing-payload',
      'text-unverified'
    ]));
  });

  it('derives Haitian journey readiness from its cleared five-passage graph', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-haiti-freedom-state');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(5);
    expect(report.readyPassages).toBe(5);
    expect(report.reasons).toEqual([]);
  });

  it('derives fiscal-state journey readiness from five independently audited documents', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-empire-debt-resistance');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(5);
    expect(report.readyPassages).toBe(5);
    expect(report.reasons).toEqual([]);
  });

  it('derives revolutionary-settlement readiness from five independently audited documents', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-revolution-settlement-1789-1815');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(5);
    expect(report.readyPassages).toBe(5);
    expect(report.reasons).toEqual([]);
  });

  it('derives Atlantic-order readiness from five independently audited document positions', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-treaties-atlantic-order');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(5);
    expect(report.readyPassages).toBe(5);
    expect(report.reasons).toEqual([]);
  });

  it('derives industrial-system readiness from four independently audited technical positions', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-machines-patents-production');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(4);
    expect(report.readyPassages).toBe(4);
    expect(report.reasons).toEqual([]);
  });

  it('derives war-for-independence readiness from six distinct evidentiary positions', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-war-independence');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(6);
    expect(report.readyPassages).toBe(6);
    expect(report.reasons).toEqual([]);
  });

  it('derives association-confederation-amendment readiness from four distinct constitutional positions', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-association-confederation-amendment');
    const report = evaluateJourneyReadiness(journey);
    expect(report.ready).toBe(true);
    expect(report.totalPassages).toBe(4);
    expect(report.readyPassages).toBe(4);
    expect(report.reasons).toEqual([]);
  });

  it('summarizes point-launch readiness without double-counting shared passages', () => {
    const journeys = PHILOSOPHY_CORPUS.journeys.filter(journey => journey.anchorIds.includes('ph-thinker-plato'));
    const report = evaluateAnchorReadiness(journeys);
    expect(report.totalJourneys).toBe(3);
    expect(report.totalPassages).toBe(9);
    expect(report.readyPassages).toBe(9);
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
