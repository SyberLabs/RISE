# The Scriptorium — a room where a score is written from dictation

**You state an intent. A hand outside the building writes a score. RISE examines
it before admitting it. The Workshop is where you compose from materials you
gathered; this is where you say what you want and receive a proposal.**

Agent composition and deterministic distribution companion:
[`AGENT-COMPOSITION-AND-RENDER-SPEC.md`](./AGENT-COMPOSITION-AND-RENDER-SPEC.md).

Status: **ROOM STARTED (additive).** `rise.experience-program.v1` and
`rise.curator-context.v1` remain canonical. Shipped: capability catalogue,
copyable refusals (`describeImportFailure`), generated export prompt
(separate from context.json), Library catalogue in context, quotation-only
anchors, the Scriptorium door beside the Curia, and — 2026-08-10 — the
reading track, which makes the room a **composer**; and — 2026-08-21 — the
extent grammar (§10c), which lets a score spend a length on part of a work.
Workshop curator buttons remain until the room is proven by a hand-run loop.
Rulings by the creator are marked ✦; open questions ⁇.

**This file is the one the code cites.** Five modules carry
`docs/vision/SCRIPTORIUM-SPEC.md §N` in a header comment, and
`src/core/scriptorium-spec.test.js` fails if a cited section is not a heading
below. A citation nobody can check is a label offered as evidence, which is
the failure this codebase names most often; the citations used to give no path
at all, and a reader looking for them in `docs/specs/` found nothing.

---

## 1. Why this is not a Workshop feature

The Live Curator loop currently lives in the Workshop header: *Export context*,
*Export score*, *Import score*. It works, and the flow reads as
**pick a source → export → import**, which is backwards.

The two acts have opposite preconditions.

| | Workshop | Scriptorium |
|---|---|---|
| starts with | materials | an intent |
| the reader supplies | the sources | the wish |
| composition comes from | the reader | outside, then examined |

The Workshop's precondition — *add sources before importing a score that binds
to them* — is structural to authoring. Forcing the curator loop through it makes
the reader gather the very thing they were asking to be chosen for them. No
rearrangement of buttons inside that room fixes it, because the requirement is
the room.

**And a second reason, which is the stronger one.** Every other room in RISE is
self-contained and offline. This is the first surface that assumes a tool
outside the building. Burying it in the Workshop hides that; giving it its own
door states it. The same discipline as *a work that cannot be credited is
absent* — say what is true rather than smuggle it in.

---

## 2. The name ⁇

Working title **Scriptorium**: the place where a text is written from dictation.

Not *Curator* — the **Curia** is already "the room where the visual canon is
governed", and two curation rooms with near-identical names would be worse than
the confusion this rework exists to remove.

*Spectorium* has been suggested. It reads toward *seeing* rather than *writing*,
which describes what the reader receives rather than what the room does. Either
is defensible; the decision is the creator's and nothing else in this document
depends on it.

---

## 3. Placement ✦

**A door, not a nav tile.** The Portal's nav triad is Vault / Library /
Workshop — the three daily tools. Solarium is a pavilion. The Curia
sits behind a small door because it is a specialist governance surface, and
this is the same kind of thing.

Consequences accepted: few readers will find it, which is correct while it is
experimental and matches *Open Beta*.

---

## 4. The loop, in the order it happens

1. **Intent** — a sentence. *"A sequence about memory and loss."*
2. **Take** — copy the prompt; download or copy `context.json`
3. **Paste** — the score that came back
4. **Verdict** — accepted, or refused with a correction that can be copied
   straight back to the model (`describeImportFailure`, shipped)
5. **Preview** — what it chose and what it scheduled, before anything is kept
6. **Accept** — a Vault draft, openable in the Workshop

**The Scriptorium proposes, the Workshop refines, the Vault holds.** The format
already says this: imports land as `authority: 'proposed'`, and a published
Journey cannot be laundered through the doorway. The room does not invent
semantics; it gives existing semantics their own door.

---

## 5. Three artifacts, three jobs ✦

| | contains | read by | enforced |
|---|---|---|---|
| `context.json` | capability ids **+ catalogue** | the model | ids are, by `assertProgramWithinContext` |
| the prompt | the task, the output shape, the rules | the model | no |
| the score | what comes back | the validator | yes, `validateExperienceProgram` |

**The catalogue belongs with the ids, in one file.** Same audience, same moment
of use. Splitting them would make the model perform a join across documents to
answer one question, and would create two things that can disagree.

