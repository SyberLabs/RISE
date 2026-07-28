# Atrium Completion Audit

**Audit date:** 2026-07-20  
**Baseline audited:** corpus 0.4.4 / runtime pack 1.12.0  
**Implemented through:** corpus 0.4.9 / runtime pack 1.16.0  
**Scope:** The baseline 24 records with live coverage state `none`

## 1. Decision

Atrium should continue to a bounded completion milestone, but it should not use
`launchable: none` as an undifferentiated defect count. The live ledger currently
combines four materially different states:

1. a ready experience exists but the record is not anchored to it;
2. a launch is required and a credible acquisition route exists;
3. a launch is desirable but depends on specialist or difficult evidentiary work;
4. the record is intentionally contextual and should not imply a single primary
   voice or a corpus scope that Atrium does not yet possess.

The completion contract should therefore add a record-level disposition independent
of runtime launchability:

| Disposition | Meaning | Completion condition |
|---|---|---|
| `launch-required` | The record belongs in the current corpus and can sustain an honest experience | A point or ready journey clears every gate |
| `alignment-repair` | Cleared material already represents the record | Correct the anchor and revalidate; do not acquire duplicate text |
| `evidence-bound` | The event is real, but the obvious speech or document is not recoverable as commonly imagined | Publish only an evidence-aware experience or retain the block |
| `context-only` | The record is a period, umbrella, or out-of-scope bridge that should remain visible without pretending to be a voice | A reviewed rationale and revisit trigger are present |

Coverage reporting should continue to show `point`, `journey`, `both`, and `none`,
but release reporting should separately count unresolved `launch-required` records.
This prevents a sound editorial refusal from being mistaken for unfinished work.

## 2. Live baseline

| Domain | Point only | Journey only | Both | None |
|---|---:|---:|---:|---:|
| Philosophy | 2 | 1 | 21 | 11 |
| History | 1 | 2 | 45 | 13 |
| **Total records** | **3** | **3** | **66** | **24** |

The shippable pack contains 101 excerpts, 94 audited editions, 81 point launches,
and 27 journeys. All duration figures must continue to come from the canonical
compiler, not editorial estimates.

### 2.1 Implemented completion state

| Domain | Satisfied | Open required | Open alignment | Accepted non-launch | Raw `none` |
|---|---:|---:|---:|---:|---:|
| Philosophy | 26 | 7 | 0 | 2 | 9 |
| History | 60 | 0 | 0 | 1 | 1 |
| **Total records** | **86** | **7** | **0** | **3** | **10** |

Every node and event now carries the schema-validated completion object. The two
alignment repairs are complete: `ph-period-early-greek` anchors
`seq-ph-archai-being`, and `ph-tradition-patristic-platonism` anchors
`seq-ph-latin-transmission`. Atrium presents both as journey-available and explains
the three accepted non-launch records instead of displaying a generic failure.
The first acquisition tranche is also complete: Rousseau, Vermont, the Articles of
Confederation, and the Bill of Rights now each have an independent point launch and
share one bounded comparative journey.
The crowd-and-publicity tranche is complete as well: the Boston Massacre, Boston
Tea Party, and Women's March each have a multi-record point, and their six sources
form a 15.86-minute comparative journey. Trial side, political alignment, archival
mediation, and Maillard's interest in his own conduct remain visible in metadata and
sequence order rather than being flattened into neutral narration.
The independence tranche is complete: Argentina, Mexico, Peru, and Brazil now have
independent points and share a 17.51-minute journey whose sequence preserves four
different political processes. Declaration, monarchical compact, capital assembly,
provisional war government, council decision, and provincial adhesion are not
collapsed into a single retrospective independence script.
The deferred-emancipation repair is complete: a 4.29-minute point pairs the
contested Commons debate with a Barbados Colonial Office law abstract, while the
repaired 17.80-minute abolition journey preserves testimony, trade prohibition,
compensation, apprenticeship, parliamentary disagreement, and local termination.
All required history records are now satisfied; the one remaining history `none`
record is the intentionally evidence-bound opening of the Mexican insurgency.

## 3. Record-by-record disposition

### 3.1 Philosophy: 11 records

