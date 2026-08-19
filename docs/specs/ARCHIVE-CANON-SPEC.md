# The Canon — an acquisition contract

**Status:** adopted 2026-08-18
**Supersedes:** the open-ended cleansing campaign, not the cleansing record
**Companion:** `ARCHIVE-CLEANSING-SPEC.md`, which is now the regression suite

---

## 1. Why the campaign stopped

The Archive held 88 works and 15.9 million words, every one of them inherited
from a transcription project that optimises for availability. Cleansing found
defects at every structural layer at once: wrong text inside a work, running
heads, apparatus, front matter fused into divisions, malformed division
schemes, destroyed verse lineation, modernised editions presented as authorial,
image filenames in prose, replacement characters, bibliographies mistaken for
divisions, and identity true at the work level while false at the division
level.

Each of those was found by inventing a new detector. That is the trap:

> **Zero known defects is not known clean text.**

The registry can only find what a signature already describes, and §3g of the
cleansing spec records the first defect class it structurally cannot hold. So
"every detector reports zero" is a stopping condition that gets weaker the more
we learn, which is precisely backwards for a release.

**60 of 88 works currently pass every detector we own.** That number is not a
certification. It is the absence of evidence from an instrument we know to be
incomplete.

## 2. The shift

The cheapest corruption is the one never imported.

```
    OLD                             NEW
    acquire                         select work
      ↓                               ↓
    ingest                          compare candidate editions
      ↓                               ↓
    discover garbage                choose the edition, and say why
      ↓                               ↓
    invent detector                 ingest PRESERVING its structure
      ↓                               ↓
    clean                           certify against a reference, end to end
      ↓                               ↓
    discover different garbage      CANON
```

The old loop treated the Archive as a corpus to be rehabilitated. The new one
treats it as a collection to be curated. RISE does not win on catalogue size —
Gutenberg has that, and Standard Ebooks has a growing high-quality library.
RISE's value is what happens to the act of reading after a work enters it.

**The Library is deliberately small. Each edition is individually prepared and
verified for the reading system.** That is a curatorial position, not an
apology.

## 3. What certification requires

A work is CANONICAL only when all of the following hold. Nothing is certified
by the absence of detector output alone.

