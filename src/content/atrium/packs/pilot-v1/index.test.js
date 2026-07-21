import { describe, expect, it } from 'vitest';
import { ATRIUM_PASSAGES, ATRIUM_SOURCES } from '../../catalog.js';
import { createAtriumJourneyHandoff, calculateAtriumPayloadChecksum } from '../../handoff.js';
import { compileAtriumItinerary } from '../../itinerary.js';
import { estimateCompiledDuration } from '../../../../core/session-compiler.js';
import { ATRIUM_PILOT_PASSAGE_DURATIONS } from './durations.js';
import { HISTORY_CORPUS } from '../../history.js';
import { PHILOSOPHY_CORPUS } from '../../philosophy.js';
import { ATRIUM_SENSORY_CONFIGS } from '../../launches.js';
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
    expect(PHILOSOPHY_PILOT_PASSAGE_IDS).toHaveLength(31);
    expect(HISTORY_PILOT_PASSAGE_IDS).toHaveLength(70);
    expect(PHILOSOPHY_PILOT_JOURNEY_IDS).toHaveLength(10);
    expect(HISTORY_PILOT_JOURNEY_IDS).toHaveLength(17);
    expect(Object.keys(ATRIUM_PILOT_PAYLOADS).sort())
      .toEqual(Object.keys(ATRIUM_PASSAGE_AUDITS).sort());
    expect(ATRIUM_PILOT_PACK.payloadIds).toHaveLength(101);
    expect(ATRIUM_PILOT_PACK.rightsJurisdiction).toBe('US');
  });

  it('recomputes every payload and source acquisition checksum', async () => {
    for (const [passageId, text] of Object.entries(ATRIUM_PILOT_PAYLOADS)) {
      const integrity = ATRIUM_PILOT_INTEGRITY[passageId];
      expect(await calculateAtriumPayloadChecksum(text)).toBe(integrity.checksum);
      expect(text.trim().split(/\s+/u)).toHaveLength(integrity.words);
    }

    for (const [sourceId, audit] of Object.entries(ATRIUM_SOURCE_AUDITS)) {
      const acquisitionUnit = audit.sourcePayloadIds
        .map(passageId => ATRIUM_PILOT_PAYLOADS[passageId])
        .join('\n\n');
      expect(await calculateAtriumPayloadChecksum(acquisitionUnit), sourceId).toBe(audit.checksum);
    }
  });

  it('keeps browse-safe duration metadata pinned to the canonical compiler', () => {
    const sourceById = new Map(ATRIUM_SOURCES.map(source => [source.id, source]));
    expect(Object.keys(ATRIUM_PILOT_PASSAGE_DURATIONS).sort())
      .toEqual(Object.keys(ATRIUM_PILOT_PAYLOADS).sort());

    for (const passage of ATRIUM_PASSAGES) {
      const text = ATRIUM_PILOT_PAYLOADS[passage.id];
      if (typeof text !== 'string') continue;
      const source = sourceById.get(passage.sourceId);
      const duration = estimateCompiledDuration({
        ...ATRIUM_SENSORY_CONFIGS[passage.domain],
        sources: [{
          id: passage.id,
          name: passage.label,
          data: text,
          ...(source?.chunkProfile ? { chunkProfile: source.chunkProfile } : {})
        }]
      });
      expect(ATRIUM_PILOT_PASSAGE_DURATIONS[passage.id], passage.id).toBe(duration);
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

  it('keeps the 1.16 tranche edition-bound and free of provider furniture', () => {
    expect(ATRIUM_PILOT_PACK.version).toBe('1.16.0');
    expect(ATRIUM_PILOT_PACK.schemaVersion).toBe('1.1.0');
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-diogenes-laertius-x'].translator).toBe('Charles Duke Yonge');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-sextus-outlines'].translator).toBe('Mary Mills Patrick');
    expect(ATRIUM_SOURCE_AUDITS['src-perseus-cicero-academica'].translator).toBe('Charles Duke Yonge');
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-communist-manifesto'].translator).toBe('Samuel Moore');
    expect(ATRIUM_SOURCE_AUDITS['src-legifrance-french-abolition-1848'].rights.status).toBe('open-license-confirmed');
    expect(ATRIUM_SOURCE_AUDITS['src-scaife-plato-timaeus'].translator).toBe('Benjamin Jowett');
    expect(ATRIUM_SOURCE_AUDITS['src-scaife-aristotle-ethics'].translator).toBe('D. P. Chase');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-philo-creation'].translator).toBe('Charles Duke Yonge');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-plotinus-enneads'].translator).toBe('Kenneth Sylvan Guthrie');
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-seneca-letters'].translator).toBe('Richard Mott Gummere');
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-marcus-meditations'].translator).toBe('George Long');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-porphyry-isagoge'].translator).toBe('Octavius Freire Owen');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-iamblichus-mysteries'].translator).toBe('Thomas Taylor');
    expect(ATRIUM_SOURCE_AUDITS['src-ogl-proclus-elements'].translator).toBe('Thomas Taylor');
    expect(ATRIUM_SOURCE_AUDITS['src-wikisource-sieyes-third-estate'].rights.status).toBe('public-domain-confirmed');
    expect(ATRIUM_SOURCE_AUDITS['src-wikisource-desmoulins-lanterne'].rights.status).toBe('public-domain-confirmed');
    expect(ATRIUM_SOURCE_AUDITS['src-elysee-republic-constitution-1793'].provider).toBe('elysee-primary-document');
    expect(ATRIUM_SOURCE_AUDITS['src-gutenberg-robespierre-political-works'].editor).toBe('Charles Vellay');
    expect(ATRIUM_SOURCE_AUDITS['src-moniteur-thermidor-convention'].provider).toBe('internet-archive-scan-backed');
    expect(ATRIUM_SOURCE_AUDITS['src-creole-patriote-insurgent-letter'].provider).toBe('persee-scan-transcription-collation');
    expect(ATRIUM_SOURCE_AUDITS['src-jcb-sonthonax-emancipation'].canonicalId).toBe('internet-archive:proclamationauno00sont');
    expect(ATRIUM_SOURCE_AUDITS['src-moniteur-abolition-1794'].provider).toBe('internet-archive-scan-backed');
    expect(ATRIUM_SOURCE_AUDITS['src-founders-franklin-examination'].provider).toBe('founders-online-primary-text-only');
    expect(ATRIUM_SOURCE_AUDITS['src-yale-treaty-paris-1763'].canonicalId).toBe('yale-avalon:paris763');
    expect(ATRIUM_SOURCE_AUDITS['src-loc-continental-congress-resolves'].canonicalId).toBe('lccn:05000059:volume-1');
    expect(ATRIUM_SOURCE_AUDITS['src-legifrance-constitution-year-viii'].rights.status).toBe('open-license-confirmed');
    expect(ATRIUM_SOURCE_AUDITS['src-wikisource-code-civil-1804'].provider).toBe('wikisource-scan-backed');
    expect(ATRIUM_SOURCE_AUDITS['src-loc-anderson-napoleon-deposition'].translator).toContain('individual translator not stated');
    expect(ATRIUM_SOURCE_AUDITS['src-wienbibliothek-vienna-final-act'].rights.license).toBe('Public Domain Mark 1.0');
    expect(ATRIUM_SOURCE_AUDITS['src-nara-treaty-paris-1783'].canonicalId).toBe('nara:RG11-treaty-of-paris-1783');
    expect(ATRIUM_SOURCE_AUDITS['src-wikisource-ardouin-haiti-recognition-1825'].provider).toBe('wikisource-scan-backed-document-compilation');
    expect(ATRIUM_SOURCE_AUDITS['src-uk-patent-watt-913'].canonicalId).toBe('great-britain-patent:913:1769');
    expect(ATRIUM_SOURCE_AUDITS['src-baines-cotton-manufacture-1835'].canonicalId).toBe('internet-archive:cottonmanufact00bain');
    expect(ATRIUM_SOURCE_AUDITS['src-marsden-cotton-weaving-1895'].provider).toBe('university-of-arizona-weaving-archive-scan');
    expect(ATRIUM_SOURCE_AUDITS['src-guardian-stockton-darlington-archive-1825'].canonicalId).toContain('1825-09-24');
    expect(ATRIUM_SOURCE_AUDITS['src-loc-lexington-depositions-1775'].canonicalId).toBe('lccn:05000059:volume-2');
    expect(ATRIUM_SOURCE_AUDITS['src-uh-gage-dartmouth-1775'].provider).toContain('primary-text-only');
    expect(ATRIUM_SOURCE_AUDITS['src-founders-washington-orders-1775'].collationUrls).toHaveLength(2);
    expect(ATRIUM_SOURCE_AUDITS['src-founders-franco-american-alliance-1778'].editionDate).toContain('signed bilingual instrument');
    expect(ATRIUM_SOURCE_AUDITS['src-founders-yorktown-capitulation-1781'].collationUrls[0]).toContain('loc.gov/resource');
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-rousseau-social-contract']).toMatchObject({
      translator: 'G. D. H. Cole',
      canonicalId: 'gutenberg:46333',
      provider: 'project-gutenberg-scan-backed'
    });
    expect(ATRIUM_SOURCE_AUDITS['src-candidate-rousseau-social-contract'].canonicalUrl).not.toContain('loc.gov');
    expect(ATRIUM_SOURCE_AUDITS['src-avalon-vermont-constitution-1777'].canonicalId).toBe('avalon:vermont-constitution:1777-07-08');
    expect(ATRIUM_SOURCE_AUDITS['src-nara-articles-confederation'].canonicalId).toContain('articles-of-confederation');
    expect(ATRIUM_SOURCE_AUDITS['src-nara-bill-rights-1789'].canonicalId).toContain('engrossed-bill-of-rights');
    expect(ATRIUM_SOURCE_AUDITS['src-founders-boston-massacre-crown'].provider).toBe('founders-online-primary-text-only');
    expect(ATRIUM_SOURCE_AUDITS['src-founders-boston-massacre-defense'].canonicalId).toContain('0003-0006');
    expect(ATRIUM_SOURCE_AUDITS['src-ukna-boston-tea-newspaper-1773'].canonicalId).toContain('CO-5/91');
    expect(ATRIUM_SOURCE_AUDITS['src-ukna-boston-tea-leslie-1773'].canonicalId).toContain('WO-40/1');
    expect(ATRIUM_SOURCE_AUDITS['src-bailly-maillard-october-days'].canonicalId).toContain('mmoiresdebailly03bail');
    expect(ATRIUM_SOURCE_AUDITS['src-arcpa-womens-march-session'].canonicalId).toContain('t1_0348');
    expect(ATRIUM_SOURCE_AUDITS['src-hansard-apprenticeship-debate-1838'].rights.license).toBe('Open Parliament Licence');
    expect(ATRIUM_SOURCE_AUDITS['src-unb-barbados-apprenticeship-termination-1838'].canonicalId).toContain('co-28-125');

    const trancheIds = [
      'pass-epicurus-gods-death',
      'pass-sextus-skeptical-way',
      'pass-cicero-academic',
      'pass-communist-manifesto',
      'pass-french-abolition-1848',
      'pass-plato-cosmos',
      'pass-aristotle-human-good',
      'pass-democritus-atoms',
      'pass-philo-creation',
      'pass-plotinus-beauty',
      'pass-plotinus-hypostases',
      'pass-seneca-inner-spirit',
      'pass-marcus-morning',
      'pass-porphyry-isagoge',
      'pass-iamblichus-theurgy',
      'pass-proclus-propositions',
      'pass-somerset',
      'pass-uk-slave-trade-act',
      'pass-us-importation-act',
      'pass-slavery-abolition-1833',
      'pass-sieyes-third-estate',
      'pass-desmoulins-lanterne',
      'pass-republic-constitution-1793',
      'pass-robespierre-virtue-terror',
      'pass-thermidor-convention',
      'pass-haiti-insurgent-letter-1792',
      'pass-sonthonax-emancipation-1793',
      'pass-convention-abolition-1794',
      'pass-franklin-war-finance-1766',
      'pass-treaty-paris-1763',
      'pass-first-continental-resolves-1774',
      'pass-constitution-year-viii',
      'pass-code-civil-1804',
      'pass-senate-deposition-napoleon-1814',
      'pass-congress-vienna-final-act-1815',
      'pass-treaty-paris-1783',
      'pass-haiti-recognition-1825',
      'pass-watt-steam-principles-1769',
      'pass-arkwright-water-frame-system-1769',
      'pass-cartwright-power-loom-iteration-1785',
      'pass-stockton-darlington-opening-1825',
      'pass-lexington-provincial-evidence-1775',
      'pass-gage-lexington-report-1775',
      'pass-washington-continental-orders-1775',
      'pass-franco-american-alliance-1778',
      'pass-yorktown-capitulation-1781',
      'pass-rousseau-association',
      'pass-vermont-constitution-1777',
      'pass-articles-confederation-1777',
      'pass-us-bill-rights-proposal-1789',
      'pass-boston-massacre-crown-evidence',
      'pass-boston-massacre-defense-evidence',
      'pass-boston-tea-colonial-newspaper-1773',
      'pass-boston-tea-leslie-letter-1773',
      'pass-maillard-womens-march-deposition',
      'pass-assembly-womens-march-1789',
      'pass-tucuman-independence-act-1816',
      'pass-belgrano-government-unsettled-1816',
      'pass-tucuman-order-decree-1816',
      'pass-plan-iguala-1821',
      'pass-mexico-independence-act-1821',
      'pass-peru-lima-independence-act-1821',
      'pass-peru-protector-decree-1821',
      'pass-brazil-manifesto-peoples-1822',
      'pass-brazil-council-session-1822',
      'pass-cachoeira-adhesion-letter-1822',
      'pass-commons-apprenticeship-debate-1838',
      'pass-barbados-apprenticeship-termination-1838'
    ];
    trancheIds.forEach(passageId => {
      const text = ATRIUM_PILOT_PAYLOADS[passageId];
      expect(text).not.toMatch(/[\u200B-\u200D\uFEFF]/u);
      expect(text).not.toMatch(/Project Gutenberg|Produced by|subscribe to our email/iu);
      expect(text).not.toMatch(/\[Greek:|\[\d+\]|Citer ce document|Fichier pdf généré/iu);
    });
  });

  it('preserves the tranche distinctions and complete selected boundaries', () => {
    const vermont = ATRIUM_PILOT_PAYLOADS['pass-vermont-constitution-1777'];
    expect(vermont).toContain('after she arrives to the age of eighteen years');
    expect(vermont).toContain('who professes the protestant religion');
    expect(vermont).toContain('I solemnly swear');
    expect(vermont.trim()).toMatch(/without fear or favor of any man\.$/u);

    const articles = ATRIUM_PILOT_PAYLOADS['pass-articles-confederation-1777'];
    expect(articles).toContain('retains its sovereignty, freedom and independence');
    expect(articles).toContain('each state shall have one vote');

    const amendments = ATRIUM_PILOT_PAYLOADS['pass-us-bill-rights-proposal-1789'];
    expect(amendments.match(/Article the (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\./gu)).toHaveLength(12);
    expect(amendments).toContain('Article the first.');
    expect(amendments).toContain('Article the second.');
    expect(amendments.trim()).toMatch(/or to the people\.$/u);
  });

  it('preserves conflicting testimony and makes record mediation explicit', () => {
    const crown = ATRIUM_PILOT_PAYLOADS['pass-boston-massacre-crown-evidence'];
    const defense = ATRIUM_PILOT_PAYLOADS['pass-boston-massacre-defense-evidence'];
    expect(crown).toContain('Heard no Order given to fire');
    expect(defense).toContain('I am very certain he did not give the word fire');
    expect(defense).toContain('Newton Prince a Negro a Member of the South Church');

    const newspaper = ATRIUM_PILOT_PAYLOADS['pass-boston-tea-colonial-newspaper-1773'];
    const military = ATRIUM_PILOT_PAYLOADS['pass-boston-tea-leslie-letter-1773'];
    expect(newspaper).toContain('Such Attention to private Property was observed');
    expect(military).toContain('the mob threatens them much');

    const maillard = ATRIUM_PILOT_PAYLOADS['pass-maillard-womens-march-deposition'];
    const assembly = ATRIUM_PILOT_PAYLOADS['pass-assembly-womens-march-1789'];
    expect(maillard).toContain("qui ne voulaient pas d'hommes parmi elles");
    expect(assembly).toContain('quand Paris est sans pain');
    expect(ATRIUM_PASSAGE_AUDITS['pass-maillard-womens-march-deposition'].normalization).toContain('self-exculpatory');
  });

  it('keeps Assembly, Republic, Terror bounded and independent of the reused Rights declaration', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-france-1789-1794');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-sieyes-third-estate',
      'pass-desmoulins-lanterne',
      'pass-republic-constitution-1793',
      'pass-robespierre-virtue-terror',
      'pass-thermidor-convention'
    ]);
    expect(journey.openRequirements).toEqual([]);
    expect(journey.segments.some(segment => segment.passageId === 'pass-rights-man')).toBe(false);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Freedom, Labor, Sovereignty a bounded five-document argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-haiti-freedom-state');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-haiti-insurgent-letter-1792',
      'pass-sonthonax-emancipation-1793',
      'pass-convention-abolition-1794',
      'pass-haiti-constitution-1801',
      'pass-haiti-independence-1804'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes War, Debt, and the Fiscal State a bounded five-document argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-empire-debt-resistance');
    expect(journey.title).toBe('War, Debt, and the Fiscal State');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-franklin-war-finance-1766',
      'pass-treaty-paris-1763',
      'pass-stamp-act',
      'pass-first-continental-resolves-1774',
      'pass-common-sense'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Revolution and Settlement a bounded five-document argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-revolution-settlement-1789-1815');
    expect(journey.title).toBe('Revolution and Settlement, 1789–1815');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-rights-man',
      'pass-constitution-year-viii',
      'pass-code-civil-1804',
      'pass-senate-deposition-napoleon-1814',
      'pass-congress-vienna-final-act-1815'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(15 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Treaties and the Atlantic Order a bounded five-document comparison', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-treaties-atlantic-order');
    expect(journey.title).toBe('Treaties and the Atlantic Order');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-treaty-paris-1763',
      'pass-treaty-paris-1783',
      'pass-jamaica-letter',
      'pass-monroe-message',
      'pass-haiti-recognition-1825'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Machines, Patents, and Production a bounded four-system argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-machines-patents-production');
    expect(journey.title).toBe('Machines, Patents, and Production');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-watt-steam-principles-1769',
      'pass-arkwright-water-frame-system-1769',
      'pass-cartwright-power-loom-iteration-1785',
      'pass-stockton-darlington-opening-1825'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(15 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(16 * 60_000);
  });

  it('makes War for Independence a bounded five-position causal argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-war-independence');
    expect(journey.title).toBe('War for Independence');
    expect(journey.anchorIds).toEqual([
      'hist-lexington-concord',
      'hist-continental-army',
      'hist-franco-american-alliance',
      'hist-yorktown',
      'hist-treaty-paris-1783'
    ]);
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-lexington-provincial-evidence-1775',
      'pass-gage-lexington-report-1775',
      'pass-washington-continental-orders-1775',
      'pass-franco-american-alliance-1778',
      'pass-yorktown-capitulation-1781',
      'pass-treaty-paris-1783'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Association, Confederation, Amendment a bounded four-position constitutional argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-association-confederation-amendment');
    expect(journey.title).toBe('Association, Confederation, Amendment');
    expect(journey.anchorIds).toEqual([
      'hist-social-contract',
      'hist-vermont-constitution',
      'hist-articles-confederation',
      'hist-us-bill-rights'
    ]);
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-rousseau-association',
      'pass-vermont-constitution-1777',
      'pass-articles-confederation-1777',
      'pass-us-bill-rights-proposal-1789'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('makes Crowd, Testimony, Publicity a bounded six-record evidentiary argument', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-crowd-testimony-publicity');
    expect(journey.anchorIds).toEqual([
      'hist-boston-massacre',
      'hist-boston-tea-party',
      'hist-womens-march'
    ]);
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-boston-massacre-crown-evidence',
      'pass-boston-massacre-defense-evidence',
      'pass-boston-tea-colonial-newspaper-1773',
      'pass-boston-tea-leslie-letter-1773',
      'pass-maillard-womens-march-deposition',
      'pass-assembly-womens-march-1789'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(15 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(16 * 60_000);
  });

  it('makes Independence without a Single Model a bounded four-process comparison', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-independence-many-models');
    expect(journey.anchorIds).toEqual([
      'hist-argentina-independence',
      'hist-mexico-independence',
      'hist-peru-independence',
      'hist-brazil-independence'
    ]);
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-tucuman-independence-act-1816',
      'pass-plan-iguala-1821',
      'pass-mexico-independence-act-1821',
      'pass-peru-lima-independence-act-1821',
      'pass-peru-protector-decree-1821',
      'pass-brazil-council-session-1822',
      'pass-cachoeira-adhesion-letter-1822'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(15 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('repairs Abolition and Its Limits through the deferred 1838 endpoint', () => {
    const journey = HISTORY_CORPUS.journeys.find(item => item.id === 'seq-hist-abolition-law-limit');
    expect(journey.anchorIds).toContain('hist-british-emancipation');
    expect(journey.segments.map(segment => segment.passageId)).toEqual([
      'pass-equiano',
      'pass-uk-slave-trade-act',
      'pass-slavery-abolition-1833',
      'pass-commons-apprenticeship-debate-1838',
      'pass-barbados-apprenticeship-termination-1838'
    ]);
    expect(journey.openRequirements).toEqual([]);
    const itinerary = compileAtriumItinerary(journey);
    expect(itinerary.totalDuration).toBeGreaterThanOrEqual(17 * 60_000);
    expect(itinerary.totalDuration).toBeLessThanOrEqual(18 * 60_000);
  });

  it('compiles all twenty-seven cleared journeys and leaves every other journey blocked', async () => {
    for (const journey of allJourneys) {
      const expectedReady = pilotJourneyIds.includes(journey.id);
      expect(evaluateJourneyReadiness(journey).ready).toBe(expectedReady);
      if (expectedReady) {
        const itinerary = compileAtriumItinerary(journey);
        expect(itinerary.totalDuration, journey.id).toBeGreaterThanOrEqual(8 * 60_000);
        expect(itinerary.totalDuration, journey.id).toBeLessThanOrEqual(18 * 60_000);
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
