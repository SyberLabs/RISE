import { freezeManifest } from './constants.js';
import { ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION } from './specialist-review-contract.js';

export * from './specialist-review-contract.js';

const edgeCase = ({
  id,
  recordId,
  currentClaim,
  reviewQuestion,
  recommendation,
  evidenceAnchors,
  riskTags
}) => ({
  id,
  schemaVersion: ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION,
  domain: 'philosophy',
  recordType: 'relationship',
  recordId,
  priority: 'high',
  status: 'awaiting-specialist',
  requiredExpertise: ['ancient-philosophy', 'history-of-philosophy'],
  currentClaim: { ...currentClaim },
  reviewQuestion,
  recommendation,
  evidenceAnchors,
  riskTags,
  decision: null
});

/**
 * Gate C tranche one: the eight relationships deliberately left in draft after
 * the internal editorial pass. Recommendations are research briefs, not
 * specialist decisions. A reviewer may approve, revise, or reject them.
 */
export const PHILOSOPHY_SPECIALIST_REVIEW_CASES = freezeManifest([
  edgeCase({
    id: 'specialist-edge-eleatic-milesian',
    recordId: 'edge-eleatic-milesian',
    currentClaim: {
      type: 'critique',
      confidence: 'contested',
      evidence: 'E3',
      citationRefs: ['SEP-PRE']
    },
    reviewQuestion: 'Does a school-level Eleatic-to-Milesian critique overstate what is more narrowly a modern reconstruction of Parmenides against Milesian accounts of generation and change?',
    recommendation: {
      disposition: 'revise',
      rationale: 'The relationship is defensible only as a contested historiographic reading. The note must identify Parmenidean arguments, avoid implying a documented school controversy, and acknowledge interpretations that treat Parmenides\' cosmology as constructive rather than merely destructive.',
      proposedClaim: {
        type: 'critique',
        confidence: 'contested',
        evidence: 'E3',
        citationRefs: ['SEP-PAR', 'SEP-PRE'],
        note: 'Some influential readings reconstruct Parmenides\' arguments against generation and change as a challenge to Milesian cosmology, while constructive readings treat his cosmology as philosophically substantive in its own right. This is a historiographic relation, not evidence of a documented controversy between two unified schools.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-PAR',
        locator: 'Interpretive discussion of Parmenides and Milesian cosmology',
        stance: 'qualifies',
        relevance: 'The entry presents the anti-Milesian reading as one influential interpretation while also discussing Parmenides\' own cosmology.'
      },
      {
        sourceRef: 'SEP-PRE',
        locator: 'Parmenides within Presocratic inquiry',
        stance: 'context',
        relevance: 'Supplies the broader evidential warning against turning retrospective categories into direct school relations.'
      }
    ],
    riskTags: ['retrospective-schooling', 'directional-inference', 'fragmentary-evidence']
  }),
  edgeCase({
    id: 'specialist-edge-xenophanes-eleatic',
    recordId: 'edge-xenophanes-eleatic',
    currentClaim: {
      type: 'influence',
      confidence: 'contested',
      evidence: 'E3',
      citationRefs: ['SEP-PRE']
    },
    reviewQuestion: 'Should ancient classifications of Xenophanes as an Eleatic precursor be represented as influence when the surviving fragments do not establish a teacher-student or school relation?',
    recommendation: {
      disposition: 'revise',
      rationale: 'Retain only as contested reception history. Plato and Aristotle encouraged the later genealogy, but current scholarship warns that Xenophanes defies simple Eleatic classification.',
      proposedClaim: {
        type: 'influence',
        confidence: 'contested',
        evidence: 'E3',
        citationRefs: ['SEP-XENOPHANES', 'SEP-PAR'],
        note: 'Ancient authors and later histories connect Xenophanes with Eleatic unity, but the surviving fragments do not establish him as Parmenides\' teacher or the founder of a continuous Eleatic school.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-XENOPHANES',
        locator: 'Section 7, Xenophanes\' Legacy',
        stance: 'qualifies',
        relevance: 'Documents the ancient genealogy while emphasizing that the surviving Xenophanes resists simple Eleatic classification.'
      },
      {
        sourceRef: 'SEP-PAR',
        locator: 'Life, transmission, and predecessors',
        stance: 'context',
        relevance: 'Provides the Parmenidean side of the disputed genealogy.'
      }
    ],
    riskTags: ['ancient-doxography', 'teacher-student-overreach', 'fragmentary-evidence']
  }),
  edgeCase({
    id: 'specialist-edge-heraclitus-stoa',
    recordId: 'edge-heraclitus-stoa',
    currentClaim: {
      type: 'influence',
      confidence: 'medium',
      evidence: 'E2',
      citationRefs: ['SEP-STOICISM']
    },
    reviewQuestion: 'Is the Heraclitean reception in Stoic physics sufficiently established to retain an influence edge without implying that Stoic logos and fire simply reproduce Heraclitus?',
    recommendation: {
      disposition: 'retain',
      rationale: 'The reception is well attested, including Stoic use of Heraclitean physics and Cleanthes\' commentary, but the note should preserve the difference between appropriation and identity.',
      proposedClaim: {
        type: 'influence',
        confidence: 'medium',
        evidence: 'E2',
        citationRefs: ['SEP-HER', 'SEP-STOICISM'],
        note: 'Stoic authors appropriated Heraclitean language and physics, including fire and, on the Stoic reading, cosmic recurrence, while reconstructing those materials inside a distinct systematic theology and cosmology.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-HER',
        locator: 'Influence',
        stance: 'supports',
        relevance: 'Reports Stoic use of Heraclitean physics and Cleanthes\' commentary on Heraclitus.'
      },
      {
        sourceRef: 'SEP-STOICISM',
        locator: 'Physical theory and sources',
        stance: 'qualifies',
        relevance: 'Shows the specifically Stoic system into which earlier materials were incorporated.'
      }
    ],
    riskTags: ['reception-versus-identity', 'fragmentary-evidence']
  }),
  edgeCase({
    id: 'specialist-edge-pyrrhonism-academic',
    recordId: 'edge-pyrrhonism-academic',
    currentClaim: {
      type: 'influence',
      confidence: 'contested',
      evidence: 'E3',
      citationRefs: ['SEP-SKEPTICISM']
    },
    reviewQuestion: 'Does the current source node incorrectly conflate the historical Pyrrho with the later Pyrrhonian movement when representing possible influence on Arcesilaus?',
    recommendation: {
      disposition: 'remove',
      rationale: 'The possible influence concerns Pyrrho and perhaps Timon, while the existing node spans a later movement revived after Academic Skepticism was already established. A directional school-to-school edge creates a chronological and conceptual conflation. Reconsider only after adding a distinct Pyrrho node.',
      proposedClaim: null
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-PYRRHO',
        locator: 'Section 8, Pyrrho\'s Influence',
        stance: 'qualifies',
        relevance: 'Describes influence on Arcesilaus as possible, disputed, and difficult to assess while distinguishing Pyrrho from later Pyrrhonism.'
      },
      {
        sourceRef: 'SEP-SKEPTICISM',
        locator: 'Academic and Pyrrhonian movements',
        stance: 'context',
        relevance: 'Distinguishes the two skeptical traditions and the later revival of Pyrrhonism.'
      }
    ],
    riskTags: ['chronological-conflation', 'person-school-conflation', 'directional-inference']
  }),
  edgeCase({
    id: 'specialist-edge-stoa-plotinus',
    recordId: 'edge-stoa-plotinus',
    currentClaim: {
      type: 'synthesis',
      confidence: 'medium',
      evidence: 'E1',
      citationRefs: ['SEP-PLOTINUS']
    },
    reviewQuestion: 'Does “synthesis” overstate Plotinus\' selective appropriation of Stoic ethics, psychology, and cosmology alongside sustained criticism of Stoic materialism?',
    recommendation: {
      disposition: 'revise',
      rationale: 'The direct engagements support a relationship, but “influence” with E2 better describes selective appropriation and opposition than a generalized synthesis claim.',
      proposedClaim: {
        type: 'influence',
        confidence: 'medium',
        evidence: 'E2',
        citationRefs: ['SEP-PLOTINUS', 'SEP-NEOPLATONISM', 'VP-14'],
        note: 'Plotinus selectively reworks Stoic ethical and psychological materials while criticizing Stoic corporealism; the relationship is one of appropriation within sustained disagreement, not a general synthesis.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-NEOPLATONISM',
        locator: 'Historical orientation and intellectual background',
        stance: 'supports',
        relevance: 'Identifies Stoic ethics among the materials evident in Plotinus\' philosophical background.'
      },
      {
        sourceRef: 'SEP-PLOTINUS',
        locator: 'Engagement with Hellenistic predecessors',
        stance: 'qualifies',
        relevance: 'Frames Plotinus as an argumentative Platonist who appropriates and rejects earlier positions.'
      },
      {
        sourceRef: 'VP-14',
        locator: 'Porphyry, Life of Plotinus 14',
        stance: 'supports',
        relevance: 'Direct ancient testimony reports Stoic and Peripatetic doctrines embedded, sometimes concealed, in Plotinus\' writings.'
      }
    ],
    riskTags: ['relationship-type-overreach', 'appropriation-versus-synthesis']
  }),
  edgeCase({
    id: 'specialist-edge-iamblichean-porphyry-critique',
    recordId: 'edge-iamblichean-porphyry-critique',
    currentClaim: {
      type: 'critique',
      confidence: 'high',
      evidence: 'E1',
      citationRefs: ['SEP-IAMBLICHUS']
    },
    reviewQuestion: 'Does the surviving Reply to Porphyry provide direct enough evidence for a high-confidence critique edge while preserving Iamblichus\' simultaneous dependence on Porphyry?',
    recommendation: {
      disposition: 'retain',
      rationale: 'This is the strongest of the queued cases: Iamblichus\' Reply directly answers Porphyry\'s objections and criticizes identifiable positions on ritual, soul, and divine hierarchy.',
      proposedClaim: {
        type: 'critique',
        confidence: 'high',
        evidence: 'E1',
        citationRefs: ['SEP-IAMBLICHUS'],
        note: 'Iamblichus\' Reply to Porphyry directly contests Porphyrian objections concerning ritual, theurgy, the soul, and divine hierarchy, even as Iamblichus remains indebted to Porphyry elsewhere.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-IAMBLICHUS',
        locator: 'Sections 1.2, 2.3, and 5.3',
        stance: 'supports',
        relevance: 'Identifies the Reply, its Porphyrian target, and specific philosophical disagreements.'
      }
    ],
    riskTags: ['dependency-and-critique']
  }),
  edgeCase({
    id: 'specialist-edge-iamblichean-alexandria',
    recordId: 'edge-iamblichean-alexandria',
    currentClaim: {
      type: 'transmission',
      confidence: 'high',
      evidence: 'E2',
      citationRefs: ['SEP-NEOPLATONISM']
    },
    reviewQuestion: 'Should the route into Alexandrian commentary culture be represented as direct Iamblichean transmission when the better documented path runs through Syrianus, Proclus, Hermeias, and Ammonius?',
    recommendation: {
      disposition: 'revise',
      rationale: 'A transmission relation is defensible, but it is mediated through Athenian and Alexandrian teachers and transformed in a distinct religious and pedagogical setting. Confidence should be medium rather than high.',
      proposedClaim: {
        type: 'transmission',
        confidence: 'medium',
        evidence: 'E2',
        citationRefs: ['SEP-IAMBLICHUS', 'SEP-AMMONIUS'],
        note: 'Iamblichean exegetical and metaphysical structures reached Alexandrian teaching through the Athenian school (Syrianus, Proclus) and its Alexandrian heirs (Hermeias, Ammonius), where they were selectively adapted rather than reproduced intact.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-AMMONIUS',
        locator: 'Opening summary and Section 1.1',
        stance: 'supports',
        relevance: 'Documents Ammonius\' study with Proclus and the dependence of Alexandrian commentaries on Proclean and Iamblichean traditions.'
      },
      {
        sourceRef: 'SEP-IAMBLICHUS',
        locator: 'Section 2.4, Posterity',
        stance: 'context',
        relevance: 'Establishes Iamblichus\' later reception while warning against a single continuous school.'
      }
    ],
    riskTags: ['mediated-transmission', 'institutional-discontinuity', 'regional-difference']
  }),
  edgeCase({
    id: 'specialist-edge-porphyry-augustine',
    recordId: 'edge-porphyry-augustine',
    currentClaim: {
      type: 'influence',
      confidence: 'contested',
      evidence: 'E3',
      citationRefs: ['SEP-AUGUSTINE']
    },
    reviewQuestion: 'Can Porphyrian influence be represented without claiming certainty about the contents of Augustine\'s “books of the Platonists” or reducing Augustine\'s later engagements to the Milan reading event?',
    recommendation: {
      disposition: 'revise',
      rationale: 'Augustine demonstrably knew Porphyrian works later, and modern scholarship often includes Porphyry among the Milanese sources, but the exact early corpus and division of influence between Plotinus and Porphyry remain disputed.',
      proposedClaim: {
        type: 'influence',
        confidence: 'contested',
        evidence: 'E3',
        citationRefs: ['SEP-AUGUSTINE', 'SEP-PORPHYRY'],
        note: 'Augustine later names and quotes Porphyrian works, and Porphyry may have been represented among the “books of the Platonists” read in Milan; the exact early corpus and its distinct contribution remain disputed.'
      }
    },
    evidenceAnchors: [
      {
        sourceRef: 'SEP-AUGUSTINE',
        locator: 'Neoplatonic sources and the books of the Platonists',
        stance: 'qualifies',
        relevance: 'Distinguishes Augustine\'s secure later access to Porphyry from debate over the precise contents of the earlier Milanese corpus.'
      },
      {
        sourceRef: 'SEP-PORPHYRY',
        locator: 'Influence and reception',
        stance: 'context',
        relevance: 'Supplies the Porphyrian side of the late-antique and Latin reception problem.'
      }
    ],
    riskTags: ['source-identification', 'contested-influence', 'reception-over-time']
  })
]);

