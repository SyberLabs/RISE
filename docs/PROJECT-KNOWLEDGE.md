# RISE — what one model learned building it

**Written 2026-08-21.** A handover for whoever works here next, human or
model. It is not a spec; the specs in `docs/specs/` are authoritative. This is
the knowledge that sits *between* the specs — the defect patterns, the reasons
behind decisions that look arbitrary, and the things measured rather than
assumed.

Everything here was verified against the tree at the time of writing. Where I
could not confirm something, it says so.

---

## 1. What RISE is, in one paragraph

A browser-based audiovisual reader. Text is broken into **atoms** — a word, a
phrase, a line — each with a duration, and presented in a **Chamber** against
procedural or sourced imagery and a bed of sound. A **score** (an Experience
Program) can author what appears when. The **Library** holds prepared
editions; the **Workshop** authors; the **Scriptorium** lets a model compose;
the **Chapel** is a Catholic devotional instrument with its own liturgy
engine. The unit of value is not the catalogue. It is what happens to the act
of reading after a work enters.

---

## 2. The recurring defects — read this section twice

These are not hypotheticals. Each cost real time, and each recurred after
being fixed once.

### 2.1 A vocabulary living in two places where only one learns a new word

The single most frequent defect. Examples: `gmask` with `GT=4096` beside a
hardcoded `4095`; the phrase floor's constant against a comment citing texts
no script ever measured; `getDivisions` reading a declared scheme while
`sequencesFor`, four hundred lines away, re-derived it; `mostlyVerse` about to
exist in two rooms.

**The rule:** prefer deleting one copy to synchronising two. Where duplication
is unavoidable, add a test asserting the two agree — that converts silent
drift into loud failure.

### 2.2 A runtime filter cannot remove a build-time dependency

The catalogue filtered withheld works at runtime; every entry still carried
`load: () => import(...)`, so Rollup emitted a chunk for all of them.
**Eighty-two megabytes of unreachable books were built and deployed.** The
same defect, found independently by a collaborator, shipped a withheld visual
engine — because the *import* was the dependency.

Whenever something is "withheld", "hidden" or "disabled", ask whether it is
still **built**. Grep the built output, not the source.

### 2.3 A test that exercises the plumbing you just wrote

Verse handling was wired to `scriptorium-resolve`, tested against
`scriptorium-resolve`, and reported as shipped. But a reader opens a poem
through the Library's contents sheet, and that path passes an explicit
allowlist at four separate hops. **The flag was dropped at the first one.**

A reading has more than one entrance. A fix applied at one is not a fix, and a
test written against the entrance you just built proves only that you can wire
two things together. Test the door a reader uses.

### 2.4 A guard that cannot fail

`expect(Math.max(...beads)).toBe(ROSARY_BEAD_COUNT - 1)` — both sides derived
from the same expression. It passed for six weeks against a rosary with the
wrong number of beads. Related: a study whose control and experimental group
were the same condition, and an e2e suite that set
`VITE_RISE_ARCHIVE_REVIEW=1` in global setup and so could not see that public
builds served an **empty Library**.

Ask of every guard: *what input makes this fail?* If you cannot construct one,
it is decoration.

### 2.5 Structure destroyed at import, then guessed at forever

Flattening Blake's quatrains into one line caused four downstream failures and
four detectors written to catch them. The source was never at fault.

**An ingest may not destroy a distinction the source made.** Corollary, learned
later and painfully: having read the distinction, do not then throw it away.
`sectionsFromParts` read the edition's verse and dropped it, after which a
read-time heuristic guessed it back.

### 2.6 Zero known defects is not known clean text

A detector registry finds only what a signature already describes. "Every
detector reports zero" gets *weaker* as you learn more. This ended the
cleansing campaign and produced the acquisition contract instead.

### 2.7 Metrics agree with each other and are all wrong together

Coefficient of variation, fragment rate, stutter runs, dangling tails — every
one scored Tintern Abbey as healthy while an atom carried the head of
Wordsworth's next line. **A person reading one poem found it.** Three separate
defects of this class surfaced that way.

When a metric and the page disagree, the metric is the suspect.

### 2.8 A label is not evidence

`Front matter` was applied to any preamble over 200 words, which skipped
Hawthorne's Custom-House and 91% of the Shahnama. An `.mp4` extension is what a
file is *called*; the mime type is what it claims to *be*.

---

## 3. Standing laws

Violating one of these is how section 2 happens.

- **Structure is read, never inferred.**
- **Words in must equal words out.** The ingest refuses a payload whose count
  differs from its source. This is the only reason several disasters are
  stories about bugs rather than about books.
- **A subdivision is not a division.** A division is what a reader *enters*.
- **An ordinal is a position, not a field.**
- **A heading is structured, not a string.** `se:label`, `z3998:ordinal` and
  `epub:type="title"` are three facts; `textContent` presses them into one.
- **Reverent degradation.** A work that will not resolve is absent — never a
  broken frame, never a substitute.
- **Models flag; humans dispose.** A silently corrected edition ceases to be
  the edition its provenance claims it is.
- **Withheld, never deleted.** Payload stays on disk, git keeps it reversible,
  and every withholding **states a reason** — enforced by test.
