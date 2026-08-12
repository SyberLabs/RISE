# Session record — Archive, Experience Program, Workshop, and Page

**Thread span:** 2026-07-28 through 2026-08-11

**Recorded:** 2026-08-11

**Purpose:** preserve the decisions, shipped architecture, investigations,
verification, and deliberate deferrals from the continuous engineering thread.

This is a handoff record, not a new authority. The governing contracts remain
the linked specifications and the implementation. Where this record exposed
specification drift, the corresponding authority was updated in the same pass.

---

## 1. Outcome

The thread began as a public-domain acquisition and legacy-text verification
pass and ended with a materially different authoring system:

- the unified Library reached 107 registered holdings; its re-ingested,
  division-indexed corpus covers 91 works and approximately 16.3 million words,
  with edition-specific rights and provenance records;
- the 18-item legacy classics cohort was audited mechanically, 17 external
  works were replaced by verified public-domain editions, and the R.I.S.E.
  original composition was retained as such;
- `rise.experience-program.v1` became the canonical score for source-bound
  visual and audio authorship;
- stable source spans now compile through atomization without allowing phrase
  boundaries to erase finer media authority;
- the Workshop became an integrated Composition Studio with Visual, Audio, and
  Combined authoring, a persistent sequence map, transactional editing, and a
  hierarchical visual-style system;
- MP4 became a first-class, sequence-local Workshop asset with authority-bound
  Stream playback and adaptive full-frame sizing;
- Focal, Genesis, and Attractor became schedulable passage fields instead of
  project-only modes;
- personal focals preserve focal composition rather than degrading into
  ordinary full-frame custom media;
- Page now preserves the static meaning of authored visual scores, including
  personal passage focals, without mutating the Stream configuration.

The Workshop is at a coherent parking point. The remaining Page work is not a
correctness hole in static parity: it is a separate dynamic-projection phase
for cue-specific Genesis/Attractor samples and MP4 posters.

---

## 2. Archive acquisition and verification

### 2.1 Second literature acquisition pass

SOL's second dossier proposed 66 edition-specific imaginative-literature
holdings: 42 Western, 16 Eastern, and 8 Indigenous. The ingest admitted all 58
Western/Eastern proposals and staged the Indigenous set behind community review
and access-policy requirements.

Two explicit inclusions were preserved:

- James Joyce, *Ulysses*, as W41;
- Ernst Jünger, *The Storm of Steel*, in Basil Creighton's 1929 translation, as
  W42 and in the Discursive division rather than Imaginative.

The ingest introduced the Imaginative division while retaining the stored
`literary` identifier for compatibility and rendering it as Discursive. Long
works were divided at authored units rather than served as one first-page
excerpt, and every holding retained edition, rights basis, checksum, and source
evidence.

### 2.2 Legacy classics audit and re-ingest

The legacy cohort contained 18 records. `starter-the-descent` was correctly
classified as an original R.I.S.E. composition; the other 17 were acquired as
edition-specific public-domain works. The mechanical audit compared the legacy
opening against the named edition and demonstrated that many claims described
texts the payload did not actually contain.

The replacements include Legge's *Tao Te Ching* and *Yî King*, Arnold's
*Bhagavad-Gîtâ*, Long's *Meditations*, Müller's *Dhammapada*, Thomas Common's
*Thus Spake Zarathustra*, and original public-domain texts such as *Walden* and
*Leaves of Grass*. Tao and the Gita did not require an interim quarantine once
their verified replacements were ready.

The durable lesson was larger than the cohort: a title, translator claim, and
public-domain label are not evidence that the served bytes are that edition.
The accession boundary must pin the artifact, checksum it, compare identity at
the division level, and keep apparatus separate from the reading stream.

---

## 3. Experience Program and source-span foundation

`rise.experience-program.v1` became the one canonical score beneath Workshop,
Session compilation, Stream, and Page. Its relevant invariants are:

- movements, visual cues, audio beds, swells, and transitions are independent
  tracks over one reading clock;
- source anchors use half-open character/token ranges and quote fingerprints;
- editor metadata never leaks into canonical runtime cues;
- same-lane overlap is refused or transactionally replaced; adjacent half-open
  clips are valid;
- project atmosphere is a fallback, not an authored passage clip;
- compilation, not UI state, decides what the runtime executes.

The stable-span pass added strict coordinate validation, edition-drift refusal,
atom coordinates, and bounded compiled span identities. The visual lane then
added Assign, Replace, Erase, preview, persistence, compilation, and bounded
undo/redo over those anchors.

---

## 4. Composition Studio implementation

### 4.1 Studio shell and information architecture

