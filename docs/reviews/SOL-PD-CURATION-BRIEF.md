# Brief for SOL — Purveyor and Curator of Public-Domain Texts

*Issued 2026-07-28 for the R.I.S.E. Archive ingest stint.*

---

## Your role

You are acting as the Archive's **acquisitions curator**: the person who
decides what a library should hold, finds the best edition of it, and
proves we may lawfully show it.

This is not a list-generation task. A list of famous public-domain books
is worth very little — anyone can produce one, and most of what it names
we would not want. What is scarce, and what we are asking you for, is
**editorial judgement backed by verified rights**, delivered per work
with the evidence attached.

Assume a demanding reader. Assume we would rather hold forty works we can
defend than four hundred we cannot.

---

## What R.I.S.E. is, briefly

An audiovisual reading environment. Text is presented either as a paced
stream (RSVP, one phrase at a time) or typeset spatially as a page, with
imagery drawn from museum collections placed beside the passage it
belongs to. It is built on a Renaissance conviction that intelligence and
meaning are not in tension — that reading done with beauty and attention
is how a person is formed.

Two consequences for you:

1. **Texts are read aloud in the mind, slowly.** Prose that is merely
   informative reads poorly here. Prose with rhythm, compression, and
   authority reads well. Aphorism, dialogue, verse, and the essay in its
   older sense all work; textbook exposition does not.
2. **We hold works, not information.** The system recently retired an
   entire family of keyword-searched imagery on the grounds that a search
   result is not a curated work. The same standard governs text.

---

## The shelves you are filling

Five, organized by **what a work does to a reader** rather than by genre.

| shelf | holds | now |
|---|---|---:|
| **Form** | how things are made, and how they hold together — structure, proportion, the grammar of things | **0** |
| **The Interior** | the self, and the keeping of it | 7 |
| **The Limit** | where knowing runs out | 11 |
| **The Recurrence** | what keeps returning, across cultures that never met | 5 |
| **Composed** | written for this system, in its own voice — *not yours to fill* | 19 |

**Form is empty and is your first priority.** We hold no Euclid, no
Vitruvius, no Kandinsky, no treatise on proportion or harmony. The shelf
is honestly empty rather than padded, and it is the clearest gap.

The other three are thin rather than empty: 23 inherited works totalling
**42,000 characters**, averaging **1,844 characters each**. These are
excerpts, not books. Part of your task is to say where an excerpt should
become a substantial reading.

---

## What we already hold

So you do not duplicate, and so you can see the register.

**The Interior** — Marcus Aurelius *Meditations* (Long, 1862), Thoreau
*Walden*, Emerson *Essays*, Rilke *Letters to a Young Poet* (Norton,
1929), Bhagavad Gita (Arnold, 1885), Yoga Sutras (Johnston, 1912).

**The Limit** — Tao Te Ching (Legge, 1891), Upanishads (Müller, 1884),
Dhammapada (Müller, 1881), Heart Sutra, Gospel of Thomas, Zen koans,
Rumi (Nicholson, 1926), Blake *Songs*, Dickinson, Whitman *Leaves of
Grass*, Nietzsche *Zarathustra* (Common, 1909).

**The Recurrence** — Hermetica and Corpus Hermeticum (Mead, 1906),
Emerald Tablet (Newton), I Ching (Legge, 1882), a Toltec text of
contested transmission.

Note two defects you may as well fix in passing: **Marcus Aurelius is
duplicated** (a full text and a selection, same translation), and several
entries record `translator: 'Traditional'`, which is not a real
provenance and needs resolving to a named edition or retiring.

**Scripture is not your remit.** The Chapel holds the Douay-Rheims Bible
behind its own door, and that separation is deliberate. Do not propose
biblical texts for the Library.

---

## The rights standard — the part that matters most

**Every text must be public domain in the United States, and you must
show your work.** This is a hard invariant, not a preference. The system
would rather hold nothing than hold what it cannot justify.

### The rule that catches people

**A translation carries its own copyright.** Marcus Aurelius died in 180;
a 2003 translation of him is under copyright until 2098. The public
domain status you are establishing is that of **the specific edition**,
never of the author.

### The rule that caught us

For a US work published **1929–1963**, publication date does not settle
anything. Under the 1909 Act, copyright ran 28 years and had to be
**renewed** in the 28th year. About 93% of 1953 books were never renewed
and are public domain. The remaining 7% are protected for 95 years.

We assumed Klee's *Pedagogical Sketchbook* (German original 1925, author
died 1940) was safe. It was not: the Sibyl Moholy-Nagy translation of
1953 was renewed as **RE090004** on 26 January 1981, and the renewal
record explicitly covers *"introduction & translation & concluding
notes."* Four texts had to be removed from the shipping product.

So: **for any edition published 1929–1963, check the renewal record and
cite it.** The Stanford Copyright Renewal Database is authoritative and
machine-queryable:

```
https://exhibits.stanford.edu/copyrightrenewals/catalog.json?q=<title>&search_field=search
```

A null result there is meaningful evidence of non-renewal; a hit like
RE090004 is disqualifying. Also useful: the Catalog of Copyright Entries
scans at `onlinebooks.library.upenn.edu/cce/`.

**Read the hits, do not count them.** Querying that database for
`meditations marcus aurelius` returns three renewals. None of them
disqualifies the Long translation we hold:

- `R96424` — an edition *"edited, with an introd., by Lloyd E. Smith"*;
  the renewal covers Smith's apparatus, not Long's 1862 text