- **The build ships what a reader can reach; a test reads what is on disk.**
- **Provenance is the promise.** A reader should always know whether they are
  meeting a received text or one written here.

---

## 4. The Archive, and why it is small

Eighty-eight inherited Gutenberg works became **fifteen** from Standard
Ebooks. Not a retreat — a change of loop:

```
    OLD                             NEW
    acquire → ingest →              select → compare editions →
    find garbage → write            choose and say why → ingest
    detector → clean →              PRESERVING structure →
    find different garbage          certify end to end
```

The fifteen are chosen as **acceptance fixtures for textual forms**, not as
favourites: epic, drama, lyric, wisdom, essay, novel. A canon of favourites
proves nothing; a canon of forms proves the instrument.

**Shelves are provenance** (Received / Composed) because provenance is what
RISE promises to keep. **Divisions are form**, because form decides the
reading — a verse line is met differently from a paragraph. Where a work was
written is a fact about it, not a shelf to put it on.

### Certification — the release long pole

`CERTIFIED_IDS` is **empty**. A record (`certification.js`,
`completeCertification`) requires: the edition chosen *and why*; a structural
**and** token comparison against an outside reference; a **named human** who
dispositioned every difference; the detector registry at zero at a stated
revision; and the exact `sourceRevision`. Certification is tied to bytes — a
re-ingest withdraws it automatically.

As of 2026-08-21 the public build serves uncertified candidates by explicit
decision (`RELEASE_SERVES_UNCERTIFIED`), and the shelf says so to the reader.

---

## 5. The chunker

- Ceiling `MAX_CHUNK_WORDS = 16`. Floor `PHRASE_FLOOR_WORDS = 5`, default-on.
- The floor never crosses a sentence end, never exceeds the ceiling, and never
  touches a paragraph containing an authored `|`.
- **Verse is read from the edition**, carried as `verse: true` per section, and
  weighed in **words** — an eight-line epigraph over two thousand words of
  Middlemarch prose is not a verse chapter.
- `verseLines` reaches **phrase mode only**; sentence mode still windows by
  word count.
- A prose paragraph inside a verse reading is still prose, and gets the floor.

Reproduce any claim with `npm run study:chunking`. Read the whole shelf, atom
by atom, with `npm run sheet:chunks` — that instrument exists because the
numbers alone could not see the defect.

---

## 6. Things that look wrong and are correct

Leave these alone without new evidence.

- **`atr-` prefixes** name real museum accessions. The Atrium room is deleted;
  the namespace is data.
- **`atriumCollections`** is a live field the Chapel writes. Renaming a
  persisted config key is a migration, not a cleanup.
- **`rise_sol_plan_v1`** stays in `USER_DATA_KEYS` though the Solarium is gone:
  a key dropped from that registry is data that export cannot carry out and
  erase cannot clear.
- **Oedipus Rex is one reading** of 12,617 words. Storr's edition marks the
  whole play as one scene; its fifty-one choral odes are inline.
- **Karamazov's numerals restart** because each is chapter I of a different
  Book. That is the book, not a defect.
- **`git cherry`, not ahead/behind.** Squash merges make the counts lie about
  whether work is upstream.

---

## 7. Practical notes

- **Verify deploys against the live bundle, never the deploy log.** More than
  one reported bug was a stale deployment — including Scriptorium uploads.
- **Netlify SPA rewrites return 200 for missing assets.** A `200` proves
  nothing; fetch the content and look at it.
- Suite is roughly 2,150 tests over 200 files; `maxWorkers` scales to the
  machine. CI runs Unit, Build, Hygiene and Browser smoke; the last is slow.
- **Other agents commit to this working directory and switch its branch.**
  Save a patch before large operations, stage only your own files, and verify
  in a detached worktree of the actual commit — local green means nothing when
  somebody else's fix is sitting in your tree.
- Heredocs mangle `\n`, `\b` and `\s`. Use `chr(92)` in Python, or an editor.
- **Regex on CSS is unsafe** wherever a comment can sit between a selector and
  its brace. It silently produced a descendant selector and killed
  `.portal-continue`. Parse, or edit by inspection.

---

## 8. What is open

- **Certification** — nothing certified; the release gate is held open by an
  explicit decision that should not become permanent by neglect.
- **Slugs in the extent grammar** — the composer reads division names and must
  emit ordinals. Depends on edition identity, which does not exist yet.
- **Sentence mode on verse** — the declaration reaches phrase mode only.
- **Per-boundary provenance** — `splitPhrases` still treats `|`, `,` and a
  newline as one anonymous split.
- **Materials descriptions** — the composer is told a filename and nothing
  else. `describes` / `describedBy` is the next step, and the one that makes
  *anchored* placement work rather than only gallery.
- **Workshop on mobile** — see `docs/prompts/WORKSHOP-ANALYSIS.md`.
- **Journeys are on ice** — their scores quote editions the canon no longer
  serves. Re-anchoring is an editorial act, not a repair.

---

## 9. The sentence the whole project turns on

> RISE does not need every text. It needs the right texts, represented
> correctly.

Everything in section 4 follows from it, and most of section 2 is what
happened before it was believed.