The Workshop was reorganized around four coordinated surfaces: transport,
unified assets, a source-centred score canvas, and one contextual Inspector.
Pacing became the conductor rather than another media panel. Presentation moved
under the visual Asset Registry. The source browser now uses the authoritative
Archive registry and preserves chapter-by-chapter selection as well as whole
work import.

The responsive implementation preserves the complete authoring command set on
desktop, tablet, and phone. Source selection survives drawer/sheet transitions,
and first-assignment activation of Scored is undoable.

### 4.2 Selection-driven authoring

Passage capture listens within the source scope to `selectionchange`, pointer,
touch, and keyboard completion. Releasing a valid selection opens the
passage-assignment surface beside the text (or as a phone sheet), and assignment
requires both a valid passage and a passage-capable asset.

After assignment, the native range becomes a persistent authored highlight with
inline Preview, Replace, Erase, and completion actions. Visual highlights are
filled, audio highlights are underlined, and Combined mode renders both without
making the lanes ambiguous.

### 4.3 Visual, Audio, and Combined modes

Audio beds and swell events execute as separate atom-driven lanes. Beds replace
beds; silence is explicit; swells are bounded events and do not displace beds.
Pause cancels both active audio lanes, resume restores the retained bed without
replaying a transient swell, and stale generations cannot publish late audio.

Visual, Audio, and Combined score views share one source-selection model. The
Combined assignment surface exposes both media routes rather than incorrectly
opening only the visual picker. A visual clip and audio clip on the exact same
span receive a stable sync-group identity without acquiring shared lifecycle
ownership.

### 4.4 Sequence-map Inspector

The redundant preview rail beside the source text was removed. Its useful
thumbnail, swatch, excerpt, and range affordances moved into the Inspector,
which now persists as the complete composition map:

- sources follow reading order;
- clips follow character position, not assignment time;
- visual and audio clips remain distinguishable;
- synchronized clips appear together;
- the selected clip expands to exact preview and editing actions.

Correspondence is bidirectional. A text highlight scrolls to and activates its
Inspector entry; an Inspector entry scrolls to and activates its passage.
Project health and the next-useful-action guidance update immediately after a
source is selected or added.

### 4.5 Even Design and control cleanup

Workshop grids were corrected to honor R.I.S.E.'s Even Design policy. The
Gallery's unused frequency control was removed; cadence remains the sole
Gallery timing control and now exposes its numeric range/value. `Off` is no
longer offered as an assignable visual asset: stillness remains an internal
fallback/operation, not a thing a user browses as media.

The visual picker now uses a deliberate hierarchy instead of a flat registry.
Focal, Genesis, Attractor, Klee, and Harmonograph expose their bounded substyle
controls from shared definitions so the Workshop and Visual Interlocution panel
do not drift semantically.

---

## 5. Persistent fields and personal focals

The investigation found that Focal, Genesis, and Attractor were excluded from
passage scoring by an application contract, not by the browser DOM or Chamber's
fundamental reading model. They had been represented as mutually exclusive
whole-reading modes, while the visual score accepted only sourced/procedural
cue shapes.

The correction introduced canonical field cues:

```js
{
  kind: "field",
  renderer: "focal" | "attractor" | "genesis",
  config: { /* validated bounded style */ }
}
```

One `VisualFieldDirector` owns mount, crossfade, pause/resume, replacement,
cancellation, and destruction. A passage field supersedes the scored fallback
for its half-open span; the fallback resumes afterward. WPM, chunking, pacing,
audio, and recitation remain properties of one uninterrupted Session—there is
no stitched child-reading workaround.

Personal focals have two authoring routes because they serve different moments:

- choose an existing project image;
- upload directly from the Focal configuration and import it into project
  media before selection.

Both routes produce the same durable project-asset identity. A personal focal
remains a focal: it renders in the small rectangular focal region above the
text rather than becoming an ordinary full-frame custom image. Its cue carries
only the durable asset id; hydration resolves the document-lifetime URI.

---

## 6. MP4 as a first-class Workshop asset

Sequence-local MP4 import now performs validation and metadata probing, stores
the media durably with the project, and compiles a canonical muted video cue.
V1's contract is intentionally narrow:

- MP4 only;
- audio always muted;
- reduced motion holds a poster/first decoded frame;
- playback exists only while the cue owns the current atom;
- pause/resume follows reading transport;
- replacement, projection change, and teardown cancel playback;
- failure degrades to stillness.

The display presenter measures media and stage aspect ratios. Near-matched
shapes use `cover`; severe portrait/landscape mismatches use `contain` so a
nominal full-screen presentation does not destroy the authored frame. Exporting
an Experience Program as MP4 remains a different, deferred distribution task.

---

## 7. The Anna Karenina boundary finding

### 7.1 What the user observed

