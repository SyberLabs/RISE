# Atrium Corpus Specification

**Document status:** Implemented pilot and living expansion specification
**Specification version:** 0.4.9
**Target corpus schema:** 1.1.0
**Prepared:** 2026-07-20
**Implementation status:** Pilot pack 1.16.0 implements 101 passages, 94 edition records, twenty-seven launchable journeys, and 81 point launches. Every point compiles to a genuine 3–7-minute session from bounded rights-cleared excerpts, and every journey remains inside the 8–18-minute compiler gate. Schema 1.1 gives every philosophy node and history event a reviewed completion disposition independent of runtime launchability. The repaired Early Greek Inquiry and Patristic Platonisms anchors and the completed Association, Confederation, Amendment; Crowd, Testimony, Publicity; Independence without a Single Model; and Abolition's Deferred Freedom tranches reduce raw `none` coverage from 24 to 10. The live ledger now reports 86 satisfied records, seven open required launches, zero open alignment repairs, and three accepted non-launch records. All required history launches are satisfied. Gate C editorial preparation still covers all 35 philosophy nodes, 47 of 55 relationships, and all 61 history events. Specialist-review tranche one packages the eight unresolved philosophy relationships as auditable cases; no external specialist decisions have been recorded. Unselected catalogue candidates remain blocked.

**University research program:** The enacted research, prioritization, and acquisition policy is maintained in `ATRIUM-UNIVERSITY-HISTORY-RESEARCH-PROGRAM.md`. University curricula inform question selection and historiographic research only; they do not authorize runtime text, settle claims, or bypass the source, rights, specialist, and compiler gates in this specification.

## 1. Purpose

The Atrium is R.I.S.E.'s interpretive discovery layer. Its first two domains are:

1. **Philosophy — Ancient Foundations:** a navigable genealogy of Western philosophical traditions from early Greek inquiry through the major channels of transmission into the Latin medieval world.
2. **History — Atlantic Revolutions, 1750–1850:** a multi-lane timeline connecting political events, documents, ideas, emancipation struggles, and constitutional experiments across the Atlantic world.

The Atrium does not replace the Library, Workshop, Vault, or Chamber. It provides a spatial and chronological way to discover material, then emits provenance-rich passage and sequence descriptors into those existing systems.

This specification defines the editorial corpus and its contracts. It does not authorize copying source text whose reuse status has not been cleared.

## 2. Product decisions

### 2.1 Responsibilities

| System | Responsibility |
|---|---|
| Atrium | Interpretive discovery, relationships, contextual framing, point launches, curated journeys |
| Library | Browseable content inventory and provider access |
| Workshop | Deliberate composition and modification |
| Vault | Saved sequences and configurations |
| Chamber Orbital | User configuration before launch |
| Session compiler | Canonical conversion of source passages into playable atoms |

Atrium navigation state is not authored content. Camera position, zoom, open panel, and filters may be remembered as preferences. Passages intentionally collected for composition belong to Workshop; saved sequences belong to Vault.

### 2.2 Launch types

Every launchable node may expose two distinct actions:

- **Point launch:** a focused 3–7 minute sequence attached to one thinker, tradition, event, or document.
- **Journey:** a curated 8–18 minute sequence crossing multiple nodes and presenting an argument, conflict, or transmission path.

A launch descriptor must preserve `origin.view = "atrium"`, the Atrium domain, the originating node, and the sequence identifier. The Chamber remains the place where the user confirms pacing, visuals, audio, and other session behavior.

### 2.3 Non-goals for the pilot

- A comprehensive history of philosophy.
- A single definitive intellectual family tree.
- A complete world-history timeline.
- Live scraping or live API hydration during Chamber startup.
- Automated generation of scholarly relationships.
- Packaging modern translations merely because the ancient original is in the public domain.
- Treating encyclopedia prose as primary-source payload.

## 3. Editorial constitution

### 3.1 Core principles

1. **No unlabeled inference.** A graph edge cannot be created from thematic resemblance alone.
2. **Primary text and editorial interpretation are separate records.** A primary passage may support a sequence; a scholarly reference supports the Atrium's summaries and relationships.
3. **The edition is part of the source.** Author and title are insufficient without editor or translator, date, locator system, and rights status.
4. **Uncertainty remains visible.** Approximate dates, disputed authorship, fragmentary survival, and contested influence must not be normalized into false precision.
5. **Runtime reliability takes precedence over live breadth.** Approved text is packaged into versioned content packs; institutional APIs are discovery and update mechanisms.
6. **Canonical does not mean neutral.** The pilot explicitly records missing voices, survival bias, and institutional asymmetries.
7. **Correction is a first-class operation.** IDs remain stable while summaries, citations, dates, and relationships may be revised through corpus versions.

### 3.2 Editorial status

Every node, edge, source, passage, and sequence has one status:

| Status | Meaning |
|---|---|
| `draft` | Proposed but not independently reviewed |
| `reviewed` | Historical/editorial review completed |
| `rights-cleared` | Payload reuse and attribution requirements verified |
| `publishable` | Schema, editorial, rights, and runtime checks all pass |
| `deprecated` | Retained for stable references but hidden from new discovery |
| `blocked` | Cannot ship until a documented issue is resolved |

Only `publishable` records may appear in a production content pack. Draft metadata may appear in an explicitly labeled editorial-preview surface, but it cannot supply a passage payload or enable a Chamber launch.

### 3.3 Rights status

| Rights status | Runtime treatment |
|---|---|
| `public-domain-confirmed` | May be packaged with provenance and jurisdiction note |
| `open-license-confirmed` | May be packaged while satisfying license and attribution |
| `permission-confirmed` | May be packaged within the recorded permission scope |
| `link-only` | May be cited and opened externally; text is not packaged |
| `review-required` | Cannot be packaged |
| `restricted` | Cannot be packaged or excerpted beyond a separately reviewed exception |

Rights apply to the exact edition or translation, not only to the underlying work.

### 3.4 Evidence and confidence

Relationships use both an evidence class and editorial confidence:

| Evidence | Definition |
|---|---|
| `E1` | Direct testimony, explicit textual engagement, teacher–student relation, or institutional succession supported by a primary or critical source |
| `E2` | Strong modern scholarly consensus based on converging evidence |
| `E3` | Plausible scholarly interpretation with meaningful dispute or indirect evidence |

| Confidence | UI treatment |
|---|---|
| `high` | Solid edge, available by default |
| `medium` | Solid but qualified; visible with uncertainty treatment |
| `contested` | Dashed or otherwise differentiated and explained in the detail panel |

No relationship may be published without at least one bibliographic reference and an editorial note. `E3` relationships must be `contested`.

## 4. Corpus contracts

The examples below are normative field definitions, not implementation code.

### 4.1 Atrium node

```json
{
  "id": "ph-tradition-stoicism",
  "schemaVersion": "1.1.0",
  "domain": "philosophy",
  "kind": "tradition",
  "label": "Stoicism",
  "alternateLabels": ["The Stoa"],
  "dates": {
    "start": -300,
    "end": 180,
    "display": "c. 300 BCE–180 CE",
    "precision": "approximate",
    "calendar": "proleptic-gregorian-astronomical"
  },
  "summary": "Editorial text owned by the Atrium corpus.",
  "traditionIds": ["ph-hellenistic"],
  "geographies": ["Athens", "Rome"],
  "themes": ["ethics", "logic", "physics"],
  "sourceRefs": ["src-sep-stoicism"],
  "passageRefs": ["pass-epictetus-enchiridion-1"],
  "sequenceRefs": ["seq-ph-stoic-practice"],
  "status": "draft",
  "completion": {
    "disposition": "launch-required",
    "rationale": "This record belongs to the current corpus and requires cleared launch coverage.",
    "reviewedOn": "2026-07-20",
    "revisitTrigger": null
  }
}
```

Years use astronomical numbering internally (`0` = 1 BCE, `-1` = 2 BCE). The interface always renders conventional BCE/CE labels.

`completion.disposition` is independent of the runtime `point` / `journey` /
`both` / `none` coverage state. It must be one of `launch-required`,
`alignment-repair`, `evidence-bound`, or `context-only`. Every disposition needs a
reviewed rationale and ISO review date. `evidence-bound` and `context-only` records
also require a concrete nonempty `revisitTrigger`. Release completion means zero
`open-required` and zero `open-alignment` records; accepted non-launch records remain
visible and explained rather than receiving a fabricated or semantically unrelated
launch.

`kind` is one of:

- `tradition`
- `school`
- `thinker`
- `work`
- `period`
- `event`
- `document`
- `movement`
- `context-anchor`

### 4.2 Relationship edge

```json
{
  "id": "edge-cynicism-stoicism",
  "from": "ph-school-cynicism",
  "to": "ph-tradition-early-stoa",
  "type": "influence",
  "confidence": "high",
  "evidence": "E1",
  "citationRefs": ["src-sep-stoicism"],
  "note": "Zeno studied with Crates; the traditions diverge substantially after this point.",
  "status": "draft"
}
```

Allowed relationship types:

- `influence`
- `critique`
- `synthesis`
- `transmission`
- `revival`
- `institutional-succession`
- `teacher-student`
- `contemporaneous-dialogue`

`from` identifies the actor or transmitting source; `to` identifies the target or recipient. For example, a `critique` edge points from the critic to the position criticized. `teacher-student` is limited to two thinker nodes. `teacher-student` and `institutional-succession` are narrower than `influence` and should be preferred when accurate.

### 4.3 Source manifest entry

```json
{
  "id": "src-scaife-aristotle-ne-eng2",
  "workTitle": "Nicomachean Ethics",
  "author": "Aristotle",
  "editor": null,
  "translator": "W. D. Ross",
  "editionDate": 1908,
  "language": "en",
  "originalLanguage": "grc",
  "provider": "scaife",
  "canonicalUrl": "https://scaife.perseus.org/",
  "canonicalId": "urn:cts:greekLit:tlg0086.tlg010.perseus-eng2",
  "locatorScheme": "CTS",
  "rights": {
    "status": "review-required",
    "jurisdictions": ["US"],
    "license": null,
    "attribution": "Aristotle, Nicomachean Ethics, trans. W. D. Ross",
    "reviewedAt": null
  },
  "checksum": null,
  "retrievedAt": null,
  "status": "draft"
}
```

### 4.4 Passage record

```json
{
  "id": "pass-aristotle-human-good",
  "sourceId": "src-scaife-aristotle-ne-eng2",
  "locator": "1.7.1097b22-1098a20",
  "canonicalLocator": "urn:cts:greekLit:tlg0086.tlg010.perseus-eng2:1.7",
  "label": "The human good and activity of soul",
  "editorialPurpose": "Contrasts Platonic ascent with Aristotle's account of flourishing.",
  "estimatedWords": 430,
  "perspectiveTags": ["philosopher", "classical-athens"],
  "payloadPath": null,
  "rightsStatus": "review-required",
  "status": "draft"
}
```

