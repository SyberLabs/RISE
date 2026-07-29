# The Library — a world-class housing of public-domain texts

*Written 2026-07-28. Implements North Star §5.2 (named journeys, editorial
voice) at the surface where R.I.S.E. holds its texts. Draws its organizing
principles from `oraculararchive.txt` and the Neorenaissance corpus.*

---

## 0. What is wrong now

The Library has four faults, and only the last is about quantity.

1. **It is organized by FORMAT, not by idea.** "Literary", "Research",
   "Sacred Texts" describe what a file *is*, not what a reader *wants*.
   A person does not arrive thinking "I would like some literary content."
2. **It leads with the wrong thing.** Sacred Texts lands first, which
   presents the whole system as a wisdom-quote app — the "woo" register
   the software has outgrown.
3. **It carries material that contradicts its own seriousness.**
   `Declassified · Released intelligence documents 👁️` holds four short
   excerpts (~5K chars total): Gateway Process, Project Stargate, Soviet
   Psychotronics, Holographic Matrices. This is the single clearest
   instance of the register problem, and retiring it costs nothing.
4. **It is thin.** 8 literary excerpts (~16.5K chars) and 6 wisdom texts.
   A "world-class housing of public-domain texts" is not 25K characters.

---

## 1. The organizing principle

From the Archive: **organize by resonance, not genre.**

A work earns its place by what it *does* to a reader, not by which shelf
a bookshop would file it on. The Archive names four functions:

- **induce state** — shift consciousness through encounter
- **install pattern** — leave structural residue in the mind
- **generate connection** — rhyme with other works in the corpus
- **serve recursion** — reward repeated engagement

This is already how the rest of R.I.S.E. thinks. The Chapel does not
offer "religious content"; it offers the Passion beside the paintings
that depict it. The Library should be no different.

### The register, stated plainly

The Library is the reading face of a Renaissance philosophy of
education — the conviction that intelligence and meaning are not in
tension. In the Neorenaissance corpus this is the claim that symbolic
depth is *load-bearing infrastructure*, not ornament, and that a
civilization which lets it erode suffers the "deathless death": systems
that keep running while the reason for running quietly departs.

**That conviction shapes the shelving; it is never printed on it.**
(Decision, 2026-07-28.) The tract's own argument is that meaning must be
*structural rather than decorative* — a library that announced its
philosophy in a banner would be doing the opposite of what it claims.
A visitor should meet a corpus with evident conviction behind it and be
able to infer the conviction from the curation alone.

No manifesto page. No named framework. No author byline.

---

## 2. The shelves

Four collections, replacing the five format categories.

**Names are plain; the editorial line beneath carries the voice.**
(Decision, 2026-07-28.) A shelf a visitor cannot predict is a shelf they
will not open — obliquity at the door costs more than it earns. The
atmosphere belongs in the orienting line, where it does work, not in the
label, where it only obscures.

### FORM — how things are made, and how they hold together
Structure, proportion, the grammar of things. Klee's *Pedagogical
Sketchbook*, Kandinsky's *Point and Line to Plane*, Euclid, Vitruvius,
the harmonic traditions. *Induces:* the sense that structure is legible.

### THE INTERIOR — the self, and the keeping of it
Marcus Aurelius, Epictetus, Seneca, Montaigne, Pascal, Thoreau, Emerson,
Rilke. The inner fortress and the practices that maintain it.
*Induces:* self-possession. Most of the current Literary corpus is
already here.

### THE LIMIT — where knowing runs out
The Upanishads, Tao Te Ching, the Heart Sutra, Meister Eckhart, the
Hermetica, Boethius, Plotinus, Blake, Dickinson. Where language ends.
*Induces:* the recognition that the map stops.

### THE RECURRENCE — what keeps returning, across cultures that never met
Plato's Timaeus and Critias, Hesiod, the mythographers, Bruno, Kepler's
*Harmonices Mundi*, Vico. *Induces:* the sense of something transmitted
across the silence.

**Open question for scale:** at four shelves, Euclid and Kepler are
ambiguous between FORM and THE RECURRENCE. These are a first cut, not
the whole taxonomy; finer structure within a shelf may be needed once
the corpus is large. Do not treat the four as final.