**The prompt must never live inside the context.** Contexts are shareable
documents. A context file received from someone else would otherwise carry
instructions the reader pastes into their own model. The prompt is generated by
the app at export time so it is un-forgeable and cannot go stale.

---

## 6. What moves, and the line that must not

| | |
|---|---|
| **Moves out of the Workshop** | *Export context*, *Import score* |
| **Stays in the Workshop** | *Export score* — sharing what you authored is an authoring act |

**`prepareSessionPayload`'s proposed-authority guard stays.**

```js
if (payload.experienceProgram?.authority === 'proposed') {
  return payload;
}
```

A proposed program reaches the Workshop *from the Vault* — that is the whole
accept path. Removing it while clearing out "curator code" would make the
Workshop silently recompile editor assignments over an imported score. Five
lines, and they do not look like the room's code.

### Extraction is additive, and measured

Every hunk P1 added to `Workshop.js` was a pure insertion — `-N,0` — so no
pre-existing line was modified on the way in. The core logic already lives in
standalone modules (`curator-context.js`, `experience-program-io.js`); the
Workshop holds ~249 lines of UI glue, of which 207 are one contiguous block at
the end of the class.

**Therefore: build the room additively and leave the Workshop's three buttons
in place.** Remove them only once the room is proven, as its own commit, with a
canonical-form comparison proving the deletion touched nothing adjacent. There
is no window in which anything is half-moved, and if the room turns out wrong,
deleting it changes nothing else.

---

## 7. Source selection — the decision that defines the room ✦

Chosen: **the score may request sources; the room resolves them.**

Today an import binds to sources already loaded. The room's premise inverts
that — choosing the text is part of what is being asked for. So the context
ships the **Library catalogue**, and an accepted score causes those works to be
loaded.

Consequences, stated rather than discovered later:

- **The capability gate's claim changes** from *these are loaded* to *these
  exist*. Still a real gate; a weaker sentence. It must be said in
  `EXPERIENCE-PROGRAM-SPEC` rather than left to drift.
- **Loading must be visible and refusable.** The reader sees what was chosen
  before anything is fetched.
- **No payloads leave.** Titles, authors, division counts and lengths only —
  *IDs only, no bytes* holds unchanged.

### Catalogue size ✦ *(settled 2026-08-21)*

`scripts/build-division-index.mjs` writes the whole corpus's divisions in a
single pass over the committed bytes, and splits the result by shelf state:

- `src/content/archive/division-index.json` — the 15 served works. **40 KiB on
  disk, 32 KiB embedded.** The only one anything under `src/` imports outside a
  test.
- `src/content/archive/division-index.withheld.json` — the other 80. **53 KiB on
  disk, 49 KiB embedded.** Corpus audits only.

Per work both carry `{divided, titled, reason, authored, noun, count, labels?,
divisionWords, words}`.

**Two sizes, because there were three statements of two numbers and none of them
agreed.** This section stated one pair, the builder's own comments stated
another, and the sizes a reader actually pays were neither: the committed files are
pretty-printed and a bundler embeds the parsed JSON, which drops the indentation.
So *on disk* is the artifact as committed and *embedded* is what a reader
downloads, both rounded down to the KiB, and `scriptorium-spec.test.js` reads all
four figures back out of the two bullets above and re-measures the files. Which
number was meant was never written down, which is how one comment could say 49
about the bundle while this section said 54 about the file and both sound like
the same claim, and how a comment could say one figure about the bundle while
this section said another about the file.

Four rulings, each of which cost something to learn:

- **One pass.** The per-division word counts the gate needs to measure
  `work#12` lived briefly in a sibling `division-words.json`, written by a
  second script. Two artifacts of one `divideSections` pass can disagree, and
  a re-ingest that regenerated only one would silently mis-charge every
  extent in the work. They come out of one call; the total and the parts that
  make it are asserted against each other, and both are asserted against what
  the resolver actually reads.
- **Split by shelf, because a runtime filter cannot remove a build-time
  dependency.** `buildLibraryCatalogue` walks the released works and drops the
  rest, and all eighty withheld works rode into every reader's bundle anyway
  — the static import *is* the dependency, which is the same mechanism that
  once cost this codebase 82 MB. Splitting the artifact took 49 KiB of embedded
  JSON out of `content-texts`. `divisions.test.js` fails if anything but a test imports
  the withheld half, and fails if a withheld id appears in the served half.