The passage record stores no copied text until rights clearance and textual verification are complete.

### 4.5 Atrium sequence

```json
{
  "id": "seq-ph-plato-aristotle",
  "title": "Forms and Substance",
  "domain": "philosophy",
  "kind": "journey",
  "anchorNodeIds": ["ph-thinker-plato", "ph-thinker-aristotle"],
  "segments": [
    { "passageId": "pass-plato-divided-line", "role": "proposition" },
    { "passageId": "pass-aristotle-substance", "role": "response" }
  ],
  "editorialIntroduction": "Original Atrium context, not source payload.",
  "estimatedMinutes": 11,
  "defaultConfig": {
    "wpm": 210,
    "curve": "gentle-arc"
  },
  "status": "draft"
}
```

Sequence roles are descriptive rather than argumentative verdicts: `context`, `proposition`, `response`, `critique`, `countervoice`, `transmission`, and `aftermath`.

## 5. Philosophy pilot: Ancient Foundations

### 5.1 Scope and framing

The philosophy pilot maps a Western lineage from early Greek natural inquiry to the philosophical inheritance available to the Latin medieval world. It does not claim that these traditions form a single continuous ascent. It shows discontinuities, rival schools, reinterpretations, and recoveries.

The display may look genealogical, but the source of truth is a directed multigraph. The initial view should group nodes into six eras:

1. Early Greek inquiry
2. The Socratic and classical turn
3. Hellenistic schools
4. Imperial Platonisms
5. Late Antique Neoplatonisms
6. Christian and Latin transmission

### 5.2 Node registry

All dates are display dates and remain subject to editorial review.

| ID | Label | Kind | Dates | Editorial scope |
|---|---|---|---|---|
| `ph-period-early-greek` | Early Greek Inquiry | period | c. 625–400 BCE | Container for fragmentary cosmological, metaphysical, and ethical inquiry conventionally called Presocratic |
| `ph-school-milesian` | Milesian Inquiry | school | c. 625–525 BCE | Thales, Anaximander, Anaximenes; explanatory accounts of nature |
| `ph-tradition-pythagorean` | Early Pythagoreanism | tradition | c. 570–400 BCE | Number, harmony, communal life, transmigration; sharply distinguish early evidence from later legend |
| `ph-thinker-xenophanes` | Xenophanes | thinker | c. 570–475 BCE | Critique of anthropomorphic divinity, inquiry, and epistemic limits |
| `ph-thinker-heraclitus` | Heraclitus | thinker | c. 540–480 BCE | Logos, opposition, change, and fragmentary style |
| `ph-school-eleatic` | Eleatic Philosophy | school | c. 515–430 BCE | Parmenides, Zeno, Melissus; being, appearance, and argument |
| `ph-tradition-pluralists` | Pluralists | tradition | c. 495–428 BCE | Empedocles and Anaxagoras as responses to Eleatic constraints |
| `ph-school-atomism` | Early Atomism | school | c. 460–370 BCE | Leucippus and Democritus; atoms, void, perception, ethics |
| `ph-movement-sophistic` | Sophistic Movement | movement | c. 490–380 BCE | Protagoras, Gorgias, education, rhetoric, convention, and relativism |
| `ph-tradition-socratic` | Socratic Inquiry | tradition | c. 470–399 BCE | Socrates through multiple witnesses; elenchus, care of the soul, ethical inquiry |
| `ph-school-cynicism` | Cynicism | school | c. 400 BCE–300 CE | Antisthenes/Diogenes traditions, askesis, convention, parrhesia; early genealogy is disputed |
| `ph-school-cyrenaic` | Cyrenaics | school | c. 400–250 BCE | Aristippus and successors; pleasure, experience, and practical autonomy |
| `ph-school-megarian` | Megarian and Dialectical Schools | school | c. 400–250 BCE | Euclides of Megara and later dialecticians; logic and Socratic inheritance |
| `ph-thinker-plato` | Plato | thinker | 427–347 BCE | Dialogues, Forms, dialectic, psychology, politics, cosmology |
| `ph-school-old-academy` | Old Academy | school | 387–266 BCE | Speusippus, Xenocrates, Polemo; early institutional reception of Plato |
| `ph-thinker-aristotle` | Aristotle | thinker | 384–322 BCE | Logic, nature, substance, soul, ethics, politics, first philosophy |
| `ph-school-peripatetic` | Peripatetic Tradition | school | c. 335 BCE–200 CE | Theophrastus onward; research, commentary, and Aristotelian transmission |
| `ph-school-epicurean` | Epicureanism | school | c. 307 BCE–300 CE | Atomism, pleasure, freedom from disturbance, friendship, critique of providence |
| `ph-tradition-early-stoa` | Early and Middle Stoa | tradition | c. 300–51 BCE | Zeno, Cleanthes, Chrysippus, Panaetius, Posidonius |
| `ph-tradition-roman-stoa` | Roman Stoicism | tradition | c. 1–180 CE | Seneca, Musonius Rufus, Epictetus, Marcus Aurelius |
| `ph-school-pyrrhonism` | Pyrrhonian Skepticism | school | c. 360 BCE–200 CE | Pyrrho through Sextus; inquiry, modes, suspension, tranquility |
| `ph-school-academic-skepticism` | Academic Skepticism | school | 266–c. 80 BCE | Arcesilaus and Carneades; skeptical phase of Plato's Academy |
| `ph-tradition-middle-platonism` | Middle Platonism | tradition | c. 80 BCE–250 CE | Plutarch, Alcinous, Numenius and plural attempts to systematize Plato |
| `ph-tradition-neopythagorean` | Neopythagoreanism | tradition | c. 1 BCE–200 CE | Revival and reconstruction of Pythagorean teachings in the imperial period |
| `ph-thinker-philo` | Philo of Alexandria | thinker | c. 20 BCE–50 CE | Synthesis of Jewish scriptural exegesis with Greek philosophy, especially Platonism and Stoicism |
| `ph-thinker-plotinus` | Plotinus | thinker | 204–270 CE | The One, Intellect, Soul, procession and return; conventional anchor of Neoplatonism |
| `ph-thinker-porphyry` | Porphyry | thinker | c. 234–305 CE | Editor of Plotinus; ethics, exegesis, Aristotelian logic, transmission |
| `ph-tradition-iamblichean` | Iamblichean Platonism | tradition | c. 245–350 CE | Iamblichus and followers; expanded metaphysical hierarchy and theurgy |
| `ph-school-athenian-neoplatonism` | Athenian Neoplatonism | school | c. 400–529 CE | Plutarch of Athens, Syrianus, Proclus, Damascius; systematic late Platonism |
| `ph-school-alexandrian-neoplatonism` | Alexandrian Neoplatonism | school | c. 400–640 CE | Ammonius, Olympiodorus, Philoponus and commentary traditions across religious change |
| `ph-tradition-patristic-platonism` | Patristic Platonisms | tradition | c. 150–500 CE | Multiple Christian engagements with Platonist concepts; not one school |
| `ph-thinker-augustine` | Augustine | thinker | 354–430 CE | Christian Platonism, inwardness, memory, time, will, grace, and critique of skepticism |
| `ph-thinker-pseudo-dionysius` | Pseudo-Dionysius | thinker | late 5th–early 6th c. | Apophatic theology and hierarchical metaphysics strongly indebted to late Platonism |
| `ph-thinker-boethius` | Boethius | thinker | c. 477–524 CE | Latin transmission of Greek logic and philosophical consolation |
| `ph-tradition-latin-scholastic` | Latin Scholastic Reception | tradition | c. 800–1300 CE | Reception anchor rather than a complete medieval corpus; Augustine, Boethius, Dionysius, and later Aristotle |

The period ends with a reception anchor rather than claiming to represent medieval philosophy. A later Atrium pack should expand Arabic philosophy, Byzantine continuities, Jewish philosophy, and the translation movements on their own terms before the scholastic node is decomposed.

### 5.3 Proposed relationship registry

The citations listed are research anchors; each edge still requires a dedicated editorial note before publication.