1. **A chosen edition, with the choice recorded.** Which edition, why that one
   over the alternatives considered, and what kind of edition it is —
   *diplomatic* (the author's own orthography preserved) or *editorial*
   (modernised). A work whose orthography carries meaning may not take an
   editorial edition.
2. **Structure preserved at ingest.** Divisions, headings, paragraphs, verse
   lines, stanzas, speakers and figures come from the SOURCE. Nothing is
   flattened and then reconstructed by heuristic.
3. **Compared end to end against a reference.** Structural comparison, then
   token comparison: missing spans, added furniture, suspicious tokens,
   edition differences — each classified.
4. **Every difference dispositioned by a human.** See §5.
5. **Every detector in the cleansing registry reports zero.** Necessary, never
   sufficient.

## 4. Structure is the thing that was lost

Blake is the proof, and the whole causal chain sits in one work:

```
  SOURCE (Gutenberg #1934)        AFTER OUR INGEST
    THE TIGER                       one 117-character line
    Tiger, tiger, burning bright        ↓
    In the forests of the night,    no line-shaped headings
    ...                                 ↓
                                    no division scheme detectable
                                        ↓
                                    47 poems unreachable
                                        ↓
                                    "The Tyger" cannot be named
```

One flattening step at ingest caused four downstream failures, and we built
detectors for each of them. The source was never at fault; the cached artifact
still on disk shows the quatrains four lines to a stanza.

**So an ingest may not destroy a distinction the source made.** If an edition
gives structured markup — chapters, verse, blockquotes, headings, figures —
that knowledge is preserved, not thrown away and guessed at later. RISE is not
a forensic typesetting laboratory.

## 5. The reviewer flags; the reviewer does not rewrite

Carried unchanged from the cleansing spec, and it governs any model used in
certification.

```
  SOURCE A: the candidate RISE text
  SOURCE B: the reference edition
        ↓
  structural comparison · token comparison · classification
        ↓
  REPORT
        ↓
  human or rule-based disposition
```

Never `looks dirty, I'll fix it`. **A silently corrected edition ceases to be
the edition its provenance record claims it is**, and provenance is the only
thing that distinguishes a canonical work from a pile of plausible words.

## 6. Sourcing — per work, never per provider

No single host can serve this archive. Each was checked rather than assumed.

| source | fidelity | structure | coverage | verdict |
|---|---|---|---|---|
| **Standard Ebooks** | proofread against page scans; CC0; git | semantic XHTML | 1,398 works, Western literature | good for Western prose; **editorial** |
| **Wikisource** | per-page status; *Validated* = two proofreaders, scan attached | wikitext, uneven | broad, patchy | the only **machine-readable** fidelity signal |
| **Perseus** | scholarly | TEI | classics | strong for the classical shelf |
| **Blake Archive / Folger** | diplomatic | TEI | one author each | where orthography carries meaning |
| **Project Gutenberg** | none stated | flat text | vast | fallback only, and the reason for this document |

Two facts that decide the strategy:

- Standard Ebooks' manual: *"archaic capitalizations are removed, unless doing
  so would change the meaning of the work."* That is an editorial hand. It is
  the same class of act that gave us `Tiger, tiger` for Blake's `Tyger Tyger`.
- Standard Ebooks has **no Bhagavad Gita, Dhammapada, Upanishads, Rumi,
  Kalevala or Shahnama.** Its catalogue is Western literature. It cannot serve
  the sacred and eastern shelves at all.

### DECIDED 2026-08-18: Standard Ebooks only

RISE serves Standard Ebooks editions and its own compositions. Nothing else.

The reasoning is the one this whole document is about. A structured edition
declares its parts, its stanzas and its verse lines, so an importer READS them;
everything else must be inferred, and inference is what deleted 303 words of
Walden and 11,359 of Leaves of Grass. One clean upstream is worth more than a
larger catalogue we cannot vouch for.

The cost is stated rather than hidden. Four works leave the canon because no
Standard Ebooks edition exists: **Storm of Steel** (Jünger died in 1998),
**the Dhammapada**, **Montaigne's Essays**, and **the Oedipus Trilogy** — the
last only in that packaging, since Sophocles is published there as separate
plays and *Oedipus Rex* is canonical in its place.

**Both lost fixtures were then restored from within the rule.** Montaigne was
the only test of a short complete PROSE argument and the Dhammapada the only
test of a numbered verse inside a chapter, so the canon took **Emerson's
Essays** (21 complete arguments) and **the Analects** (499 addressable
sayings, each its own `z3998:subchapter`) in their places. Lyrical Ballads
came with them for the lyric and the ballad. The rule cost the canon nothing
it could not replace from the same upstream.

A DIFFERENT EDITION IS A DIFFERENT WORK, and an authored score knows it. The
war Journey quotes Homer and Milton exactly, so re-sourcing them made every
quotation anchor refuse — correctly. The Journeys are on ice rather than
re-anchored in haste: re-authoring a score against a new translation is an
editorial act, not a repair, and Journeys will not be ready for release
regardless. Their scores stay in the tree with their tests, reachable by
neither a reader nor the Scriptorium.

---

So "Standard Ebooks first" was a Western-prose strategy. The rule above accepts
that boundary deliberately, and the canon is what that upstream can supply.

## 7. The canon

Fifteen works, chosen so that each is also an ACCEPTANCE FIXTURE for a
textual form the reading system must handle. A canon of favourites would prove
nothing; a canon of forms proves the instrument.

Fifteen works, all from Standard Ebooks, all read rather than inferred.

| form the system must handle | work |
|---|---|
| long prose novel — chapters, continuation, Page | Middlemarch |
| long novel in translation | The Brothers Karamazov |
| short philosophical work — Keystone, phrase reading | Meditations |
| aphoristic / verse-prose scripture | Tao Te Ching |
| epic in books | The Iliad |
| structured verse epic — cantos, three canticles | The Divine Comedy |
| classical narrative verse | Metamorphoses |
| poetry collection — lineation, stanzas, many short works | Songs of Innocence and of Experience |
| drama — speakers, scenes | The Oedipus Trilogy |
| scriptural verse — division semantics | The Dhammapada |
| essay — short complete sessions | Essays (Montaigne) |
| natural prose | Walden |
| unusually structured | Ulysses |
| English blank-verse epic | Paradise Lost |
| modern memoir, titled divisions | Storm of Steel |

**The canon is closed under Journey dependencies.** An authored Journey names
its sources, so withholding one breaks it. The war Journey reads Milton, Homer
and Jünger against each other and cannot be assembled from two of the three —
Paradise Lost and Storm of Steel are canonical because a shipped Journey is a
promise about works, and the test suite said so before a reader could.

## 8. Everything else is withheld, and says why

Not deleted. Withheld: absent from the Library, payload retained on disk, git
keeping the decision reversible.

The mechanism already exists and is already guarded — `WITHHELD_WORKS` in
`src/content/archive/index.js`, with a test requiring **every withholding to
state a reason**. What it forbids is precisely a payload that is off the shelf
and nobody said why.

A withheld work is a candidate for a future edition of the canon, not a
failure. Its defects, where known, are named in its reason.

## 9. What the campaign bought

The cleansing work is not discarded with the payloads. It produced the
acquisition contract, and each grotesque taught a clause:

| the work | what it taught |
|---|---|
| the Mahabharata | an artifact id cannot establish textual identity |
| running heads | printed-page furniture masquerades as structure |
| Don Quixote | scanner affordances distribute through a legitimate book |
| Anna Karenina | a real division can have junk welded to its head |
| Blake | corruption can be structural rather than lexical |
| the Corpus Hermeticum | intact text can carry a bogus reader-facing scheme |
| the Shahnama | a scheme found late is a broken scheme, not a long preamble |
| The Custom-House | a label is not evidence |

Every one of those is now an import gate. **The registry stops being a cleaning
tool and becomes the acquisition regression suite** — the question every future
candidate is asked before it is allowed in.

We used a hostile corpus to discover the specification for a trustworthy
archive. That was worth doing. It does not oblige us to rehabilitate the
hostile corpus.

## 10. Growth

After release, an Archive Edition adds five newly certified works, then
another five. Corpus expansion becomes visible and curatorial rather than
invisible janitorial labour.
