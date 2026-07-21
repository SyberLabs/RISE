import { COMPLETION_DISPOSITIONS, COMPLETION_STATES, freezeManifest } from './constants.js';
import { HISTORY_CORPUS } from './history.js';
import { ATRIUM_POINT_LAUNCHES } from './launches.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import { evaluateJourneyReadiness } from './readiness.js';
import { HISTORY_PILOT_JOURNEY_IDS, PHILOSOPHY_PILOT_JOURNEY_IDS } from './packs/pilot-v1/manifest.js';

const allJourneys = [...PHILOSOPHY_CORPUS.journeys, ...HISTORY_CORPUS.journeys];

const readyJourneyIdsByAnchor = new Map();
for (const journey of allJourneys) {
  if (!evaluateJourneyReadiness(journey).ready) continue;
  journey.anchorIds.forEach(anchorId => {
    const ids = readyJourneyIdsByAnchor.get(anchorId) || [];
    ids.push(journey.id);
    readyJourneyIdsByAnchor.set(anchorId, ids);
  });
}

const pointByAnchor = new Map(ATRIUM_POINT_LAUNCHES.map(point => [point.anchorIds[0], point]));

function coverageRecord(record, domain) {
  const point = pointByAnchor.get(record.id) || null;
  const journeyIds = readyJourneyIdsByAnchor.get(record.id) || [];
  const launchable = point && journeyIds.length ? 'both' : point ? 'point' : journeyIds.length ? 'journey' : 'none';
  const completionDisposition = record.completion.disposition;
  const completionState = launchable !== 'none'
    ? 'satisfied'
    : completionDisposition === 'launch-required'
      ? 'open-required'
      : completionDisposition === 'alignment-repair'
        ? 'open-alignment'
        : 'accepted-nonlaunch';
  return {
    id: record.id,
    domain,
    launchable,
    pointId: point?.id || null,
    journeyIds,
    completionDisposition,
    completionState,
    reason: launchable === 'none' ? record.completion.rationale : null
  };
}

export const ATRIUM_LAUNCH_COVERAGE = freezeManifest([
  ...PHILOSOPHY_CORPUS.nodes.map(record => coverageRecord(record, 'philosophy')),
  ...HISTORY_CORPUS.events.map(record => coverageRecord(record, 'history'))
]);

export function launchCoverageFor(recordId) {
  return ATRIUM_LAUNCH_COVERAGE.find(record => record.id === recordId) || null;
}

export function validateLaunchCoverage() {
  const expected = [...PHILOSOPHY_CORPUS.nodes, ...HISTORY_CORPUS.events].map(record => record.id);
  const actual = ATRIUM_LAUNCH_COVERAGE.map(record => record.id);
  const errors = [];
  if (new Set(actual).size !== actual.length) errors.push({ code: 'duplicate-coverage-record' });
  expected.filter(id => !actual.includes(id)).forEach(id => errors.push({ code: 'missing-coverage-record', recordId: id }));
  ATRIUM_LAUNCH_COVERAGE.filter(record => !['journey', 'point', 'both', 'none'].includes(record.launchable))
    .forEach(record => errors.push({ code: 'invalid-coverage-state', recordId: record.id }));
  ATRIUM_LAUNCH_COVERAGE.filter(record => !COMPLETION_DISPOSITIONS.includes(record.completionDisposition))
    .forEach(record => errors.push({ code: 'invalid-completion-disposition', recordId: record.id }));
  ATRIUM_LAUNCH_COVERAGE.filter(record => !COMPLETION_STATES.includes(record.completionState))
    .forEach(record => errors.push({ code: 'invalid-completion-state', recordId: record.id }));
  const journeysById = new Map(allJourneys.map(journey => [journey.id, journey]));
  const pointsById = new Map(ATRIUM_POINT_LAUNCHES.map(point => [point.id, point]));
  ATRIUM_LAUNCH_COVERAGE.forEach(record => {
    if (record.pointId && !evaluateJourneyReadiness(pointsById.get(record.pointId)).ready) {
      errors.push({ code: 'claimed-point-not-launchable', recordId: record.id });
    }
    record.journeyIds.forEach(journeyId => {
      if (!evaluateJourneyReadiness(journeysById.get(journeyId)).ready) {
        errors.push({ code: 'claimed-journey-not-launchable', recordId: record.id, journeyId });
      }
    });
    if (record.completionDisposition === 'alignment-repair' && record.launchable === 'none') {
      errors.push({ code: 'unresolved-alignment-repair', recordId: record.id });
    }
    if (['context-only', 'evidence-bound'].includes(record.completionDisposition)
      && record.launchable !== 'none') {
      errors.push({ code: 'accepted-nonlaunch-has-launch', recordId: record.id });
    }
  });
  [...PHILOSOPHY_PILOT_JOURNEY_IDS, ...HISTORY_PILOT_JOURNEY_IDS].forEach(journeyId => {
    if (!evaluateJourneyReadiness(journeysById.get(journeyId)).ready) {
      errors.push({ code: 'pilot-pack-claim-not-launchable', journeyId });
    }
  });
  return { valid: errors.length === 0, errors };
}

export function summarizeLaunchCoverage() {
  return ATRIUM_LAUNCH_COVERAGE.reduce((table, record) => {
    table[record.domain][record.launchable] += 1;
    return table;
  }, {
    philosophy: { point: 0, journey: 0, both: 0, none: 0 },
    history: { point: 0, journey: 0, both: 0, none: 0 }
  });
}

export function summarizeCompletionCoverage() {
  return ATRIUM_LAUNCH_COVERAGE.reduce((summary, record) => {
    const domain = summary.byDomain[record.domain];
    summary.totalRecords += 1;
    domain.totalRecords += 1;
    if (record.launchable === 'none') {
      summary.rawNone += 1;
      domain.rawNone += 1;
    }
    summary[record.completionState] += 1;
    domain[record.completionState] += 1;
    return summary;
  }, {
    totalRecords: 0,
    rawNone: 0,
    satisfied: 0,
    'open-required': 0,
    'open-alignment': 0,
    'accepted-nonlaunch': 0,
    byDomain: {
      philosophy: {
        totalRecords: 0,
        rawNone: 0,
        satisfied: 0,
        'open-required': 0,
        'open-alignment': 0,
        'accepted-nonlaunch': 0
      },
      history: {
        totalRecords: 0,
        rawNone: 0,
        satisfied: 0,
        'open-required': 0,
        'open-alignment': 0,
        'accepted-nonlaunch': 0
      }
    }
  });
}