| Record | Disposition | Recommended route | Principal risk |
|---|---|---|---|
| `ph-period-early-greek` | `alignment-repair` | Add the period as an anchor of `seq-ph-archai-being`, whose five positions already enact its stated scope | A period is framing, not a single authorial voice |
| `ph-tradition-pythagorean` | `launch-required`, specialist-bound | Pair explicitly late testimony in Diogenes Laertius VIII with bounded early evidence; title the experience as Pythagorean memory, not recovered doctrine | Legend, pseudepigraphy, and retrospective systematization |
| `ph-thinker-xenophanes` | `launch-required`, specialist-bound | Collate identified poetic fragments and their transmitting witnesses to a public-domain edition with stable fragment concordance | Fragment numbering and later quotation contexts |
| `ph-school-cynicism` | `launch-required`, specialist-bound | Use the Cynic lives in Diogenes Laertius VI as mediated testimony in a Socratic-afterlives tranche | Anecdote can be mistaken for direct biography or doctrine |
| `ph-school-cyrenaic` | `launch-required`, specialist-bound | Use the Aristippus and Cyrenaic sections of Diogenes Laertius II with the mediation disclosed | Positions are reconstructed from later doxography |
| `ph-school-megarian` | `launch-required`, specialist-bound | Select Euclides and dialectical-successor testimony from Diogenes Laertius II; preserve argument-level attribution | Scattered reports do not constitute one school treatise |
| `ph-school-old-academy` | `launch-required`, specialist-bound | Select Speusippus, Xenocrates, and Polemo testimony from Diogenes Laertius IV; distinguish succession from doctrinal unity | Lost works and later institutional reconstruction |
| `ph-tradition-neopythagorean` | `launch-required`, specialist-bound | Use Iamblichus as evidence for an imperial-period reconstruction of Pythagorean authority, not as transparent evidence for early Pythagoras | Revival material can overwrite the early tradition |
| `ph-school-alexandrian-neoplatonism` | `context-only` for the present milestone | Retain as a reviewed map node until an edition and translation can represent the commentary classroom across its religious and generational differences | Most suitable English translations are modern; the umbrella is heterogeneous |
| `ph-tradition-patristic-platonism` | `alignment-repair` | Add the tradition as an anchor of `seq-ph-latin-transmission`; Augustine and Dionysius already supply distinct Christian transformations | Do not collapse several patristic traditions into one school |
| `ph-tradition-latin-scholastic` | `context-only` for the Ancient Foundations pilot | Keep visible as a reception horizon; reopen only with a medieval expansion that includes Arabic, Byzantine, and translation-movement bridges | Current material ends with late antiquity and Boethius, not scholasticism proper |

The principal reusable source for the four Socratic-successor records is the
public-domain Yonge translation of Diogenes Laertius. Its late, compilatory nature
must be part of the experience rather than hidden by a clean modern label. Iamblichus's
*Pythagoric Life* is likewise reusable in the United States, but is evidence for a
late-antique reconstruction, not uncomplicated access to sixth-century BCE teaching.

### 3.2 History: 13 records

| Record | Disposition | Recommended route | Principal risk |
|---|---|---|---|
| `hist-social-contract` | `launch-required`, satisfied in 1.13 | Cole's 1920 translation, Book I.6, selected at paragraph boundaries | Translation is identified; abstract theory is not presented as direct revolutionary causation |
| `hist-boston-massacre` | `launch-required`, satisfied in 1.14 | Pair Crown-side Hinkley and Cunningham testimony with defense-side Newton Prince and James Woodall from the same authenticated trial record | Witnesses disagree about crowd conduct, command, and causation; neither side is a neutral event transcript |
| `hist-boston-tea-party` | `launch-required`, satisfied in 1.14 | Pair the complete surviving 23 December colonial newspaper extract with Leslie's next-day British military report | The newspaper stages disciplined civic action while Leslie reports a threatening mob; late patriotic memory is not used |
| `hist-vermont-constitution` | `launch-required`, satisfied in 1.13 | Selected 1777 rights articles and the freemanship rule retain the age, consent, debt, religious, and political qualifications | “Abolition” must not erase the adult thresholds or other exclusions |
| `hist-articles-confederation` | `launch-required`, satisfied in 1.13 | National Archives transcript, Articles I–V | The point reads sovereignty, common defense, privileges, and equal state voting on the instrument's own terms |
| `hist-womens-march` | `launch-required`, satisfied in 1.14 | Pair Maillard's French deposition with the complete 5 October *Archives parlementaires* incident | Maillard is a male mediator defending his conduct; the Assembly record compresses the women into a collective demand and institutional disturbance |
| `hist-us-bill-rights` | `launch-required`, satisfied in 1.13 | National Archives enrolled preamble and all twelve proposed articles | The label and framing distinguish the 1789 proposal from the ten amendments ratified in 1791 |
| `hist-mexican-insurgency` | `evidence-bound` | Do not manufacture a transcript of the Grito. Reopen only as a “How We Know” experience using later Hidalgo decrees, contemporary official responses, and explicit archival absence | No authoritative verbatim Grito survives |
| `hist-argentina-independence` | `launch-required`, satisfied in 1.15 | Pair the Tucumán act with Belgrano's 12 July letter and Congress's 1 August order decree | Declaration, unresolved political form, and coercive consolidation remain distinct |
| `hist-mexico-independence` | `launch-required`, satisfied in 1.15 | Pair the Plan of Iguala with the 28 September act | The 27 September entry is not itself the constitutional settlement |
| `hist-peru-independence` | `launch-required`, satisfied in 1.15 | Pair Lima's 15 July act with San Martín's 3 August Protector decree | Proclamation cannot be equated with completed territorial control |
| `hist-brazil-independence` | `launch-required`, satisfied in 1.15 | Pair the prince's August manifesto with the 2 September council minute and Cachoeira's provincial adhesion letter | No single declaration exhausts the process, and Bahia's war cannot be reduced to Ipiranga |
| `hist-british-emancipation` | `launch-required`, satisfied in 1.16 | Pair the 29 March Commons debate with the Barbados termination-law abstract, then carry both into `seq-hist-abolition-law-limit` | One colonial act illustrates implementation without being presented as a uniform imperial enactment |