**Retired:** *Declassified* (register), *Research* (an ArXiv abstract
feed is a different product; live abstracts are not a corpus and cannot
be curated).

**Not a shelf:** the Chapel keeps its own door. Scripture is not filed
beside Nietzsche. That separation is already load-bearing and stays.

---

## 3. What a reader meets

### The door
Not a category grid. A short editorial statement — three or four
sentences with a point of view — and then the shelves, each with its
own line of orientation. The Archive's own voice is the model: dense,
declarative, unhedged.

### A work's entry
The current registry stores `title`, `author`, `description`, `tags`. It
should also carry:

- **why it is here** — one or two sentences of editorial judgement, in
  the Archive's voice. Not a blurb. Not a Wikipedia summary.
- **its function** — which of the four resonance functions it serves.
- **its rhymes** — other works in the corpus it speaks to. This is what
  turns a list into an archive; it is also what makes "generate
  connection" real rather than asserted.
- **its provenance** — translator, edition, year, and the public-domain
  basis. A world-class housing is honest about what edition you are
  reading and why we may show it.

### The reading record
An archive that does not remember is a catalogue. The Library should
know what a reader has read and let them return to it. Local-only, no
account. This is the Archive's "recursion" made literal.

---

## 4. Rights — the invariant

**Every text is public domain, and the basis is recorded per work.**
This is the textual analogue of curation-only for imagery, and it is
non-negotiable for the same reason: the system would rather show nothing
than show something it has no right to.

The Archive's Books tiers name many works still in copyright — Calvino,
Borges, Flusser, Michaux. **They inform the taste and cannot be
ingested.** Where a work is unavailable, the shelf is honestly shorter.
A reader is never shown a text we cannot justify holding.

Per work, record: source (Gutenberg id, Archive.org id, or an ingest
script), translator and edition, year of publication, and the
public-domain basis (pre-1930 US publication, author death + 70, US
government work, or an explicit CC0/PD dedication). Translations have
their own copyright — a 2003 translation of Marcus Aurelius is *not*
public domain even though Marcus Aurelius is. The existing corpus
already gets this right (George Long, 1862) and the pattern should be
enforced rather than assumed.

---

## 5. Scope of this stint (decided 2026-07-28)

**Architecture first. Ingest is its own stint.**

In scope:
1. The four shelves, replacing the five format categories.
2. Retire Declassified and Research.
3. Editorial voice: the door statement, per-work "why it is here".
4. The work entry: function, rhymes, provenance fields.
5. The reading record.
6. Re-file the existing corpus onto the new shelves.

### Built 2026-07-28

All six items landed. Notes on what the work turned up:

**A fifth shelf was necessary.** The 19 starter sequences are R.I.S.E.'s
own compositions, not found works — several already carry the framework
explicitly ("Neohumanist core", "Neohumanist identity"). Filing them
among inherited texts would break the Archive's central promise, so they
sit under COMPOSED: *written for this system, in its own voice*. A reader
should always know whether they are meeting a received text or one
written here.

**FORM is empty, and stays empty.** We hold no Euclid, Vitruvius, or
Kandinsky. The shelf is honest about that rather than padded with
near-misses; the ingest stint fills it.

**Four texts were retired for copyright.** Starter sequences reproduced
verbatim in-copyright translations: Calvino's *Cosmicomics* (Weaver,
Harcourt 1968), Borges' *The Aleph* (di Giovanni 1970 / Hurley 1999),
Flusser's *Technical Images* (Roth, Minnesota 2011), and Klee's
*Pedagogical Sketchbook*.

The Klee case is worth recording because the answer was not guessable.
Klee died in 1940, the German original is 1925, and **93% of 1953 US
books lapsed for non-renewal** — the prior strongly favoured public
domain. But the Stanford renewal database holds **RE090004**, filed
26 Jan 1981 against registration A78572 (published 12 Jan 1953), claimant
Hattula Moholy-Nagy Hug, whose new matter is explicitly *"introduction &
translation & concluding notes."* Renewed in the final eligible year. The
German source may well be public domain; **this English text is not.**

