# Prompt — full analysis of the Scriptorium

Paste this to a model with repository access. It is written to be
falsifiable: every claim below is either measured or marked as a suspicion
to verify.

---

You are analysing ONE room of RISE, a browser-based audiovisual reader. The
room is the **Scriptorium**: where a reader states an intent, RISE exports a
capability document, a model composes an Experience Program against it, and
the room examines that score at a gate before anything is admitted.

Read these before forming any opinion:

```
src/components/Scriptorium.js          the room
src/core/curator-context.js            rise.curator-context.v1 — what a model may name
src/core/curator-prompt.js             what the model is told
src/core/experience-program-io.js      the import gate
src/core/scriptorium-resolve.js        turning a score into loadable sources
src/core/library-extent.js             the extent ladder
src/core/materials.js                  what the reader may upload
docs/specs/SCRIPTORIUM-SPEC.md
docs/specs/ARCHIVE-CANON-SPEC.md       §6 governs what may be served
```

## The governing laws you must not violate in any proposal

1. **The gate refuses; it never repairs.** A score naming something outside
   the capability document is rejected with a copyable reason. Silently
   correcting a model's output is forbidden.
2. **A score is self-describing.** The extent rides in the source id
   (`work`, `work#12`, `work#12:200`) so the same program reads the same
   words on any day.
3. **Reverent degradation.** A thing that will not resolve is absent, never
   a broken frame and never a substitute.
4. **Models flag; humans dispose.** Applies to anything the model asserts
   about a text or an asset.
5. **One vocabulary, one place.** The most frequent defect in this codebase
   is the same knowledge living in two modules where only one learns a new
   word. Prefer deleting a copy to synchronising two.

## Three findings to verify, not assume

### A. The length slider is calibrated to a corpus that no longer exists

Measured on the current shelf: **944 divisions, median 853 words**, p25 153,
p75 2,878. But the room defaults to `DEFAULT_TARGET_WORDS = 20_000`, its
minimum is 200, and its maximum is `READING_LIMITS.maxAtoms = 120_000`.

- A 200-word budget already takes **35% of divisions whole**; 900 words takes
  **51%**. The Archive is no longer a corpus of long chapters.
- The slider maximum is an **atom** ceiling used as a **word** budget. Decide
  whether that is a category error or a deliberate shared bound, and say
  which.
- Ask what the slider is *for*. If most divisions now fit whole, the useful
  control may be "how long a sitting" rather than "how many words", and the
  mapping from one to the other is the pace, which the score itself sets.

### B. The extent ladder may now be answering a question nobody asks

`library-extent.js` degrades: whole work → whole division → **the opening of
a division**, cut at the nearest honest boundary. Constants:
`EXTENT_MIN_WORDS = 40`, `OVERSHOOT_LIMIT = 1.6`.

Verify by measurement, not reasoning:

- How often does the opening rung actually fire across the shelf at realistic
  budgets? If rarely, its cost is complexity for a case the corpus outgrew.
- **The ladder can only take an opening — never a middle.** Establish whether
  that is now a real limitation. Spoon River has 246 poems; the Tao 81
  chapters.
- **Four divisions are below the 40-word floor** and can never be served as an
  extent at all. Name them, and say whether the floor or the divisions are
  wrong.

### C. The composer reads names but must emit ordinals

The curator context now ships division **labels** — "The Hill", "Book I ·
Creation of the World" — but a movement addresses `work#12`. The model reads a
name and then counts positions in an array to say which one it means.

- Establish how often that misaddresses. Construct the failure, do not
  hypothesise it.
- If slugs are the answer, note that a slug is a durable anchor and therefore
  depends on edition identity, which does not exist yet. Say what must come
  first.

## Everything else you must cover

- **Uploads.** `materials.js` decides what may be carried; the panel stages
  it; `curator-context` names it as `sequence-asset:<id>` and the catalogue
  now carries the reader's own filename. Check the whole path resolves at
  compile, and that a refused file states why. *(A recent report of "uploads
  not working" was a stale deployment, not a defect. Confirm this rather than
  inheriting it.)*
- **What the model is actually told.** Read the generated prompt for a real
  intent. Judge it as a brief: is it a capability list a stranger could use,
  or a schema dump?
- **The gate's refusals.** Are they copyable, specific, and actionable? A
  refusal a reader cannot act on is a failure even when the refusal is right.
- **Failure surfaces.** What happens when the model returns prose, truncated
  JSON, a program naming a withheld work, or a program 40× over budget.
- **The seam to the Workshop.** `workshopProjectFromImportedProgram` — does
  everything the score named survive the handoff, including uploads?

## What to produce

1. A defect list, most severe first. Each entry: the file and line, the
   concrete failing input, and what a reader experiences. **No finding
   without a reproduction.**
2. A separate list of things that are correct but look wrong, so nobody
   "fixes" them later.
3. Answers to A, B and C as measurements, with the script you used.
4. At most five recommendations, ordered, each with what it costs and what
   breaks if it is skipped.

Do not write code unless a change is one line and obviously right. This is an
analysis.