## 4. Source-feasibility findings

The audit verified credible institutional routes for the next work:

- Project Gutenberg identifies the selected 1920 G. D. H. Cole *Social Contract*
  edition as public domain in the United States; Standard Ebooks and the underlying
  scan provide independent edition collation: <https://www.gutenberg.org/ebooks/46333>
  and <https://standardebooks.org/ebooks/jean-jacques-rousseau/the-social-contract/g-d-h-cole>.
- The National Archives supplies full transcripts for the Articles of Confederation
  and Bill of Rights, with public-domain high-resolution founding-document images:
  <https://www.archives.gov/milestone-documents/articles-of-confederation>,
  <https://www.archives.gov/milestone-documents/bill-of-rights>, and
  <https://www.archives.gov/founding-docs/downloads>.
- Yale's Avalon transcript preserves the limiting language of the 1777 Vermont
  Constitution rather than reducing it to a modern abolition label:
  <https://avalon.law.yale.edu/18th_century/vt01.asp>.
- Founders Online supplies the historically distinct Crown and defense summaries
  used for the Boston Massacre point; the Library of Congress's 1870 compilation
  remains independent scan collation. Only historical trial text enters runtime:
  <https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0004>,
  <https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0006>, and
  <https://www.loc.gov/item/02002963/>.
- The UK National Archives provides both the complete surviving colonial newspaper
  account and Leslie's 17 December British military letter for the Tea Party:
  <https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-4/>
  and <https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-3/>.
- Maillard's deposition is packaged from the 1822 scan of *Mémoires de Bailly* and
  explicitly paired with the *Archives parlementaires* record of women interrupting
  the Assembly's 5 October agenda to demand deliberation on grain:
  <https://archive.org/details/mmoiresdebailly03bail> and
  <https://archives-parlementaires.persee.fr/prt/aa2d9720-1619-4fd3-8357-695dd6ae3154>.
- Argentina, Mexico, Peru, and Brazil all have institutional archival footholds,
  but their digital transcription quality is uneven:
  <https://www.argentina.gob.ar/interior/archivo-general-de-la-nacion/documentos-de-la-independencia>,
  <https://www.gob.mx/agn/prensa/el-acta-de-independencia-a-200-anos-de-vida-el-archivo-general-de-la-nacion-la-preserva-en-condiciones-optimas>,
  <https://www.gob.pe/institucion/cultura/noticias/506461-ministerio-de-cultura-declaran-patrimonio-cultural-de-la-nacion-el-acta-de-declaracion-de-la-independencia-del-peru>, and
  <https://www.gov.br/arquivonacional/pt-br/canais_atendimento/imprensa/copy_of_noticias/nota-de-esclarecimento-sobre-documentos-da-independencia-do-brasil>.
- Historic Hansard preserves the 1838 apprenticeship debate, but the documentary
  route must also represent colonial implementation:
  <https://api.parliament.uk/historic-hansard/commons/1838/mar/29/abolition-of-negro-apprenticesship>.
