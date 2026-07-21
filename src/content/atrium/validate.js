import {
  ATRIUM_SCHEMA_VERSION,
  COMPLETION_DISPOSITIONS,
  EVIDENCE_LEVELS,
  HISTORY_LANES,
  HISTORY_RANGE,
  JOURNEY_SEGMENT_ROLES,
  LAUNCH_STATUSES,
  PACKABLE_RIGHTS,
  PHILOSOPHY_ERAS,
  PHILOSOPHY_NODE_KINDS,
  RECORD_STATUSES,
  RIGHTS_STATUSES,
  SHA256_CHECKSUM_PATTERN,
  RELATIONSHIP_CONFIDENCE,
  RELATIONSHIP_TYPES
} from './constants.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import { HISTORY_CORPUS } from './history.js';
import { ATRIUM_CATALOG } from './catalog.js';
import { evaluatePassageReadiness, evaluateSourceReadiness } from './readiness.js';
import { PHILOSOPHY_SURVIVAL_NOTES } from './editorial-review.js';

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function createReport() {
  return {
    errors: [],
    warnings: [],
    get valid() {
      return this.errors.length === 0;
    }
  };
}

function add(report, level, code, message, recordId = null) {
  report[level].push({ code, message, recordId });
}

function validateCorpusHeader(corpus, report) {
  if (!isRecord(corpus)) {
    add(report, 'errors', 'invalid-corpus', 'Corpus must be an object.');
    return false;
  }
  if (!hasText(corpus.id) || !hasText(corpus.label)) {
    add(report, 'errors', 'incomplete-corpus', 'Corpus needs a stable id and label.', corpus.id || null);
  }
  if (corpus.schemaVersion !== ATRIUM_SCHEMA_VERSION) {
    add(report, 'errors', 'schema-version', `Expected schema ${ATRIUM_SCHEMA_VERSION}.`, corpus.id);
  }
  if (!hasText(corpus.corpusVersion)) {
    add(report, 'errors', 'missing-corpus-version', 'Corpus needs a content version.', corpus.id);
  }
  validateStatus(corpus, report);
  return true;
}

function validateResearchSources(value, report, corpusId) {
  if (!isRecord(value)) {
    add(report, 'errors', 'invalid-research-sources', 'Research sources must be an object.', corpusId);
    return {};
  }
  Object.entries(value).forEach(([id, source]) => {
    if (!hasText(id) || !isRecord(source) || !hasText(source.label) || !hasText(source.href)) {
      add(report, 'errors', 'invalid-research-source', 'Research source needs an id, label, and URL.', id || corpusId);
      return;
    }
    if (!source.href.startsWith('https://')) {
      add(report, 'errors', 'insecure-research-source', 'Research source URL must use HTTPS.', id);
    }
  });
  return value;
}

function validateUniqueIds(records, report, scope) {
  const seen = new Set();
  records.forEach(record => {
    if (!hasText(record?.id)) {
      add(report, 'errors', 'missing-id', `${scope} record is missing an id.`);
      return;
    }
    if (seen.has(record.id)) {
      add(report, 'errors', 'duplicate-id', `Duplicate ${scope} id: ${record.id}.`, record.id);
    }
    seen.add(record.id);
  });
  return seen;
}

function readCollection(corpus, key, report) {
  if (!Array.isArray(corpus[key])) {
    add(report, 'errors', 'invalid-collection', `Corpus field "${key}" must be an array.`, corpus.id);
    return [];
  }
  return corpus[key];
}

function validateStatus(record, report) {
  if (!isRecord(record)) {
    add(report, 'errors', 'invalid-record', 'Record must be an object.');
    return;
  }
  if (!RECORD_STATUSES.includes(record.status)) {
    add(report, 'errors', 'invalid-status', `Unknown status "${record.status}".`, record.id);
  }
}

function validateDates(record, report) {
  if (!isRecord(record)) {
    add(report, 'errors', 'invalid-record', 'Record must be an object.');
    return;
  }
  const dates = record.dates;
  if (!dates || !Number.isFinite(dates.start) || !Number.isFinite(dates.end)) {
    add(report, 'errors', 'invalid-dates', 'Date range must include numeric start and end values.', record.id);
    return;
  }
  if (dates.start > dates.end) {
    add(report, 'errors', 'reversed-dates', 'Date range starts after it ends.', record.id);
  }
  if (!hasText(dates.display)) {
    add(report, 'errors', 'missing-date-display', 'Date range needs a human-readable display value.', record.id);
  }
}