| From | To | Type | Confidence | Evidence | Research basis |
|---|---|---|---|---|---|
| Eleatic Philosophy | Milesian Inquiry | critique | contested | E3 | `SEP-PRE` |
| Early Pythagoreanism | Plato | influence | medium | E2 | `SEP-PYTH`, `SEP-PLATO` |
| Xenophanes | Eleatic Philosophy | influence | contested | E3 | `SEP-PRE` |
| Heraclitus | Plato | influence | medium | E2 | `SEP-HER`, `SEP-PLATO` |
| Pluralists | Eleatic Philosophy | critique | high | E2 | `SEP-PRE` |
| Early Atomism | Eleatic Philosophy | critique | high | E2 | `SEP-PRE` |
| Eleatic Philosophy | Plato | influence | high | E2 | `SEP-PAR`, `SEP-PLATO` |
| Sophistic Movement | Socratic Inquiry | contemporaneous-dialogue | high | E1 | `SEP-SOPH`, Platonic dialogues |
| Plato | Sophistic Movement | critique | high | E1 | `SEP-SOPH`, Platonic dialogues |
| Socratic Inquiry | Plato | influence | high | E1 | `SEP-SOCR`, `SEP-PLATO` |
| Socratic Inquiry | Cynicism | influence | medium | E2 | `SEP-CYN` |
| Socratic Inquiry | Cyrenaics | influence | high | E1 | `SEP-CYR` |
| Socratic Inquiry | Megarian and Dialectical Schools | influence | high | E1 | `SEP-MEG` |
| Plato | Old Academy | institutional-succession | high | E1 | `SEP-ACADEMY` |
| Plato | Aristotle | teacher-student | high | E1 | `SEP-ARISTOTLE` |
| Aristotle | Plato | critique | high | E1 | Aristotelian corpus |
| Aristotle | Peripatetic Tradition | institutional-succession | high | E1 | `SEP-ARISTOTLE` |
| Early Atomism | Epicureanism | revival | high | E1 | `SEP-EPICURUS` |
| Cynicism | Early and Middle Stoa | influence | high | E1 | `SEP-STOICISM` |
| Heraclitus | Early and Middle Stoa | influence | medium | E2 | `SEP-STOICISM` |
| Megarian and Dialectical Schools | Early and Middle Stoa | influence | medium | E2 | `SEP-STOICISM` |
| Early and Middle Stoa | Roman Stoicism | transmission | high | E1 | `SEP-STOICISM` |
| Old Academy | Academic Skepticism | institutional-succession | high | E1 | `SEP-SKEPTICISM` |
| Pyrrhonian Skepticism | Academic Skepticism | influence | contested | E3 | `SEP-SKEPTICISM` |
| Academic Skepticism | Early and Middle Stoa | critique | high | E1 | `SEP-SKEPTICISM`, `SEP-STOICISM` |
| Epicureanism | Early and Middle Stoa | contemporaneous-dialogue | high | E1 | Hellenistic testimonia |
| Old Academy | Middle Platonism | transmission | medium | E2 | `SEP-MIDDLE-PLATONISM` |
| Middle Platonism | Academic Skepticism | critique | medium | E2 | `SEP-MIDDLE-PLATONISM` |
| Plato | Middle Platonism | revival | high | E1 | Middle Platonist corpus |
| Aristotle | Middle Platonism | synthesis | medium | E2 | `SEP-MIDDLE-PLATONISM` |
| Early Pythagoreanism | Neopythagoreanism | revival | high | E2 | `SEP-PYTH` |
| Middle Platonism | Philo of Alexandria | synthesis | high | E2 | `SEP-PHILO` |
| Early and Middle Stoa | Philo of Alexandria | synthesis | medium | E2 | `SEP-PHILO` |
| Middle Platonism | Plotinus | transmission | high | E2 | `SEP-PLOTINUS` |
| Plato | Plotinus | revival | high | E1 | Plotinian corpus, `SEP-PLOTINUS` |
| Aristotle | Plotinus | synthesis | high | E1 | Plotinian corpus, `SEP-PLOTINUS` |
| Early and Middle Stoa | Plotinus | synthesis | medium | E1 | `SEP-PLOTINUS` |
| Plotinus | Porphyry | teacher-student | high | E1 | Porphyry, *Life of Plotinus* |
| Porphyry | Iamblichean Platonism | influence | high | E1 | `SEP-IAMBLICHUS` |
| Iamblichean Platonism | Porphyry | critique | high | E1 | `SEP-IAMBLICHUS` |
| Iamblichean Platonism | Athenian Neoplatonism | transmission | high | E2 | `SEP-IAMBLICHUS`, `SEP-PROCLUS` |
| Iamblichean Platonism | Alexandrian Neoplatonism | transmission | high | E2 | `SEP-NEOPLATONISM` |
| Athenian Neoplatonism | Alexandrian Neoplatonism | contemporaneous-dialogue | high | E1 | late antique commentaries |
| Middle Platonism | Patristic Platonisms | synthesis | medium | E2 | `SEP-NEOPLATONISM` |
| Philo of Alexandria | Patristic Platonisms | transmission | medium | E2 | `SEP-PHILO` |
| Plotinus | Augustine | influence | medium | E2 | `SEP-AUGUSTINE`, *Confessions* VII |
| Porphyry | Augustine | influence | contested | E3 | `SEP-AUGUSTINE` |
| Patristic Platonisms | Augustine | transmission | high | E1 | Augustinian corpus |
| Athenian Neoplatonism | Pseudo-Dionysius | influence | high | E2 | `SEP-DIONYSIUS`, `SEP-PROCLUS` |
| Aristotle | Boethius | transmission | high | E1 | Boethian logical works |
| Porphyry | Boethius | transmission | high | E1 | Boethius' translation/commentary on *Isagoge* |
| Augustine | Latin Scholastic Reception | transmission | high | E1 | medieval reception corpus |
| Pseudo-Dionysius | Latin Scholastic Reception | transmission | high | E1 | medieval reception corpus |
| Boethius | Latin Scholastic Reception | transmission | high | E1 | medieval reception corpus |
| Peripatetic Tradition | Latin Scholastic Reception | revival | medium | E2 | translation movement; incomplete until Arabic/Byzantine pack exists |

### 5.4 Philosophy passage candidates

This registry identifies candidate passage locations without reproducing them.

| Passage ID | Work and locator | Purpose | Preferred source | Initial status |
|---|---|---|---|---|
| `pass-anaximander-fragment` | Anaximander, DK 12 B1 / current Laks–Most equivalent | Origin, order, and return | OGL Greek plus cleared historical translation | `review-required` |
| `pass-heraclitus-logos` | Heraclitus, selected Logos fragments using both DK and current concordance | Logos and common order | OGL/testimonia; translation audit | `review-required` |
| `pass-parmenides-being` | Parmenides, fragment B8, selected lines | Being and the limits of coming-to-be | OGL Greek; translation audit | `review-required` |
| `pass-empedocles-roots` | Empedocles, selected fragments on roots, Love, and Strife | Pluralist response | OGL Greek; translation audit | `review-required` |
| `pass-democritus-atoms` | Leucippus and Democritus, Burnet §§173–175, selected testimonia | Atoms, void, and the Eleatic problem of motion | Burnet, *Early Greek Philosophy* (1908) | `publishable — pilot 1.3` |
| `pass-protagoras-measure` | Plato, *Theaetetus* 151e–160e, selected | Relativism through a critical witness | Scaife Plato edition | `review-required` |
| `pass-socrates-apology` | Plato, *Apology* 20c–23b and 28e–30b | Wisdom and examined life | Scaife | `review-required` |
| `pass-plato-recollection` | Plato, *Meno* 80d–86c, selected | Inquiry and recollection | Scaife | `review-required` |
| `pass-plato-divided-line` | Plato, *Republic* VI 507b–511e | Knowledge and intelligibility | Scaife | `review-required` |
| `pass-plato-cave` | Plato, *Republic* VII 514a–521b, selected | Education and return | Scaife | `review-required` |
| `pass-plato-forms` | Plato, *Phaedo* 74a–76e | Equality, recollection, Forms | Scaife | `review-required` |
| `pass-plato-cosmos` | Plato, *Timaeus* 27d–29d | Model, becoming, and likely account | Jowett; Project Gutenberg 1572 | `publishable — pilot 1.3` |
| `pass-aristotle-first-causes` | Aristotle, *Metaphysics* I.3, 983a24–984b22, selected | Aristotle's genealogy of predecessors | Scaife | `review-required` |
| `pass-aristotle-substance` | Aristotle, *Metaphysics* VII.1–3, selected | Being and substance | Scaife | `review-required` |
| `pass-aristotle-human-good` | Aristotle, *Nicomachean Ethics* I.7, 1097b22–1098a20 | Function and flourishing | Chase; Project Gutenberg 8438 | `publishable — pilot 1.3` |
| `pass-aristotle-soul` | Aristotle, *De Anima* II.1, 412a3–413a10 | Soul as actuality | Scaife | `review-required` |
| `pass-epicurus-gods-death` | Epicurus, *Letter to Menoeceus* 122–135, selected | Gods, death, desire, pleasure | Diogenes Laertius X; cleared edition | `review-required` |
| `pass-epicurus-doctrines` | Epicurus, *Principal Doctrines* 1–5 and 27–28 | Freedom from fear and friendship | Diogenes Laertius X; cleared edition | `review-required` |
| `pass-epictetus-control` | Epictetus, *Enchiridion* 1 | What is and is not up to us | Standard Ebooks or cleared public-domain edition | `review-required` |
| `pass-seneca-inner-spirit` | Seneca, *Moral Letters* 41.1–5 | Divinity, reason, inward dignity | Gummere; scan-backed Wikisource | `publishable — pilot 1.4` |
| `pass-marcus-morning` | Marcus Aurelius, *Meditations* II.1–5 | Social nature, difficult encounters, deliberate action | Long; Project Gutenberg 15877 | `publishable — pilot 1.4` |
| `pass-sextus-skeptical-way` | Sextus Empiricus, *Outlines of Pyrrhonism* I.1–12 | Inquiry and suspension | original Greek plus cleared translation | `review-required` |
| `pass-cicero-academic` | Cicero, *Academica* II, selected | Academic arguments about apprehension | Perseus/cleared Latin edition | `review-required` |
| `pass-philo-creation` | Philo, *On the Creation* 16–22 | Intelligible model and scriptural exegesis | Yonge (1854); OGL/Perseus collation | `publishable — pilot 1.3` |
| `pass-plotinus-beauty` | Plotinus, *Ennead* I.6.5, selected | Beauty and ascent | Guthrie (1918); Project Gutenberg 42930 | `publishable — pilot 1.3` |
| `pass-plotinus-hypostases` | Plotinus, *Ennead* V.1.10–11 | The three primary hypostases | Guthrie (1918); Project Gutenberg 42930 | `publishable — pilot 1.3` |
| `pass-porphyry-life-14` | Porphyry, *Life of Plotinus* 14 | Plotinus' sources and teaching | OGL/Scaife; translation audit | `review-required` |
| `pass-porphyry-isagoge` | Porphyry, *Isagoge* I and II, opening definition of genus, selected | Logical transmission | Owen (1853); historical transcription | `publishable — pilot 1.4` |
| `pass-iamblichus-theurgy` | Iamblichus, *On the Mysteries* I.11 opening and I.12 | Reason, ritual, and divine action | Taylor; Project Gutenberg 72815 | `publishable — pilot 1.4` |
| `pass-proclus-propositions` | Proclus, *Elements of Theology*, propositions 1–4 | Unity, multiplicity, procession | Taylor (1816); Internet Archive scan | `publishable — pilot 1.4` |
| `pass-augustine-platonic-books` | Augustine, *Confessions* VII.9–21, selected | Encounter with the “books of the Platonists” | Cleared edition; Standard Ebooks edition is currently unfinished | `review-required` |
| `pass-augustine-time` | Augustine, *Confessions* XI.14–28, selected | Time, memory, and attention | Cleared edition; Standard Ebooks edition is currently unfinished | `review-required` |
| `pass-dionysius-mystical` | Pseudo-Dionysius, *Mystical Theology* I | Apophatic ascent | cleared historical translation | `review-required` |
| `pass-boethius-eternity` | Boethius, *Consolation of Philosophy* V, selected | Providence, eternity, and freedom | Standard Ebooks or cleared edition | `review-required` |

### 5.5 Philosophy launch catalog