- **Labels ride for every scheme the author wrote, not only the titled
  ones.** "Book I" was rejected as the count and the noun restated. It is not
  restated: a work's own number is precisely what its array position is not
  (§10c), and a curator handed no labels can only count blind. Milton,
  Marcus Aurelius and Joyce shipped no labels at all on that reasoning.
- **Only for a work the shelf offers.** Labels have exactly one consumer,
  `buildLibraryCatalogue`, which walks the released works; sending the other
  eighty would name divisions nobody can address. The split above now makes
  that structural rather than a condition in the builder.

They ride **whole or not at all**, and **uncut**. A truncated list reads as the
work's complete scheme and sends a curator past the end of the work; a label
shortened mid-word reads as the edition's own title. There were two caps, at
60 characters in the builder and 80 in the catalogue, and one label in four of
Lyrical Ballads was cut by them. The validator's bound on catalogue text is the
only one left, and a label that breaches it refuses rather than lies.

---

## 8. Binding — how a curator points at a place in the text

The room's value depends on this. A model that can only set one surface for a
whole reading is choosing wallpaper. A model that can say *the first tenth in
Turrell, then the storm in fractal* is doing something closer to the work.

**The format already carries it.** `fromProgress` / `toProgress` are canonical:
validated 0–1, `to` must exceed `from`. Nothing needed to be invented; nothing
in the context or the prompt says so.

### The format already distinguishes this author ✦

Not incidentally — the validator draws the line explicitly:

| span | quote fingerprints |
|---|---|
| character / token | **required** (`PROGRAM_QUOTE_REQUIRED`) |
| progress | **forbidden** (`PROGRAM_ORPHAN_QUOTE`) |

A character span needs fingerprints because you must have read the bytes to
produce one. A progress span needs none, because the premise is that you have
not. **The coordinate system for an author who knows the shape and not the text
was designed before there was one.**

### Progress is measured in words, so it is measured in time

`atom.sourceProgress = consumed / totalWords` (`session-compiler.js`). "The
first 10%" is a tenth of the *reading*, not of the character count — which for
an audiovisual work is the unit that matters. A dense paragraph takes its share
of the clock rather than its share of the page.

### Contiguous proportions are natively the shape the gate wants

Ranges are half-open, so `[0, 0.1)` and `[0.1, 0.3)` abut without intersecting.
Same-lane exclusivity accepts abutment and refuses overlap (§P0-B). A run of
weights therefore passes the validator by construction — the ergonomic form and
the lawful form are the same form.

### RULING: no weighting field in the program ✦

If `weights` enters the format there are two ways to say one thing and the
runtime must reconcile them — the failure this codebase pays for most often.

- The **prompt** teaches proportional thinking.
- The **import boundary** may normalise a weights array into progress ranges.
- The **canonical program** keeps one representation.

Same discipline as the catalogue: enrich the periphery, leave the enforceable
core alone.

### The tension: what needs no text also cannot be checked

A character span carries fingerprints, so a drifted payload is caught. A
progress span carries nothing. If a division is an artificial cut, or the
payload opens with front matter, the model's "first 10%" lands somewhere else
and **nothing detects it**. It will look like it worked.

This is the honest cost of the cheap coordinate system, and it is why the next
two items exist.

### Artificial divisions must be declared ⁇

The premise — *the model has already read the canon* — holds for the work, not
necessarily for our cuts. `division-index.json` records `titled: true/false` per
work; where divisions are mechanical, the model's memory does not map onto them.

The catalogue should say which works have authored divisions and which have
imposed ones, so a curator knows when it is recalling and when it is guessing.
Cheap, and the kind of honesty the rest of the product already keeps.

### Anchor by quotation — the synthesis ⁇

A model's strongest knowledge of a canonical text is not its proportional
structure. It is the **lines**. It knows *"It is a truth universally
acknowledged"*; it does not know that phrase sits at 4.2%.

So let a clip anchor by quote **without** offsets, and let RISE derive them:

- **no text sent** — the quote comes from memory
- **verifiable** — the quote is located or it is not
- **degrades reverently** — not found means the clip is absent and reported,
  which is already the law
- **validation where the author is** — ambiguous openings refuse at
  import/accept (`assertQuotationAnchorsAgainstSources`), where the curator can
  extend until unique; session compile omits them so a reader never loses the
  reading. Same split as Workshop media: save refuses, read degrades.

The machinery is half-built. `normalizeQuote` and `sourceTokens` exist, and
`resolveSourceSpan` already performs the integrity check. What is missing is
the *direction*: today it verifies offsets against quotes rather than deriving
offsets from them. A resolver in front of working parts.