function validateCompletion(record, report) {
  const completion = record?.completion;
  if (!isRecord(completion)) {
    add(report, 'errors', 'missing-completion-disposition', 'Corpus records need a reviewed completion disposition.', record?.id || null);
    return;
  }
  if (!COMPLETION_DISPOSITIONS.includes(completion.disposition)) {
    add(report, 'errors', 'invalid-completion-disposition', `Unknown completion disposition: ${completion.disposition}.`, record.id);
  }
  if (!hasText(completion.rationale)) {
    add(report, 'errors', 'missing-completion-rationale', 'Completion disposition needs an editorial rationale.', record.id);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completion.reviewedOn || '')) {
    add(report, 'errors', 'invalid-completion-review-date', 'Completion disposition needs an ISO review date.', record.id);
  }
  if (['context-only', 'evidence-bound'].includes(completion.disposition)
    && !hasText(completion.revisitTrigger)) {
    add(report, 'errors', 'missing-completion-revisit-trigger', 'Accepted non-launch records need a concrete revisit trigger.', record.id);
  }
  if (!['context-only', 'evidence-bound'].includes(completion.disposition)
    && completion.revisitTrigger !== null) {
    add(report, 'errors', 'unexpected-completion-revisit-trigger', 'Launch and alignment dispositions must use a null revisit trigger.', record.id);
  }
}

function validateSourceRefs(record, sources, report) {
  if (!isRecord(record)) {
    add(report, 'errors', 'invalid-record', 'Record must be an object.');
    return;
  }
  if (!Array.isArray(record.sourceRefs) || record.sourceRefs.length === 0) {
    add(report, 'warnings', 'missing-source-refs', 'Record has no research source references.', record.id);
    return;
  }
  record.sourceRefs.forEach(sourceId => {
    if (!sources[sourceId]) {
      add(report, 'errors', 'dangling-source-ref', `Unknown research source: ${sourceId}.`, record.id);
    }
  });
}

function validateEditorialReview(record, recordCitationRefs, report, { requireDateBasis = false } = {}) {
  if (!['reviewed', 'publishable'].includes(record.status)) return;
  const review = record.editorialReview;
  if (!isRecord(review)) {
    add(report, 'errors', 'missing-editorial-review', 'Reviewed records need a structured editorial review.', record.id);
    return;
  }
  if (!['editorial', 'specialist'].includes(review.stage)) {
    add(report, 'errors', 'invalid-review-stage', 'Editorial review stage must be editorial or specialist.', record.id);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedOn || '')) {
    add(report, 'errors', 'invalid-review-date', 'Editorial review needs an ISO review date.', record.id);
  }
  if (typeof review.specialistSignoff !== 'boolean') {
    add(report, 'errors', 'missing-specialist-signoff', 'Editorial review must state whether specialist sign-off is complete.', record.id);
  }
  if (review.stage === 'specialist' && review.specialistSignoff !== true) {
    add(report, 'errors', 'inconsistent-specialist-review', 'Specialist-stage review requires specialist sign-off.', record.id);
  }
  if (review.specialistSignoff === true && review.stage !== 'specialist') {
    add(report, 'errors', 'signoff-without-specialist-stage', 'Specialist sign-off requires the specialist review stage.', record.id);
  }
  if (review.specialistSignoff === true) {
    if (!hasText(review.specialistDecisionId)) {
      add(report, 'errors', 'missing-specialist-decision-id', 'Specialist sign-off must reference an auditable decision.', record.id);
    }
  }
  if (record.status === 'publishable' && review.specialistSignoff !== true) {
    add(report, 'errors', 'publishable-without-specialist-signoff', 'Publishable discovery metadata requires specialist sign-off.', record.id);
  }
  if (!hasText(review.note)) {
    add(report, 'errors', 'missing-review-note', 'Editorial review needs an explanatory note.', record.id);
  }
  if (!Array.isArray(review.citationRefs) || review.citationRefs.length === 0) {
    add(report, 'errors', 'missing-review-citations', 'Editorial review needs claim-level citation references.', record.id);
  } else {
    const allowedRefs = new Set(Array.isArray(recordCitationRefs) ? recordCitationRefs : []);
    review.citationRefs.forEach(sourceId => {
      if (!allowedRefs.has(sourceId)) {
        add(report, 'errors', 'unscoped-review-citation', `Editorial review cites a source outside the record: ${sourceId}.`, record.id);
      }
    });
  }
  if (requireDateBasis && !hasText(review.dateBasis)) {
    add(report, 'errors', 'missing-date-basis', 'Reviewed historical events need a note explaining display-date precision.', record.id);
  }
}

