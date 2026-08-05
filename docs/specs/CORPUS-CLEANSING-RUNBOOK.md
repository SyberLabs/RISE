# Corpus cleansing — the runbook

**What this is:** the operational steps, in order, from where the shelf is today
to a corpus that is clean. `ARCHIVE-CLEANSING-SPEC` says *what* and *why*; this
says *what to type*.

**Why it exists:** the pieces were built in the order they were discovered
rather than the order they run in, and the loop had no end — batches could be
generated and validated and then nothing could happen to them. It closes now.

---

## The one idea

Every defect falls into one of two paths, and **which path it takes is decided
by evidence, never by preference.**

```
                      is it PROVABLE from position alone?
                                     │
              ┌──────────────yes─────┴──────no──────────────┐
              ▼                                             ▼
   PATH A — the script decides              PATH B — a reader decides
   corpus-cleanse.mjs --apply               jobs → reviewer → validate → apply
   no model, no cost, deterministic         one model call per passage
```

Path A is finished for every class that has one. **Path B is the remaining
work, and it is 1,551 passages.**

---

## Where the shelf stands today

Run this any time to see it:

```bash
node scripts/corpus-review-jobs.mjs --out /tmp/queue.json | tail -5
```

| | count |
|---|---|
| removed by proof (path A) | 393 |
| foreign divisions withdrawn | 8 (403,208 words) |
| surveyed and judged *not* defects | ~14,000 |
| **open, needing path B** | **1,551** |

Two thirds of that queue is one work: **the Shahnama, 1,055.**

---

## PATH A — the deterministic pass

Already run, and it is **idempotent**: running it again finds nothing, which is
how you check it is still clean.

```bash
node scripts/corpus-cleanse.mjs            # report; expect 0 removals
node scripts/corpus-cleanse.mjs --apply    # only if it finds something
```

It removes two classes and refuses everything else:

- **running heads with positional proof** — the clause before did not end, the
  word after continues in lower case (`§2b`);
- **bare `[Illustration]` markers** — a plate this edition does not have (`§2c`).

Every span is checked against the furniture pattern before it is written, and a
work with one bad span is skipped whole.

---

## PATH B — the reviewed pass, step by step

This is the part that was unclear. Five steps, and step 3 is the only one that
costs anything.

### Step 1 — build a batch

```bash
node scripts/corpus-review-jobs.mjs --work the-shahnama --out shahnama.json
```

Writes two files:

- `shahnama.json` — the jobs, plus ~10% hidden controls, shuffled
- `shahnama.key.json` — **the answer key. This never leaves your machine.**

Start with one work. `--limit 50` if you want a smaller first run.

### Step 2 — understand what a job is

One job is one passage. It looks like this, and it is the **entire user
message** you send:

```json
{
  "workId": "the-shahnama-of-firdausi",
  "edition": "…",
  "locator": { "division": "Volume 2", "charStart": 18432, "charEnd": 18447, "rejoin": " " },
  "before": "…the sentence before…",
  "passage": "KAI KHUSRAU 214",
  "after": "…the sentence after…",
  "suspicion": "running-head"
}
```

### Step 3 — run the reviewer

**The three rules, and the first two have already been broken once each:**

1. **`CORPUS-REVIEWER-PROMPT.md` §2 goes in the SYSTEM slot.** One job object is
   the whole user message. Nothing else — not the batch, not the spec.
2. **No tools. No file access. No repository.** A reviewer that can read the
   repo reads the answer key and the worked examples, which is the exact priming
   the prompt is built to avoid.
3. **Fresh context per job.** No conversation. Temperature 0.

Collect the replies into a JSON array — `verdicts.json`.

### Step 4 — check the batch before believing it

```bash
node scripts/corpus-review-verdicts.mjs verdicts.json --key shahnama.key.json
```

It validates the schema, enforces the disposition rules as a check rather than
a hope, scores the hidden controls, and flags notes that describe an *action*
rather than an identity — the signature of a reviewer that has started editing.

