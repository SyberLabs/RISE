import {
  ATRIUM_CORPUS_VERSION,
  ATRIUM_PACK_JURISDICTION,
  SHA256_CHECKSUM_PATTERN
} from './constants.js';
import { ATRIUM_PASSAGES, ATRIUM_SOURCES } from './catalog.js';
import { HISTORY_CORPUS } from './history.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import {
  ATRIUM_PILOT_PACK
} from './packs/pilot-v1/manifest.js';
import { ATRIUM_PILOT_PAYLOADS } from './packs/pilot-v1/payloads.js';
import { evaluateJourneyReadiness } from './readiness.js';
import { ATRIUM_POINT_LAUNCHES, findAtriumPoint, sensoryConfigFor } from './launches.js';

export const ATRIUM_PAYLOADS = ATRIUM_PILOT_PAYLOADS;

const allJourneys = () => [
  ...PHILOSOPHY_CORPUS.journeys,
  ...HISTORY_CORPUS.journeys
];

function payloadFrom(registry, passageId) {
  if (registry instanceof Map) return registry.get(passageId);
  return registry && typeof registry === 'object' ? registry[passageId] : undefined;
}

function payloadText(entry) {
  if (typeof entry === 'string') return entry;
  return typeof entry?.text === 'string' ? entry.text : '';
}

function wordCount(text) {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

function sourceName(source, passage) {
  return `${source.author}, ${source.workTitle} — ${passage.label}`;
}

export class AtriumHandoffError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AtriumHandoffError';
    this.code = code;
    this.details = details;
  }
}