function validateJourney(journey, anchors, report, expectedDomain, passageIds) {
  if (!isRecord(journey)) {
    add(report, 'errors', 'invalid-journey', 'Journey must be an object.');
    return;
  }
  validateStatus(journey, report);
  if (journey.domain !== expectedDomain || journey.kind !== 'journey') {
    add(report, 'errors', 'invalid-journey-contract', `Journey must belong to ${expectedDomain}.`, journey.id);
  }
  if (!hasText(journey.title) || !hasText(journey.description)) {
    add(report, 'errors', 'incomplete-journey', 'Journey needs a title and description.', journey.id);
  }
  if (!Array.isArray(journey.anchorIds) || journey.anchorIds.length === 0) {
    add(report, 'errors', 'missing-journey-anchors', 'Journey needs at least one anchor.', journey.id);
  } else {
    journey.anchorIds.forEach(id => {
      if (!anchors.has(id)) {
        add(report, 'errors', 'dangling-journey-anchor', `Unknown journey anchor: ${id}.`, journey.id);
      }
    });
  }
  if (journey.status === 'blocked' && !hasText(journey.blockedReason)) {
    add(report, 'errors', 'missing-block-reason', 'Blocked journey needs a reason.', journey.id);
  }
  if (!Array.isArray(journey.segments) || journey.segments.length === 0) {
    add(report, 'errors', 'missing-journey-segments', 'Journey needs at least one passage segment.', journey.id);
  } else {
    journey.segments.forEach(segment => {
      if (!isRecord(segment) || !passageIds.has(segment.passageId)) {
        add(report, 'errors', 'dangling-journey-passage', `Unknown journey passage: ${segment?.passageId}.`, journey.id);
        return;
      }
      if (!JOURNEY_SEGMENT_ROLES.includes(segment.role)) {
        add(report, 'errors', 'invalid-segment-role', `Unknown journey segment role: ${segment.role}.`, journey.id);
      }
    });
  }
  if (!Array.isArray(journey.openRequirements)) {
    add(report, 'errors', 'invalid-open-requirements', 'Journey open requirements must be an array.', journey.id);
  } else if (journey.status === 'publishable' && journey.openRequirements.length > 0) {
    add(report, 'errors', 'publishable-journey-has-open-requirements', 'Publishable journey cannot retain open requirements.', journey.id);
  }
  if (!Number.isFinite(journey.estimatedMinutes) || journey.estimatedMinutes <= 0) {
    add(report, 'errors', 'invalid-journey-duration', 'Journey needs a positive duration estimate.', journey.id);
  }
}