| Sequence ID | Title | Type | Anchor nodes | Passage plan | Target duration |
|---|---|---|---|---|---|
| `seq-ph-archai-being` | From Origin to Being | journey | Milesians, Heraclitus, Eleatics, Pluralists | Anaximander → Heraclitus → Parmenides → Empedocles → Aristotle's retrospective | 13–16 min |
| `seq-ph-socratic-turn` | The Examined Life | journey | Sophists, Socrates, Plato | Protagoras through Plato → *Apology* → *Meno* | 10–13 min |
| `seq-ph-plato-ascent` | Line, Cave, Return | point/journey | Plato | Divided Line → Cave, ending with the return to the cave | 8–11 min |
| `seq-ph-plato-aristotle` | Forms and Substance | journey | Plato, Aristotle | *Phaedo* → *Metaphysics* VII → *De Anima* II | 11–14 min |
| `seq-ph-three-therapies` | Three Therapies of Judgment | journey | Epicureanism, Stoicism, Skepticism | Epicurus → Epictetus → Sextus | 10–13 min |
| `seq-ph-stoic-practice` | The Work of Assent | journey | Roman Stoicism | Epictetus → Seneca → Marcus Aurelius | 12–15 min |
| `seq-ph-suspension` | Continue to Search | point/journey | Pyrrhonism, Academic Skepticism | Sextus → Cicero, with editorial distinction between traditions | 8–11 min |
| `seq-ph-platonism-one` | Toward the One | journey | Middle Platonism, Plotinus | Plato *Timaeus* → Philo → Plotinus I.6 and V.1 | 15–18 min |
| `seq-ph-theurgy-system` | Reason, Rite, Hierarchy | journey | Porphyry, Iamblichus, Proclus | Porphyry → Iamblichus → Proclus | 14–17 min |
| `seq-ph-latin-transmission` | The Inward and the Eternal | journey | Augustine, Dionysius, Boethius | Augustine VII → Dionysius → Boethius V | 12–16 min |

Point launches should be derived only after these passages pass rights and text review. They must not silently substitute a different translation because a preferred passage is unavailable.

## 6. History pilot: Atlantic Revolutions, 1750–1850

### 6.1 Scope and interpretive structure

The timeline examines how war, fiscal pressure, political argument, slavery, racial hierarchy, print, and constitutional experimentation interacted across the Atlantic world. It must not render the American and French Revolutions as the central story with Haiti and Spanish America as aftereffects.

The pilot uses six lanes:

1. `war-empire`
2. `politics-constitution`
3. `ideas-publication`
4. `slavery-emancipation`
5. `social-movement`
6. `economic-technology`

Events may occupy more than one lane. Geography filters begin with Britain/Ireland, British North America/United States, France, Saint-Domingue/Haiti, Spanish America, Brazil, and transatlantic.

### 6.2 Timeline event registry

| ID | Date | Event | Lanes | Geography | Source posture |
|---|---|---|---|---|---|
| `hist-seven-years-war` | 1756–1763 | Seven Years' War | war-empire | transatlantic/global | Context event; institutional histories |
| `hist-social-contract` | 1762 | Rousseau publishes *The Social Contract* | ideas-publication | Geneva/France | Cole 1920 Book I.6; `publishable — pilot 1.13` |
| `hist-treaty-paris-1763` | 1763-02-10 | Treaty of Paris reshapes imperial possessions | war-empire, politics-constitution | transatlantic | Treaty text; archive source |
| `hist-stamp-act` | 1765-03-22 | British Parliament enacts the Stamp Act | politics-constitution, war-empire | British Atlantic | Statute and colonial responses |
| `hist-watt-patent` | 1769 | Watt's steam-engine patent | economic-technology | Britain | British Patent No. 913 official reprint; `publishable — pilot 1.11` |
| `hist-water-frame` | 1769 | Arkwright's spinning-frame patent | economic-technology | Britain | Baines scan and embedded specification, collated to patent and museum records; `publishable — pilot 1.11` |
| `hist-boston-massacre` | 1770-03-05 | Boston Massacre | war-empire, social-movement | Massachusetts | Paired Crown and defense trial testimony; `publishable — pilot 1.14` |
| `hist-somerset` | 1772-06-22 | Somerset judgment | slavery-emancipation, politics-constitution | Britain | Judgment/report edition review |
| `hist-boston-tea-party` | 1773-12-16 | Destruction of East India Company tea | social-movement, war-empire | Massachusetts/Britain | Colonial newspaper and next-day British military report; `publishable — pilot 1.14` |
| `hist-first-continental-congress` | 1774-09-05/1774-10-26 | First Continental Congress | politics-constitution | British North America | LOC Journals/records |
| `hist-lexington-concord` | 1775-04-19 | War begins at Lexington and Concord | war-empire | Massachusetts | Provincial depositions paired with Gage's official report; `publishable — pilot 1.12` |
| `hist-continental-army` | 1775-06-14/1775-07-04 | Congress creates an army and Washington assumes command | war-empire, politics-constitution | British North America | Washington's General Orders; `publishable — pilot 1.12` |
| `hist-common-sense` | 1776-01-10 | Publication of *Common Sense* | ideas-publication, politics-constitution | British North America | Public-domain edition |
| `hist-us-declaration` | 1776-07-04 | Declaration of Independence | politics-constitution, ideas-publication | United States | LOC/NARA/Founders witness |
| `hist-vermont-constitution` | 1777-07-08 | Vermont Constitution prohibits adult slavery with qualifications | slavery-emancipation, politics-constitution | Vermont | Rights and freemanship qualifications retained; `publishable — pilot 1.13` |
| `hist-franco-american-alliance` | 1778-02-06 | France and the United States conclude a military alliance | war-empire, politics-constitution | transatlantic | Signed bilingual treaty, historical English text; `publishable — pilot 1.12` |
| `hist-articles-confederation` | 1781-03-01 | Articles of Confederation take effect | politics-constitution | United States | NARA engrossed original and transcript; `publishable — pilot 1.13` |
| `hist-yorktown` | 1781-10-19 | British surrender at Yorktown | war-empire | Virginia/transatlantic | Articles of capitulation and Washington's refusal to grant loyalists immunity; `publishable — pilot 1.12` |
| `hist-treaty-paris-1783` | 1783-09-03 | Treaty recognizes U.S. independence | war-empire, politics-constitution | transatlantic | Treaty text |
| `hist-power-loom` | 1785 | Cartwright's first power-loom patent | economic-technology | Britain | Marsden technical history and embedded specification; `publishable — pilot 1.11` |
| `hist-us-constitution` | 1787-09-17 | U.S. Constitution signed | politics-constitution | United States | NARA/LOC |
| `hist-federalist` | 1787-10-27/1788-05-28 | *The Federalist* published | ideas-publication, politics-constitution | United States | Founders Online; rights review for annotations |
| `hist-estates-general` | 1789-05-05 | Estates-General convenes | politics-constitution, social-movement | France | FRDA/Archives parlementaires |
| `hist-bastille` | 1789-07-14 | Storming of the Bastille | social-movement, politics-constitution | France | Context and contemporary accounts |
| `hist-rights-man` | 1789-08-26 | Declaration of the Rights of Man and of the Citizen | politics-constitution, ideas-publication | France | French institutional source; translation review |
| `hist-womens-march` | 1789-10-05/1789-10-06 | Women's March on Versailles | social-movement | France | Maillard deposition and Assembly incident, mediation disclosed; `publishable — pilot 1.14` |
| `hist-equiano-narrative` | 1789 | Equiano publishes his *Interesting Narrative* | slavery-emancipation, ideas-publication | Britain/Atlantic | Standard Ebooks/public-domain edition |
| `hist-haitian-uprising` | 1791-08 | General uprising in northern Saint-Domingue | slavery-emancipation, social-movement, war-empire | Saint-Domingue | Date precision and Bois Caïman claims require care |
| `hist-rights-woman` | 1791-09 | Olympe de Gouges publishes *Declaration of the Rights of Woman* | politics-constitution, social-movement | France | French original; translation rights review |
| `hist-us-bill-rights` | 1791-12-15 | U.S. Bill of Rights ratified | politics-constitution | United States | NARA 1789 enrolled proposal, all twelve articles; `publishable — pilot 1.13` |
| `hist-french-republic` | 1792-09-21 | First French Republic declared | politics-constitution | France | Archives parlementaires |
| `hist-sonthonax-emancipation` | 1793-08-29 | Sonthonax proclaims emancipation in northern Saint-Domingue | slavery-emancipation, war-empire | Saint-Domingue | French/Haitian archival text |
| `hist-french-abolition-1794` | 1794-02-04 | National Convention abolishes slavery in French colonies | slavery-emancipation, politics-constitution | French Atlantic | Archives parlementaires |
| `hist-thermidor` | 1794-07-27 | Fall of Robespierre | politics-constitution | France | Context plus convention records |
| `hist-brumaire` | 1799-11-09/1799-11-10 | Coup of 18–19 Brumaire | politics-constitution, war-empire | France | Official and critical accounts |
| `hist-haiti-constitution-1801` | 1801-07-08 | Constitution of Saint-Domingue promulgated | politics-constitution, slavery-emancipation | Saint-Domingue | LOC public-domain constitution collection |
| `hist-haiti-independence` | 1804-01-01 | Haitian independence declared | politics-constitution, slavery-emancipation, war-empire | Haiti | Original French; translation review |
| `hist-code-civil` | 1804-03-21 | French Civil Code promulgated | politics-constitution | France/Empire | Official code; contextual limits |
| `hist-napoleonic-wars` | 1803–1815 | Napoleonic Wars and imperial collapse | war-empire, politics-constitution | Europe/Atlantic | Broad interval anchor; 1814 Senate decree is a partisan endpoint witness, not a neutral campaign synopsis |
| `hist-uk-slave-trade-act` | 1807-03-25 | British Slave Trade Act receives assent | slavery-emancipation, politics-constitution | British Empire | legislation text/Parliamentary archive |
| `hist-us-import-ban` | 1808-01-01 | U.S. prohibition on importing enslaved people takes effect | slavery-emancipation, politics-constitution | United States/Atlantic | U.S. statute; distinguish trade ban from abolition |
| `hist-mexican-insurgency` | 1810-09-16 | Hidalgo's insurgency begins | war-empire, social-movement | New Spain/Mexico | Do not present a verbatim “Grito” speech; no authoritative transcript survives |
| `hist-venezuela-declaration` | 1811-07-05 | Venezuelan Declaration of Independence | politics-constitution, war-empire | Venezuela | Original Spanish; institutional edition needed |
| `hist-cadiz-constitution` | 1812-03-19 | Constitution of Cádiz promulgated | politics-constitution | Spain/Spanish Atlantic | Official Spanish text; translation review |
| `hist-congress-vienna` | 1815-06-09 | Final Act of the Congress of Vienna | war-empire, politics-constitution | Europe | 1815 official edition; Wienbibliothek public-domain scan |
| `hist-jamaica-letter` | 1815-09-06 | Bolívar writes the Jamaica Letter | ideas-publication, politics-constitution | Caribbean/Spanish America | Original Spanish preferred; common 1951 English translation is not presumed packable |
| `hist-argentina-independence` | 1816-07-09 | Congress of Tucumán declares independence | politics-constitution, war-empire | Río de la Plata | Tucumán act, Belgrano letter, and congressional order decree; `publishable — pilot 1.15` |
| `hist-angostura` | 1819-02-15 | Bolívar addresses Congress of Angostura | politics-constitution, ideas-publication | Venezuela/Gran Colombia | Original Spanish; translation audit |
| `hist-mexico-independence` | 1821-09-27 | Army of the Three Guarantees enters Mexico City | war-empire, politics-constitution | Mexico | Plan of Iguala plus 28 September act; `publishable — pilot 1.15` |
| `hist-peru-independence` | 1821-07-28 | Peruvian independence proclaimed | politics-constitution, war-empire | Peru | Lima act plus Protector decree; `publishable — pilot 1.15` |
| `hist-brazil-independence` | 1822-09-07 | Brazilian declaration of independence | politics-constitution, war-empire | Brazil/Portugal | Manifesto, council minute, and Cachoeira adhesion letter; `publishable — pilot 1.15` |
| `hist-monroe-doctrine` | 1823-12-02 | Monroe's annual message articulates hemispheric policy | politics-constitution, war-empire | United States/Americas | Official U.S./Library of Congress source |
| `hist-ayacucho` | 1824-12-09 | Battle of Ayacucho | war-empire | Peru/Spanish America | Context event |
| `hist-stockton-darlington` | 1825-09-27 | Stockton and Darlington Railway opens | economic-technology | Britain | Identified company notice and contemporary opening report; `publishable — pilot 1.11` |
| `hist-slavery-abolition-act` | 1833-08-28 | British Slavery Abolition Act receives assent | slavery-emancipation, politics-constitution | British Empire | Legislation text; foreground apprenticeship and compensation |
| `hist-british-emancipation` | 1838-08-01 | Apprenticeship ends in most British colonies | slavery-emancipation, social-movement | British Empire | Contested Commons debate plus Barbados local termination abstract; `publishable — pilot 1.16` |
| `hist-revolutions-1848` | 1848 | Revolutions across Europe | social-movement, politics-constitution | Europe | Cluster event decomposed at closer zoom |
| `hist-french-abolition-1848` | 1848-04-27 | Second French Republic abolishes colonial slavery | slavery-emancipation, politics-constitution | French Empire | Official decree; distinguish from 1794 and 1802 reversal |
| `hist-communist-manifesto` | 1848-02 | *Manifesto of the Communist Party* published | ideas-publication, social-movement | Europe/transatlantic | Cleared public-domain translation only |
| `hist-seneca-falls` | 1848-07-19/1848-07-20 | Seneca Falls Convention | social-movement, politics-constitution | United States | LOC/NPS/institutional transcription |

