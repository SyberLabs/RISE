# Consolidating RISE around the Current

**Phase 0: the map. Nothing here is built. Nothing proceeds until the creator approves it.**

Written against `origin/main` at `67547ae`, with pull request 296 read from its
branch `cursor/affective-semantic-layer-2e9e`. Pull request 297 (Oracle Home and
the wormhole) is open and unmerged, so this map describes the Home that `main`
has today and notes where 297 changes it.

Everything below marked **verified** was read in the tree or found by search, and
carries a file reference. Everything marked **not verified** says so. Nothing in
the second group is presented as fact.

---

## 0. The answer in ten lines

1. The Current is already one object with one door. `new Session(` appears once,
   in `compileSession` (`src/core/session-compiler.js:653`). `new Player(` appears
   once, in the chamber factory (`src/app/chamber-session-factory.js:187`).
   Phase 1a is therefore mostly a **contract and a test**, not a build. The rule
   is stated in `ARCHITECTURE.md` §5 ("the only way a reading is built") and in
   the compiler's own header, but **nothing checked it**: no test failed when a
   second constructor appeared. (An earlier draft of this plan said the document
   was silent. It is not; it names the module rather than the function, which is
   why a search for `compileSession` missed it.)
2. **Rosarium and Via are not on the Current at all.** They run their own timer
   clock and never build a Session or a Player (`Rosarium.js:348, 434, 459`).
   This is the one real exception to the thesis. It needs a creator ruling (§1.3).
3. **Position lives in two places that share no coordinate**: the Player's atom
   index in the Stream, and a page number in the Chamber for the Page. Switching
   projections keeps the reader's *place in the Page*, not their *place in the
   reading* (§2.3). Phase 1b is real work.
4. The undercurrent is mostly **already expressible**. Image and sound threads
   anchored to a span of source text are legal Experience Program clips today. Only
   written glosses and echoes have no home (§2.4).
5. **The successor reading is rebuilt by hand.** `continueLibraryReading` copies
   seventeen named fields into the next division's session
   (`src/app.js:701-760`). Anything the Current gains later, threads and position
   included, is silently dropped at the next division unless this changes (§2.5).
   This is the same failure PROJECT-KNOWLEDGE §2.3 describes: a fix at one door.
6. **Affect is scored in three places on `main`, and pull request 296 adds a
   fourth**, with a second lexicon that disagrees with the first about the same
   words (§3). One of them must own the vocabulary before Phase 2.
7. "Materials descriptions" is **half shipped**. The reader's own description
   already reaches the composer. What does not exist is *who wrote it*, and the
   Experience Program already has a vocabulary for that (§2.4, decision D3).
8. The dive/surface touch gestures collide with a standing line in the
   Lateral Traversal spec (§4, decision D5).
9. Nothing needs deleting to do this work. Four things need **not building**
   (§5).
10. Seven decisions belong to the creator, not to me (§6).

---

## 1. Inventory: every way into a reading

### 1.1 The taxonomy problem, stated first

The brief sorts every feature into source, layer, projection, or pace. Applying
that to the rooms exposes a gap: most rooms are none of those. They are
**entrances**, ways of choosing the inputs to `compileSession`. PROJECT-KNOWLEDGE
§2.3 already uses that word ("a reading has more than one entrance"), so I keep
it rather than invent one.

- An **entrance** contributes nothing to a Current. It chooses a source, a pace
  and layers, then hands them to the compiler.
- A **contributor** adds a source, a layer, a projection, or a pace.
- Some rooms are both, and I say so.

I propose this as the honest reading of the thesis: *the four words classify what
a thing contributes to a Current; an entrance is classified by what it chooses.*
This is decision D1, because it is a vocabulary ruling.

### 1.2 The table (verified unless marked)

Every route in `src/app/route-manifest.js`, plus the runtime and offline callers
that the brief's list leaves out.

