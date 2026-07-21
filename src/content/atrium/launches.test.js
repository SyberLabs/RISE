import { describe, expect, it } from 'vitest';
import { compileSession } from '../../core/session-compiler.js';
import { ATRIUM_PASSAGES, ATRIUM_SOURCES } from './catalog.js';
import {
  ATRIUM_LAUNCH_COVERAGE,
  launchCoverageFor,
  summarizeCompletionCoverage,
  summarizeLaunchCoverage,
  validateLaunchCoverage
} from './coverage.js';
import { ATRIUM_PAYLOADS, createAtriumPointHandoff } from './handoff.js';
import { compileAtriumItinerary } from './itinerary.js';
import { ATRIUM_POINT_LAUNCHES, ATRIUM_SENSORY_CONFIGS, findAtriumPoint } from './launches.js';
import { evaluateJourneyReadiness } from './readiness.js';
import { validateAtriumEchoes } from './echoes.js';
import { AUDITED_COMPLETION_POLICIES } from './completion-policy.js';

const passageById = new Map(ATRIUM_PASSAGES.map(passage => [passage.id, passage]));
const sourceById = new Map(ATRIUM_SOURCES.map(source => [source.id, source]));

function chunkProfileForPassage(passageId) {
  const source = sourceById.get(passageById.get(passageId)?.sourceId);
  return source?.chunkProfile ? { chunkProfile: source.chunkProfile } : {};
}