### 6.3 Mandatory historical cautions

- The Haitian uprising is dated to August 1791, but the evidentiary status of specific Bois Caïman narratives is contested. The interface must not present a reconstructed speech as a transcript.
- The “Grito de Dolores” is an event, not a surviving verbatim document. Point launches should use later authenticated writings or contemporary records and state that distinction.
- Legal abolition events must state their exclusions, delays, apprenticeship systems, compensation structures, reversals, and enforcement limits.
- Founding documents must not be presented without their exclusions and the voices that contested them.
- National independence is not equivalent to social emancipation.
- The Atlantic frame must acknowledge that its archive privileges literate, state, colonial, and elite records.

### 6.4 History passage candidates

| Passage ID | Document and locator | Role | Preferred source | Initial status |
|---|---|---|---|---|
| `pass-rousseau-association` | Rousseau, *Social Contract* I.6, selected | Legitimate association and the general will | Cole 1920; Project Gutenberg 46333, scan-backed and independently collated | `publishable — pilot 1.13` |
| `pass-vermont-constitution-1777` | Vermont Constitution, Chapter I Articles I, III, VI, VIII; Chapter II §VI | Rights, qualified servitude, religion, and freemanship | Yale Avalon institutional transcript | `publishable — pilot 1.13` |
| `pass-articles-confederation-1777` | Articles of Confederation, Articles I–V | State sovereignty, common defense, privileges, and equal state voting | National Archives original and transcript | `publishable — pilot 1.13` |
| `pass-us-bill-rights-proposal-1789` | Enrolled Bill of Rights, preamble and proposed Articles I–XII | Amendment, rights, and the difference between proposal and ratification | National Archives original and transcript | `publishable — pilot 1.13` |
| `pass-boston-massacre-crown-evidence` | *The King v. Preston*, Hinkley and Cunningham, 24–25 October 1770 | Crown-side testimony on crowd conduct, loading, and command | Founders Online historical trial text; LOC Kidder collation | `publishable — pilot 1.14` |
| `pass-boston-massacre-defense-evidence` | *The King v. Preston*, Newton Prince and James Woodall, 25–27 October 1770 | Defense-side counterevidence on crowd conduct and command | Founders Online historical trial text; LOC Kidder collation | `publishable — pilot 1.14` |
| `pass-boston-tea-colonial-newspaper-1773` | *Massachusetts and Boston Weekly*, 23 December 1773, complete surviving extract | Disciplined collective action, spectatorship, property, and public celebration | UK National Archives, CO 5/91 | `publishable — pilot 1.14` |
| `pass-boston-tea-leslie-letter-1773` | Alexander Leslie to Viscount Barrington, 17 December 1773 | Military readiness and a British judgment on crowd power | UK National Archives, WO 40/1 | `publishable — pilot 1.14` |
| `pass-maillard-womens-march-deposition` | Maillard deposition, *Mémoires de Bailly* III, pp. 407–408, selected | Women's collective action disclosed through a self-exculpatory male mediator | 1822 Internet Archive scan; Google Books collation | `publishable — pilot 1.14` |
| `pass-assembly-womens-march-1789` | *Archives parlementaires* IX, night session of 5 October, p. 348 | Bread demand and institutional evacuation of the hall | Persée/ARCPA scan-backed record | `publishable — pilot 1.14` |
| `pass-tucuman-independence-act-1816` | Congress of Tucumán, 9 July act with the 19 July amendment | Independence claimed for represented provinces | Argentine government transcript; Educ.ar collation | `publishable — pilot 1.15` |
| `pass-belgrano-government-unsettled-1816` | Belgrano to Pueyrredón, 12 July 1816, selected | Political form, finance, and command remain unsettled | Archivo General de la Nación facsimile and transcript | `publishable — pilot 1.15` |
| `pass-tucuman-order-decree-1816` | Congress of Tucumán, decree of 1 August 1816 | Union, obedience, petition, and coercive consolidation | Museo Histórico Nacional object; historical-text collation | `publishable — pilot 1.15` |
| `pass-plan-iguala-1821` | Plan of Iguala, preamble and selected numbered bases | Independence joined to monarchy and the Three Guarantees | Mexican Chamber of Deputies/INEHRM transcript | `publishable — pilot 1.15` |
| `pass-mexico-independence-act-1821` | Mexican Imperial Act of Independence, 28 September 1821 | Sovereignty declared through the Iguala settlement | INEHRM institutional transcript | `publishable — pilot 1.15` |
| `pass-peru-lima-independence-act-1821` | Cabildo of Lima act, 15 July 1821 | A capital assembly certifies a general will | Proyecto Especial Bicentenario transcript; Ministry of Culture collation | `publishable — pilot 1.15` |
| `pass-peru-protector-decree-1821` | San Martín, Protector decree, 3 August 1821, selected | Proclamation followed by provisional war government | Congress of Peru transcript | `publishable — pilot 1.15` |
| `pass-brazil-manifesto-peoples-1822` | Manifesto to the Peoples of Brazil, 1 August 1822, selected | Provincial union and a projected constitutional order | Biblioteca Nacional newspaper scan; USP collation | `publishable — pilot 1.15` |
| `pass-brazil-council-session-1822` | Council of State session 13, 2 September 1822 | Collective decision, reprisal, and planning for war | Chamber of Deputies archival exhibition transcript | `publishable — pilot 1.15` |
| `pass-cachoeira-adhesion-letter-1822` | Municipal chamber of Cachoeira to Pedro, 28 June 1822, selected | Provincial adhesion made under bombardment | Historical documentary edition quoted in a UFBA repository scan | `publishable — pilot 1.15` |
| `pass-franklin-war-finance-1766` | Franklin, Commons examination, questions 2–4, 14–16, and 27–28 | Colonial wartime taxation, debt, specie, and contribution claims | Founders Online historical examination text | `publishable — pilot 1.8` |
| `pass-watt-steam-principles-1769` | Watt, British Patent No. 913, selected Principles I–IV and VI–VII | Heat economy, condensation, expansion, and patent scope | 1855 official reprint of the 1769 specification | `publishable — pilot 1.11` |
| `pass-arkwright-water-frame-system-1769` | Baines, Chapter IX, print pp. 147 and 151–154, selected | Rollers, drive, scale, and factory organization | 1835 Internet Archive scan, collated to surviving patent and museum records | `publishable — pilot 1.11` |
| `pass-cartwright-power-loom-iteration-1785` | Marsden, Chapter III, print pp. 61–63, selected | First specification, operational failure, and second design | 1895 University of Arizona scan | `publishable — pilot 1.11` |
| `pass-stockton-darlington-opening-1825` | Company notice of 24 September and opening report of 15 October 1825 | Mixed railway motive power, freight, passengers, and infrastructure | Guardian archive historical-text republication, institutionally collated | `publishable — pilot 1.11` |
| `pass-treaty-paris-1763` | Treaty of Paris (1763), Articles IV, X, and XI, selected | Global territorial and commercial settlement | Yale Avalon institutional transcript | `publishable — pilot 1.8` |
| `pass-stamp-act` | Stamp Act 1765, selected operative clauses | Imperial taxation | UK Parliamentary/legislation source | `review-required` |
| `pass-first-continental-resolves-1774` | First Continental Congress, Declaration and Resolves, opening and Resolves 1 and 4 | Coordinated constitutional resistance to revenue and authority | LOC *Journals of the Continental Congress*, vol. I, scan-backed | `publishable — pilot 1.8` |
| `pass-lexington-provincial-evidence-1775` | Provincial Congress letter and selected sworn depositions, April 1775 | Provincial evidentiary claim and its planned transatlantic circulation | LOC *Journals of the Continental Congress*, vol. II, scan-backed | `publishable — pilot 1.12` |
| `pass-gage-lexington-report-1775` | Gage to Dartmouth, 22 April 1775, selected | British command account of the expedition and return | Digital History institutional transcript, collated to the published report | `publishable — pilot 1.12` |
| `pass-washington-continental-orders-1775` | Washington, General Orders, 4 July 1775, selected | Continental service, discipline, health, stores, and intelligence | Founders Online historical text collated to LOC manuscript/transcript | `publishable — pilot 1.12` |
| `pass-franco-american-alliance-1778` | Treaty of Alliance with France, preamble and Articles I–III, VIII, and XI | Reciprocal military commitment, war aims, and guarantee | Founders Online historical text collated to official treaty scan | `publishable — pilot 1.12` |
| `pass-yorktown-capitulation-1781` | Yorktown Articles of Capitulation, preamble and selected articles | Combined command, prisoners, property, loyalists, shipping, and interpretation | Founders Online historical text collated to LOC manuscript | `publishable — pilot 1.12` |
| `pass-somerset` | Somerset v Stewart, selected judgment/report | Law, slavery, jurisdiction | verified legal edition | `review-required` |
| `pass-common-sense` | Paine, *Common Sense*, introduction and selected monarchy/republic sections | Independence argument | Standard Ebooks/cleared edition | `review-required` |
| `pass-us-declaration` | Declaration of Independence, grievances and conclusion | Independence and universal claim | NARA/LOC | `review-required` |
| `pass-us-constitution` | Constitution, Preamble and selected structural clauses | Federal design | NARA/LOC | `review-required` |
| `pass-federalist-10` | *Federalist* 10, selected | Faction and extended republic | Founders Online for collation; PD base text | `review-required` |
| `pass-sieyes-third-estate` | Sieyès, *Qu’est-ce que le tiers état ?*, opening and Chapter I, selected | Political nation and representation | 1888 scan-backed Wikisource edition | `publishable — pilot 1.6` |
| `pass-desmoulins-lanterne` | Desmoulins, *Le Discours de la Lanterne*, selected | Bastille memory, popular justice, and conspiracy | 1880 scan-backed Wikisource edition | `publishable — pilot 1.6` |
| `pass-rights-man` | Declaration of Rights of Man and Citizen, selected articles | Rights and sovereignty | French institutional original; cleared translation | `review-required` |
| `pass-constitution-year-viii` | Constitution of 22 frimaire an VIII, Articles 25, 28, 34, 41–42 and proclamation, selected | Representative forms and consular executive power | Légifrance open data; Élysée/Archives nationales collation | `publishable — pilot 1.9` |
| `pass-code-civil-1804` | *Code civil des Français* (1804), selected articles | Civil rights, household hierarchy, property, and contract | Original official edition; scan-backed Wikisource collation | `publishable — pilot 1.9` |
| `pass-senate-deposition-napoleon-1814` | Conservative Senate deposition decree, selected | Partisan institutional indictment at imperial collapse | Anderson 1904 English document collection; LOC scan | `publishable — pilot 1.9` |
| `pass-congress-vienna-final-act-1815` | Congress of Vienna Final Act, preamble and Articles I, CVIII–CIX | Territory, representation, navigation, and commerce | 1815 official edition; Wienbibliothek scan | `publishable — pilot 1.9` |
| `pass-republic-constitution-1793` | Founding decrees of September 1792 and Constitution of 24 June 1793, selected | Republic, popular sovereignty, and insurrection | Élysée institutional transcript collated to Archives nationales | `publishable — pilot 1.6` |
| `pass-robespierre-virtue-terror` | Robespierre, report of 18 pluviôse an II, selected | Revolutionary government, virtue, and terror | Vellay 1910 edition; Project Gutenberg 29887 | `publishable — pilot 1.6` |
| `pass-thermidor-convention` | Convention proceedings, 9 Thermidor an II, *Moniteur* volume XXI, pp. 335–336, selected | Accusation, arrest, and institutional rupture | 1842 public-domain scan; Archives parlementaires/Persée collation | `publishable — pilot 1.6` |
| `pass-rights-woman` | de Gouges, *Declaration of the Rights of Woman*, selected | Counterclaim and exclusion | institutional French original; cleared translation | `review-required` |
| `pass-equiano` | Equiano, *Interesting Narrative*, selected authenticated episode | Enslavement, commerce, testimony | Standard Ebooks | `review-required` |
| `pass-haiti-insurgent-letter-1792` | Jean-François, Biassou, and Bélair, July 1792 letter, selected | Natural equality, general liberty, peace, and paid labor | *Le Créole Patriote* text in Persée scan-backed transcription, pp. 133–135 | `publishable — pilot 1.7` |
| `pass-sonthonax-emancipation-1793` | Sonthonax proclamation, preamble and Articles II, IX, XI, XII, XXVII, XXXIII | Emancipation, citizenship, wages, plantation discipline | John Carter Brown Library contemporary broadside | `publishable — pilot 1.7` |
| `pass-convention-abolition-1794` | Convention proceedings and decree, 16 pluviôse an II, selected | Metropolitan abolition and implementation | public-domain *Moniteur* reprint; *Archives parlementaires*/Persée collation | `publishable — pilot 1.7` |
| `pass-haiti-constitution-1801` | Constitution of 1801, selected articles on freedom, territory, labor, authority | Emancipation and constitutional power | LOC public-domain collection | `publishable — pilot 1.2` |
| `pass-haiti-independence-1804` | Haitian Declaration of Independence, selected | Independence after slavery and war | surviving print, The National Archives (UK) | `publishable — pilot 1.2` |
| `pass-uk-slave-trade-act` | Slave Trade Act 1807, selected operative clauses | Trade prohibition and enforcement | legislation/Parliamentary source | `review-required` |
| `pass-us-importation-act` | Act Prohibiting Importation of Slaves, selected | Trade prohibition without abolition | U.S. statute source | `review-required` |
| `pass-cadiz` | Constitution of Cádiz, selected articles on nation, sovereignty, citizenship | Imperial constitutionalism | Spanish institutional source | `review-required` |
| `pass-venezuela-declaration` | Venezuelan Declaration of Independence, selected | Spanish American independence | Venezuelan institutional edition | `review-required` |
| `pass-jamaica-letter` | Bolívar, Jamaica Letter, selected original Spanish | Continental diagnosis and political futures | authenticated Spanish edition | `review-required` |
| `pass-angostura` | Bolívar, Angostura Address, selected original Spanish | Republican design and executive power | authenticated Spanish edition | `review-required` |
| `pass-monroe-message` | Monroe annual message, relevant paragraphs | Hemispheric policy | U.S. government/LOC source | `review-required` |
| `pass-slavery-abolition-1833` | Slavery Abolition Act 1833, selected clauses | Emancipation, apprenticeship, compensation | legislation source | `review-required` |
| `pass-commons-apprenticeship-debate-1838` | Commons debate, 29 March 1838, Strickland and Grey selected | Immediate termination, material failure, modified coercion, and the compensation compact | UK Parliament Historic Hansard; Open Parliament Licence | `publishable — pilot 1.16` |
| `pass-barbados-apprenticeship-termination-1838` | Barbados termination-act abstract, title and Clauses 1–3 selected | Local termination, temporary housing protection, and limited support obligations | Colonial Office CO 28/125 transcript via UNB; CC0 | `publishable — pilot 1.16` |
| `pass-french-abolition-1848` | Decree of 27 April 1848, selected articles | Re-abolition | French official source; translation review | `review-required` |
| `pass-communist-manifesto` | *Communist Manifesto* I, selected cleared translation | Class and industrial transformation | Standard Ebooks/PD translation | `review-required` |
| `pass-seneca-declaration` | Declaration of Sentiments, selected | Rights claim and inherited declaration form | LOC/NPS/institutional source | `review-required` |