### Three ways to point at a place ✦

| | the author must have | verifiable | good for |
|---|---|---|---|
| **progress** | the shape | no | broad movements, overall arc |
| **quotation** | a remembered line | yes | specific moments |
| **character / token** | the bytes | yes | the Workshop |

A curator uses the first two; the Workshop uses the third; all three compile to
the same program. The reader never sends the text in any of them.

### What this does not buy

Finer binding is real progress and it does not change the room's kind. A model
placing imagery at a tenth's granularity is still arranging pictures over a
reading whose pace it cannot touch. What changed the room's kind was §10 —
the reading lane — not the granularity of the visual one.

---

## 9. What the room may never do ✦

- **No network.** RISE calls no model. The reader carries documents by hand.
- **No bytes out.** Ids, titles, lengths. No payloads, no images, no URIs — the
  context refuses any capability id containing a URI scheme or `://`.
- **No prompt in the context.** §5.
- **No path around the validator.** Every entry — file, paste, or a future one —
  goes through `validateExperienceProgram` and, when a context is supplied,
  `assertProgramWithinContext`.
- **`published` is refused.** Only RISE's own Journeys hold that authority.
- **Degrade honestly.** A reader with no model must still get a useful document
  rather than a broken room: the context export alone is a legitimate outcome.

---

## 10. Blocked on, and blocking

**Pacing shipped 2026-08-10 (ROADMAP Phase 13), and the room is a composer.**
A `reading` track carries `{ kind: 'pace', wpm?, chunkMode? }`, so a proposal
can slow into a passage, hold a section in whole phrases, and quicken a
narrative stretch. Three properties matter to this room:

- **A scored pace is a default, not a seizure.** The track has no fallback,
  so outside a scored span the reader's own pace governs; and pace is baked
  into atom durations, so the Chamber's speed control still scales the whole
  reading. A curator sets a contour; the reader sets the tempo.
- **A scored `chunkMode` needs a quotation anchor** (or none, meaning the
  whole source). Progress is a fraction of the atom stream, so it cannot
  locate a cut it is asking to change. `wpm` is unrestricted.
- **Within one source, all pace clips share one coordinate system.** Two
  ranged clips in different systems cannot be shown not to overlap and are
  refused. The export prompt states this.

**Blocked on nothing.** The format, the gate, the catalogue, the correction
path and the reading lane all ship. §11 ran twice on 2026-08-11 against a real
model: the first run found a contradiction in the export prompt, the second
produced a score that passes the gate and reads — 237 words at 120 wpm in
phrases, with imagery over three progress spans. The room now reads its own
scores (§10b), so the Workshop's duplicate curator buttons can come out.

### 10b. The room does not hand off to the Workshop ✦ *(2026-08-11)*

**Ruled: an accepted score is read from here.** Accept used to save a Vault
draft and then navigate to the Workshop. That was the wrong end for the
reason §1 gives: the room exists so that a reading can be had *without*
manual configuration, and delivering the reader into the configuration
surface undoes the argument.

**What the attempt to keep the Workshop in the path revealed.** Two gaps were
reported and both are the same fault:

- The Workshop's reading controls showed 320 wpm / word for a score that
  scored 120 wpm / phrase, because import derives `defaults.reading` from the
  project and never from the program.
- The Workshop painted no highlights at all for an imported score.
  `visualAssignmentsFromProgram` and `audioAssignmentsFromProgram` both open
  `if (clip.anchor.fromCharacter === undefined) return []`, and the export
  prompt teaches models to prefer **progress** anchors. Measured on a real
  curator score: **3 visual clips → 0 assignments, 1 audio clip → 0.**

**Those are not bugs to fix, they are the seam.** The Workshop is a
character-space editor for readings a person composes by hand; a curator score
is progress-space and arrives finished. Teaching the Workshop to read one
would mean converting progress anchors to character spans on open — an
approximate conversion promoted into an authored one — to enable editing
nobody asked for.

**So the room accounts for itself instead.** `program-rundown.js` says what a
score will do in a reader's words: length, movements, pace, imagery and sound,
each with the span it covers stated **in the coordinate its author used** — a
progress range as a proportion, a quotation by its own words, neither
converted into the other. Step 6 offers *Begin reading* and *Keep in the
Vault*, and neither passes through the Workshop.

**What is deliberately given up.** An accepted score cannot be hand-edited.
That is the trade, and it is the right one: a score that needs editing should
be refused or re-asked for, not repaired in a surface that speaks a different
coordinate system. The Vault draft remains, so a reader who genuinely wants to
take it apart can still open it there.