export function validatePhilosophyCorpus(corpus = PHILOSOPHY_CORPUS, passages = ATRIUM_CATALOG.passages) {
  const report = createReport();
  if (!validateCorpusHeader(corpus, report)) return report;

  const nodes = readCollection(corpus, 'nodes', report);
  const edges = readCollection(corpus, 'edges', report);
  const journeys = readCollection(corpus, 'journeys', report);
  const sources = validateResearchSources(corpus.researchSources, report, corpus.id);
  const nodeIds = validateUniqueIds(nodes, report, 'philosophy node');
  const passageIds = new Set((Array.isArray(passages) ? passages : []).filter(isRecord).map(item => item.id));
  validateUniqueIds(edges, report, 'philosophy edge');
  validateUniqueIds(journeys, report, 'philosophy journey');
  const eraIds = new Set(PHILOSOPHY_ERAS.map(era => era.id));

  if (nodes.length === 0) {
    add(report, 'errors', 'empty-philosophy-corpus', 'Philosophy corpus needs at least one node.', corpus.id);
  }

  nodes.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-node', 'Philosophy node must be an object.');
      return;
    }
    validateStatus(item, report);
    validateCompletion(item, report);
    validateDates(item, report);
    validateSourceRefs(item, sources, report);
    if (!hasText(item.id) || !item.id.startsWith('ph-')) {
      add(report, 'errors', 'invalid-node-prefix', 'Philosophy node id must start with ph-.', item.id);
    }
    if (item.domain !== 'philosophy' || !PHILOSOPHY_NODE_KINDS.includes(item.kind)) {
      add(report, 'errors', 'invalid-node-contract', 'Node must use the philosophy domain and a known node kind.', item.id);
    }
    if (!LAUNCH_STATUSES.includes(item.launchStatus)) {
      add(report, 'errors', 'invalid-launch-status', `Unknown launch status: ${item.launchStatus}.`, item.id);
    }
    if (item.launchStatus === 'ready' && item.status !== 'publishable') {
      add(report, 'errors', 'unsafe-ready-launch', 'Only publishable records may be launch-ready.', item.id);
    }
    if (!eraIds.has(item.era)) {
      add(report, 'errors', 'invalid-era', `Unknown philosophy era: ${item.era}.`, item.id);
    }
    if (!hasText(item.label) || !hasText(item.summary)) {
      add(report, 'errors', 'incomplete-node', 'Node needs a label and summary.', item.id);
    }
    validateEditorialReview(item, item.sourceRefs, report);
    if (PHILOSOPHY_SURVIVAL_NOTES[item.id] && !hasText(item.editorialReview?.survivalNote)) {
      add(report, 'errors', 'missing-survival-note', 'Fragmentary or mediated traditions need an explicit textual-survival note.', item.id);
    }
  });

  edges.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-edge', 'Philosophy edge must be an object.');
      return;
    }
    validateStatus(item, report);
    if (item.domain !== 'philosophy' || item.kind !== 'relationship') {
      add(report, 'errors', 'invalid-edge-contract', 'Edge must be a philosophy relationship.', item.id);
    }
    if (!nodeIds.has(item.from) || !nodeIds.has(item.to)) {
      add(report, 'errors', 'dangling-edge', 'Edge endpoint does not resolve to a philosophy node.', item.id);
    }
    if (!RELATIONSHIP_TYPES.includes(item.type)) {
      add(report, 'errors', 'invalid-edge-type', `Unknown relationship type: ${item.type}.`, item.id);
    }
    if (!RELATIONSHIP_CONFIDENCE.includes(item.confidence)) {
      add(report, 'errors', 'invalid-confidence', `Unknown confidence: ${item.confidence}.`, item.id);
    }
    if (!EVIDENCE_LEVELS.includes(item.evidence)) {
      add(report, 'errors', 'invalid-evidence', `Unknown evidence level: ${item.evidence}.`, item.id);
    }
    if (item.evidence === 'E3' && item.confidence !== 'contested') {
      add(report, 'errors', 'e3-not-contested', 'E3 relationships must be contested.', item.id);
    }
    if (!Array.isArray(item.citationRefs) || item.citationRefs.length === 0) {
      add(report, 'errors', 'missing-edge-citation', 'Relationship needs at least one research citation.', item.id);
    } else {
      item.citationRefs.forEach(sourceId => {
        if (!sources[sourceId]) {
          add(report, 'errors', 'dangling-edge-citation', `Unknown relationship citation: ${sourceId}.`, item.id);
        }
      });
    }
    if (item.status === 'publishable' && !hasText(item.note)) {
      add(report, 'errors', 'missing-publishable-edge-note', 'Publishable relationships need an editorial note.', item.id);
    }
    validateEditorialReview(item, item.citationRefs, report);
    if (item.type === 'teacher-student') {
      const from = nodes.find(node => node?.id === item.from);
      const to = nodes.find(node => node?.id === item.to);
      if (from?.kind !== 'thinker' || to?.kind !== 'thinker') {
        add(report, 'errors', 'invalid-teacher-student', 'Teacher-student edges require two thinker nodes.', item.id);
      }
    }
  });

  journeys.forEach(item => validateJourney(item, nodeIds, report, 'philosophy', passageIds));
  return report;
}