| Room / surface | What it is | Reaches the Current by | Contributes | Verdict |
|---|---|---|---|---|
| **Portal** (Home) | Prompt box plus a Jev request; on 297, the Oracle and its ROLL | `launchJevReading` → `handleBeginSession` → `compileSession` (`app.js:825`); also `launchFirstRead`, `launchJevSample` | Entrance. Chooses source + pace + layer preset | Keep. Routed already |
| **Wormhole** (297, unmerged) | A second skin over the same roll | Hands off to the same `launchJevReading` (`INVOCATION-SKINS.md`) | Entrance | Keep. Routed already |
| **Library** | The shelf of received works | `handleTextSelection` → Reader Setup → `handleBeginSession` (`app.js:682`) | **Source** + entrance | Keep. Routed already |
| **ChamberOrbital** ("Reader Setup", route `chamber`) | Where pace and surface layers are chosen | `handleBeginSession` (`route-manifest.js`) | Entrance. Chooses **pace** and **surface layers** | Keep. Routed already |
| **Chamber** (route `chamber-session`) | **The Current's runtime**: hosts the Player, the Stream, and the Page toggle | It *is* the destination, built by `createChamberSession` | **Projection host** (Stream, Page) | Keep. Not an entrance; it is where every entrance ends |
| **Page** (`src/page/PageReader.js`) | Typeset projection of the same session | Toggled inside the Chamber (`togglePageMode`, `Chamber.js:3585`) | **Projection** | Keep. See gap G1 |
| **Chapel** | Catholic devotional reader | `createChapelHandoff` → route `chamber` → `handleBeginSession` (`app.js:544`) | **Source** (Douay-Rheims corpus) + layer presets (icons, chant beds) + entrance | Keep. Routed |
| **Rosarium** | Rosary liturgy | `compileLiturgy` and its own `setTimeout` clock. **No Session, no Player** | None of the four | **Withhold from the thesis, with a reason (§1.3)** |
| **Via** | Stations of the Cross | Same as Rosarium | None of the four | Same |
| **Journeys** | Authored argument across works | `compileJourney` → `handleBeginSession` (`Journeys.js:219`) | Entrance + **layers** across several **sources** | Keep on ice (§8.24). Phase 3's base |
| **Workshop** | The authoring studio | `handleCreateSession` (`app.js:941`, compiles at `:997`) | Entrance. Authors **layers** and **pace** | Keep |
| **Create** | Personal readings | `handleCreateSession`; its duration estimate calls `compileSession` directly (`Create.js:114`) | **Source** (the reader's own) + entrance | Keep. Generation stays off |
| **Vault** | Saved compositions and examples | `handleCreateSession`; calls `compileSession` only to show a duration (`Vault.js:269`) | Store of Current *inputs* + entrance | Keep |
| **Scriptorium** | A model composes; a gate refuses | `handleCreateSession` | **Layers**, as *proposals* | Keep. It is the existing "models flag, humans dispose" mechanism, and 1c should reuse it |
| **Keystones** | Composed pieces | `launchKeystone` → `keystones.js` `compileSession` (`app.js:853`) | Entrance over authored **source** + presentation | Keep |
| **Mint** | Minted house programs | `openMintedProgram` (`app.js:896`) | Entrance over an authored **layer** bundle | Keep. Not read past its wiring |
| **Visual Lab** | Explore and save Living Flame scenes | `useRecipeInReading` holds a scene for the *next* reading, once (`app.js:607`) | **Surface layer** | Keep |
| **Curia** | The source and rights record | None. It never launches a reading | None: it is the **provenance ledger** the sources point at | Keep. See §1.4 |
| **Settings, Guide, BetaGate, Admit** | Shell | None | None. Not features of a reading | Keep. Outside the taxonomy |
| **Enterprise** (`src/enterprise/`) | Kev, talk programs | No `compileSession` caller in the directory (verified by search) | Out of scope per the brief | Leave alone |
| **Offline renderers** (`render/plan`, `artifact`, `vertical-slice`, `producer`, `scriptorium-cli`, five scripts) | Turn a Current into video, audio, or a check | `compileSession` at 10 files under `src/` and 5 under `scripts/` | A **projection** (export). Not in the brief's list | Note it. Reserve the projection names with this in mind |

**Emotions** (pull request 296, unmerged) adds a room and the path `/emotions`.
It is dealt with in Phase 2; the brief already says the Constellation replaces it.

### 1.3 The one exception: Rosarium and Via

**What is true (verified).** `LiturgyRunner` says of itself: *"there is NO
randomness, NO semantic track, NO probabilistic selection anywhere in this
module … The conductor's cleverness stays outside the fixed forms"*
(`liturgy-runner.js:10-13`). The Lateral Traversal spec §8 says liturgical
sessions are traversal-exempt "by covenant". The Session model has a
`shuttleExempt` flag for this, but **nothing in `src/` ever sets it**
(search: only `models.js` and `player.js` mention it). The exemption holds because
liturgy is structurally never on the Player. `liturgyToAtoms` exists
(`liturgy-runner.js:104`) and has no non-test caller. I mention both and delete
neither.

**Fold or withhold?** The thesis says nothing is deleted and each non-fitting
thing is folded or withheld *with a stated reason*. My recommendation is
**withhold, do not fold**:

- A Current is what a **reader paces**. A liturgy is what a **prayer fixes**. The
  two differ in exactly the property the Current exists to provide: a Current can
  be slowed, dived into, and read against an undercurrent. A liturgy must do none
  of those.
- Folding it (compiling steps to atoms with `liturgyToAtoms`, which already
  exists) would put a prayer on the surface where Phase 1c threads, 1d
  dive/surface, and Phase 2 affect all attach. The covenant is "no semantic
  track". The safest implementation of a covenant is a system that cannot reach it.
- So the rule becomes a **test that can fail**: launching a liturgy yields no
  Current, and no thread, dive, or affect signal attaches to it. That replaces a
  flag nobody sets with a structural fact somebody checks.

This is an editorial and reverence call, so it is decision **D2**. I will not
proceed on my recommendation alone.

### 1.4 Curia and the provenance ledger

Curia contributes nothing to a Current, and I do not want it folded in. It is the
thing that makes "provenance is the promise" checkable. It is a rail beside the
Current. Classifying it "none, keep, this is why" is a complete answer.

### 1.5 Where `main` and pull request 297 differ

297 rewrites Home into the Oracle, adds the wormhole, and changes `Portal.js`.
Pull request 296 also touches `Portal.js` (one line, the Emotions link) and
`app.js`. Whichever merges second will conflict there. This is a scheduling fact
for the creator, not a design one.

---

## 2. The Current as a contract over objects that already exist

**Rule kept (PROJECT-KNOWLEDGE §2.1):** no parallel type, no new vocabulary. The
contract below names existing objects. If Phase 1 needs a word, it uses one of
these.

### 2.1 What the Current already is

| Part of the Current | Existing object | Where |
|---|---|---|
| The source(s) | `session.sources`; exact text in `session.sourceTexts` (non-enumerable, never serialized) | `session-compiler.js:653-675` |
| The reading, as atoms | `session.atoms`, each with `position`, `sourceId`, `sourceProgress`, `duration` | `session-compiler.js:605-625` |
| **Pace** | `wpm`, `chunkMode`, `curve`; the `reading` track (`pace` clips); narration timing; at runtime `Player.speedFactor` and the `Shuttle` | `pacing.js`, `reading-score.js`, `player.js:548`, `shuttle.js` |
| **Layer: surface** | `visualConfig`, `visualProgram`, `presentation`, `customVisuals`, `sequenceVisualAssets` | `models.js:209-286` |
| **Layer: undercurrent** (nearest today) | `audioProgram`, `soundscape`, entrainment, narration, and visual/audio *clips with source-span anchors* | §2.4 |
| **Projection** | `session.projection` (`'stream'` or `'page'`) | `models.js:280` |
| The authored score | `experienceProgram` (canonical, validated) plus the schedules lowered from it | `experience-program.js:857` |
| Provenance | `session.provenance`; program-level `authority` (`published`, `user`, `proposed`) | `experience-program.js:45` |
| Where to return to | `session.origin` (a *launch-surface return descriptor*, not part of what is read) | `models.js:224` |

### 2.2 What "equivalent Current" means, and how to test it

Two sessions built from different entrances are equivalent when, with `id` and
`origin` removed, their atoms (content, duration, `sourceId`, `position`), their
`experienceProgram`, their `projection`, and their `provenance` are deeply equal.

`id` must be removed: `Session` sets `this.id = crypto.randomUUID()`
(`models.js:290`), so no two sessions are ever identical. A guard that compared
them whole would fail on every run for the wrong reason (PROJECT-KNOWLEDGE §2.4).
`origin` must be removed because it records the door, not the reading.

Because construction is already one door, Phase 1a's test does not prove the
doors *converge*. It proves they *stay* convergent and that no entrance quietly
adds a field the others lack. That is the "door a reader uses" test (§2.3 of the
knowledge document), applied to every entrance.

### 2.3 Gaps

**G1. Two positions, no shared coordinate. (verified)**
The Stream's place is `player.sessionState.currentIndex`, an atom index, with the
Shuttle holding the high-water mark. The Page's place is `Chamber._lastPageIndex`,
a *page number*, recorded only when there is more than one page
(`Chamber.js:214, 4256-4263`). Opening the Page pauses the Player
(`Chamber.js:3656`) and closing it resumes at the Player's index. Reading
forty pages does not advance the Stream, and going back to the Stream does not
move the Page. `PageReader.onPageChange` reports a page index only
(`PageReader.js:267-272`).

What exists to build on: `PageReader` already builds an item-to-position map
(`PageReader.js:120-124`), so a coordinate is *present*. **Not verified:** whether
the items in that map carry an atom `position` or a `sourceProgress`. Phase 1b
begins by settling that, because the whole design turns on it. (This is also
where the Lateral Traversal ruling applies: the Stream's head must never jump. So
"the Page moved the place" has to be expressed as the head *walking* there, or as
the head not moving at all. That is decision D4.)

**G2. The Session holds identity but not place. (verified)**
The Session stores its programs precisely so they survive the Chamber's
destroy-and-recreate cycle ("stored rather than rebuilt", `models.js:268-273`).
It does not store the reader's position. Position is Player-internal, so a
recreated Chamber starts at the beginning. Phase 1b's "position lives in the
Current" resolves this and G1 together.

**G3. No anchored written layer. (verified)** See §2.4.

**G4. Provenance is one object per session. (verified)**
`session.provenance` is a single bounded object. Per-boundary provenance is
already an open item (PROJECT-KNOWLEDGE §8). A thread carries its own
received-or-written fact, so it cannot borrow the session's.

**G5. The successor is rebuilt by an allow-list. (verified)**
`continueLibraryReading` compiles the next division and copies these by hand:
`displayMode`, `verseLines`, `revealMode`, `audioPreset`, `soundscape`,
`entrainmentMode`, `entrainmentWaveform`, `visualConfig`, `origin`, `provenance`,
`continuation`, `capabilities`, `recitation`, `voiceId`, `selectedSwellId`,
`projection`, plus pace (`app.js:722-760`). It does not carry `experienceProgram`
or `readingProgram`, which is correct today because ordinary Archive readings have
none. But it means **any thread attached to a work is lost at the next division**,
and a reader's position with it. This is the exact defect class of §2.3 and §2.1:
a vocabulary in two places where only one learns a new word. The fix is to derive
the successor from the Current, not to keep the list in step. It belongs to 1a.

**G6. The session is mutated after it is compiled. (verified)**
`handleBeginSession` attaches `origin` and `firstReadPreview` to the returned
session (`app.js:813-816`). They are surface facts, not reading facts, so this is
defensible, but it means "compiled once, then unchanged" is not literally true.
The equivalence test in §2.2 has to name them.

### 2.4 The undercurrent: what exists and what does not

The Experience Program's clips anchor to the **source text**, never to atom ids.
An anchor may be a progress range, a character range, a token range, or a pair of
quotation fingerprints (`experience-program.js:220-317`; `source-span.js`). Spans
are checked against the exact edition text before any atom is annotated. That is
precisely what anchoring a thread to "atom spans" requires, and it is already
built.

| Thread | Exists today? | Note |
|---|---|---|
| **Image** | Yes: a `visual` clip of kind `still` or `sourced`, token or quotation anchored | Placement text is what "Materials descriptions" feeds |
| **Sound** | Yes: an `audio` clip (`soundscape`, `tone`, `hold`, `silence`), source-anchored | |
| **Gloss** (written text beside the passage) | **No** | No clip kind carries text to show |
| **Echo** (a phrase returning) | **No** | Same |

Two constraints the new kind must respect:

- Authority is **per program**, not per lane (`experience-program.js`: one
  `authority` on the whole score; one track per kind). That still maps to "models
  flag, humans dispose": a program of proposed glosses becomes a `user` program
  when a person accepts it. It gives no per-thread provenance, so the kind of
  cue carries it instead. A gloss is written, by the program's authority. An echo
  stores no text and names where the received words are, so it can only be received.
  (An earlier draft said "each lane one authority"; that was a misreading of the
  comment beside the one-track-per-kind rule.)
- Same-lane clips may not overlap (fail-closed for every kind). That rule exists
  because a media lane presents one thing at a time. A thread lane is a list, so
  the thread kind is exempted with that reason stated where the exemption is made.
- Track kinds are a closed list (`PROGRAM_TRACK_KINDS`), and the file says the
  render-support registry "must cover every value". A new kind means a registry
  entry and a test, not just a string.

**Materials descriptions, decided by evidence.** PROJECT-KNOWLEDGE §8 says the
composer "is told a filename and nothing else". That is **stale**. The reader's own
description is bounded on the way in (`visual-score-lane.js:62, 278`), persisted
(`:139`), and, per the header of `Scriptorium.descriptions.test.js`, carried into
the composer's prompt and held by that test. What is absent is `describedBy`: whether a
description was written by the reader or proposed by a model. The program already
has that vocabulary as `authority`. My recommendation, decision **D3**: **do not
close "Materials descriptions" as a separate task first.** Image threads already
have the placement text they need. Adopt `authority` for the who-wrote-it fact
rather than adding a second field beside it, and let the thread work define that
once.

(The knowledge document is a dated record. I have not edited it; this plan notes
the two stale items in it: the Materials item above, and "Workshop on mobile",
which pull request 172 already answered.)

---

## 3. Affect: every place it is scored, and who should own it

### 3.1 The places

| # | Where | What it does | State |
|---|---|---|---|
| A | `conductor.js` `LEXICON`, `scoreChunk`, `scoreAtoms` | A hand-curated valence and arousal lexicon; smoothed per-atom track `{valence −1..1, arousal 0..1, confidence}` | Production. Opt-in (below) |
| B | `Chamber.js:275-288` and `chamber-session-factory.js:284` | **Two call sites** score the session and share one memo on `session.semanticTrack` | Production |
| C | `passage-visuals/director.js` `blockSignal` | Calls `scoreChunk` per block with **its own confidence formula** (`hits / max(3, tokens·0.04)`) versus A's `hits / 3` | Production |
| D | `player.js:645-651` via `responsiveFrequency`, and the visual engines: `harmonograph`, `fractal`, `klee`, `ascii-engine`, `treatments.js`, and others that read `{valence, arousal}` | **Consumers** of the signal shape | Production |
| E | `pull 296: src/affect/text/lexicon.js`, `encode.js` | A second lexicon, a negation window, an unfitted linear readout, twelve axes | Not imported by the reading runtime. Only `Emotions.js` imports it |
| F | `pull 296: modalities/pacing.js` | A prior that places words per minute on arousal, centred at 220 | Same |

Scoring is **opt-in today**: it runs only when `livingText.enabled` or
interlocution `responsive` is on, and `responsive` defaults to `false`
(`Chamber.js:275-278`, `Workshop.js:242`). `responsiveMood` and `responsiveRhythm`
default to *true* inside a reading that has already chosen `responsive`.

### 3.2 The defect

A and E are two hand-authored lexicons for the same job, and they disagree about
the same words. For `love`, A holds valence 0.9 and arousal 0.6; E holds 0.7 and
0.45. Neither is a published norm (E says so in its own header). This is
PROJECT-KNOWLEDGE §2.1 verbatim: a vocabulary in two places, where only one learns
a new word. It is also §2.7: two metrics that will each look healthy while
disagreeing.

The **axes** themselves already agree: E's `valence` is −1..1 and `arousal` is
0..1 (`dimensions.js`), the same as A's signal. So the shape is compatible, and
the conflict is only in the numbers and in who scores.

### 3.3 Recommendation (decision D6): one owner, one table

- **Vocabulary owner (the names, ranges, and what counts as measured versus
  inferred): pull 296's `dimensions.js` and `schema.js`.** It is the more careful
  contract: missing is not zero, every value carries a source and a confidence.
  Because the shared axes have identical ranges, adopting it renames nothing in
  production.
- **Scorer owner for production: `conductor.js`, unchanged, until human
  judgments exist.** It is what readers have actually seen. E is explicitly
  unfitted and its author will not ship a learned encoder without human judgments.
  Replacing A with E now would change what every reader sees on the strength of
  numbers nobody has validated, and would move a research library into the first
  load.
- **End state: one lexicon.** E's extra columns (dominance, warmth, intimacy)
  should extend A's table, keyed by the same words, not sit in a second file. The
  guard, which can fail: for every word present in both tables, the shared axes are
  equal, or the test names the word.
- Direction: pull 296's regenerated diagram shows `affect → core` (7 imports) and
  no reverse edge, so `affect` reading `conductor` fits and `conductor` reading
  `affect` must not happen. **Not verified as enforced:** the existing layering
  guard in `system-design.test.js` covers only `core`/`visuals` never importing a
  component, so a `core → affect` import would need its own rule.

Editorial consequence: choosing which numbers survive changes how Living Text
looks. That is an aesthetic and editorial change, so the creator decides, not me.

### 3.4 What "conductor mode stays OFF" means

The brief says the conductor mode stays OFF until 24 human pairwise judgments.
The existing conductor is already opt-in and default-off. Pull 296's fit script
refuses to write weights until 24 records marked human exist
(`fit-readout.mjs`). I read the brief as: *no new, affect-driven mode may run
until those judgments exist*. **I am asking rather than assuming** (decision D7),
because the alternative reading, that the *existing* conductor should be switched
off, would change shipped behaviour.

---

## 4. Notes on the later phases

Not part of this deliverable. These are the findings each phase's plan will start
from, so approval can be given with them in view.

**1a (one contract).** Mostly a guard for a rule `ARCHITECTURE.md` §5 already
states, plus the equivalence test of §2.2, and replacing the
hand-copied successor (G5). The host operations that feed the compiler
(`handleBeginSession`, `handleCreateSession`, `handleTextSelection`,
`handleSequenceSelection`, `handleArchetypeLaunch`, `launchKeystone`,
`openMintedProgram`) are candidates to collapse into fewer.
**Not verified**: I read `handleBeginSession`, `handleTextSelection`,
`continueLibraryReading` and `createSessionFromSequence`; I did not read
`handleCreateSession`'s body or `launchKeystone`'s beyond their compile calls.

**1b (position).** Start with the G1 question. The Stream⇄Page switch already
holds the Player, suspends temporal visuals, and fades audio
(`Chamber.js:3636-3660`); that hold is the pattern to reuse. Reserve the names
Constellation and Stage as words in `ARCHITECTURE.md`, not as code.

**1c (threads).** Image and sound: no new machinery. Gloss and echo: one new kind.
Whether that is a new track kind or a clip kind inside an existing one is
vocabulary, decision D3. Nothing may be unbounded: a track is capped at 512 clips
(`experience-program.js`).

**1d (dive/surface).** The dive must *not move the head*: it holds the Player as
the Page toggle does, and surfacing releases it, so "same atom, no skipped
schedules" is the natural result and testable. Two collisions to settle first:

- Lateral Traversal §2 keeps ← → for the Shuttle and ↑ ↓ for pace, "never
  overloaded". The keyboard route for dive and surface must use neither pair.
- Lateral Traversal §9 says **"No touch/gesture bindings (deferred until the
  keyboard shuttle proves the model)."** Glance is a hold and Anchor is a tap.
  Whether that deferral has ended is the creator's to say (decision D5).