describe('Atrium point launch coverage', () => {
  it('accounts for every node and event with an explicit coverage state', () => {
    const report = validateLaunchCoverage();
    const coverageTable = summarizeLaunchCoverage();
    expect(report.errors, `Launch coverage table:\n${JSON.stringify(coverageTable, null, 2)}`).toEqual([]);
    expect(report.valid).toBe(true);
    expect(ATRIUM_LAUNCH_COVERAGE).toHaveLength(96);
    expect(ATRIUM_LAUNCH_COVERAGE.every(record => ['journey', 'point', 'both', 'none'].includes(record.launchable))).toBe(true);
    expect(summarizeLaunchCoverage()).toEqual({
      philosophy: { point: 2, journey: 3, both: 21, none: 9 },
      history: { point: 1, journey: 2, both: 57, none: 1 }
    });
  });

  it('separates raw non-launches from unresolved completion work', () => {
    expect(Object.keys(AUDITED_COMPLETION_POLICIES)).toHaveLength(24);
    expect(summarizeCompletionCoverage()).toEqual({
      totalRecords: 96,
      rawNone: 10,
      satisfied: 86,
      'open-required': 7,
      'open-alignment': 0,
      'accepted-nonlaunch': 3,
      byDomain: {
        philosophy: {
          totalRecords: 35,
          rawNone: 9,
          satisfied: 26,
          'open-required': 7,
          'open-alignment': 0,
          'accepted-nonlaunch': 2
        },
        history: {
          totalRecords: 61,
          rawNone: 1,
          satisfied: 60,
          'open-required': 0,
          'open-alignment': 0,
          'accepted-nonlaunch': 1
        }
      }
    });
  });

  it('repairs the two audited journey alignments without inventing point launches', () => {
    expect(launchCoverageFor('ph-period-early-greek')).toMatchObject({
      launchable: 'journey',
      pointId: null,
      journeyIds: ['seq-ph-archai-being'],
      completionDisposition: 'alignment-repair',
      completionState: 'satisfied'
    });
    expect(launchCoverageFor('ph-tradition-patristic-platonism')).toMatchObject({
      launchable: 'journey',
      pointId: null,
      journeyIds: ['seq-ph-latin-transmission'],
      completionDisposition: 'alignment-repair',
      completionState: 'satisfied'
    });
  });

  it('only publishes points whose passages clear the unchanged readiness gate', () => {
    expect(ATRIUM_POINT_LAUNCHES).toHaveLength(81);
    ATRIUM_POINT_LAUNCHES.forEach(point => {
      expect(evaluateJourneyReadiness(point).ready).toBe(true);
    });
  });

  it('restores the four French Revolution anchors with distinct source units', () => {
    expect(Object.fromEntries([
      'hist-estates-general',
      'hist-bastille',
      'hist-french-republic',
      'hist-thermidor'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-estates-general': ['pass-sieyes-third-estate'],
      'hist-bastille': ['pass-desmoulins-lanterne'],
      'hist-french-republic': ['pass-republic-constitution-1793'],
      'hist-thermidor': ['pass-thermidor-convention']
    });
  });

  it('gives the three early Haitian Revolution anchors distinct source units', () => {
    expect(Object.fromEntries([
      'hist-haitian-uprising',
      'hist-sonthonax-emancipation',
      'hist-french-abolition-1794'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-haitian-uprising': ['pass-haiti-insurgent-letter-1792'],
      'hist-sonthonax-emancipation': ['pass-sonthonax-emancipation-1793'],
      'hist-french-abolition-1794': ['pass-convention-abolition-1794']
    });
  });

  it('repairs the fiscal-state spine with distinct war, settlement, and resistance units', () => {
    expect(Object.fromEntries([
      'hist-seven-years-war',
      'hist-treaty-paris-1763',
      'hist-first-continental-congress'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-seven-years-war': ['pass-franklin-war-finance-1766'],
      'hist-treaty-paris-1763': ['pass-treaty-paris-1763'],
      'hist-first-continental-congress': ['pass-first-continental-resolves-1774']
    });
  });

  it('repairs Brumaire and the Civil Code while adding distinct war and Vienna units', () => {
    expect(Object.fromEntries([
      'hist-brumaire',
      'hist-code-civil',
      'hist-napoleonic-wars',
      'hist-congress-vienna'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-brumaire': ['pass-constitution-year-viii'],
      'hist-code-civil': ['pass-code-civil-1804'],
      'hist-napoleonic-wars': ['pass-senate-deposition-napoleon-1814'],
      'hist-congress-vienna': ['pass-congress-vienna-final-act-1815']
    });
  });

  it('repairs treaty recognition and adds Haiti’s conditional-recognition point', () => {
    expect(Object.fromEntries([
      'hist-treaty-paris-1783',
      'hist-haiti-recognition-1825'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-treaty-paris-1783': ['pass-treaty-paris-1783'],
      'hist-haiti-recognition-1825': ['pass-haiti-recognition-1825']
    });
  });

  it('repairs the four industrial anchors with distinct system-level units', () => {
    expect(Object.fromEntries([
      'hist-watt-patent',
      'hist-water-frame',
      'hist-power-loom',
      'hist-stockton-darlington'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-watt-patent': ['pass-watt-steam-principles-1769'],
      'hist-water-frame': ['pass-arkwright-water-frame-system-1769'],
      'hist-power-loom': ['pass-cartwright-power-loom-iteration-1785'],
      'hist-stockton-darlington': ['pass-stockton-darlington-opening-1825']
    });
  });

  it('repairs the war-for-independence spine with contested, organizational, alliance, and surrender units', () => {
    expect(Object.fromEntries([
      'hist-lexington-concord',
      'hist-continental-army',
      'hist-franco-american-alliance',
      'hist-yorktown'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-lexington-concord': ['pass-lexington-provincial-evidence-1775', 'pass-gage-lexington-report-1775'],
      'hist-continental-army': ['pass-washington-continental-orders-1775'],
      'hist-franco-american-alliance': ['pass-franco-american-alliance-1778'],
      'hist-yorktown': ['pass-yorktown-capitulation-1781']
    });
  });

  it('repairs the association-confederation-amendment spine with four distinct constitutional units', () => {
    expect(Object.fromEntries([
      'hist-social-contract',
      'hist-vermont-constitution',
      'hist-articles-confederation',
      'hist-us-bill-rights'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-social-contract': ['pass-rousseau-association'],
      'hist-vermont-constitution': ['pass-vermont-constitution-1777'],
      'hist-articles-confederation': ['pass-articles-confederation-1777'],
      'hist-us-bill-rights': ['pass-us-bill-rights-proposal-1789']
    });
  });

  it('repairs the three crowd anchors without collapsing conflicting records', () => {
    expect(Object.fromEntries([
      'hist-boston-massacre',
      'hist-boston-tea-party',
      'hist-womens-march'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-boston-massacre': ['pass-boston-massacre-crown-evidence', 'pass-boston-massacre-defense-evidence'],
      'hist-boston-tea-party': ['pass-boston-tea-colonial-newspaper-1773', 'pass-boston-tea-leslie-letter-1773'],
      'hist-womens-march': ['pass-maillard-womens-march-deposition', 'pass-assembly-womens-march-1789']
    });
  });

  it('launches four independence processes without reducing them to one declarative model', () => {
    expect(Object.fromEntries([
      'hist-argentina-independence',
      'hist-mexico-independence',
      'hist-peru-independence',
      'hist-brazil-independence'
    ].map(anchorId => [
      anchorId,
      findAtriumPoint(anchorId).segments.map(segment => segment.passageId)
    ]))).toEqual({
      'hist-argentina-independence': ['pass-tucuman-independence-act-1816', 'pass-belgrano-government-unsettled-1816', 'pass-tucuman-order-decree-1816'],
      'hist-mexico-independence': ['pass-plan-iguala-1821', 'pass-mexico-independence-act-1821'],
      'hist-peru-independence': ['pass-peru-lima-independence-act-1821', 'pass-peru-protector-decree-1821'],
      'hist-brazil-independence': ['pass-brazil-manifesto-peoples-1822', 'pass-brazil-council-session-1822', 'pass-cachoeira-adhesion-letter-1822']
    });
  });

  it('launches British emancipation through contested Parliament and colonial implementation', () => {
    expect(findAtriumPoint('hist-british-emancipation').segments.map(segment => segment.passageId)).toEqual([
      'pass-commons-apprenticeship-debate-1838',
      'pass-barbados-apprenticeship-termination-1838'
    ]);
  });

  it('keeps every point launch inside the genuine three-to-seven-minute editorial window', () => {
    ATRIUM_POINT_LAUNCHES.forEach(point => {
      const itinerary = compileAtriumItinerary(point);
      expect(itinerary.ready).toBe(true);
      expect(itinerary.totalDuration, point.id).toBeGreaterThanOrEqual(180_000);
      expect(itinerary.totalDuration, point.id).toBeLessThanOrEqual(420_000);
    });
  });

  it('uses the canonical compiler for every itinerary station and total', () => {
    const point = findAtriumPoint('ph-thinker-plato');
    const itinerary = compileAtriumItinerary(point);
    expect(itinerary.ready).toBe(true);
    expect(itinerary.segments).toHaveLength(4);
    const session = compileSession({
      ...ATRIUM_SENSORY_CONFIGS.philosophy,
      title: point.title,
      sources: point.segments.map(segment => ({
        ...chunkProfileForPassage(segment.passageId),
        id: segment.passageId,
        name: segment.passageId,
        type: 'text',
        data: ATRIUM_PAYLOADS[segment.passageId]
      }))
    });
    expect(itinerary.totalDuration).toBe(session.totalDuration);
  });

  it('emits point provenance, exact source concatenation, and the curated sensory contract', async () => {
    const handoff = await createAtriumPointHandoff('ph-thinker-plato');
    expect(handoff.config.provenance).toMatchObject({
      kind: 'atrium-point',
      pointId: 'point-ph-thinker-plato',
      anchorId: 'ph-thinker-plato'
    });
    expect(handoff.config.sources.every(source => (
      source.provenance.pointId === 'point-ph-thinker-plato'
      && !Object.hasOwn(source.provenance, 'journeyId')
    ))).toBe(true);
    expect(handoff.text).toBe(handoff.config.sources.map(source => source.data).join('\n\n'));
    expect(handoff.config).toMatchObject({
      soundscape: 'aurora',
      curve: 'flat',
      visualConfig: {
        interlocution: {
          frequency: 0.15,
          procedural: ['harmonograph'],
          // Plato carries curated collections that replace the domain
          // default: Old Masters for the tradition that transmitted him,
          // geometry for the Divided Line and the Forms.
          sourced: ['aic-oldmasters', 'geometry'],
          atriumCollections: ['aic-oldmasters', 'geometry'],
          harmonographClimate: 'auto'
        }
      }
    });
  });

  it('fails point launches closed when a packaged checksum is corrupted', async () => {
    const point = findAtriumPoint('ph-school-milesian');
    const payloads = {
      ...ATRIUM_PAYLOADS,
      'pass-anaximander-fragment': `${ATRIUM_PAYLOADS['pass-anaximander-fragment']} altered`
    };
    await expect(createAtriumPointHandoff(point, { payloads })).rejects.toMatchObject({
      code: 'ATRIUM_PAYLOAD_INTEGRITY'
    });
  });

  it('keeps the small cross-domain echo slice content-gated', () => {
    expect(validateAtriumEchoes()).toEqual({ valid: true, errors: [] });
  });
});