Before final passage selection, the history corpus must add at least four authenticated non-state or counter-archive records, including voices of enslaved or formerly enslaved people, women acting politically, and people contesting colonial rule. Equiano and de Gouges are necessary but not sufficient.

### 6.5 History launch catalog

| Sequence ID | Title | Type | Anchor events | Passage plan | Target duration |
|---|---|---|---|---|---|
| `seq-hist-empire-debt-resistance` | War, Debt, and the Fiscal State | journey | Seven Years' War, Paris 1763, Stamp Act, Continental Congress, *Common Sense* | Franklin testimony → Treaty of Paris → Stamp Act → Continental resolves → *Common Sense* | 17.94 min |
| `seq-hist-declaration-claim` | Declaring the People | journey | U.S. Declaration, Rights of Man, Haiti, Seneca Falls | U.S. Declaration → Rights of Man → Haitian constitutional claim → Seneca Falls | 13–17 min |
| `seq-hist-faction-constitution` | Designing a Republic | journey | U.S. Constitution, Federalist, Cádiz, Angostura | Constitution → Federalist 10 → Cádiz → Angostura | 13–17 min |
| `seq-hist-rights-exclusions` | Rights and Their Boundaries | journey | Rights of Man, Rights of Woman, Equiano, Haiti | Rights of Man → de Gouges → Equiano → Haiti 1801 | 14–18 min |
| `seq-hist-france-1789-1794` | Assembly, Republic, Terror | journey | Estates-General through Thermidor | Sieyès → Desmoulins → 1792/1793 settlement → Robespierre → Convention at Thermidor | 17.36 min |
| `seq-hist-revolution-settlement-1789-1815` | Revolution and Settlement, 1789–1815 | journey | Rights of Man, Brumaire, Civil Code, Napoleonic wars, Vienna | Rights declaration → Year VIII Constitution → Civil Code → Senate deposition decree → Vienna Final Act | 17.33 min |
| `seq-hist-haiti-freedom-state` | Freedom, Labor, Sovereignty | journey | 1791 uprising, 1793/1794 emancipation, 1801 constitution, 1804 independence | 1792 insurgent letter → Sonthonax proclamation → Convention decree → 1801 Constitution → 1804 independence declaration | 17.98 min |
| `seq-hist-abolition-law-limit` | Abolition and Its Limits | journey | Somerset, Equiano, 1807, 1833, 1838, 1848 | Testimony → trade prohibition → compensated apprenticeship → contested termination → Barbados implementation | 17.80 min |
| `seq-hist-spanish-america` | A Continent Imagined | journey | Cádiz, Venezuela, Jamaica Letter, Angostura, Ayacucho | Cádiz → Venezuelan declaration → Jamaica Letter → Angostura → aftermath | 14–18 min |
| `seq-hist-hemisphere-doctrine` | Independence and Hemisphere | journey | Haiti, Spanish America, Monroe Doctrine | Haiti → Jamaica Letter → Monroe message, with conflict between perspectives made explicit | 11–15 min |
| `seq-hist-machines-patents-production` | Machines, Patents, and Production | journey | Watt, Arkwright, Cartwright, Stockton–Darlington | Steam principles → coordinated spinning → failed loom and redesign → mixed railway system | 15.39 min |
| `seq-hist-war-independence` | War for Independence | journey | Lexington, Continental Army, French alliance, Yorktown, Paris 1783 | Paired opening accounts → army organization → allied commitment → capitulation → peace | 17.86 min |
| `seq-hist-association-confederation-amendment` | Association, Confederation, Amendment | journey | Rousseau, Vermont, Articles of Confederation, Bill of Rights | Association → qualified state rights → confederation → twelve proposed amendments | 17.87 min |
| `seq-hist-crowd-testimony-publicity` | Crowd, Testimony, Publicity | journey | Boston Massacre, Boston Tea Party, Women's March | Crown evidence → defense evidence → colonial newspaper → military report → mediated deposition → Assembly record | 15.86 min |
| `seq-hist-independence-many-models` | Independence without a Single Model | journey | Argentina, Mexico, Peru, Brazil | Tucumán act → Iguala compact → Mexican act → Lima act → Protector decree → Brazilian council → Cachoeira adhesion | 17.51 min |
| `seq-hist-1848-unfinished` | The Unfinished Revolution | journey | 1848 revolutions, abolition, Communist Manifesto, Seneca Falls | Manifesto → French abolition → Seneca Falls → editorial aftermath | 12–16 min |