**1e (breath).** `StateCurve.at(position)` is indexed by *progress through the
reading*, and a breath is periodic in *time*. The existing zero-mean doctrine
(`semanticTexture` in `pacing.js`) is the right shape: a periodic multiplier that
averages to one, so it never changes the reading's length. The reading track cannot
carry it: a scored pace is a clip, a track holds 512, and a long book has far more
breaths. It needs a function in `pacing.js`, clamped by the pace window and by the
100 ms to 10 s duration limits already there. It must behave sensibly at 50 and at
1000 words per minute, and say so in a test.

**Phase 2 (Emotions).** Pull 296 already contains the Thomas filament
(`emotion-map.js`), a content hash (`hash.js`), and the offline scripts. The work is
rebasing, deciding the owner (§3), and moving the room onto a projection. It edits
`ARCHITECTURE.md` (a new §8.33 and a room row) and the generated diagram; those
counts will conflict with anything else that lands first.

**Phase 3 (Confluence).** Facts to check before committing to the design:

- Paradise Lost is in the canon (`canon.js:45`). Genesis in Douay-Rheims exists in
  the Chapel corpus (`content/chapel/corpus/books/genesis.js`). They live in
  **different text planes**, the Archive and the Chapel corpus, and edition
  identity does not yet exist (knowledge §8). **Not verified:** that both are
  served in a public build. The brief says to stop if they are not.
