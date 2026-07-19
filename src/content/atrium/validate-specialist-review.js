import {
  EVIDENCE_LEVELS,
  RELATIONSHIP_CONFIDENCE,
  RELATIONSHIP_TYPES
} from './constants.js';
import { HISTORY_CORPUS } from './history.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import { ATRIUM_SPECIALIST_REVIEW_CASES } from './specialist-review.js';
import {
  ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION,
  SPECIALIST_REVIEW_DISPOSITIONS,
  SPECIALIST_REVIEW_OUTCOMES,
  SPECIALIST_REVIEW_STATUSES
} from './specialist-review-contract.js';

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

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validateUniqueCaseIds(cases, report) {
  const ids = new Set();
  const recordIds = new Set();
  cases.forEach(item => {
    if (!hasText(item?.id)) {
      add(report, 'errors', 'missing-specialist-case-id', 'Specialist review case needs a stable id.');
    } else if (ids.has(item.id)) {
      add(report, 'errors', 'duplicate-specialist-case-id', 'Specialist review case id must be unique.', item.id);
    }
    ids.add(item?.id);

    if (recordIds.has(item?.recordId)) {
      add(report, 'errors', 'duplicate-specialist-record', 'A record may appear only once in a specialist review tranche.', item?.recordId);
    }
    recordIds.add(item?.recordId);
  });
}

function validateSpecialistDecision(item, report, corpusVersion) {
  const decision = item.decision;
  if (!isRecord(decision)) {
    add(report, 'errors', 'missing-specialist-decision', 'A decided specialist case needs a decision record.', item.id);
    return;
  }
  if (!SPECIALIST_REVIEW_OUTCOMES.includes(decision.outcome)) {
    add(report, 'errors', 'invalid-specialist-outcome', 'Specialist decision has an unknown outcome.', item.id);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(decision.decidedOn || '')) {
    add(report, 'errors', 'invalid-specialist-decision-date', 'Specialist decision needs an ISO date.', item.id);
  }
  if (decision.corpusVersion !== corpusVersion) {
    add(report, 'errors', 'stale-specialist-decision', 'Specialist decision must identify the reviewed corpus version.', item.id);
  }
  if (!hasText(decision.rationale) || !hasText(decision.conflictStatement) || !hasText(decision.attestation)) {
    add(report, 'errors', 'incomplete-specialist-decision', 'Specialist decision needs rationale, conflict statement, and attestation.', item.id);
  }
  if (!isRecord(decision.reviewer)
    || !hasText(decision.reviewer.id)
    || !hasText(decision.reviewer.displayName)
    || !hasText(decision.reviewer.qualifications)) {
    add(report, 'errors', 'missing-specialist-reviewer', 'Specialist decision needs an identifiable reviewer and qualifications.', item.id);
  }
}

/**
 * Build-time editorial validation. This module is intentionally excluded from
 * the public Atrium entry point so research briefs and reviewer metadata do not
 * inflate the runtime bundle.
 */