## 7. Source research scorecard

Scores run from 1 (poor) to 5 (excellent). A high scholarly score does not imply that payload can be redistributed.

| Source | Scholarly/editorial quality | Machine structure | Rights clarity | Runtime stability | Pilot role | Decision |
|---|---:|---:|---:|---:|---|---|
| Stanford Encyclopedia of Philosophy | 5 | 3 | 2 | 5 | Topology, summaries, bibliographies | `research-only`, link and cite |
| Scaife Viewer / Perseus / Open Greek and Latin | 4 | 5 | 3 | 5 | Ancient originals, editions, CTS locators | Preferred ancient source; audit each edition |
| Standard Ebooks | 4 | 5 | 5 | 5 | Proofread public-domain later texts | Preferred packable source when coverage exists |
| Project Gutenberg | 2–4 by title | 3 | 4 | 5 | Coverage fallback | Require edition and transcription audit |
| French Revolution Digital Archive | 5 | 5 | 3 | 4 | Parliamentary record and discovery | Preferred research/collation source; payload rights review |
| Gallica / BnF | 5 | 4 | 2–4 by item/use | 5 | French originals and bibliographic authority | Metadata preferred; content reuse reviewed per item and use |
| Library of Congress | 4–5 by collection | 4 | 3–5 by item | 5 | U.S., Haitian, print and manuscript sources | Preferred where item states public domain/free reuse |
| Founders Online | 5 | 4 | 3 | 5 | Scholarly U.S. documentary editions | Collation and citation; package base text only after rights audit |
| National Archives Catalog | 4–5 by record | 4 | 3–5 by item | 4 | U.S. government records | Curated import only; never session-time dependency |
| Duke Haiti Digital Library | 4 | 3 | mixed | 4 | Discovery guide and scholarly orientation | Research/discovery; audit target items separately |
| Brown Modern Latin America | 4 | 3 | mixed | 4 | Teaching context and document discovery | Research-only unless underlying edition clears rights |
| Wikidata | 2–4 by claim | 5 | 5 (CC0 data) | 4 | IDs, aliases, date/geography crosswalk | Metadata enrichment only, never sole historical authority |
| FRUS | 5 | 5 | 5 | 5 | Later diplomatic-history expansion | Approved future provider; largely outside pilot period |

### 7.1 Approved research authorities

The following are approved for editorial research and citation, not automatically for payload:

