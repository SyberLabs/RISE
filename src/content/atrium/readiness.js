import { ATRIUM_PASSAGES, ATRIUM_SOURCES } from './catalog.js';
import {
  ATRIUM_PACK_JURISDICTION,
  PACKABLE_RIGHTS,
  SHA256_CHECKSUM_PATTERN
} from './constants.js';

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const issue = (code, message, recordId = null) => ({ code, message, recordId });
const toArray = value => (Array.isArray(value) ? value : []);

function sourceIndex(sources) {
  return new Map(toArray(sources).filter(Boolean).map(source => [source.id, source]));
}

function passageIndex(passages) {
  return new Map(toArray(passages).filter(Boolean).map(passage => [passage.id, passage]));
}

export function evaluateSourceReadiness(source) {
  const reasons = [];
  if (!source) {
    reasons.push(issue('missing-source', 'No edition-level source record resolves for this passage.'));
    return { ready: false, state: 'blocked', reasons, source: null };
  }

  const rights = source.rights || {};
  if (!PACKABLE_RIGHTS.includes(rights.status)) {
    reasons.push(issue('rights-review', 'Edition-level reuse rights have not been cleared.', source.id));
  }
  if (!Array.isArray(rights.jurisdictions) || rights.jurisdictions.length === 0) {
    reasons.push(issue('missing-jurisdiction', 'Rights review needs at least one jurisdiction.', source.id));
  } else if (!rights.jurisdictions.includes('WORLDWIDE')
    && !rights.jurisdictions.includes(ATRIUM_PACK_JURISDICTION)) {
    reasons.push(issue(
      'rights-jurisdiction-mismatch',
      'Edition rights do not cover the configured Atrium pack jurisdiction.',
      source.id
    ));
  }
  if (!hasText(rights.reviewedAt)) {
    reasons.push(issue('missing-rights-review-date', 'Rights review date is missing.', source.id));
  }
  if (!hasText(rights.attribution)) {
    reasons.push(issue('missing-attribution', 'Edition-level attribution is missing.', source.id));
  }
  if (!hasText(source.canonicalId)) {
    reasons.push(issue('missing-canonical-id', 'A stable edition identifier has not been recorded.', source.id));
  }
  if (!hasText(source.editionDate)) {
    reasons.push(issue('missing-edition-date', 'The selected edition date has not been recorded.', source.id));
  }
  if (!hasText(source.retrievedAt)) {
    reasons.push(issue('missing-source-retrieval-date', 'The selected edition retrieval date is missing.', source.id));
  }
  if (source.language !== source.originalLanguage && !hasText(source.translator)) {
    reasons.push(issue('missing-translator', 'A translated edition must identify its translator.', source.id));
  }
  if (!hasText(source.checksum)) {
    reasons.push(issue('missing-source-checksum', 'The acquired edition has no checksum.', source.id));
  } else if (!SHA256_CHECKSUM_PATTERN.test(source.checksum)) {
    reasons.push(issue('invalid-source-checksum', 'The acquired edition checksum must be SHA-256.', source.id));
  }
  if (source.status !== 'publishable') {
    reasons.push(issue('source-not-publishable', 'The source record has not completed editorial review.', source.id));
  }

  return { ready: reasons.length === 0, state: reasons.length === 0 ? 'ready' : 'blocked', reasons, source };
}

export function evaluatePassageReadiness(passage, sources = ATRIUM_SOURCES) {
  if (!passage) {
    return {
      ready: false,
      state: 'blocked',
      reasons: [issue('missing-passage', 'Journey segment does not resolve to a passage record.')],
      passage: null,
      source: null
    };
  }

  const source = sourceIndex(sources).get(passage.sourceId) || null;
  const sourceReport = evaluateSourceReadiness(source);
  const reasons = [...sourceReport.reasons];

  if (!PACKABLE_RIGHTS.includes(passage.rightsStatus)) {
    reasons.push(issue('passage-rights-review', 'The selected passage has not inherited cleared edition rights.', passage.id));
  }
  if (!hasText(passage.canonicalLocator)) {
    reasons.push(issue('missing-canonical-locator', 'The passage needs a canonical locator.', passage.id));
  }
  if (!hasText(passage.payloadPath)) {
    reasons.push(issue('missing-payload', 'No local passage payload has been packaged.', passage.id));
  }
  if (!hasText(passage.payloadChecksum)) {
    reasons.push(issue('missing-payload-checksum', 'The packaged passage has no checksum.', passage.id));
  } else if (!SHA256_CHECKSUM_PATTERN.test(passage.payloadChecksum)) {
    reasons.push(issue('invalid-payload-checksum', 'The packaged passage checksum must be SHA-256.', passage.id));
  }
  if (passage.textVerified !== true) {
    reasons.push(issue('text-unverified', 'The transcription has not passed text verification.', passage.id));
  }
  if (!Number.isFinite(passage.estimatedWords) || passage.estimatedWords <= 0) {
    reasons.push(issue('missing-word-count', 'Final payload word count is unavailable.', passage.id));
  }
  if (passage.status !== 'publishable') {
    reasons.push(issue('passage-not-publishable', 'The passage record has not completed editorial review.', passage.id));
  }

  return {
    ready: reasons.length === 0,
    state: reasons.length === 0 ? 'ready' : 'blocked',
    reasons,
    passage,
    source
  };
}

export function evaluateJourneyReadiness(
  journey,
  passages = ATRIUM_PASSAGES,
  sources = ATRIUM_SOURCES
) {
  const passagesById = passageIndex(passages);
  const segments = Array.isArray(journey?.segments) ? journey.segments : [];
  const segmentReports = segments.map(segment => ({
    ...segment,
    ...evaluatePassageReadiness(passagesById.get(segment.passageId) || null, sources)
  }));
  const reasons = [];

  if (!journey || segments.length === 0) {
    reasons.push(issue('missing-journey-segments', 'Journey has no passage sequence.', journey?.id || null));
  }
  if (journey?.status !== 'publishable') {
    reasons.push(issue('journey-not-publishable', 'Journey has not completed editorial review.', journey?.id || null));
  }
  toArray(journey?.openRequirements).forEach(requirement => {
    reasons.push(issue('open-editorial-requirement', requirement, journey.id));
  });
  segmentReports.forEach(report => reasons.push(...report.reasons));

  const readyPassages = segmentReports.filter(report => report.ready).length;
  return {
    ready: reasons.length === 0,
    state: reasons.length === 0 ? 'ready' : 'blocked',
    reasons,
    segments: segmentReports,
    readyPassages,
    totalPassages: segmentReports.length,
    journey
  };
}

export function evaluateAnchorReadiness(journeys, passages = ATRIUM_PASSAGES, sources = ATRIUM_SOURCES) {
  const journeyReports = toArray(journeys)
    .map(journey => evaluateJourneyReadiness(journey, passages, sources));
  const passageIds = new Set(journeyReports.flatMap(report => report.segments.map(segment => segment.passageId)));
  const readyPassageIds = new Set(
    journeyReports.flatMap(report => report.segments.filter(segment => segment.ready).map(segment => segment.passageId))
  );

  return {
    ready: journeyReports.some(report => report.ready),
    readyJourneys: journeyReports.filter(report => report.ready).length,
    totalJourneys: journeyReports.length,
    readyPassages: readyPassageIds.size,
    totalPassages: passageIds.size,
    journeys: journeyReports
  };
}