- Journeys are on ice because their scores quote editions the canon no longer
  serves, and "re-authoring is an editorial act, not a repair" (`ARCHITECTURE.md`
  §8.24). Confluence builds on that compiler, so it inherits that constraint.
- Limits a braid meets: 16 movements, 32 transitions, 64 sources
  (`EXPERIENCE_PROGRAM_LIMITS`, `READING_LIMITS`). A braid that alternates at line
  level between two long works may not fit.
- "There is no seeking" holds for a braid because the head passes every atom in
  order; alternating sources is still a forward walk.

---

## 5. The Master Reference Checklist, asked out loud

**First principles.** *Why does the Current need to exist as a named thing?* Because
one instrument turning any text into a paced, time-based reading is the actual
product, and the rooms are ways of choosing its inputs. The physics here are the
Player's clock and the atom stream. Everything else is a recommendation. *Is it
right?* Mostly yes, with the Rosarium and Via as the honest exception.

**The Algorithm, in order.**

1. *Question every requirement, and name the owner.* Every phase requirement here
   is Mateo's. Two I would question: that dive/surface needs **touch** gestures
   before the keyboard model is proven (the spec says wait), and that Emotions
   needs **a third home for affect** rather than one of the existing two.
2. *Delete.* I delete four proposals from the plan, not features from the product:
   (a) a new Current *type*, because the contract is a test over existing objects;
   (b) a new `describedBy` field, because `authority` exists; (c) a second lexicon,
   per §3; (d) code for the reserved Constellation and Stage names. They are two
   words in a document, and code for them now would be building for an unapproved
   future. Ten percent added back: the successor rebuild (G5) is *not* deleted,
   because it turns out to be the one place the contract genuinely leaks.