---

### 10a. Length — the reader's one dial ✦ *(2026-08-11)*

The room's second control, beside intent: **how long the reading should be,
in words.** It travels as `constraints.targetWords` and is a **hard limit** —
a score over it is refused at the gate, not trimmed.

**Words, not minutes**, and the field it replaces was `targetMinutes` — dead
since it was written, populated by nothing, read by nothing. Three reasons it
stays dead:

- A model can add words up from the library it was handed. It cannot turn
  minutes into words without a pace and a chunk mode it was never given.
- The ceiling that actually refuses is `maxAtoms`, and in word chunking one
  word is one atom. Words sit on the real limit; minutes are a proxy for it.
- **A program can score its own pace now** (ROADMAP Phase 13). Duration is a
  function of the score, so a minute budget could not be checked until after
  the thing being budgeted had been composed. Words are invariant to pace.

Minutes are still shown under the slider, because that is what a reader
thinks in — derived at the reader's current wpm, never stored. Same shape as
the reading band: the durable value is the one that survives a change of
device or of pace.

**The measurement is exact, not estimated.** A movement anchor carries only
`sourceIds` — `validateAnchor` gives it no range — so a movement reads its
source whole and a score's length is precisely the sum of `words` over the
sources its movements name. Visual, audio and reading clips bind inside
territory the movements already own and add nothing.

**A source of unknown length refuses the score.** Inability to prove the
budget is not proof of it. All 88 library works carry `words`; loaded sources
now carry it too, counted at export rather than converted from characters —
a characters-to-words ratio is exactly the kind of invention this boundary
exists to refuse.

**Why it is at the gate and not at Run.** It already failed at Run once: a
score naming more than 120,000 atoms compiled, refused, and did so after the
reader had accepted it. The refusal now names the budget, the total, and the
works that make it up, and says the only three things that reduce it.

---

### 10c. Part of a work — the extent grammar ✦ *(2026-08-21)*

A movement read its source whole, so the shortest reading the room could
compose was the shortest work on the shelf: 10,321 words. Length was a filter
over the catalogue rather than a budget a score could spend.

**The extent rides in the SOURCE ID.** `library-extent.js` owns the grammar and
nothing else restates it:

| id | reads |
|---|---|
| `sacred-tao-te-ching` | the whole work |
| `sacred-tao-te-ching#40` | division 40 entire |
| `sacred-tao-te-ching#40:200` | that division's opening ~200 words |

A score is therefore self-describing — the same program reads the same words on
any day, at any slider position — and the extent is resolved into an ordinary
source before the chunker, the atoms or any media anchor see it.

**The rung is always the largest honest unit that fits**: whole work → whole
division → division's opening. The same reverent degradation the imagery
follows: never a broken frame, always a smaller true thing.

#### The gate reads extents, and charges the most they can read

`createCuratorSourceReader` (curator-context.js) answers both questions a gate
asks — *may the score name this?* and *how long is it?* — because they were
answered separately by two `new Set(library.map(...))` lookups that had neither
of them heard of an extent, and fixing only the membership side turned a
refusal into an unmeasurable budget.

An opening's exact length is a fact about where the sentences fall, which the
gate cannot know while holding only the catalogue. What it can prove is the
ceiling: `extentReadingBound` charges
`min(divisionWords, EXTENT_OVERSHOOT_LIMIT × the ask)`, so `#12:200` costs up to
320 words and a score the gate admits cannot read longer than it promised.
`EXTENT_OVERSHOOT_LIMIT` is **1.6**, and it lives beside the cut it bounds in
`library-extent.js`; a second copy in the gate is exactly the drift this
codebase keeps paying for. This sentence carried a literal `1.6` through the
fold-in that exported the constant — the spec being one of the documents the
export existed to keep honest — so the figure above is now read back out of this
paragraph and compared to the export.

#### Three refusals, and no substitutions

- **A division the work does not have.** Refused, never neared.
- **Below the floor.** `#50:37` asks for 37 words against a 40-word floor. It
  used to be handed back as a whole-string work id, miss in the registry, and
  tell the reader RISE does not hold Spoon River — while Spoon River stood in
  the same catalogue. The refusal now names the floor.
- **An opening the text cannot be cut near.** `sentenceAlignedPrefix` returns
  nothing when no boundary at or under the ceiling clears the floor.
  `ulysses#18:200` used to return 5,714 words — Molly's soliloquy to its first
  full stop, 28.6× the ask. The choice is between a passage of a wildly
  different length and nothing, so it is nothing. Measured cost before the
  choice was made: of 944 divisions on the shelf, 2 refuse at a 200-word ask.

