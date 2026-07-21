import { describe, expect, it } from 'vitest';
import { HISTORY_CORPUS } from './history.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import {
  PHILOSOPHY_SPECIALIST_REVIEW_CASES,
  PHILOSOPHY_SPECIALIST_TRANCHE_2_DRAFTS,
  summarizeSpecialistReview
} from './specialist-review.js';
import { ATRIUM_CORPUS_VERSION } from './constants.js';
import {
  validateAtriumCorpus,
  validateHistoryCorpus,
  validatePhilosophyCorpus
} from './validate.js';
import { validateSpecialistReviewCases } from './validate-specialist-review.js';

describe('Atrium corpus validation', () => {
  it('accepts the authored pilot metadata', () => {
    const report = validateAtriumCorpus();
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(PHILOSOPHY_CORPUS.nodes).toHaveLength(35);
    expect(PHILOSOPHY_CORPUS.edges.length).toBeGreaterThanOrEqual(50);
    expect(HISTORY_CORPUS.events.length).toBeGreaterThanOrEqual(50);
    expect(Object.isFrozen(PHILOSOPHY_CORPUS.nodes[0])).toBe(true);
    expect(Object.isFrozen(PHILOSOPHY_CORPUS.nodes[0].dates)).toBe(true);
    expect(Object.isFrozen(PHILOSOPHY_CORPUS.nodes[0].completion)).toBe(true);
    expect(Object.isFrozen(HISTORY_CORPUS.events[0].lanes)).toBe(true);
    expect(Object.isFrozen(HISTORY_CORPUS.events[0].completion)).toBe(true);
  });

  it('meets the Gate C editorial-preparation floor without claiming specialist sign-off', () => {
    const reviewedNodes = PHILOSOPHY_CORPUS.nodes.filter(item => item.status === 'reviewed');
    const reviewedEdges = PHILOSOPHY_CORPUS.edges.filter(item => item.status === 'reviewed');
    const reviewedEvents = HISTORY_CORPUS.events.filter(item => item.status === 'reviewed');

    expect(reviewedNodes.length).toBeGreaterThanOrEqual(25);
    expect(reviewedEdges.length).toBeGreaterThanOrEqual(35);
    expect(reviewedEvents.length).toBeGreaterThanOrEqual(35);
    [...reviewedNodes, ...reviewedEdges, ...reviewedEvents].forEach(item => {
      expect(item.editorialReview).toEqual(expect.objectContaining({
        stage: 'editorial',
        specialistSignoff: false
      }));
      expect(item.editorialReview.note.length).toBeGreaterThan(0);
      expect(item.editorialReview.citationRefs.length).toBeGreaterThan(0);
    });
  });

  it('rejects a dangling philosophy edge', () => {
    const corpus = {
      ...PHILOSOPHY_CORPUS,
      edges: [{
        ...PHILOSOPHY_CORPUS.edges[0],
        id: 'edge-broken',
        to: 'ph-missing'
      }]
    };
    const report = validatePhilosophyCorpus(corpus);
    expect(report.valid).toBe(false);
    expect(report.errors.some(error => error.code === 'dangling-edge')).toBe(true);
  });

  it('requires E3 relationships to remain contested', () => {
    const corpus = {
      ...PHILOSOPHY_CORPUS,
      edges: [{
        ...PHILOSOPHY_CORPUS.edges[0],
        id: 'edge-overclaim',
        evidence: 'E3',
        confidence: 'high'
      }]
    };
    const report = validatePhilosophyCorpus(corpus);
    expect(report.errors.some(error => error.code === 'e3-not-contested')).toBe(true);
  });

  it('fails reviewed discovery metadata closed when its evidence ledger is incomplete', () => {
    const edgeCorpus = {
      ...PHILOSOPHY_CORPUS,
      edges: [{
        ...PHILOSOPHY_CORPUS.edges.find(edge => edge.status === 'reviewed'),
        editorialReview: null
      }]
    };
    expect(validatePhilosophyCorpus(edgeCorpus).errors).toContainEqual(
      expect.objectContaining({ code: 'missing-editorial-review' })
    );

    const eventCorpus = {
      ...HISTORY_CORPUS,
      events: [{
        ...HISTORY_CORPUS.events[0],
        editorialReview: { ...HISTORY_CORPUS.events[0].editorialReview, dateBasis: '' }
      }]
    };
    expect(validateHistoryCorpus(eventCorpus).errors).toContainEqual(
      expect.objectContaining({ code: 'missing-date-basis' })
    );
  });

  it('requires specialist approval before reviewed discovery metadata can be published', () => {
    const corpus = {
      ...PHILOSOPHY_CORPUS,
      nodes: [{ ...PHILOSOPHY_CORPUS.nodes[0], status: 'publishable' }]
    };
    expect(validatePhilosophyCorpus(corpus).errors).toContainEqual(
      expect.objectContaining({ code: 'publishable-without-specialist-signoff' })
    );
  });

  it('queues every unresolved philosophy relationship for bounded specialist review', () => {
    const draftEdgeIds = PHILOSOPHY_CORPUS.edges
      .filter(edge => edge.status === 'draft')
      .map(edge => edge.id)
      .sort();
    const queuedIds = PHILOSOPHY_SPECIALIST_REVIEW_CASES
      .map(item => item.recordId)
      .sort();

    expect(queuedIds).toEqual(draftEdgeIds);
    expect(PHILOSOPHY_SPECIALIST_REVIEW_CASES).toHaveLength(8);
    expect(PHILOSOPHY_SPECIALIST_REVIEW_CASES.every(item => (
      item.status === 'awaiting-specialist' && item.decision === null
    ))).toBe(true);
    expect(summarizeSpecialistReview()).toEqual({
      total: 8,
      'awaiting-specialist': 8,
      'in-review': 0,
      decided: 0,
      recommendations: { retain: 2, revise: 5, remove: 1 }
    });
    expect(validateSpecialistReviewCases().valid).toBe(true);
  });

  it('records corpus 0.4.9 launch expansion without promoting tranche-two drafts', () => {
    expect(ATRIUM_CORPUS_VERSION).toBe('0.4.9');
    const heraclitus = PHILOSOPHY_SPECIALIST_REVIEW_CASES.find(item => item.recordId === 'edge-heraclitus-stoa');
    expect(heraclitus.recommendation.proposedClaim.note).toContain('on the Stoic reading, cosmic recurrence');
    const plotinus = PHILOSOPHY_SPECIALIST_REVIEW_CASES.find(item => item.recordId === 'edge-stoa-plotinus');
    expect(plotinus.evidenceAnchors).toContainEqual(expect.objectContaining({ sourceRef: 'VP-14' }));
    const alexandria = PHILOSOPHY_SPECIALIST_REVIEW_CASES.find(item => item.recordId === 'edge-iamblichean-alexandria');
    expect(alexandria.recommendation.proposedClaim.note).toContain('Athenian school');
    expect(PHILOSOPHY_SPECIALIST_TRANCHE_2_DRAFTS).toHaveLength(2);
    expect(PHILOSOPHY_SPECIALIST_TRANCHE_2_DRAFTS.every(item => item.status === 'draft' && item.decision === null)).toBe(true);
    expect(PHILOSOPHY_CORPUS.nodes.some(node => node.id === 'ph-thinker-pyrrho')).toBe(false);
  });

  it('fails specialist review packets closed when their record snapshot drifts', () => {
    const specialistCase = PHILOSOPHY_SPECIALIST_REVIEW_CASES[0];
    const cases = [{
      ...specialistCase,
      currentClaim: { ...specialistCase.currentClaim, type: 'influence' }
    }];
    expect(validateSpecialistReviewCases({ cases }).errors).toContainEqual(
      expect.objectContaining({ code: 'stale-specialist-snapshot' })
    );
  });

  it('rejects a forged specialist boolean without an approved reviewer decision', () => {
    const specialistCase = PHILOSOPHY_SPECIALIST_REVIEW_CASES[0];
    const edge = PHILOSOPHY_CORPUS.edges.find(item => item.id === specialistCase.recordId);
    const corpus = {
      ...PHILOSOPHY_CORPUS,
      edges: [{
        ...edge,
        status: 'publishable',
        note: 'Attempted promotion.',
        editorialReview: {
          version: 'gate-c.specialist.1',
          stage: 'specialist',
          reviewedOn: '2026-07-17',
          specialistSignoff: true,
          specialistDecisionId: specialistCase.id,
          note: 'Attempted promotion.',
          citationRefs: edge.citationRefs,
          cautions: []
        }
      }]
    };

    expect(validateSpecialistReviewCases({
      cases: PHILOSOPHY_SPECIALIST_REVIEW_CASES,
      philosophy: corpus
    }).errors).toContainEqual(
      expect.objectContaining({ code: 'unapproved-specialist-decision' })
    );
  });

  it('requires identity, qualifications, conflict disclosure, and attestation for a decision', () => {
    const specialistCase = PHILOSOPHY_SPECIALIST_REVIEW_CASES[0];
    const cases = [{
      ...specialistCase,
      status: 'decided',
      decision: {
        outcome: 'changes-requested',
        decidedOn: '2026-07-17',
        corpusVersion: PHILOSOPHY_CORPUS.corpusVersion,
        rationale: 'Narrow the claim.',
        conflictStatement: 'No conflict.',
        attestation: 'Reviewed the cited evidence.'
      }
    }];

    expect(validateSpecialistReviewCases({ cases }).errors).toContainEqual(
      expect.objectContaining({ code: 'missing-specialist-reviewer' })
    );
  });

  it('accepts a version-bound approved decision only after the corpus matches it', () => {
    const specialistCase = PHILOSOPHY_SPECIALIST_REVIEW_CASES
      .find(item => item.recordId === 'edge-heraclitus-stoa');
    const proposed = specialistCase.recommendation.proposedClaim;
    const decidedCase = {
      ...specialistCase,
      status: 'decided',
      decision: {
        outcome: 'approved',
        decidedOn: '2026-07-17',
        corpusVersion: PHILOSOPHY_CORPUS.corpusVersion,
        reviewer: {
          id: 'reviewer-example',
          displayName: 'Example Reviewer',
          qualifications: 'Ancient philosophy specialist'
        },
        rationale: 'The qualified reception claim is supported.',
        conflictStatement: 'No known conflict of interest.',
        attestation: 'I reviewed the identified claim and evidence for this corpus version.'
      }
    };
    const edge = PHILOSOPHY_CORPUS.edges.find(item => item.id === specialistCase.recordId);
    const reviewedEdge = {
      ...edge,
      ...proposed,
      status: 'publishable',
      editorialReview: {
        version: 'gate-c.specialist.1',
        stage: 'specialist',
        reviewedOn: '2026-07-17',
        specialistSignoff: true,
        specialistDecisionId: specialistCase.id,
        note: proposed.note,
        citationRefs: proposed.citationRefs,
        cautions: []
      }
    };
    const philosophy = {
      ...PHILOSOPHY_CORPUS,
      edges: PHILOSOPHY_CORPUS.edges.map(item => item.id === reviewedEdge.id ? reviewedEdge : item)
    };

    expect(validateSpecialistReviewCases({
      cases: [decidedCase],
      philosophy
    }).errors).toEqual([]);
    expect(validatePhilosophyCorpus(philosophy).valid).toBe(true);
  });

  it('requires every declared history lane to contain events', () => {
    const corpus = {
      ...HISTORY_CORPUS,
      events: HISTORY_CORPUS.events.filter(event => !event.lanes.includes('economic-technology'))
    };
    const report = validateHistoryCorpus(corpus);
    expect(report.errors).toContainEqual(expect.objectContaining({ code: 'unused-lane' }));
  });

  it('reports malformed input instead of throwing inside the contract boundary', () => {
    expect(() => validatePhilosophyCorpus(null)).not.toThrow();
    expect(validatePhilosophyCorpus(null).errors).toContainEqual(
      expect.objectContaining({ code: 'invalid-corpus' })
    );

    const corpus = { ...PHILOSOPHY_CORPUS, nodes: [null] };
    expect(() => validatePhilosophyCorpus(corpus)).not.toThrow();
    expect(validatePhilosophyCorpus(corpus).errors).toContainEqual(
      expect.objectContaining({ code: 'invalid-node' })
    );
  });

  it('rejects unsafe launch readiness and malformed collection shapes', () => {
    const unsafe = {
      ...HISTORY_CORPUS,
      events: [{ ...HISTORY_CORPUS.events[0], launchStatus: 'ready' }],
      journeys: 'not-an-array'
    };
    const report = validateHistoryCorpus(unsafe);
    expect(report.errors).toContainEqual(expect.objectContaining({ code: 'unsafe-ready-launch' }));
    expect(report.errors).toContainEqual(expect.objectContaining({ code: 'invalid-collection' }));
  });

  it('fails closed when a record omits or weakens its completion disposition', () => {
    const missing = {
      ...PHILOSOPHY_CORPUS,
      nodes: [{ ...PHILOSOPHY_CORPUS.nodes[0], completion: null }]
    };
    expect(validatePhilosophyCorpus(missing).errors).toContainEqual(
      expect.objectContaining({ code: 'missing-completion-disposition' })
    );

    const acceptedWithoutTrigger = {
      ...HISTORY_CORPUS,
      events: [{
        ...HISTORY_CORPUS.events.find(event => event.id === 'hist-mexican-insurgency'),
        completion: {
          ...HISTORY_CORPUS.events.find(event => event.id === 'hist-mexican-insurgency').completion,
          revisitTrigger: ''
        }
      }]
    };
    expect(validateHistoryCorpus(acceptedWithoutTrigger).errors).toContainEqual(
      expect.objectContaining({ code: 'missing-completion-revisit-trigger' })
    );
  });
});
