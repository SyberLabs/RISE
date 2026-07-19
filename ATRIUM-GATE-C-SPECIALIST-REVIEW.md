# Atrium Gate C Specialist Review Packet

**Packet:** Ancient Philosophy Relationships — Tranche 1  
**Packet schema:** `gate-c.specialist.1`  
**Corpus version:** `0.3.1`  
**Status:** Ready for external specialist review; no specialist decisions recorded

## Purpose

This packet isolates the eight philosophy relationships that remained draft after the Atrium's internal evidence pass. They are the claims most vulnerable to false continuity, retrospective school construction, chronological conflation, or overstatement of influence.

The recommendations below are editorial research briefs. They are not specialist decisions and do not authorize publication. The normative machine-readable cases live in `src/content/atrium/specialist-review.js`; build-time release checks live in `src/content/atrium/validate-specialist-review.js`. Both are intentionally excluded from the public Atrium bundle.

## Reviewer scope

The reviewer should have demonstrable expertise in ancient philosophy or the history of ancient philosophy, with particular competence in Presocratic evidence, ancient skepticism, or late-antique Platonism as applicable. One reviewer may decide the entire packet, or cases may be assigned to different specialists.

For every case, the reviewer must:

1. Examine the current claim, cited evidence anchors, and proposed disposition.
2. Distinguish ancient testimony from modern reconstruction.
3. Choose `approved`, `changes-requested`, or `rejected`.
4. Supply a rationale specific to the claim.
5. Identify themselves and state relevant qualifications.
6. Record a conflict-of-interest statement and review attestation.
7. Review the exact corpus version named by the decision.

## Case register

| Record | Principal risk | Internal recommendation | Review focus |
|---|---|---|---|
| `edge-eleatic-milesian` | Retrospective school-level critique | Revise | Limit the claim to a contested reading of Parmenidean arguments against Milesian generation and change |
| `edge-xenophanes-eleatic` | Ancient doxography treated as genealogy | Revise | Preserve the ancient reception while rejecting an established teacher–student or continuous-school claim |
| `edge-heraclitus-stoa` | Reception mistaken for doctrinal identity | Retain | Confirm Stoic appropriation of Heraclitean physics without collapsing the systems |
| `edge-pyrrhonism-academic` | Pyrrho conflated with later Pyrrhonism | Remove | Reconsider only if a distinct Pyrrho node is introduced |
| `edge-stoa-plotinus` | Selective appropriation labeled synthesis | Revise | Prefer qualified influence and acknowledge Plotinus's anti-corporealist critique |
| `edge-iamblichean-porphyry-critique` | Dependence and critique coexist | Retain | Confirm direct textual grounding in the *Reply to Porphyry* |
| `edge-iamblichean-alexandria` | Mediated transmission shown as direct | Revise | Represent the Syrianus–Proclus–Hermeias–Ammonius route and Alexandrian adaptation |
| `edge-porphyry-augustine` | Uncertain source identification | Revise | Separate Augustine's secure later access to Porphyry from the disputed Milanese corpus |

## Decision record

An authorized editor records the specialist's decision inside the corresponding case. A complete decision has this shape:

```json
{
  "outcome": "approved",
  "decidedOn": "YYYY-MM-DD",
  "corpusVersion": "0.3.1",
  "reviewer": {
    "id": "stable-reviewer-id",
    "displayName": "Reviewer name",
    "qualifications": "Relevant degree, publications, teaching, or curatorial expertise"
  },
  "rationale": "Claim-specific grounds for the decision.",
  "conflictStatement": "Declared conflict or an explicit statement that none is known.",
  "attestation": "I reviewed the identified claim and cited evidence for the named corpus version."
}
```

`specialistSignoff` must never be edited independently. After an approved decision, the corpus claim must first be changed to the approved form—or removed—then its editorial review may reference the case through `specialistDecisionId`. Validation rejects missing reviewers, stale corpus versions, incomplete attestations, unapproved decisions, and claims that drift from the approved disposition.

## Evidence orientation

The packet's primary research anchors are the Stanford Encyclopedia of Philosophy entries for Parmenides, Xenophanes, Heraclitus, Pyrrho, ancient skepticism, Plotinus, Iamblichus, Ammonius, Porphyry, and Augustine. These are starting points for specialist judgment, not substitutes for consultation of primary texts and current critical scholarship.

## Remaining Gate C tranches

This packet does not complete Gate C. After these eight cases:

1. Ancient Philosophy Tranche 2 must review the 35 node summaries and 47 internally prepared relationships by era and expertise.
2. Atlantic History Tranche 1 must review Haiti, slavery and abolition, Spanish America, and 1848 before the remaining event register.
3. Atlantic History Tranche 2 must review the full periodization, lane assignments, display-date claims, and journey framing.
4. Only approved records may move from the internal `editorial` stage to the `specialist` stage.