**A batch fails whole.** If a control comes back wrong, discard the batch and
re-run it cold. Do not correct it: a reviewer that missed a known answer has
said nothing reliable about the unknown ones.

It applies nothing.

### Step 5 — apply

```bash
node scripts/corpus-review-apply.mjs shahnama.json verdicts.json          # report
node scripts/corpus-review-apply.mjs shahnama.json verdicts.json --apply  # write
```

It re-runs the validator itself and refuses to start if the batch does not pass.
Then, for every `trim`, it checks that **what is at that offset now is what the
job said was there** — payloads move when other passes run, and a stale offset
applied blind deletes prose. A work with one mismatch is skipped whole and tells
you to rebuild the jobs.

Every removal lands in `cleanse-log.json`.

### Step 6 — verify and commit

```bash
node scripts/corpus-cleanse.mjs                 # expect: 0 removals
node scripts/build-division-index.mjs           # counts changed
npm run test:run                                # the guards must stay green
git diff --stat -- src/content/archive/works/   # read it before committing
```

---

## The order to work in

1. **The Shahnama** — 1,055 of 1,551. One work is 68% of the queue, and its
   heads (`KAI KHUSRAU`×220, `GUSHTASP`×124) are Persian royal names used as
   running heads, which is the least ambiguous material in the corpus. Do a
   `--limit 50` batch first and read the verdicts yourself before scaling.
2. **The Corpus Hermeticum** — the next largest.
3. **Everything else** — 14 works, small batches, one run.

---

## Who the reviewer is

The prompt targets a cheap model **for cost, not for correctness**. The
judgement is easy; there is simply a lot of it. For a batch of twenty you can
read them yourself, or have a capable model read them — the contract is the
same either way, and `corpus-review-verdicts.mjs` does not care who answered.

Storm of Steel's fourteen were reviewed by reading them, and the evidence was
decisive in a way worth reusing: **each stem was exactly the name of the
division it sat inside** (`LANGEMARCK` inside the division `LANGEMARCK`), the
numbers ascended across occurrences (99→103→107, 163→185, 245→277), and every
one stood mid-narrative between two finished sentences. A chapter title appears
*once*, at the head of its division. Eleven appearances through the middle with
rising numbers is a page header.

That test — *does the stem equal the division's own name?* — is worth applying
to every batch before spending a model call on it.

## The residue, and why it is left

Storm of Steel now reports **zero** candidates, and two running heads remain in
it:

```
…were to counter-attack at 168 LANGEMARCK 10.30, and that the 2nd Company…
…disappeared in shell-holes, as LANGEMARCK 18g I could make out…
```

The first puts the numeral **before** the stem; the second is `189` with the 9
read as a `g`. Neither matches a detector built on *name-then-number*, and
loosening it to catch them would admit far more than it caught.

**Two in one work is the right amount to leave.** The rule that finds 150 and
misses 2 is better than the rule that finds 152 and takes a word of Jünger with
them. They are recorded here so the next person knows they are known, not
missed.

## What is NOT yet built, stated plainly

So the runbook is not mistaken for completeness:

- **Apparatus, marginalia, imprint fragments and OCR corruption have no
  detector.** Four of the ten classes in `§2` are untouched. Hamlet was caught
  by hand and withheld; nothing has swept for its siblings.
- **The orphaned-bracket detector is wrong** and known to be — it balances
  brackets per LINE, and a stage direction spans lines, so 7,223 of its 7,223
  findings are false (`§2c`).
- **`[Greek: taxis]` has no disposition.** Deleting it loses the Greek term;
  rewriting it is forbidden. It is a rendering problem for the Page.
- **Re-sourcing the Mahābhārata's true volumes 5–9** is an acquisition, not a
  cleanse, and nothing here does it.

---

## If something goes wrong

Everything is in git and every payload change is a commit of its own. There is
no state outside the repository.

```bash
git diff -- src/content/archive/works/   # what changed
git checkout HEAD -- src/content/archive/works/   # undo it all
```

`cleanse-log.json` is the record of what was removed and why. If it and the
payloads ever disagree, the payloads are wrong — rebuild from the log.