**Existence is established before the floor is judged.** A sub-floor ask on a
work nobody holds is refused as absent; on a division the edition does not have,
as no-such-division; below-floor is what is left when the work and the division
are both there. Only the grammar may be judged before the shelf is asked, and
only because an id whose shape is wrong names no work to look up.
`parseLibraryExtent` is a string reader — it can see that a `:N` is under the
floor and it cannot see whether the work, the division or its text exists — so
judging the floor first let a fact about the cut speak for facts nobody had
established. The refusal for `sacred-tao-te-ching#900:39` told the curator to
name `sacred-tao-te-ching#900` instead, which is a chapter the Tao does not
have, and following that advice earned a second refusal; the same id spelled
`:200` was correctly refused as a division that is not there. Which of §13's
four extent statuses a script learned turned on the `:N`. Both doors now judge
in one order — `createCuratorSourceReader` at the gate,
`resolveLibrarySourceIds` and `resolveDivisionExtent` at the reading — so the
two cannot disagree about the same id.

`add-source` carries **no `division` field**. It had one, validated and read by
nothing, so `{"op":"add-source","sourceId":"sacred-tao-te-ching","division":40}`
was accepted and loaded the whole book. It is refused rather than honoured —
composing the id on the model's behalf is rewriting its output — and the
refusal names the id that was meant.

#### A division's position is not the work's own number

This is the misaddressing that survives everything above, and no test can see
it: labels and resolver positions agree 1-based for all fifteen works, so
nothing is broken. But a work served in several parts numbers each part from
one. Inferno Canto I is division 2, Purgatorio Canto I is 37, Paradiso Canto I
is 71; *the Paolo and Francesca canto* is Inferno V and `the-divine-comedy#5`
returns Canto IV.

**Slugs are not the fix.** A slug is a durable anchor and depends on edition
identity, which does not exist here: `CERTIFIED_IDS` is empty and
`RELEASE_SERVES_UNCERTIFIED` is true. Minting one would promise permanence the
shelf cannot keep.

The fix is the catalogue plus one sentence. Every served work now ships
`divisions.labels` (§7), and the export prompt says the position is not the
work's own number, illustrated with the widest gap the catalogue currently
holds — computed, so it can never describe a work that has left.

#### What the reader can ask for

`MAX_SAFE_TARGET_WORDS` (reading-limits.js) is **104,529**: `maxAtoms` divided
by the worst-case atoms-per-word, because word chunking emits a paragraph-break
atom per paragraph. The slider is capped there and the gate refuses above it
with `PROGRAM_IO_ATOM_CEILING`, against the same constant — the two agree by
reading one number rather than by arithmetic that matches today.

This paragraph carried the figure from the old 1.05 atoms-per-word assumption
until 2026-08-21; the constant has been 1.148 since the Analects were measured,
and nothing re-read the figure here. This is the one number the
slider and the gate both stand on and the document a red team is told to script
against, so `scriptorium-spec.test.js` now reads it back out of this sentence
and compares it to the exported constant. A number in prose is a label; the
guard is what makes it evidence.

The worst-case ratio it divides by bounds atoms per word of BUDGET, not per
word of text — an opening can compile denser than the constant per word it
delivers, and cannot per word it is charged. `reading-limits.js` states the
proof and `shelf-measurements.test.js` measures every extent the grammar can
name against it.

---

## 11. How we will know

**Run the loop by hand, badly, in the Workshop as it stands.** Not because the
Workshop is the right home — it is not — but because the surface should be
designed from watching a real model fail against the gate, and neither the
format's author nor its reviewer has seen that happen yet.

What to record on the first run:
- how many round trips before a score validates
- which refusals recur, and whether `describeImportFailure` was enough to fix
  them without opening the source
- whether the 29 capability descriptions were sufficient to choose well, or
  whether the model reached for imagery that fought the text
- whether the intent survived — is the result *about* memory and loss, or
  merely decorated

Only then build the room.

---

## 12. Sequence

1. ~~Derive the context from the registries; describe all 29 capabilities~~ ✅
2. ~~Copyable refusals~~ ✅
3. ~~Export prompt~~ ✅ — generated, separate from the JSON; teaches progress,
   quotation, and Workshop character/token systems.