- `RE238031` — Russell Kirk, a different work entirely
- `RE229958` — no author recorded

A renewal attaches to **specific new matter in a specific edition**. Three
hits on a title is not evidence of anything until you read what each one
claims. Conversely, RE090004 was disqualifying precisely because its new
matter named the translation itself. Cite the record, quote what it
covers, and say why it does or does not bind the edition you propose.

### Acceptable bases

- `pre-1930-us` — published in the US before 1930. Safe without further
  checking.
- `author-death-70` — author **and translator** both died 70+ years ago.
  Name both.
- `us-government-work`
- `cc0-or-pd-dedication` — an explicit dedication, linked.

If a work's status is uncertain, **say so and exclude it.** An honest
"cannot establish" is a useful finding. A confident guess is not.

---

## What to deliver, per work

```
title:        Meditations
author:       Marcus Aurelius
shelf:        interior
edition:      trans. George Long, 1862
source:       Gutenberg #2680  (or Archive.org id, or a URL)
basis:        author-death-70   (Long d. 1879 — 147 years)
evidence:     Published 1862, so pre-1929 and outside the renewal regime
              entirely. Stanford returns 3 renewals on this title
              (R96424, RE238031, RE229958); none binds Long's text —
              R96424 covers Lloyd E. Smith's introduction to a later
              edition, the others are unrelated.
why:          <1–2 sentences of editorial judgement, in the Archive's
               voice. Not a blurb. Not a plot summary. Why a reader
               should give this an hour.>
functions:    induce-state | install-pattern | generate-connection |
              serve-recursion   (one or more)
rhymes:       <ids or titles of other works here it speaks to>
extent:       <full text? a named selection? if a selection, which
               passages and why those>
caveats:      <anything a reader should know — contested transmission,
               a dated translation, an abridgement>
```

The `why` field is the one we care most about and the one most likely to
come back weak. Compare:

> ✗ "A classic work of Stoic philosophy by the Roman emperor Marcus
>   Aurelius, offering timeless wisdom on virtue and self-control."

> ✓ "A Roman emperor writing to no one but himself, in Greek, at the edge
>   of a war he did not expect to survive. The private register is the
>   point: this is what a mind does when it is not performing."

The second says something true that a reader could not have guessed. The
first is jacket copy. Write the second.

---

## Editions: prefer the readable over the recent

Because translations must be old enough to be free, you will often be
choosing among Victorian and Edwardian translations. These vary enormously
in quality and some are close to unreadable now. **Where several
public-domain translations exist, say which you recommend and why** — this
is exactly the judgement we cannot get from a list.

Where the only good translation is under copyright, **say that plainly and
recommend against ingesting.** A shelf that is honestly shorter is better
than a shelf padded with a bad edition. We would rather hold no Kandinsky
than hold a poor one.

---

## Priorities

1. **Form, from zero.** Structure, proportion, the grammar of made
   things. Euclid, Vitruvius, treatises on harmony and perspective,
   Alberti, Dürer's *Underweysung der Messung* if a PD English edition
   exists. This shelf should be the best-argued part of your report.

   A worked example of the gap you must close: Gutenberg **#20239** is
   *The Ten Books on Architecture* by Vitruvius, marked "Public domain in
   the USA" — but **the landing page does not name the translator.** That
   is not sufficient for a dossier. Vitruvius died around 15 BC; the
   *translator* is the copyright-bearing party. Opening the text itself
   settles it — the title page reads *"TRANSLATED BY MORRIS HICKY MORGAN,
   PH.D., LL.D."*, Harvard University Press, **1914**, which is pre-1930
   and clear. That took one fetch, and it is the difference between a
   dossier and a guess. "Gutenberg says public domain" is where your work
   starts, not where it ends.
2. **Depth over breadth in The Interior and The Limit.** Where we hold
   1,800 characters of something that deserves 50,000, say so.
3. **The Recurrence needs non-European material.** It currently claims
   "across cultures that never met" while holding four Hermetic texts and
   an I Ching. That is close to false advertising.
4. **New shelves, if the corpus demands one.** Four was a first cut, and
   we said explicitly it was not final. If forty good works do not fit,
   propose the shelf they need.

---

## Scale

Aim for **40–80 works** with full dossiers. Fewer, if that is what
survives your own standard — we would rather have thirty defensible
entries than eighty with soft rights.

Flag separately any work you badly want but cannot clear. That list is
useful: it tells us what the Archive is missing and why.

---

## What we will do with this

Each cleared work becomes an ingest: text pulled from the named source,
formatted, checksummed, and registered with its provenance visible to the
reader. Our existing ingest script (`scripts/chapel-ingest.mjs`) is the
standard — it names its source edition, records every editorial decision
in a header comment, and treats the checksum as the integrity contract.

Your dossier is what makes that possible. **The `basis` and `evidence`
fields are load-bearing**: they go into the code and into a test that
fails if a work carries no valid basis.

---

## One caution

Do not optimise for volume. The failure mode we most want to avoid is a
long, plausible list that dissolves on inspection — works whose rights are
asserted rather than checked, editions chosen because they were the first
free one found, `why` fields that could describe any book.

We have been burned by exactly this pattern in the imagery layer, where a
category that scored 91% "artwork" by automated measure turned out to be
coins, genealogical charts, and a Brussels building facade. **Filename
plausibility is not image quality**, and by the same token, *a famous
title is not a good edition.*

Look at what the text actually is.