- [Stanford Encyclopedia of Philosophy — About](https://plato.stanford.edu/about.html)
- [Stanford Encyclopedia of Philosophy — Presocratic Philosophy](https://plato.stanford.edu/entries/presocratics/)
- [Stanford Encyclopedia of Philosophy — Stoicism](https://plato.stanford.edu/entries/stoicism/)
- [Stanford Encyclopedia of Philosophy — Ancient Skepticism](https://plato.stanford.edu/entries/skepticism-ancient/)
- [Stanford Encyclopedia of Philosophy — Plotinus](https://plato.stanford.edu/entries/plotinus/)
- [Stanford Encyclopedia of Philosophy — Iamblichus](https://plato.stanford.edu/entries/iamblichus/)
- [Stanford Encyclopedia of Philosophy — Proclus](https://plato.stanford.edu/entries/proclus/)
- [Scaife Viewer / Open Greek and Latin — About](https://scaife.perseus.org/about/)
- [French Revolution Digital Archive](https://frda.stanford.edu/)
- [Founders Online — About](https://founders.archives.gov/about/)
- [Duke Haiti Digital Library — Haitian Revolution guide](https://sites.duke.edu/haitilab/english/haitian-revolution/)

The philosophy edge table uses the following bibliography keys. They are drafting conveniences and must become complete edition-level source records before an edge can move to `publishable`.

| Key | Research authority |
|---|---|
| `SEP-PRE` | [Presocratic Philosophy](https://plato.stanford.edu/entries/presocratics/) |
| `SEP-PYTH` | [Pythagoras](https://plato.stanford.edu/entries/pythagoras/) |
| `SEP-HER` | [Heraclitus](https://plato.stanford.edu/entries/heraclitus/) |
| `SEP-PAR` | [Parmenides](https://plato.stanford.edu/entries/parmenides/) |
| `SEP-SOPH` | [The Sophists](https://plato.stanford.edu/entries/sophists/) |
| `SEP-SOCR` | [Socrates](https://plato.stanford.edu/entries/socrates/) |
| `SEP-PLATO` | [Plato](https://plato.stanford.edu/entries/plato/) |
| `SEP-CYN` | [Ancient Ethical Theory — Cynics](https://plato.stanford.edu/entries/ethics-ancient/#Cyni) |
| `SEP-CYR` | [The Cyrenaics](https://plato.stanford.edu/entries/cyrenaics/) |
| `SEP-MEG` | [Stoicism](https://plato.stanford.edu/entries/stoicism/) and [Ancient Skepticism](https://plato.stanford.edu/entries/skepticism-ancient/) |
| `SEP-ACADEMY` | [Ancient Skepticism — Academic Skepticism](https://plato.stanford.edu/entries/skepticism-ancient/#AcadSkep) |
| `SEP-ARISTOTLE` | [Aristotle](https://plato.stanford.edu/entries/aristotle/) |
| `SEP-EPICURUS` | [Epicurus](https://plato.stanford.edu/entries/epicurus/) |
| `SEP-STOICISM` | [Stoicism](https://plato.stanford.edu/entries/stoicism/) |
| `SEP-SKEPTICISM` | [Ancient Skepticism](https://plato.stanford.edu/entries/skepticism-ancient/) |
| `SEP-MIDDLE-PLATONISM` | [Plutarch](https://plato.stanford.edu/archives/fall2025/entries/plutarch/) and [Plotinus](https://plato.stanford.edu/entries/plotinus/) |
| `SEP-PHILO` | [Philo of Alexandria](https://plato.stanford.edu/entries/philo/) |
| `SEP-PLOTINUS` | [Plotinus](https://plato.stanford.edu/entries/plotinus/) |
| `SEP-IAMBLICHUS` | [Iamblichus](https://plato.stanford.edu/entries/iamblichus/) |
| `SEP-PROCLUS` | [Proclus](https://plato.stanford.edu/entries/proclus/) |
| `SEP-NEOPLATONISM` | [Neoplatonism](https://plato.stanford.edu/archives/sum2022/entries/neoplatonism/) |
| `SEP-AUGUSTINE` | [Augustine](https://plato.stanford.edu/entries/augustine/) |
| `SEP-DIONYSIUS` | [Pseudo-Dionysius](https://plato.stanford.edu/archives/fall2019/entries/pseudo-dionysius-areopagite/) |

### 7.2 Sources with strong packaging potential

- [Standard Ebooks](https://standardebooks.org/) states that its editorial production is dedicated to the public domain; each underlying work and translation still receives a manifest record.
- Confirmed relevant Standard Ebooks editions include Epictetus' [*Short Works*](https://standardebooks.org/ebooks/epictetus/short-works/george-long), Marcus Aurelius' [*Meditations*](https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long), and Boethius' [*Consolation of Philosophy*](https://standardebooks.org/ebooks/boethius/the-consolation-of-philosophy/h-r-james).
- The [Library of Congress Journals of the Continental Congress](https://www.loc.gov/item/05000059/) explicitly identifies that collection as public domain and free to use and reuse.
- The Library of Congress record for [*Les constitutions d'Haïti (1801–1885)*](https://www.loc.gov/item/78396819/) likewise identifies the books as public domain and free to use and reuse.
- [FRUS](https://history.state.gov/about/faq/what-is-frus) is explicitly public domain and offers structured resources, making it a strong future history provider.
- Open Greek and Latin repositories provide structured texts, but the license and rights of each edition or translation must be preserved rather than inferred from the platform as a whole.

### 7.3 Sources requiring special caution

- SEP is copyrighted and serves as an editorial authority, not distributable session text.
- Standard Ebooks currently lists Augustine's [*Confessions*](https://standardebooks.org/ebooks/augustine-of-hippo/confessions/j-g-pilkington) as an unfinished project, so it is not yet an available production source.
- Gallica permits broad access, but its reuse terms distinguish metadata, noncommercial reuse, commercial reuse, partner content, and AI processing. No Gallica payload ships from an assumed blanket permission.
- Library of Congress and NARA rights vary by item. A provider-level allowlist is insufficient.
- A commonly circulated English version of Bolívar's Jamaica Letter derives from a 1951 translation. The Spanish original should be the canonical source until an English translation is independently cleared or commissioned.
- Public-domain OCR is not automatically accurate. Scans and transcriptions must be collated for passages used in the Chamber.

## 8. Source ingestion and packaging

### 8.1 Proposed repository layout

```text
src/content/atrium/
  corpus-index.json
  sources.manifest.json
  philosophy/
    ancient-foundations.manifest.json
    relationships.json
    sequences.json
    passages/
  history/
    atlantic-revolutions-1750-1850.manifest.json
    events.json
    sequences.json
    passages/
  schemas/
    atrium-node.schema.json
    atrium-edge.schema.json
    atrium-source.schema.json
    atrium-passage.schema.json
    atrium-sequence.schema.json
```

The pilot implements this boundary with split ES modules by domain and subject group. Discovery imports metadata only; the verified text registry is loaded through the asynchronous Chamber handoff.

The discovery slice uses frozen ES-module manifests so it can share the application's existing build and test pipeline without introducing a second runtime loader. The split JSON layout above remains a future packaging option; the current modules already preserve the same stable record ids and lazy payload boundary.

The Chamber boundary refuses draft journeys, hashes packaged text at handoff, verifies the reviewed word count, preserves passage boundaries as independent session sources, and carries edition, locator, rights, checksum scope, content-pack version, jurisdiction, and Atrium-origin provenance through the canonical compiler.

### 8.2 Ingestion stages

1. **Discover:** record candidate institutional URL, stable identifier, edition, language, and rights statement.
2. **Acquire:** download or transcribe only after the source has a non-blocking rights posture.
3. **Normalize:** preserve original orthography in the canonical payload; record any display normalization separately.
4. **Collate:** compare transcription with scan or a second trusted edition for the selected passage.
5. **Annotate:** add locator, word count, language, perspective tags, content notes, and sequence role.
6. **Validate:** run schema, referential, chronology, duplicate, and rights checks.
7. **Review:** separate editorial and rights approval where feasible.
8. **Package:** emit immutable versioned files and checksums.

### 8.3 Runtime rules

- No Atrium session waits on SEP, Scaife, LOC, NARA, BnF, or another external API.
- Graph/event manifests load independently from passage payload.
- Detail panels may link to institutional pages but must remain useful offline.
- Search indexes are built from approved local metadata and editorial summaries.
- A missing optional pack disables its launch action clearly; it never substitutes unrelated procedural or textual content.
- Source payloads are immutable during a session. Updates create a new corpus version.

## 9. Validation requirements

### 9.1 Structural validation

- All IDs are globally unique and stable.
- Every edge endpoint resolves to a node.
- Every citation reference resolves to a source manifest entry.
- Every sequence segment resolves to a publishable passage.
- Every passage resolves to exactly one edition-level source.
- Every point-launch node has at least one valid sequence or is explicitly `launchable: false`.
- Deprecated records cannot be newly referenced.

### 9.2 Chronology validation

- Influence and teacher–student edges receive warnings when date ranges do not overlap plausibly.
- Revival edges may cross long intervals but require an explanatory note.
- Exact dates require an exact source; approximate evidence cannot produce day precision.
- BCE/CE display tests cover the absence of a year zero in human-readable output.
- Date ranges distinguish publication, composition, promulgation, ratification, and effective dates.

### 9.3 Rights validation

A passage build fails unless it has:

- an edition-level source record;
- `public-domain-confirmed`, `open-license-confirmed`, or `permission-confirmed` status;
- jurisdiction and review date;
- required attribution;
- payload checksum;
- a canonical institutional or bibliographic locator.

### 9.4 Editorial validation

- Every graph edge has a citation and note.
- Every contested relationship is visually distinguishable and explained.
- Every fragmentary thinker states the nature of textual survival.
- Every history journey includes multiple perspectives when the subject is contested.
- Summaries do not quote research authorities beyond allowed limits.
- A reviewer checks claims for anachronistic labels and false continuity.
- Accessibility labels use intelligible dates and relationship language.

### 9.5 Text validation

- Unicode is normalized consistently without destroying polytonic Greek or historical orthography.
- Apparatus markers, headers, OCR artifacts, page furniture, and provider license boilerplate do not enter Chamber payload.
- Passage boundaries do not begin or end mid-sentence unless the UI explicitly marks an excerpt.
- Word counts and estimated durations are generated from the final payload.
- Duplicate or near-duplicate translations are flagged.

## 10. Experience and performance budgets

### 10.1 Philosophy graph

- Initial manifest target: under 100 KB compressed.
- Runtime layout is deterministic; force simulation is not required for the pilot.
- Default view shows eras and major anchors before minor nodes.
- Edge types are filterable and never communicated by color alone.
- Selecting a node uses a restrained camera transition and respects reduced-motion settings.
- A chronological list provides equivalent access on narrow screens and to assistive technology.

### 10.2 History timeline

- Initial event manifest target: under 150 KB compressed.
- Only visible-window marks and a small overscan buffer are rendered at full detail.
- Clustering is deterministic at each zoom level.
- Keyboard commands support chronological next/previous movement and lane navigation.
- Every visual event has a semantic list counterpart.

### 10.3 Session launch

- Opening a node detail panel must not fetch its entire domain pack.
- Pack availability is resolved before the user begins session preparation.
- A locally available point launch should reach the Chamber configuration without network access.
- The exact source edition, passage locator, and Atrium origin survive compilation and appear in session provenance.

## 11. Pilot acceptance criteria

The Atrium corpus pilot is ready for UI implementation when:

1. The philosophy graph contains at least 25 reviewed nodes and 35 reviewed, cited edges.
2. At least 12 philosophy passages from four eras are rights-cleared and text-verified.
3. At least four philosophy journeys compile successfully from packaged passages.
4. The history timeline contains at least 35 reviewed events across all six lanes and at least five geographies.
5. At least 14 history passages are rights-cleared, including two counter-archive/non-state voices.
6. At least four history journeys compile successfully.
7. No production launch depends on a live external request.
8. Every compiled atom preserves source and passage provenance.
9. All graph, date, source, rights, and sequence validators pass.
10. Keyboard, list-view, and reduced-motion acceptance tests pass on both domains.

The full pilot release target is the larger catalog described in this document: 35 philosophy nodes, approximately 55 relationships, 10 philosophy journeys, approximately 50 history events, and 10 history journeys.

**Current acceptance posture:** the internal corpus now exceeds the numerical review floors with 35 editorially reviewed philosophy nodes, 47 reviewed and cited edges, and 56 reviewed history events across all six lanes. “Reviewed” at this stage means a recorded internal evidence pass. Every review record retains `specialistSignoff: false`, and the validator refuses to promote that discovery metadata to `publishable` until specialist approval is recorded. The eight remaining philosophy edges stay draft because their transmission or influence claims require more focused review.

## 12. Editorial backlog and gates

### Gate A — Corpus charter approval

- Confirm “Ancient Foundations” and “Atlantic Revolutions, 1750–1850” as the two pilot scopes.
- Confirm whether the product ships only in English initially while retaining original-language source records.
- Decide whether R.I.S.E. will commission original translations for strategically important passages that lack a high-quality reusable English edition.

### Gate B — Source audit

**Pilot v1 status:** Complete for the current selected 101-passage runtime pack. The remaining discovery candidates stay blocked and retain the requirements below.

- Complete edition-level rights review for every remaining philosophy and history passage candidate selected for acquisition.
- Select one canonical locator scheme per work.
- Record excluded editions and the reason for exclusion.
- Test Scaife/OGL, Standard Ebooks, LOC, and FRDA extraction on representative samples.

### Gate C — Scholarly review

**Status:** Internal editorial preparation is complete for the full node and event registries and for 47 philosophy edges. Ancient-philosophy specialist tranche one is ready for external review with eight bounded relationship cases; specialist sign-off remains incomplete. This is still the gate for promoting discovery metadata or additional candidate journeys.

- Specialist-review decisions are version-bound audit records, not a mutable boolean. Approval requires an identifiable reviewer, qualifications, decision date, rationale, conflict statement, attestation, and the exact corpus version reviewed.
- The validator rejects forged sign-off, incomplete reviewer identity, stale decisions, unresolved cases, and drift between the approved disposition and the runtime claim.
- The first specialist packet is documented in `ATRIUM-GATE-C-SPECIALIST-REVIEW.md`; its normative cases and build-time validator are excluded from the public Atrium bundle.

- Every prepared record carries a versioned review date, claim-level citation references, an explanatory note, and an explicit specialist-sign-off flag.
- Fragmentary or heavily mediated philosophy traditions carry a textual-survival note rather than appearing as fully preserved systems.
- History event date precision is documented as a display claim tied to cited records; numeric timeline coordinates cannot imply additional day precision.
- The publication validator fails closed when the review ledger, date basis, survival note, citation scope, or specialist approval is missing.
- Eight difficult relationship claims remain draft instead of inheriting approval from adjacent nodes.

- Have an ancient-philosophy reviewer inspect the graph, especially Presocratic, Cynic, Middle Platonist, and Neoplatonist edges.
- Have an Atlantic-history reviewer inspect periodization, Haiti, abolition, Spanish America, and the treatment of 1848.
- Add citations and explanatory notes to every publishable edge and event.

### Gate D — Minimum viable content pack

**Pilot v1 status:** Complete and expanding. The checked-in pack contains 31 philosophy and 70 history passages, ten philosophy journeys, seventeen history journeys, 81 point launches, offline payloads, exact locators, exclusions, and recomputed provenance/integrity tests.

- Package 12 philosophy and 14 history passages.
- Build four journeys per domain.
- Validate offline compilation and provenance.
- Only then begin visual graph/timeline implementation.

## 13. Expansion principles

Later philosophy packs should not simply hang additional traditions from the Western tree. Each receives an internally coherent map and may expose carefully reviewed cross-tradition transmission edges. Priority expansions are:

1. Arabic-language philosophy and the translation movements.
2. Byzantine continuities.
3. Medieval Jewish philosophy.
4. Latin medieval philosophy as a full corpus.
5. Early modern philosophy.
6. Independent Indian, Chinese, African, and Islamic maps before comparative overlays.

Later history packs should be bounded by an explicit question or period rather than accumulating indefinitely on one master timeline. Candidate packs include:

- Mediterranean antiquity
- Reformation and confessional states
- Industrialization and labor
- Decolonization
- Cold War and non-aligned worlds

Cross-pack links are typed references, not duplicated events.

## 14. Open decisions

1. **Translation strategy:** historical public-domain translations maximize reuse but may compromise clarity or scholarship. Commissioned translations offer control and provenance but require budget and review.
2. **Editorial voice:** determine whether Atrium summaries use a neutral institutional register or a more recognizably R.I.S.E. interpretive voice. In either case, factual and interpretive sentences should remain distinguishable.
3. **Original language display:** decide whether original text is visible in the detail panel, available as an optional Chamber segment, or initially retained only in provenance.
4. **Content warnings:** define metadata for violence, enslavement, racial language, execution, and other material without turning the Atrium into a generic warning system.
5. **User-created paths:** defer until the curated graph and provenance contracts are stable. User paths should reference stable nodes/passages rather than copying corpus payload.

## 15. Definition of the next artifact

The next editorial artifact after approval of this specification is a **minimum viable source manifest**, not UI code. It should contain:

- the exact editions selected for the first 12 philosophy passages;
- the exact institutional records selected for the first 14 history passages;
- rights evidence and attribution strings;
- stable locators and checksums;
- passage word counts;
- four fully ordered sequences per domain;
- an exclusions log documenting rejected editions and translations.

That manifest is the go/no-go boundary between attractive product design and a trustworthy, launchable Atrium.