4. **Run the loop by hand** — §11
5. ~~Quotation anchoring~~ ✅ — resolve quotes against the edition; omit when absent
6. ~~Decide pacing~~ ✅ — the reading track; §10
7. ~~Build the room~~ ✅ — additive; Workshop buttons left in place
8. Remove the Workshop's curator buttons — separate, verified commit

---

## 13. Three entrances, one sequence ✦ *(2026-08-21)*

The five steps — intent and length, take, examine, the reading, read — belong
to `ScriptoriumSession` (`src/core/scriptorium-session.js`) and to nothing
else. Three surfaces drive that one object:

| surface | how it drives | what it adds |
| --- | --- | --- |
| the room, `Scriptorium.js` | DOM events | markup, object URLs, the clipboard, the Vault write, IndexedDB durability |
| the CLI, `scripts/scriptorium.mjs` | argv | printing and an exit status |
| the suite | direct calls | assertions |

The room holds **no copy** of the intent, the length, the context, the prompt,
the verdict, the program or the materials: each is a getter onto the session.
That is not tidiness. The Scriptorium and the Workshop's Import score are two
doors onto one gate, and every defect this room has produced has been one door
knowing something the other did not.

### The CLI is not an agent

It calls no model and runs no loop. `RISE calls no model` (§9) is not suspended
because the caller is a terminal. What the CLI does is ask the live modules a
question and print the answer, which is why it replaced fourteen
`scripts/probe-scriptorium-*.mjs` files: a probe records what the source said
once, and three of those fourteen were describing source that had changed
within hours.

### A refusal code is an exit status

`SCRIPTORIUM_EXIT` (`src/core/scriptorium-cli.js`) maps every refusal the gate
can produce onto a process status, so a script asserts *which* refusal without
reading prose. `0` is acceptance and nothing else; `1` means the CLI met a code
its own vocabulary does not name, which is a bug in the CLI rather than a
verdict about the score; `2` is the argv.

| status | meaning | codes |
| --- | --- | --- |
| 20 | not a score yet | `PROGRAM_IO_EMPTY`, `PROGRAM_IO_JSON`, `PROGRAM_IO_TOO_LARGE` |
| 21 | not a score this doorway may admit | `PROGRAM_IO_SCHEMA`, `PROGRAM_IO_RECORD`, `PROGRAM_IO_PUBLISHED_REFUSED` |
| 22 | it smuggles something | `PROGRAM_IO_URI_REFUSED`, `PROGRAM_IO_PROTOTYPE` |
| 23 | the program's own shape | `PROGRAM_LANE_OVERLAP`, `PROGRAM_READING_*`, `PROGRAM_INCOMPLETE_RANGE`, `PROGRAM_UNKNOWN_FIELD`, `PROGRAM_SOURCE_OWNERSHIP`, `PROGRAM_TRANSITION_SOURCE_DUPLICATE`, `WORKSHOP_PROJECT_*`, … |
| 24 | the capability document | `CURATOR_CONTEXT_*` |
| 30 | a work this build does not hold | `PROGRAM_IO_UNKNOWN_SOURCE` |
| 31 | the work is here, that division is not | `PROGRAM_IO_UNKNOWN_DIVISION` |
| 32 | an opening below the floor | `PROGRAM_IO_EXTENT_FLOOR` |
| 33 | not one of the three id forms | `PROGRAM_IO_EXTENT_GRAMMAR` |
| 34 | a capability nobody offers | `PROGRAM_IO_UNKNOWN_COLLECTION`, `…_ENGINE`, `…_SURFACE`, `…_SOUNDSCAPE`, `…_TONE`, `…_SWELL`, `…_VOICE`, `…_ASSET` |
| 40 | longer than the reader asked for | `PROGRAM_IO_BUDGET_EXCEEDED` |
| 41 | one source declares no length | `PROGRAM_IO_BUDGET_UNMEASURED` |
| 42 | more words than one session holds | `PROGRAM_IO_ATOM_CEILING` |
| 43 | more works than one session holds | `PROGRAM_IO_SOURCE_CEILING` |
| 50 | only the text could settle it | `PROGRAM_IO_LIBRARY_UNLOADABLE`, `SOURCE_SPAN_*`, `VISUAL_SCORE_*`, `AUDIO_SCORE_*` |
| 51 | there is no reading here | `PROGRAM_IO_NO_LIBRARY_SOURCES`, `PROGRAM_IO_NOT_EXAMINED` |
| 60 | an operation set, or the producer | `AGENT_OP_*`, `PRODUCER_*`, `EDITOR_ASSET_*` |
| 70 | acquisition, narration, publication | `ACQUISITION_*`, `NARRATION_*`, `PUBLICATION_*` |