3. *Simplify.* 1a shrinks from "one contract every surface" to a document plus a
   test plus one fix, because the doors already converge.
4. *Accelerate.* Phase 1a's equivalence test is one file and runs in the ordinary
   unit gate, with no browser.
5. *Automate.* Nothing here should be automated yet. The offline arcs script is
   Phase 2 and only after the vocabulary owner is chosen.

**The machine that builds the machine.** The real product is the *guard set*: an
equivalence test, a single-lexicon test, a no-thread-on-a-liturgy test, and a
dive-returns-to-the-same-atom test. Those are what keep this consolidation from
undoing itself. The first-load budget (64 KB brotli) is the standing check that
the undercurrent stays lazy.

**Communication.** Bad news, stated up front: the brief's premise that every room
fits the four words is false for the Rosarium and Via, and the brief's dive/surface
touch gestures may contradict a standing creator ruling.

**Ownership.** One name per part. The vocabulary owner is the open item (D6).
Excellence as the average: every phase carries a test that *can fail*, per
PROJECT-KNOWLEDGE §2.4.

**Semantic tree.** Trunk first: the Current. Branches: undercurrent, position,
pace. Leaves: gloss, echo, breath, dive. Emotions and Confluence hang from the
branches, and neither should be started until the trunk contract (1a) exists.