export function validateSpecialistReviewCases({
  cases = ATRIUM_SPECIALIST_REVIEW_CASES,
  philosophy = PHILOSOPHY_CORPUS,
  history = HISTORY_CORPUS
} = {}) {
  const report = createReport();
  if (!Array.isArray(cases)) {
    add(report, 'errors', 'invalid-specialist-review-cases', 'Specialist review cases must be an array.');
    return report;
  }

  validateUniqueCaseIds(cases, report);
  const records = new Map([
    ...(Array.isArray(philosophy?.nodes) ? philosophy.nodes : []),
    ...(Array.isArray(philosophy?.edges) ? philosophy.edges : []),
    ...(Array.isArray(history?.events) ? history.events : [])
  ].filter(isRecord).map(item => [item.id, item]));
  const sourcesByDomain = {
    philosophy: isRecord(philosophy?.researchSources) ? philosophy.researchSources : {},
    history: isRecord(history?.researchSources) ? history.researchSources : {}
  };
  const casesByRecord = new Map(cases.filter(isRecord).map(item => [item.recordId, item]));

  cases.forEach(item => {
    if (!isRecord(item)) {
      add(report, 'errors', 'invalid-specialist-review-case', 'Specialist review case must be an object.');
      return;
    }
    if (item.schemaVersion !== ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION) {
      add(report, 'errors', 'specialist-review-schema-version', `Expected specialist review schema ${ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION}.`, item.id);
    }
    if (!['philosophy', 'history'].includes(item.domain)) {
      add(report, 'errors', 'invalid-specialist-domain', 'Specialist review case needs a known Atrium domain.', item.id);
    }

    const record = records.get(item.recordId);
    const approvedDecision = item.status === 'decided' && item.decision?.outcome === 'approved';
    const approvedRemoval = approvedDecision && item.recommendation?.disposition === 'remove';
    if ((!record || record.domain !== item.domain) && !approvedRemoval) {
      add(report, 'errors', 'dangling-specialist-record', 'Specialist review case does not resolve to a record in its domain.', item.id);
    }
    if (item.recordType !== 'relationship' || (record && record.kind !== 'relationship')) {
      add(report, 'errors', 'invalid-specialist-record-type', 'This review tranche accepts philosophy relationship cases only.', item.id);
    }
    if (approvedRemoval && record) {
      add(report, 'errors', 'approved-removal-still-present', 'A relationship approved for removal must no longer remain in the corpus.', item.id);
    }
    if (!SPECIALIST_REVIEW_STATUSES.includes(item.status)) {
      add(report, 'errors', 'invalid-specialist-status', 'Specialist review case has an unknown status.', item.id);
    }
    if (!Array.isArray(item.requiredExpertise) || item.requiredExpertise.length === 0
      || item.requiredExpertise.some(value => !hasText(value))) {
      add(report, 'errors', 'missing-required-expertise', 'Specialist review case must declare required expertise.', item.id);
    }
    if (!hasText(item.reviewQuestion)) {
      add(report, 'errors', 'missing-specialist-question', 'Specialist review case needs a bounded review question.', item.id);
    }

    const snapshot = item.currentClaim;
    const expectedClaim = approvedDecision && item.recommendation?.disposition !== 'remove'
      ? item.recommendation?.proposedClaim
      : snapshot;
    const claimDrifted = !approvedRemoval && (
      !isRecord(expectedClaim)
      || expectedClaim.type !== record?.type
      || expectedClaim.confidence !== record?.confidence
      || expectedClaim.evidence !== record?.evidence
      || !sameStringArray(expectedClaim.citationRefs, record?.citationRefs)
      || (approvedDecision && expectedClaim.note !== record?.note)
    );
    if (!isRecord(snapshot) || claimDrifted) {
      add(report, 'errors', 'stale-specialist-snapshot', 'Specialist review case no longer matches the current or approved record.', item.id);
    }

    const recommendation = item.recommendation;
    if (!isRecord(recommendation)
      || !SPECIALIST_REVIEW_DISPOSITIONS.includes(recommendation.disposition)
      || !hasText(recommendation.rationale)) {
      add(report, 'errors', 'invalid-specialist-recommendation', 'Specialist review case needs a bounded disposition and rationale.', item.id);
    } else if (recommendation.disposition === 'remove') {
      if (recommendation.proposedClaim !== null) {
        add(report, 'errors', 'remove-with-proposed-claim', 'A removal recommendation cannot retain a proposed claim.', item.id);
      }
    } else {
      const proposed = recommendation.proposedClaim;
      if (!isRecord(proposed)
        || !RELATIONSHIP_TYPES.includes(proposed.type)
        || !RELATIONSHIP_CONFIDENCE.includes(proposed.confidence)
        || !EVIDENCE_LEVELS.includes(proposed.evidence)
        || !hasText(proposed.note)
        || !Array.isArray(proposed.citationRefs)
        || proposed.citationRefs.length === 0) {
        add(report, 'errors', 'invalid-proposed-specialist-claim', 'Retained or revised relationships need a complete proposed claim.', item.id);
      } else {
        if (proposed.evidence === 'E3' && proposed.confidence !== 'contested') {
          add(report, 'errors', 'specialist-e3-not-contested', 'Proposed E3 relationships must remain contested.', item.id);
        }
        proposed.citationRefs.forEach(sourceRef => {
          if (!sourcesByDomain[item.domain]?.[sourceRef]) {
            add(report, 'errors', 'dangling-proposed-specialist-source', `Unknown proposed research source: ${sourceRef}.`, item.id);
          }
        });
      }
    }

    if (!Array.isArray(item.evidenceAnchors) || item.evidenceAnchors.length === 0) {
      add(report, 'errors', 'missing-specialist-evidence', 'Specialist review case needs evidence anchors.', item.id);
    } else {
      item.evidenceAnchors.forEach(anchor => {
        if (!isRecord(anchor)
          || !hasText(anchor.sourceRef)
          || !hasText(anchor.locator)
          || !hasText(anchor.stance)
          || !hasText(anchor.relevance)) {
          add(report, 'errors', 'invalid-specialist-evidence', 'Evidence anchor needs source, locator, stance, and relevance.', item.id);
        } else if (!sourcesByDomain[item.domain]?.[anchor.sourceRef]) {
          add(report, 'errors', 'dangling-specialist-source', `Unknown specialist research source: ${anchor.sourceRef}.`, item.id);
        }
      });
    }

    if (item.status === 'decided') {
      const corpusVersion = item.domain === 'philosophy' ? philosophy?.corpusVersion : history?.corpusVersion;
      validateSpecialistDecision(item, report, corpusVersion);
    } else if (item.decision !== null) {
      add(report, 'errors', 'premature-specialist-decision', 'Only decided specialist cases may carry a decision.', item.id);
    }
  });

  records.forEach(record => {
    if (record.editorialReview?.specialistSignoff !== true) return;
    const specialistCase = casesByRecord.get(record.id);
    if (!hasText(record.editorialReview.specialistDecisionId)
      || specialistCase?.id !== record.editorialReview.specialistDecisionId) {
      add(report, 'errors', 'unresolved-specialist-decision', 'Signed metadata must reference its specialist decision case.', record.id);
    } else if (specialistCase.status !== 'decided' || specialistCase.decision?.outcome !== 'approved') {
      add(report, 'errors', 'unapproved-specialist-decision', 'Signed metadata requires an approved specialist decision.', record.id);
    }
  });

  return report;
}