- Project Gutenberg provides public-domain United States editions of Diogenes
  Laertius and Iamblichus:
  <https://www.gutenberg.org/ebooks/57342> and
  <https://www.gutenberg.org/ebooks/63300>.

These are acquisition leads, not automatic source approvals. Exact editions,
locators, transcription provenance, exclusions, checksums, and jurisdictional
rights must still enter the normal audit ledger before runtime packaging.

## 5. Re-ranked completion program

The old next item, **Law after Revolution**, overlaps too heavily with the completed
pack 1.9 journey. It should be replaced by the following sequence.

| Order | Completion tranche | Records moved from unresolved `none` | Why now |
|---:|---|---:|---|
| 0 | **Coverage alignment repair** | 2 | Corrects two honest existing journeys without duplicate acquisition |
| 1 | **Association, Confederation, Amendment** | 4 | Highest source certainty; completes Rousseau, Vermont, Articles, and Bill of Rights while asking a question distinct from the existing comparative-constitution journey |
| 2 | **Crowd, Testimony, Publicity** | 3 | Completes Boston Massacre, Tea Party, and Women's March through an evidence-centered experience rather than patriotic or crowd mythology |
| 3 | **Independence without a Single Model** | 4 | Completes Argentina, Mexico 1821, Peru, and Brazil through different settlements rather than one declaration template |
| 4 | **Abolition's Deferred Freedom** | 1 | Completes the 1838 record and repairs the temporal endpoint of the existing abolition journey |
| 5 | **Socratic Afterlives** | 4 | Efficient philosophy repair, but only after specialist approval of the doxographic framing |
| 6 | **Pythagoreanism Remembered** | 2 | Separates early testimony from late-antique revival instead of merging them |
| 7 | **Xenophanes in Fragments** | 1 | A focused fragment-and-witness point after concordance review |

After those tranches, three `none` records should remain without being classified as
unfinished: Alexandrian Neoplatonism and Latin Scholastic Reception are `context-only`,
and the Mexican insurgency opening is `evidence-bound`. Their visible rationales and
revisit triggers are the correct completion state.

## 6. Projected completion curve

| Milestone | Raw `none` count | Unresolved `launch-required` count |
|---|---:|---:|
| Baseline pack 1.12 | 24 | 19 |
| Pack 1.12.1 — alignment repaired | 22 | 19 |
| Pack 1.13 — Association, Confederation, Amendment | 18 | 15 |
| Pack 1.14 — Crowd, Testimony, Publicity | 15 | 12 |
| Pack 1.15 — Independence without a Single Model | 11 | 8 |
| **Current pack 1.16 — Abolition's Deferred Freedom** | **10** | **7** |
| Socratic Afterlives | 6 | 3 |
| Pythagoreanism Remembered | 4 | 1 |
| Xenophanes in Fragments | 3 | 0 |

The three remaining raw `none` records are not launch requirements: Alexandrian
Neoplatonism and Latin Scholastic Reception are reviewed `context-only` records, and
the Mexican insurgency is reviewed `evidence-bound`. With the proposed contract in
place, the terminal state is therefore **zero unresolved required launches**, not zero
raw `none` records.

## 7. Exit criteria for the corpus-completion milestone

Atrium's current corpus phase is complete when:

1. every record carries a reviewed completion disposition and rationale;
2. every `launch-required` record has a point or ready journey;
3. every `context-only` or `evidence-bound` record has a concrete revisit trigger;
4. no launch obtains coverage merely by being attached to a semantically unrelated journey;
5. all excerpts pass source, rights, textual, duration, provenance, integrity, and
   specialist gates appropriate to their risk;
6. displayed counts, machine-readable coverage, pack manifests, and documentation agree;
7. a final corpus-wide red-team and Chamber smoke test pass before the milestone is tagged.

Tranches 0 through 4 are complete: the completion-disposition contract encodes all
24 audited decisions, the two journey anchors are repaired, Association,
Confederation, Amendment clears four required launches, and Crowd, Testimony,
Publicity clears three more without collapsing conflicting or mediated records, and
Independence without a Single Model clears four through ten authenticated passages
that preserve distinct state-making processes. Abolition's Deferred Freedom then
completes the last required history launch without inventing a unitary imperial
enactment. The next objective is **Socratic Afterlives**, subject to the specialist
review gate.