Row 23 is the only row whose cell ends in an ellipsis, and the ellipsis is
honest: `PROGRAM_` is a prefix family, so a code added to the program validator
tomorrow lands at 23 by construction. It is not a licence. The set of rows that
may end that way lives in `scriptorium-cli.test.js` rather than being read out
of this table — `open` computed from the document under test is a document that
grants itself the exemption — and every refusal the CLI phrases at 23 has to be
named in the cell above or excused there with a reason. Rehoming
`AGENT_OP_SOURCE`, `SOURCE_SPAN_QUOTE_NOT_FOUND` and `PUBLICATION_HUMAN_REQUIRED`
onto 23 once left the whole suite and CI green, because the backward pass
skipped the row every unlisted code lands in.

### What a capability is, and where the list of them lives

Status 34 is one refusal per FAMILY of capability, and the families are one
table: `CAPABILITY_FAMILIES` in `experience-program-io.js` says where each
family's offered ids live in the capability document and which refusal an
unoffered id raises. Both doors enumerate into that shape —
`programCapabilities` for a score, `operationSetCapabilities` for an operation
set — and one loop checks it.

That is the second half of the fix `programSourceIds` began. Making the SOURCE
check derived closed the hole a transition clip could carry a novel through,
and the derivation stopped at text: a soundscape, a tone preset, a personal
swell, a narration voice and a field renderer stayed hand-written allowlists
that only the program door consulted. `set-atmosphere` wrote three of them
into a project's reading defaults with no gate anywhere in the path, and
`assign-audio` on a swell nobody holds FABRICATED one called "Personal audio".

The document gained two lists in the same pass, because a capability that can
be named has to be a capability the document describes: `audio.voices` (the
voices that are actually BUILT — an unbuilt one is silence wearing a name) and
`visuals.surfaces` (the three field renderers `PROGRAM_VISUAL_FIELD_RENDERERS`
has always closed and nothing had ever offered).

The four extent statuses are deliberately separate. They are the grammar §10c
teaches, and telling 32 from 33 is the difference between a curator who asked
wrongly and a build that cannot serve what was asked.

#### Why 42 and 43 are two statuses

A session holds a number of words *and* a number of works, and both ceilings
are "longer than one session can hold". They were one status for a pass —
`PROGRAM_IO_ATOM_CEILING` and 42 for both — with `details.maxSources` as the
only thing distinguishing them. That was honest and it was not enough, for two
reasons.

The first is that the status is the whole of what a script reads. §13 exists so
a caller can branch on *which* refusal without parsing prose or poking at a
details object; a discriminator that lives only in `details` puts back exactly
the reading the exit code was invented to remove.

The second is that the two refusals ask the curator for different things. 42
says the reading is too long: read less — a shorter work, a division instead of
a book, fewer movements. 43 says the reading names too many *ids*: sixty-five
chapters of the Tao is 8,456 words against a 20,000 budget, nothing large at
all, and the fix is to name the work once rather than sixty-five times, which
is very often the same text. A curator told "longer than one session can hold"
about a score well inside every length they set has been told the wrong thing.

That is the same argument that keeps 32 and 33 apart, and it is settled the
same way: `scripts/fixtures/scriptorium/source-count.json` produces 43 on every
run, and `source-count-limit.json` — exactly `READING_LIMITS.maxSources` — is
admitted beside it, because a ceiling tested only from above may sit one too
low.

Every `PROGRAM_IO_*` refusal is named in the table **explicitly** rather than by
prefix. `scriptorium-cli.test.js` reads the `case` labels out of
`describeImportFailure` and fails when one of them would fall through to the
`PROGRAM_` family default — because a status assigned by accident means nothing.

### The wording of a refusal has one home

`describeImportFailure` (`experience-program-io.js`). Nothing else phrases one.
`PROGRAM_IO_LIBRARY_UNLOADABLE` was the last exception: the Workshop wrote that
reply itself, in a method the Scriptorium could not reach, so the room with the
copyable refusal panel said `Could not load: ulysses#18:200` and stopped.

### It runs in CI

`npm run scriptorium:ci` spawns the CLI against committed scores under
`scripts/fixtures/scriptorium/` and asserts the documented status and code for
each. It is its own job in `.github/workflows/ci.yml`, beside the unit suite
which drives the same argv shell in-process.

---

*The room is named for a place where copying was done carefully and what was
copied was checked. The examining is the part RISE supplies.*