export async function calculateAtriumPayloadChecksum(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Atrium payload checksum input must be text.');
  }
  if (!globalThis.crypto?.subtle) {
    throw new AtriumHandoffError('ATRIUM_CRYPTO_UNAVAILABLE', 'SHA-256 is unavailable in this runtime.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

export function findAtriumJourney(journeyId, journeys = allJourneys()) {
  return (Array.isArray(journeys) ? journeys : []).find(journey => journey.id === journeyId) || null;
}

export function findAtriumLaunch(launchId, launches = [...allJourneys(), ...ATRIUM_POINT_LAUNCHES]) {
  return (Array.isArray(launches) ? launches : []).find(launch => launch.id === launchId) || null;
}

/**
 * Build the only supported Atrium -> Chamber boundary.
 *
 * The function is deliberately asynchronous because payload bytes are hashed
 * before they can enter a session. Candidate locators and unverified text can
 * never be substituted for a missing packaged payload.
 */
export async function createAtriumJourneyHandoff(journeyOrId, options = {}) {
  const passages = Array.isArray(options.passages) ? options.passages : ATRIUM_PASSAGES;
  const sources = Array.isArray(options.sources) ? options.sources : ATRIUM_SOURCES;
  const payloads = options.payloads || ATRIUM_PAYLOADS;
  const journeys = Array.isArray(options.journeys)
    ? options.journeys
    : [...allJourneys(), ...ATRIUM_POINT_LAUNCHES];
  const journey = typeof journeyOrId === 'string'
    ? findAtriumLaunch(journeyOrId, journeys)
    : journeyOrId;

  if (!journey) {
    throw new AtriumHandoffError('ATRIUM_JOURNEY_NOT_FOUND', 'Atrium journey does not exist.');
  }

  const launchKind = journey.kind === 'point' ? 'point' : 'journey';

  const readiness = evaluateJourneyReadiness(journey, passages, sources);
  if (!readiness.ready) {
    throw new AtriumHandoffError(
      'ATRIUM_JOURNEY_NOT_READY',
      'Atrium journey has not cleared source, rights, and text review.',
      { journeyId: journey.id, reasons: readiness.reasons.map(reason => reason.code) }
    );
  }

  const chamberSources = [];
  for (const segment of readiness.segments) {
    const { passage, source } = segment;
    const text = payloadText(payloadFrom(payloads, passage.id));
    if (!text.trim()) {
      throw new AtriumHandoffError(
        'ATRIUM_PAYLOAD_MISSING',
        `Packaged payload is missing for ${passage.id}.`,
        { journeyId: journey.id, passageId: passage.id }
      );
    }

    const checksum = await calculateAtriumPayloadChecksum(text);
    if (!SHA256_CHECKSUM_PATTERN.test(passage.payloadChecksum) || checksum !== passage.payloadChecksum.toLowerCase()) {
      throw new AtriumHandoffError(
        'ATRIUM_PAYLOAD_INTEGRITY',
        `Packaged payload checksum failed for ${passage.id}.`,
        { journeyId: journey.id, passageId: passage.id }
      );
    }

    const actualWords = wordCount(text);
    if (actualWords !== passage.estimatedWords) {
      throw new AtriumHandoffError(
        'ATRIUM_PAYLOAD_WORD_COUNT',
        `Packaged payload word count failed for ${passage.id}.`,
        { journeyId: journey.id, passageId: passage.id, expected: passage.estimatedWords, actual: actualWords }
      );
    }

    chamberSources.push({
      id: passage.id,
      name: sourceName(source, passage),
      type: 'text',
      providerId: source.provider,
      data: text,
      provenance: {
        kind: 'atrium-passage',
        corpusVersion: ATRIUM_CORPUS_VERSION,
        contentPackId: ATRIUM_PILOT_PACK.id,
        contentPackVersion: ATRIUM_PILOT_PACK.version,
        rightsJurisdiction: ATRIUM_PACK_JURISDICTION,
        domain: journey.domain,
        ...(launchKind === 'journey'
          ? { journeyId: journey.id, journeyTitle: journey.title }
          : { pointId: journey.id, pointTitle: journey.title, anchorId: journey.anchorIds[0] || null }),
        segmentRole: segment.role,
        sourceId: source.id,
        passageId: passage.id,
        author: source.author,
        workTitle: source.workTitle,
        editor: source.editor,
        translator: source.translator,
        editionDate: source.editionDate,
        language: source.language,
        originalLanguage: source.originalLanguage,
        canonicalId: source.canonicalId,
        canonicalUrl: source.canonicalUrl,
        canonicalLocator: passage.canonicalLocator,
        editionChecksum: source.checksum,
        editionChecksumScope: source.acquisitionScope,
        editionRetrievedAt: source.retrievedAt,
        checksum,
        rightsStatus: passage.rightsStatus,
        attribution: source.rights.attribution
      }
    });
  }

  return {
    text: chamberSources.map(source => source.data).join('\n\n'),
    source: `Atrium · ${journey.title}`,
    config: {
      ...sensoryConfigFor(journey.domain),
      sources: chamberSources,
      origin: {
        view: 'atrium',
        icon: '⌘',
        name: 'Atrium',
        data: {
          ...(options.origin && typeof options.origin === 'object' ? options.origin : {}),
          domain: journey.domain,
          selectedId: journey.anchorIds[0] || null,
          expandedJourneyId: launchKind === 'journey' ? journey.id : null
        }
      },
      provenance: {
        kind: `atrium-${launchKind}`,
        corpusVersion: ATRIUM_CORPUS_VERSION,
        contentPackId: ATRIUM_PILOT_PACK.id,
        contentPackVersion: ATRIUM_PILOT_PACK.version,
        rightsJurisdiction: ATRIUM_PACK_JURISDICTION,
        domain: journey.domain,
        ...(launchKind === 'journey'
          ? { journeyId: journey.id, journeyTitle: journey.title }
          : { pointId: journey.id, pointTitle: journey.title, anchorId: journey.anchorIds[0] || null }),
        passageIds: chamberSources.map(source => source.id)
      }
    }
  };
}

export async function createAtriumPointHandoff(pointOrAnchorId, options = {}) {
  const point = typeof pointOrAnchorId === 'string'
    ? findAtriumPoint(pointOrAnchorId) || findAtriumLaunch(pointOrAnchorId, ATRIUM_POINT_LAUNCHES)
    : pointOrAnchorId;
  if (!point || point.kind !== 'point') {
    throw new AtriumHandoffError('ATRIUM_POINT_NOT_FOUND', 'Atrium point does not exist.');
  }
  return createAtriumJourneyHandoff(point, { ...options, journeys: [point] });
}