export function validateHistoryCorpus(corpus = HISTORY_CORPUS, passages = ATRIUM_CATALOG.passages) {
  const report = createReport();
  if (!validateCorpusHeader(corpus, report)) return report;

  const events = readCollection(corpus, 'events', report);
  const journeys = readCollection(corpus, 'journeys', report);
  const sources = validateResearchSources(corpus.researchSources, report, corpus.id);
  const eventIds = validateUniqueIds(events, report, 'history event');
  const passageIds = new Set((Array.isArray(passages) ? passages : []).filter(isRecord).map(item => item.id));
  validateUniqueIds(journeys, report, 'history journey');
  const laneIds = new Set(HISTORY_LANES.map(lane => lane.id));
  const usedLanes = new Set();

  if (events.length === 0) {
    add(report, 'errors', 'empty-history-corpus', 'History corpus needs at least one event.', corpus.id);
  }

  events.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-event', 'History event must be an object.');
      return;
    }
    validateStatus(item, report);
    validateCompletion(item, report);
    validateDates(item, report);
    validateSourceRefs(item, sources, report);
    if (!hasText(item.id) || !item.id.startsWith('hist-')) {
      add(report, 'errors', 'invalid-event-prefix', 'History event id must start with hist-.', item.id);
    }
    if (item.domain !== 'history' || item.kind !== 'event') {
      add(report, 'errors', 'invalid-event-contract', 'Event must use the history domain and event kind.', item.id);
    }
    if (!LAUNCH_STATUSES.includes(item.launchStatus)) {
      add(report, 'errors', 'invalid-launch-status', `Unknown launch status: ${item.launchStatus}.`, item.id);
    }
    if (item.launchStatus === 'ready' && item.status !== 'publishable') {
      add(report, 'errors', 'unsafe-ready-launch', 'Only publishable records may be launch-ready.', item.id);
    }
    if (!laneIds.has(item.primaryLane)) {
      add(report, 'errors', 'invalid-primary-lane', `Unknown primary lane: ${item.primaryLane}.`, item.id);
    }
    if (!Array.isArray(item.lanes) || !item.lanes.includes(item.primaryLane)) {
      add(report, 'errors', 'primary-lane-missing', 'Event lanes must contain its primary lane.', item.id);
    } else {
      item.lanes.forEach(lane => {
        usedLanes.add(lane);
        if (!laneIds.has(lane)) {
          add(report, 'errors', 'invalid-lane', `Unknown history lane: ${lane}.`, item.id);
        }
      });
    }
    if (item.dates.start < HISTORY_RANGE.start || item.dates.end > HISTORY_RANGE.end) {
      add(report, 'warnings', 'outside-pilot-range', 'Event extends beyond the 1750–1850 pilot range.', item.id);
    }
    if (!hasText(item.label) || !hasText(item.summary) || !hasText(item.geography)) {
      add(report, 'errors', 'incomplete-event', 'Event needs a label, summary, and geography.', item.id);
    }
    validateEditorialReview(item, item.sourceRefs, report, { requireDateBasis: true });
  });

  laneIds.forEach(lane => {
    if (!usedLanes.has(lane)) {
      add(report, 'errors', 'unused-lane', `History lane has no events: ${lane}.`);
    }
  });

  journeys.forEach(item => validateJourney(item, eventIds, report, 'history', passageIds));
  return report;
}