**Usefulness and delight.** Net positive if position survives a projection
switch and a division change. Those are the two moments a reader currently loses
their place, and they are the strongest argument for 1b.

---

## 6. Decisions that belong to the creator

Each has my recommendation. None proceeds without an answer.

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Is "entrance" an accepted noun beside source, layer, projection, and pace? | Yes. It is already project vocabulary; a room is classified by what it chooses |
| **D2** | Rosarium and Via: fold into the Current, or withhold with the stated reason and a test that nothing attaches to them? | Withhold, with the test (§1.3) |
| **D3** | Materials descriptions: close `describedBy` first, or fold it into thread provenance and reuse `authority`? And is gloss/echo a new track kind or a clip kind in an existing one? | Do not close it first. Reuse `authority`. One new track kind for written threads |
| **D4** | Position across projections: does reading in the Page *advance the Stream's head*, and if so how, given "there is no seeking"? | Not decided by me. It is the central editorial question of 1b |
| **D5** | Has the "no touch/gesture bindings" deferral in Lateral Traversal §9 ended, so Glance and Anchor may be gestures? Which keys are free for dive and surface? | Ask. Keep ← → ↑ ↓ untouched |
| **D6** | One owner for the affect vocabulary and one lexicon | Vocabulary from pull 296; production scorer stays `conductor.js`; one merged table |
| **D7** | "Conductor mode stays OFF": the new affect-driven mode, or the existing one? | The new one. The existing conductor is already opt-in and default-off |

---

## 7. What I did not verify

- The bodies of `handleCreateSession`, `handleArchetypeLaunch`,
  `launchKeystone`, `openMintedProgram`, and Mint's and Keystones' internals,
  beyond their compile calls.
- Whether `PageReader`'s composition items carry an atom position (G1).
- That Paradise Lost and Genesis in Douay-Rheims are served in a public build.
- I ran no tests. This phase adds a document only. The wiki build reads
  `docs/README.md`, so the plan is listed there.