In *Anna Karenina*, Chapter 1, adjacent passage assignments were authored across
the leading contents material: Genesis, then Fractal Flames, then Animals. In
phrase mode, the linguistic phrase atom crossed those media boundaries.
Genesis therefore remained authoritative through `PART EIGHT`, the intermediate
Fractal cue was skipped, and Animals did not appear until “Everything was in
confusion in the Oblonskys’ house.” Newline gaps made the failure look like
unassignable blank visual space.

### 7.2 Runtime correction

Media authority now constrains atomization:

1. every authored source-span endpoint is resolved before chunking;
2. explicit coordinates must already end between complete tokens;
3. selection UI expands a partial-word drag outward to complete words;
4. invisible score-cut sentinels prevent paragraph, sentence, phrase, and word
   chunkers from crossing an authority boundary;
5. the phrase floor runs within each score unit and cannot merge across it;
6. compilation fails if one atom still crosses two clips on the same track.

The regression fixture reproduces the Chapter 1 `PART ONE … PART EIGHT`
configuration and proves that Fractal owns `PART SEVEN` while Animals owns the
`Chapter 1` atom. Character-level anchoring remains stable, but the smallest
user-authorable media unit is one complete token; a word cannot be split between
two sources.

### 7.3 Separate archive defect

The same fixture exposed source contamination. The served `Chapter 1` begins
with the title, author, translator, a literal `Contents`, and navigation entries
for all eight parts before the genuine `PART ONE / Chapter 1` opening. That is
front-matter/contents apparatus embedded in a prose division. It should be
handled by Archive cleansing, not hidden by the chunker. The finding and a
report-only detection rule are now recorded in
`docs/specs/ARCHIVE-CLEANSING-SPEC.md`.

The two corrections are intentionally independent: cleansing should improve the
text, while runtime authority must remain correct even when an imperfect source
reaches it.

---

## 8. Stream and Page boundaries

### 8.1 Stream seam

Gallery pause/resume now follows authored authority. A Gallery driven by a
visual program freezes its exact layers, cadence, and remaining dwell while the
reading is paused. An unbound ambient Gallery may continue drifting because it
has no passage-level claim.

### 8.2 Page correctness

Projection now persists with the reading identity and does not leak from a
previous reading into a newly loaded one. Printing force-hydrates the full Page,
disconnects lazy observation, resolves every figure, and restores the exact
interactive projection and scroll state after printing.

### 8.3 Static Workshop-to-Page parity

A Page-first launch no longer rewrites authored `visualConfig` to `off` or
stores a shadow mode for later restoration. It defers temporal presenters and
consent/preload only; returning to Stream activates them from the unchanged
Session.

Page now:

- holds a whole-reading focal, including a Scored fallback focal, once above
  the opening title;
- places passage focals at their stable source-span boundary;
- resolves personal/project images from `sequenceVisualAssets`;
- binds a passage focal to its first prose so pagination cannot strand it;
- preserves non-still episode semantics through flow and composition.

The boundary test exercises the complete route: Workshop registry → canonical
project → hydration → Session compilation → Page DOM.

---

## 9. Verification at session close

The final implementation was exercised through overlapping focused suites, not
reported as one inflated aggregate:

- the main targeted pass completed 196 tests;
- the safety/orbital pass completed 23 tests;
- the final focused Page/Workshop/runtime pass completed 135 tests;
- the production build completed;
- `git diff --check` completed cleanly.

The build reported two environmental/bundling advisories: the installed Node
20.18 runtime is one patch below Vite's requested 20.19+, and existing large
chunk warnings remain. The focused Playwright `page-suspend` invocation did not
produce a runner result before it was terminated during server/bootstrap, so no
new browser-E2E result is claimed by this record.

---

## 10. Deliberate deferrals and next boundary

### Parked with Page

1. **Cue-specific Genesis/Attractor projection.** Whole-reading dynamic modes
   can be sampled from one current configuration. A scored Page may contain
   several differently configured field clips, so it needs a config-keyed,
   abortable static sampler with bounded caching and a per-reading sample
   budget. Configurations must not be smuggled through collection ids.
2. **MP4 Page posters.** The temporal Stream presenter is complete, but Page
   needs a deterministic poster extraction/storage contract. Page must not run
   video merely to discover a frame.

These are a distinct dynamic/static-media projection phase. They do not block
parking Workshop work after static focal parity.

### Existing open Workshop certification

- real iOS and Android selection certification;
- 200% zoom reachability;
- repeated-entry memory return;
- atomic referenced-source/asset removal recovery.

### Archive follow-up

- report the Anna Karenina embedded contents preamble across the corpus;
- verify the candidate boundary against the pinned edition;
- add the exact preamble as a cleansing fixture;
- apply any trim only through the dossier-recorded cleansing process.

The active execution order remains in `docs/ROADMAP-2026-08-04.md`.