export function validateAtriumCatalog(catalog = ATRIUM_CATALOG) {
  const report = createReport();
  if (!validateCorpusHeader(catalog, report)) return report;

  const sources = readCollection(catalog, 'sources', report);
  const passages = readCollection(catalog, 'passages', report);
  const sourceIds = validateUniqueIds(sources, report, 'Atrium source');
  validateUniqueIds(passages, report, 'Atrium passage');
  const sourcesById = new Map(sources.filter(isRecord).map(item => [item.id, item]));

  sources.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-source', 'Source candidate must be an object.');
      return;
    }
    validateStatus(item, report);
    if (!hasText(item.id) || !item.id.startsWith('src-')) {
      add(report, 'errors', 'invalid-source-prefix', 'Source id must start with src-.', item.id);
    }
    if (!['philosophy', 'history'].includes(item.domain) || item.kind !== 'source-edition-candidate') {
      add(report, 'errors', 'invalid-source-contract', 'Source needs a known Atrium domain and source-edition-candidate kind.', item.id);
    }
    if (!hasText(item.workTitle) || !hasText(item.author) || !hasText(item.provider)
      || !hasText(item.canonicalUrl) || !hasText(item.locatorScheme)) {
      add(report, 'errors', 'incomplete-source', 'Source candidate lacks required bibliographic discovery fields.', item.id);
    }
    if (!item.canonicalUrl?.startsWith('https://')) {
      add(report, 'errors', 'insecure-source-url', 'Source canonical URL must use HTTPS.', item.id);
    }
    if (!isRecord(item.rights) || !RIGHTS_STATUSES.includes(item.rights.status)) {
      add(report, 'errors', 'invalid-source-rights', 'Source needs a recognized rights status.', item.id);
    }
    if (hasText(item.checksum) && !SHA256_CHECKSUM_PATTERN.test(item.checksum)) {
      add(report, 'errors', 'invalid-source-checksum', 'Source checksum must use the sha256:<hex> format.', item.id);
    }
    if (item.status === 'publishable') {
      evaluateSourceReadiness(item).reasons.forEach(reason => {
        add(report, 'errors', `publishable-${reason.code}`, reason.message, item.id);
      });
    }
  });

  passages.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-passage', 'Passage candidate must be an object.');
      return;
    }
    validateStatus(item, report);
    if (!hasText(item.id) || !item.id.startsWith('pass-')) {
      add(report, 'errors', 'invalid-passage-prefix', 'Passage id must start with pass-.', item.id);
    }
    if (!['philosophy', 'history'].includes(item.domain) || item.kind !== 'passage-candidate') {
      add(report, 'errors', 'invalid-passage-contract', 'Passage needs a known Atrium domain and passage-candidate kind.', item.id);
    }
    const resolvedSource = sourcesById.get(item.sourceId);
    if (!sourceIds.has(item.sourceId) || !resolvedSource) {
      add(report, 'errors', 'dangling-passage-source', `Unknown passage source: ${item.sourceId}.`, item.id);
    } else if (resolvedSource.domain !== item.domain) {
      add(report, 'errors', 'cross-domain-passage-source', 'Passage and source domains must match.', item.id);
    }
    if (!hasText(item.locator) || !hasText(item.label) || !hasText(item.editorialPurpose)) {
      add(report, 'errors', 'incomplete-passage', 'Passage needs a locator, label, and editorial purpose.', item.id);
    }
    if (!RIGHTS_STATUSES.includes(item.rightsStatus)) {
      add(report, 'errors', 'invalid-passage-rights', `Unknown passage rights status: ${item.rightsStatus}.`, item.id);
    }
    if (resolvedSource?.rights?.status && item.rightsStatus !== resolvedSource.rights.status) {
      add(report, 'errors', 'passage-source-rights-mismatch', 'Passage rights must match its edition record.', item.id);
    }
    if (!PACKABLE_RIGHTS.includes(item.rightsStatus) && (item.payloadPath || item.payloadChecksum)) {
      add(report, 'errors', 'payload-before-rights', 'Blocked passage cannot carry a packaged payload.', item.id);
    }
    if (hasText(item.payloadChecksum) && !SHA256_CHECKSUM_PATTERN.test(item.payloadChecksum)) {
      add(report, 'errors', 'invalid-payload-checksum', 'Passage checksum must use the sha256:<hex> format.', item.id);
    }
    if (item.status === 'publishable') {
      evaluatePassageReadiness(item, sources).reasons.forEach(reason => {
        add(report, 'errors', `publishable-${reason.code}`, reason.message, item.id);
      });
    }
  });

  return report;
}

export function validateAtriumCorpus({
  philosophy = PHILOSOPHY_CORPUS,
  history = HISTORY_CORPUS,
  catalog = ATRIUM_CATALOG
} = {}) {
  const catalogReport = validateAtriumCatalog(catalog);
  const catalogPassages = Array.isArray(catalog?.passages) ? catalog.passages : [];
  const philosophyReport = validatePhilosophyCorpus(philosophy, catalogPassages);
  const historyReport = validateHistoryCorpus(history, catalogPassages);
  const globalReport = createReport();
  validateUniqueIds([
    ...(Array.isArray(philosophy?.nodes) ? philosophy.nodes : []),
    ...(Array.isArray(philosophy?.edges) ? philosophy.edges : []),
    ...(Array.isArray(philosophy?.journeys) ? philosophy.journeys : []),
    ...(Array.isArray(history?.events) ? history.events : []),
    ...(Array.isArray(history?.journeys) ? history.journeys : []),
    ...(Array.isArray(catalog?.sources) ? catalog.sources : []),
    ...catalogPassages
  ], globalReport, 'global Atrium record');
  return {
    valid: philosophyReport.valid && historyReport.valid && catalogReport.valid && globalReport.valid,
    errors: [
      ...philosophyReport.errors,
      ...historyReport.errors,
      ...catalogReport.errors,
      ...globalReport.errors
    ],
    warnings: [
      ...philosophyReport.warnings,
      ...historyReport.warnings,
      ...catalogReport.warnings,
      ...globalReport.warnings
    ],
    philosophy: philosophyReport,
    history: historyReport,
    catalog: catalogReport,
    global: globalReport
  };
}

export function assertAtriumCorpus(corpora) {
  const report = validateAtriumCorpus(corpora);
  if (!report.valid) {
    const summary = report.errors.map(error => `${error.code}${error.recordId ? ` (${error.recordId})` : ''}`).join(', ');
    throw new Error(`Atrium corpus validation failed: ${summary}`);
  }
  return report;
}