The lesson for the ingest stint: publication date never settles a
pre-1964 US work. The renewal record does, and it must be checked per
edition.

Out of scope, next stint: bringing public-domain texts in at volume
(Gutenberg / Archive.org ingest, rights verification, chunk formatting).
The shelving must exist before it is worth filling, and the fields
defined here are what the ingest will populate.

---

## 6. Constraints inherited

- **Chapel separation holds.** The Library never absorbs scripture.
- **The three-layer law.** A work's shelf and rhymes are CONTENT; the
  runtime follows. Curation never teaches the cortex about pericopes.
- **Reverent degradation.** A text that will not load is absent, not a
  broken entry — and per §4 absence is now observable to the maintainer.
- **Public domain only**, basis recorded per work (§4).
- **Authored boundaries are sacred.** Ingested texts must not acquire
  `|` phrase markers automatically; see PHRASE-CHUNKING-STUDY.md §4 —
  the runtime cannot yet tell an authored boundary from a derived one,
  and a bulk ingest that guessed would poison that distinction before
  it is built.


---

## 8. The ingest stint (2026-07-28)

Sixteen works ingested from SOL's acquisitions dossier; 53 texts across
five shelves. **Form went from 0 to 6.**

| shelf | texts | ingested |
|---|---:|---:|
| Form | 6 | 6 |
| The Interior | 10 | 3 |
| The Limit | 11 | 3 |
| The Recurrence | 8 | 4 |
| Composed | 19 | — |

Machinery: `scripts/archive-ingest.mjs`. A work declares its edition,
rights, source, and what its headings look like; shared code does the
rest. Every generated module carries the SHA-256 of the artifact **as
fetched** alongside the payload checksum — the first says this is the
file the world served us, the second says this is what we made of it.

### What the work taught

**Check the END of a text, not only the beginning.** This caught six
defects that a first-lines check would have missed entirely: Vitruvius
ending on his editor's essay, Boethius running into Gutenberg's licence
and then into the translator's citation list, Dow closing on "THE END",
Ross on a printer's colophon and a paragraph index, Rasmussen on a list
of tellers and page numbers.

**Losing the first section is the quietest failure.** Parker and
Beckwith both lost tale 1 to a contents-skip neither edition needed. A
collection that begins at its second story reads perfectly well and is
simply wrong.

**Structure is per-edition, not per-work.** Five Gutenberg files state
the same three things five different ways. Counting headings to find the
body failed on Dow (six in contents, eight in the body); a contents
block is contiguous and body headings are far apart, so DISTANCE is the
signal. Boethius defeated the shared helper entirely and got an explicit
parser rather than another option on the general one.

**The reading unit is an editorial decision.** Montaigne parsed into
three books of ~940,000 characters each — sixty hours a section, which
is a file rather than a reading. He is read one essay at a time; 102 of
them.

**Lazy loading is not optional at this scale.** Six works statically
imported took the content bundle to 1.63 MB. Metadata is now eager and
text is lazy: the eager bundle is ~116 kB with sixteen works, and
Montaigne alone is a 2.8 MB chunk nobody downloads unless they open him.

### Deferred, honestly

- **Westervelt's Hawaiian legends** — the plain-text edition has no
  machine-detectable chapter structure. Guessing would produce sections
  that are not the work's own divisions.
- **The Upanishads and Hermetica** remain withheld. Both need rebuilding
  from Müller and Mead alone, and no clean Gutenberg edition of either
  translation was found.
- **The Heart Sutra and Gospel of Thomas** cannot be cleared at all:
  Conze and Lambdin are modern, and the Nag Hammadi codices were
  unearthed in 1945.
- **Marcus Aurelius (Selected)** is withheld as a duplicate, awaiting a
  reading-route feature the Archive does not yet have.
- Twenty-seven of SOL's 43 cleared editions remain un-ingested, including
  the four requiring Internet Archive scans (Euclid, Alberti, Helmholtz,
  Owen Jones) and the image-dependent works SOL placed last.