export const ATRIUM_SPECIALIST_REVIEW_CASES = PHILOSOPHY_SPECIALIST_REVIEW_CASES;

/**
 * Tranche-two candidates are research briefs only. They are deliberately not
 * inserted into the runtime graph and cannot inherit tranche-one approval.
 */
export const PHILOSOPHY_SPECIALIST_TRANCHE_2_DRAFTS = freezeManifest([
  {
    id: 'specialist-draft-academic-to-pyrrhonism',
    schemaVersion: ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION,
    domain: 'philosophy',
    recordType: 'relationship-candidate',
    status: 'draft',
    proposedClaim: {
      from: 'ph-school-academic-skepticism',
      to: 'ph-school-pyrrhonism',
      type: 'influence',
      claimKind: 'origin-reaction',
      confidence: 'high',
      evidence: 'E1',
      citationRefs: ['PHOTIUS-BIBL-212', 'SEP-SKEPTICISM'],
      note: 'Aenesidemus emerged from Academic Skepticism and broke with it in reviving a Pyrrhonian program; this proposed edge records institutional origin and reaction, not doctrinal identity.'
    },
    decision: null
  },
  {
    id: 'specialist-draft-pyrrho-to-arcesilaus',
    schemaVersion: ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION,
    domain: 'philosophy',
    recordType: 'node-and-relationship-candidate',
    status: 'draft',
    proposedNode: {
      id: 'ph-thinker-pyrrho',
      kind: 'thinker',
      label: 'Pyrrho',
      era: 'hellenistic',
      dates: { display: 'c. 360–270 BCE', start: -359, end: -269, precision: 'approximate' }
    },
    proposedClaim: {
      from: 'ph-thinker-pyrrho',
      to: 'ph-school-academic-skepticism',
      targetPerson: 'Arcesilaus',
      type: 'influence',
      confidence: 'contested',
      evidence: 'E3',
      citationRefs: ['SEP-PYRRHO', 'SEP-SKEPTICISM'],
      note: 'Ancient testimony and modern scholarship leave possible Pyrrhonian influence on Arcesilaus contested; the claim concerns Pyrrho the person, not the later Pyrrhonian movement.'
    },
    decision: null
  }
]);

export function findSpecialistReviewCase(recordId, cases = ATRIUM_SPECIALIST_REVIEW_CASES) {
  return cases.find(item => item.recordId === recordId) || null;
}

export function summarizeSpecialistReview(cases = ATRIUM_SPECIALIST_REVIEW_CASES) {
  return freezeManifest(cases.reduce((summary, item) => {
    summary.total += 1;
    summary[item.status] = (summary[item.status] || 0) + 1;
    summary.recommendations[item.recommendation.disposition]
      = (summary.recommendations[item.recommendation.disposition] || 0) + 1;
    return summary;
  }, {
    total: 0,
    'awaiting-specialist': 0,
    'in-review': 0,
    decided: 0,
    recommendations: { retain: 0, revise: 0, remove: 0 }
  }));
}
