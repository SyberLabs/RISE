# Source Expansion — Science Imagery (Cosmos & Natural History)

**Extending R.I.S.E.'s imagery beyond the art museum: the heavens and
the living world, sourced with the same rights discipline and reverent
register the Chapel already holds.**

Status: ACTIVE — the Audubon art-of-nature corpus and the cross-presenter
artwork-label pathway are implemented; the remaining Cosmos and
natural-history providers are still design candidates.
Claims marked ⚠ **UNVERIFIED** must be confirmed by a live probe under the
MUSEUM-ATLAS discipline before code trusts them. Rulings by the creator
marked ✦; open questions ⁇.

### Implementation ledger — Audubon Animals

The existing `animals` reader intent now hydrates from a checked-in,
versioned catalog of 585 institution-verified public-domain plates:

- all 435 double-elephant-folio plates of *Birds of America*, from the
  Cincinnati & Hamilton County Public Library;
- all 150 imperial-folio plates of *The Viviparous Quadrupeds of North
  America*, from the University of Michigan Library.

`npm run build:audubon` is the controlled refresh boundary. It harvests the
institutions' IIIF manifests, verifies exact gapless plate ranges, rights,
image dimensions, identifiers, and provenance, then replaces the generated
catalog. The browser never performs that metadata crawl. At runtime, the
Animals provider lazy-loads the catalog, independently re-gates every record,
and derives responsive IIIF image URLs. The former curated animal pins remain
an explicit degraded-mode fallback, not a second competing authority.

The octavo *Birds of America* and later *Quadrupeds of North America* remain
future corpus candidates; they are not silently mixed into this canonical
folio release.

---

## 0. Why this, and why now

The museum sources have served art beautifully — the four-institution
pool model (MUSEUM-ATLAS), the Gospel pericope concordance, the
curated collections. But R.I.S.E. reads more than art history. A
cosmology text, a psalm of creation, a natural-theology reading, an
Ackerman-vault science sequence — these want **the heavens and the
living world**, and the art museums do not hold them (or hold only their
*painted* echoes).

The founding principle of the MUSEUM-ATLAS is the exact lens for this:

> **A category is a READER INTENT, never an institution. Museums
> contribute works to shared pools; the institution is provenance
> metadata on the work, not a browsing axis.**

"Cosmos" and "Wildlife" are new reader intents. NASA, ESO, and the
Smithsonian are new *institutions* that feed them. Nothing about the
architecture changes — only the roster of contributors grows.

---

## 1. The load-bearing distinction: **art-of** vs **witness-of**

This is the one genuinely new architectural idea, and everything else
follows from it. Science imagery splits into two kinds that differ in
provenance, rights, and — most importantly — **their relationship to
meaning**:

### 1a. ART-OF nature (the illustrated / engraved tradition)
Audubon's *Birds of America*, Haeckel's *Kunstformen der Natur*, Maria
Sibylla Merian's insects, historical celestial atlases (Bayer, Hevelius,
Flamsteed), botanical and zoological plates. These are **artworks whose
subject is nature**. Most still live in the museum-pins model; Audubon is
the first bulk-corpus exception, compiled from institutional IIIF manifests
into an audited runtime catalog. Smithsonian, Rijks, Cleveland, the Met,
and specialist libraries hold this material under the same
CC0/PD rights regime and the same contact-sheet review we know. A reader
of St. Francis, of a bestiary, of natural theology wants these:
reverent, made by a human hand, at home beside a Rembrandt.

### 1b. WITNESS-OF nature (the photographic / observational tradition)
A Hubble nebula, a JWST deep field, a Mars-rover panorama, a satellite
Earth, a wildlife photograph. These are **not art but witness** — the
thing itself, captured by instrument. Different institutions (NASA, ESO,
observatories), different rights (US-government public domain, or CC-BY
*with attribution obligations*), and a different aesthetic contract: they
carry the authority of the real. A cosmology reading, a creation psalm,
a text on deep time wants these.

✦ **Ruling: these are two source TYPES, not one.** The art-of tradition
extends the existing museum model with new institutions. The witness-of
tradition is a **new provider family** with its own rights ledger,
attribution handling, and aesthetic placement rules. Conflating them
would smuggle a photograph into a hall of paintings, or lose the
attribution a CC-BY telescope image legally requires.

Both feed reader intents; a single intent may blend them (a Franciscan
reading: Audubon's plates AND wildlife photography). The blend is a
**content-domain decision**, exactly as the Chapel decides pericope
imagery today.

---

## 2. Candidate sources — a survey (⚠ all UNVERIFIED; probe before trusting)

Written from general knowledge to plan the harvest. Each becomes an
MUSEUM-ATLAS section *only after* a live probe confirms it, per the
standing discipline ("when behavior contradicts this atlas, re-probe").

### 2a. COSMOS (witness-of)

**NASA Image and Video Library** — `images-api.nasa.gov`
- ⚠ Keyless search endpoint believed public (`/search?q=...&media_type=image`);
  returns a collection of items each with an `nasa_id` and an asset
  manifest (a second hop to the actual image URLs, à la Rijks's hops).
- **Rights:** NASA-created content is overwhelmingly **US-government
  public domain** — BUT the library aggregates some partner content that
  is NOT (ESA, individual photographers). ⚠ Rights must be read
  **per-item** from the item's metadata (`copyright`/`rights` fields);
  absence of a copyright field is the PD signal, presence withholds.
  This mirrors the Atlas rule: *absence of a stated restriction is not
  automatically permission — read the item.*
- **Aesthetic fit:** the strongest of all. Slow nebula/galaxy crossfades
  behind a reading are the Continuous Field's ideal content.

**APOD (Astronomy Picture of the Day)** — `api.nasa.gov/planetary/apod`
- ⚠ Needs an API key (free `DEMO_KEY` exists, rate-limited). One
  curated masterpiece per day, each with the astronomer's own
  explanation — a *concordance-grade* pairing of image + meaning
  already done by experts. A date-ranged pull yields a hand-curated
  archive. Some APOD images are credited to non-NASA photographers with
  their own rights — ⚠ per-item rights again.

**ESA/Hubble & ESO** — `esahubble.org`, `eso.org`
- ⚠ Publish gorgeous deep-sky imagery, typically **CC BY 4.0** — usable
  but **attribution is mandatory** (the witness-of attribution
  obligation, §3). ⚠ API/programmatic access unclear; may be a scrape
  or a manifest, not a clean JSON API. Verify before committing.

**Others to weigh (⁇):** JWST/STScI archives, USGS Astrogeology (planetary
maps), NOAA/NASA Earth imagery (the Solarium's Earth already lives here
conceptually).

### 2b. NATURAL HISTORY

**Smithsonian Open Access** — `api.si.edu` (Open Access API)
- ⚠ ~4.5M items, a real search API, **CC0** on the open-access subset —
  the cleanest, most museum-like entry. Holds BOTH natural-history
  *specimens/photographs* (witness-of) AND historical *illustrations*
  (art-of). ⚠ Needs an API key (free via api.data.gov). The CC0 subset
  clears our gate identically to Cleveland; per-item rights still read
  authoritatively.
- **Best first natural-history source** — museum-grade rights, a known
  discipline, both traditions under one roof.

**Biodiversity Heritage Library (BHL)** — `biodiversitylibrary.org`
- ⚠ Historical natural-history *illustrations* (the art-of tradition):
  Audubon, Merian, botanical plates, at high res. Rights vary by
  volume's publication date (pre-1929 → PD); ⚠ must read per-item, and
  the API is book/page-oriented, not image-first.

**GBIF / iNaturalist** — living wildlife photography (witness-of)
- ⚠ Enormous, current, real animals in the wild — BUT **user-contributed
  under a spread of CC licenses per observation** (CC0, CC-BY, CC-BY-NC,
  and All-Rights-Reserved all coexist). This is a **rights-checking
  burden** heavier than any museum: every image needs its individual
  license read, and CC-BY-NC / ARR must be withheld. Defer until the
  clean sources prove the intent; if pursued, filter hard to CC0/CC-BY
  at the query and re-verify per-item.

---

## 2z. PROBED — 2026-08-05

§2 was written from general knowledge and marked UNVERIFIED. This is the
live probe it asked for. **Three of its assumptions did not survive**, and
one of those changes the harvest plan.

### NASA Image and Video Library — `images-api.nasa.gov`

| | |
|---|---|
| keyless | **confirmed** — `/search?q=…&media_type=image` returns 200 |
| second hop | **confirmed** — `/metadata/{nasa_id}` → an assets manifest, à la Rijks |
| per-item rights | **THE ASSUMPTION FAILED** |

§2 planned to read rights per item: *"absence of a copyright field is the
PD signal, presence withholds."* **There is no such field.** Across 100
items and four queries (`nebula`, `hubble`, `ESA`, `Webb telescope`) the
only keys ever returned are `center, date_created, description,
description_508, keywords, media_type, nasa_id, title, photographer,
secondary_creator, album, location`. The metadata second hop yields 62
fields of which exactly one is rights-adjacent — `XMP:Credit`, a credit
line, not a licence.

So the rule cannot be implemented as written: a test for the absence of a
field that is *always* absent withholds nothing.

**And the policy is not what §2 assumed either.** NASA's own guidance says
content "generally are not subject to copyright in the United States" —
but also that **attribution is required**: *"NASA should be acknowledged
as the source of the material."* Third-party content exists and is
"marked as copyright-protected with the holder's name" — **in prose, not
in a field.** A scan of 100 galaxy descriptions for `copyright`, `©`,
`courtesy of`, `all rights reserved` found one hit, and it was benign.

**Consequences for the harvest.** NASA is not an unencumbered PD source;
it is *credit-required*, and the credit is always composable —
`secondary_creator || photographer || center || "NASA"` — which matters
because **27 of 100 items carry no `secondary_creator` at all**. The
undetectable third-party fraction is a residual risk that must be
recorded in the ledger rather than pretended away, and it argues for
harvesting from **curated NASA collections** rather than open search.

### Smithsonian Open Access — `api.si.edu`

| | |
|---|---|
| `DEMO_KEY` | answers 200 — but **cannot harvest**: a handful of probes exhausted it and everything after returned 429. A free key from `api.data.gov/signup` is required. A silent 429 looks exactly like an empty collection, and "the source has nothing" and "we were throttled" are opposite facts, so the harvester raises rather than absorbing it. |
| per-item rights | **machine-readable**: `online_media.media[].usage.access === "CC0"` |
| the catch | **only 1 of 40 search rows carried any media at all** |
| query syntax | narrow. `online_media_type:Images AND bird` → 60 rows, **55 media, every one CC0**. `unit_code:NMNH`, any multi-word phrase, and a bare `galaxy` all return **zero**. One word at a time, behind the media filter. |
| subject fit | **natural history, not cosmos.** Its nebula holdings are one image per sixty rows; its bird holdings are 55 per sixty. §2 called it "best first natural-history source" and the probe agrees. |

The cleanest rights story of the three, and `rowCount` badly overstates
the yield — 5.2M rows is not 5.2M images. The harvest must filter on
media presence and expect a small fraction.

**Harvested with a real key, 2026-08-05.** 175 media across six terms →
54 pinnable candidates, every one `usage.access === "CC0"`. Three things
the first run got wrong, all of which the second run measures:

- **A media manifest is a claim, not a guarantee.** 6 of the 60 delivery
  URLs return 404, and they are not scattered: **all six are Smithsonian
  Gardens** (6 of its 20), while NMNH Birds and Cooper Hewitt are clean.
  The URL *form* is not the discriminator — the legacy
  `deliveryService?id=` shape works 36 times and fails 6 — so nothing but
  asking distinguishes a live image from a dead one. The harvester now
  probes every delivery URL and drops what will not resolve, which is the
  imagery's own law applied one stage earlier: a work that will not
  resolve is absent, never a broken frame.
- **Records share media.** 60 rows carried 60 distinct record URLs and
  only **39 distinct images** — a third of the shelf was one photograph
  under several accession numbers. Dedupe on the delivery URL, before the
  limit is applied.
- **The term budget must be round-robin.** Concatenating six terms and
  cutting to 60 gave `bird` 54 of them — 54 hummingbird specimen trays
  from one NMNH division — while `fossil` and `shell` contributed
  nothing. Interleaved, the same limit yields butterfly 21, orchid 14,
  bird 12, fossil 5, botanical 2. (`shell` returns nothing behind the
  media filter and should be dropped from the term list.)

Titles are Linnaean binomials — `Trochilidae`, `Psychopsis papilio` — so
this is a **specimen catalogue**, and the contact sheet must judge
whether specimen photography belongs in a chamber at all. The Cooper
Hewitt and botanical-illustration rows are a different and more promising
register than the NMNH trays.

**VERDICT — retired entire, 2026-08-05, Mateo.** All 54 reviewed works
refused: NMNH ×4 units (18, "low quality entry"), Smithsonian Gardens
(14 photographs of flora), Cooper Hewitt (22). Nothing here was a
harvester fault — the rights were clean, every delivery URL resolved, and
the images were simply the wrong thing, which is the only failure a
contact sheet can catch and the entire reason the step exists.

Cooper Hewitt's inclusion is the deliberate part. Those twelve are a
genuinely different register — decorative designs, art-of rather than
witness-of — and keeping them would have carried a design museum forward
as a *remnant* of a natural-history harvest. A collection assembled that
way is not curated, it is left over.

One measurement defect to carry forward: **22 candidates were 12 distinct
objects.** The harvest dedupes on the delivery URL, and a Smithsonian
record can attach several media (views, versions) to one object, so a
per-image count overstates the holdings by nearly half. ESA/Hubble and
NASA are 1:1 and were unaffected. Multiple views are useful *on the
sheet*; it is the count that misleads, so the sheet reports both.

### ESA/Hubble and ESO — a feed, not an API

§2 guessed "may be a scrape or a manifest, not a clean JSON API". Closer
than that: both run Djangoplicity and expose the same endpoint.

```
https://esahubble.org/images/json/        → 100 entries, 652 KB
https://www.eso.org/public/images/json/   → 100 entries, 552 KB
```

Each entry carries `Rights`, `Credit`, `Title`, `Description`, `Creator`,
`ReferenceURL`, `ID`, `Type` — and `Rights` reads *"Creative Commons
Attribution 4.0 International License"* with `Credit` a full attribution
string. **This is the ideal shape for the machinery §3a just built**: a
declared licence class and a composed credit, per item.

Two quirks to handle rather than discover later:
- values arrive as Python bytes-repr — `b'Creative Commons…'` — and must
  be unwrapped;
- `?page=2` returns byte-identical content, so **pagination is unsolved**.
  100 entries is a start, not a corpus.

### What this changes

1. **Smithsonian first**, not NASA. It has the only per-item
   machine-readable licence of the three, and CC0 clears the gate
   identically to Cleveland.
2. **ESA/Hubble and ESO second** — CC BY 4.0 with a credit line, which is
   exactly the case §3a was built for, and the aesthetic heart of the
   cosmos intent.
3. **NASA third, and narrowed.** Curated collections rather than open
   search, credit always composed, and the undetectable third-party
   fraction written into the ledger as a known limit.
4. **GBIF/iNaturalist stays deferred**, and the probe strengthens that:
   with three sources offering per-item licences, there is no reason to
   take on a corpus where CC-BY-NC and ARR coexist with CC0.

---

## 3. The new rights obligation: **attribution** (witness-of)

The museum sources cleared on PD/CC0 — **no attribution obligation**. The
witness-of sources introduce **CC BY**, which is free to use *only if
credited*. The runtime now carries normalized title, artist, source, rights,
and required-credit identity from provider hydration into both flash and
Gallery presenters.

✦ **Ruling: a work carrying an attribution obligation must display its
credit whenever shown.** Implications:
- The work model gains a `rightsBasis` beyond PD/CC0 — a `CC-BY` basis
  that carries a required `attribution` string (creator + institution +
  license), read from the API, never hand-built (the Atlas's URL rule
  extends to credit strings).
- Every presenter that shows a CC-BY work must surface its credit —
  the flash economy's caption, the Continuous Field's layer-owned label,
  and the future Page Mode figure caption. A CC-BY work with no
  place to show its credit **cannot be shown** in that presenter
  (reverent withholding, now legally required).
- The **rights ledger (MUSEUM-ATLAS §5) gains rows** for each new
  institution: NASA (`copyright` absent → US-gov PD), APOD (per-item),
  ESO/Hubble (CC-BY + attribution), Smithsonian (`CC0` on OA subset),
  BHL (publication-date PD).

This is the single most important thing to design *before* harvesting a
witness-of source — the attribution pathway must exist first.

---

## 3a. Audit of the attribution pathway — 2026-08-05

**The pathway is largely BUILT, which was not obvious and had been
assumed otherwise.** Read against the code rather than the plan:

| piece | state |
|---|---|
| canonical metadata boundary that strips markup | `normalizeArtworkLabel` — **built** |
| `creditRequired`, from `AttributionRequired` or a CC-BY licence string | **built** |
| credit shown regardless of the reader's label preference | `displayedArtworkLabel` — **built** |
| applied across Flash, Gallery and Page | **built** (`is-required-credit`) |
| provider capture of licence, licence URL, attribution, source URL | **built** for Wikimedia |

So §3's ruling has a home. Three gaps remain, all narrow.

### Gap 1 — the licence name is dropped exactly when a provider is helpful — **CLOSED 2026-08-05**

`requiredText` is composed as `attribution || [title, artist, sourceName,
rightsBasis]`. The `||` short-circuits, so a work that supplies an
attribution string shows **only** that string and the licence is never
named:

```
with an attribution string : "ESA/Webb, NASA & CSA, J. Lee"
without one                : "Pillars… · NASA, ESA, CSA, STScI · ESA/Webb · CC BY 4.0"
```

CC BY 4.0 §3(a)(1) requires attribution **and** identification of the
licence. The first line above is the one a real ESA/Webb record produces,
and it is the non-compliant one. The fix is composition rather than
substitution: the provider's attribution replaces the *name* fields, not
the licence.

### Gap 2 — an uncreditable work is displayed rather than withheld — **CLOSED 2026-08-05**

`normalizeArtworkLabel` returns `null` when title, artist and attribution
are all absent, and a null label renders nothing — **the image still
shows**. For PD/CC0 that is correct. For CC-BY it is a licence breach,
and §3 already forbids it in words: *"A CC-BY work with no place to show
its credit cannot be shown."*

The rule needs to exist in code, and it is the same sentence the imagery
already lives by: **a work that will not resolve is absent, never a
broken frame** → *a work that cannot be credited is absent, never
uncredited.* This is the one load-bearing item; everything else here is
polish.

### Gap 3 — CC-BY-SA is not distinguished from CC-BY — **CLOSED 2026-08-05**

The detector marks both credit-required, which is right, but they are not
the same licence class. Wildlife imagery on Wikimedia and iNaturalist is
a mixture of BY, BY-SA and CC0, so the ledger must record which — before
harvest, not after.

### How it was closed, and the shape that matters

**The licence class is now determined from the RAW item, before any
label is composed** — `licenceClassOf(item)` returning `open`, `cc-by`,
`cc-by-sa` or `undeclared`. That separation is the whole fix. The
obligation used to be discovered *inside* `normalizeArtworkLabel`, which
returns `null` when there is nothing to display — so a work that REQUIRED
credit and had none arrived at the presenter as `null`, indistinguishable
from a work that needed none, and both were shown.

**`artworkMayBeShown(label)` refuses exactly one case:** a credit-required
work whose credit cannot be composed. The visual cortex refuses to
hydrate it and records a `rights` failure; the Page absents the figure by
the same path a work that will not load takes.

**And it does not reach the CC0 corpus, which was the risk.** Tested
explicitly, because much of the museum shelf is by an unknown hand and a
blunt rule would have emptied it:

| record | licence | shown |
|---|---|---|
| CC0 woodcut, unknown artist, title only | `open` | **yes** — "Woodcut of a hare" |
| CC0 with no metadata whatever | — (`null` label) | **yes**, no chip |
| Art Institute record as it arrives | `open` | **yes**, reader's preference governs |
| undeclared rights | `undeclared` | **yes** — every existing provider keeps working |
| CC BY with someone to name | `cc-by` | **yes**, credit always visible |
| CC BY with nobody to name | `cc-by` | **no** |
| CC BY-SA with nobody to name | `cc-by-sa` | **no** |

The `undeclared` default is deliberately permissive. Tightening it would
be the retroactive change this separation exists to avoid; a new
witness-of source must DECLARE its licence, and that obligation belongs
to the harvester, not to the presenter.

**One case found while testing:** a licence name alone is not a credit.
A record carrying only `CC BY 4.0` composes the non-empty string
"CC BY 4.0", which names the licence and credits nobody — so the
withholding test is on the NAMES, not on the composed text.

### Ruling: where the credit lives — decided 2026-08-05, Mateo

> **The chip carries the credit as TEXT. The Curia carries the full
> record with URLs.**

CC BY 4.0 §3(a)(2) allows the conditions to be satisfied *"in any
reasonable manner based on the medium, means, and context"*, and names a
linked resource as an example. Naming the licence in text **identifies**
it; the hyperlink is the "where practical" clause, and in a reading
surface it is not practical — an earlier version put URLs in the chip and
it threw off the visual coherence of the Chamber.

This holds because **the Curia is reader-reachable** — it has its own
door on the Portal and is a registered view, not a developer tool. A full
attribution record there, with licence and source URLs, is a resource a
reader can actually get to. Had the Curia been dev-only this ruling would
not stand.

**Built 2026-08-05 — and it was the load-bearing half.** The roster
ruling below shortens 25 credits and lets the remainder live "elsewhere"
under §3(a)(3). Until the Curia actually listed the science collections,
*elsewhere was nowhere*: the full text existed only in a generated JSON
file no reader could reach, so the permission the shortening relies on
had no ground. The Curia now carries the astronomy record — every credit
as the chip renders it, every elided roster in full, the licence class,
and the source URL as a real link.

It carries **no governance verbs**, deliberately. The Curia's
exclude/pin/move rewrite `museum-pins.js`, which is machine-writable by
design; the science canon is `science-pins.js` plus a rebuild through
`build-science-catalog.mjs`. A verb here would be a control that silently
does nothing — worse than no control, because it would claim an authority
the room does not have.

### `--limit` truncated the review, and the report called it a yield

The first contact sheet ran at `--limit 60`. The harvest reported
*"fetched 100 … kept 60"* and that reads as a yield — works lost to
duplicates, rights or dead links — when it was simply a **cut**. Forty
ESA/Hubble works, forty ESO and fifteen NASA never reached the sheet.

The cost was not hypothetical: the reviewer approved **ESA/Hubble "in
full"** having been shown three fifths of it. A verdict on a truncated
view was recorded in the canon as a verdict on a collection.

Ordering is stable across runs — every previously reviewed id reappears
in the full harvest — so the remainder is cleanly recoverable and nothing
had to be re-reviewed. The report now names the truncation
(`⚠ 40 NOT SHOWN (--limit 60)`) and `notShown` is in the JSON report,
because a number meaning "all of it" and a number meaning "as many as you
asked for" cannot share a column without eventually being read as the
wrong one.

**Both passes are now complete.** The remainder — ESO 40, ESA/Hubble 40,
NASA 15 — went to two further sheets and was reviewed; Smithsonian's 78
were moot, the source being retired. Astronomy closed at **216 works**:
ESA/Hubble 98 of 100, NASA 64 of 75, ESO 54 of 100.

The second pass cut four from the whole-collection sources. Two are not
photographs of the sky at all (an Apollo 17 mission emblem, a Mars
portrait) and two are planets — *Alien aurorae on Uranus*, *Jupiter's
swirling colourful clouds* — a register the reader meets differently from
deep field and nebula.

**And ESO's shortlist is closed.** Holding it apart was correct while its
status was undecided; it had 35 approvals from the first pass and gained
19 from the second, so it is now simply part of the collection. The
distinction it protected still stands in words: a shortlist filed as a
pin is indistinguishable from an approval a week later.

The 100 per feed remains the djangoplicity pagination ceiling; `?page=2`
returns byte-identical content, so 100 is everything ESA/Hubble and ESO
will give until that is solved.

### AVM subject codes: a hint that is NOT a filter — measured 2026-08-05

ESO's feed carries `Subject.Category`, the source's own **Astronomy
Visualization Metadata** classification (A solar system, B stars &
nebulae, C galaxies, D cosmology, E sky phenomena, F photographic and
facilities). Reading it against the first ESO pass produced a strikingly
clean correlation — and then a caution that matters more.

| AVM branch | kept | cut |
|---|---|---|
| A · Solar system | 0 | **4** |
| E · Sky phenomena | 0 | **16** |
| B · Stars & nebulae | 27 | 8 |
| C · Galaxies | 7 | 1 |
| D · Cosmology | 1 | 0 |

**Every A and every E was cut — 20 of the 25 rejections**, and they are
exactly the observatory-landscape shots the reviewer described: *"ALMA's
world at night"*, *"The southern Milky Way above ALMA"*, *"Total solar
eclipse, La Silla Observatory"*, *"Three planets dance over La Silla"*.
ESO files that photography under sky phenomena, so the field a reviewer
needed was in the feed all along.

**AND IT DOES NOT TRANSFER.** The astronomy catalog — ESA/Hubble,
approved in full — contains five `A` works and one `E`. They are *Saturn
in natural colours*, *Hubble's View of Jupiter and Europa*, *Collision
leaves giant Jupiter bruised*. The same code that marked 100% rejections
at ESO marks approvals at ESA/Hubble, because **the code describes the
subject while the thing being judged is the vantage point** — and Hubble
has no ground vantage to have.

So the branch is carried to the **contact sheet** and warmed in colour for
A/E/F, and it is deliberately *not* a harvest filter. A signal that
predicted one reviewer's twenty-five cuts within one institution is worth
showing and not worth trusting; treating it as a rule would have silently
dropped Saturn. This is the same failure the Wikimedia botanical service
committed — a query cannot promise what it has not seen — arriving in a
better disguise.

The codes are carried into the generated catalog too (57 of 111 works;
NASA publishes no such field), because §4 route 2 — a science concordance
binding passages to images — needs exactly this axis and it is far
cheaper to keep now than to re-harvest for later.

### Ruling: an appended roster goes to the Curia — decided 2026-08-05, Mateo

> **Cut at the roster marker. Never at a length.**

The contact sheet made the problem visible: one ESA/Hubble credit ran
**723 characters** — two full observing teams — which is not a chip, it
is a paragraph floating over the passage.

The cut is **structural**, and that is the legally load-bearing part.
§3(a)(1)(A) requires retaining identification of the creators *and any
others designated to receive attribution*, so shortening a list of
designated names is the risky operation. Dropping a section the provider
itself labelled as supplementary thanks is not — ESA/Hubble's own
convention writes `Credit: … Acknowledgment: …`, and the second is
courtesy. §3(a)(3) then permits satisfying the condition by link where the
medium makes the full text impractical, and the Curia ruling above is
what makes that available.

**There is no length fallback.** Five of the twelve long credits are pure
name lists with no marker; they top out at 155 characters and are left
whole however long they run. A chip one line too tall is a smaller
problem than a credit naming half a person.

Two markers, both observed in the data: an `Acknowledg[e]ment(s):`
section, and a run-on where the feed concatenated two fields with no
separator at all (`…Westerlund 2 Science Team The original observations
of…`). A leading `Image:` / `Credit:` field label is also dropped — it
names the field, not the creator.

Result across 234 candidates: **723 → 115 characters**, longest credit now
181, none over 300, **14 genuinely elided**. Every elision carries
`fullCredit` for the Curia and is flagged on the contact sheet, because a
reviewer approving an elision must see that one happened.

Alongside it, the licence is now **identified rather than quoted**:
all 120 CC-BY candidates declared `Creative Commons Attribution 4.0
International License` (54 characters) where §3(a)(1)(B) asks only that
the licence be identified, and `CC BY 4.0` is the identification the deed
itself uses. Share-alike is matched **first**, because
"Attribution-ShareAlike" contains "Attribution" and the looser pattern
would relabel a BY-SA work as BY.

**None of this reaches the CC0 corpus.** Trimming applies only to
`requiredText`; `labelText` — what an open-licence work displays — is
composed exactly as before, and two tests hold that line.

### Ruling: the API key never leaves the workstation — decided 2026-08-05

Smithsonian is the first source that needs a key at all, which raised the
question directly: does it belong in Netlify's secrets? **No — and the
reason generalises to every keyed source we might add.**

The split is **harvest time vs. runtime**, and only harvest time touches
an API that wants a key. `scripts/harvest-science.mjs` is a by-hand
script, not part of `npm run build`; its output is a reviewed, pinned
list committed to the repo. Netlify builds that list and never queries
the institution. This is not an accident of convenience — it is
curation-only stated in infrastructure.

Three ways a key *could* reach the deployment, all wrong:

| route | why it fails |
|---|---|
| `VITE_SI_API_KEY` | Vite **inlines `VITE_*` into the client bundle**. That is not a secret, it is a published string sitting in the shipped JS. The most tempting option and the worst. |
| Netlify build env var | only helps if the build calls the API. It does not. |
| Netlify Function proxy | puts a server into a static site, needs a new `connect-src` entry, and buys nothing. |

And a fourth, quieter route the harvester now guards: **a delivery URL
that carries the key in its query string** would fetch perfectly from the
workstation and then commit the secret into the pin file — publishing it
exactly as a `VITE_` variable would, by a route no one would think to
check. `CARRIES_SECRET` rejects any candidate whose delivery URL contains
`api_key`, `token`, `signature`, or `auth`.

`netlify.toml` already enforces the arrangement from the other side:
`connect-src` is an allowlist and **does not include `api.si.edu`**, so
the browser could not reach the search API even if something asked it to,
while `img-src ... https:` already permits `ids.si.edu` to deliver
pixels. No CSP change is required to serve Smithsonian imagery — which is
the tell that the design is right.

**One real consequence, and it is not cosmetic.** `museum-pins.js`
records that the Cleveland and Rijksmuseum adapters *re-verify rights per
object at resolution* — `share_license_status === 'CC0'` checked live,
every time. Smithsonian **cannot** do that from the browser without the
key and a CSP entry. Its rights verification is therefore **frozen at
harvest**: true as of the date the harvest ran, not re-confirmed at
render. That is a difference in kind from the other two institutions and
must be recorded as such in the pin ledger and the Atlas, not left to
look equivalent.

---

## 4. How science intents reach the reader

Three routes, reusing machinery that already exists:

1. **Free readings (Library / paste)** — a science text selects
   a Cosmos or Wildlife collection the same way it selects Old Masters
   today: `interlocution.sourced = ['cosmos']`, and the cortex resolves
   the pool through the new adapter. The Gallery (Continuous Field) is
   the natural presenter — slow, reverent, never-black; a wall of
   nebulae behind a cosmology reading is the feature's dream.

2. **A science concordance (pericope-style, later)** — the three-layer
   law (content authors schedules → runtime follows → cortex renders)
   is domain-agnostic. A cosmology or natural-history text could carry a
   `visualProgram` binding *passages* to *images* exactly as the Gospel
   pericopes bind verses to paintings: a creation narrative moving from
   "let there be light" (a deep field) through the waters, the lights,
   the creatures (Audubon), the beasts. This reuses the entire scheduler
   + cortex path with a new domain compiler — no new runtime.

3. **The Ackerman vault** — Dr. Ackerman's science sequences are the
   most concrete near-term consumer; the `aic-*` category dependency is
   untouched, and new `cosmos-*` / `wildlife-*` categories sit beside it.

Note the poetic convergence: the **Solarium** already shows the Earth
from space (NASA-lineage imagery in the portal). The witness-of tradition
is, in a sense, already in the building.

---

## 5. What must NOT change (invariants inherited)

- **The reader-intent principle** — new sources feed intents (Cosmos,
  Wildlife), never appear as "browse by NASA."
- **Contact-sheet review by human eyes** — search curates nothing; every
  candidate is reviewed before it is pinned. Register matters: a NASA
  *diagram* is not a nebula; a specimen *tag photo* is not wildlife.
- **Rights read per-item at the authoritative location** — the
  witness-of sources make this stricter (per-item copyright fields,
  attribution obligations), never looser. Absence of a restriction is
  not permission.
- **URLs and credit strings from the API, never hand-built.**
- **Reverent register** — the science sources must clear the same bar:
  the cosmos as awe, not wallpaper; the creature as wonder, not
  clip-art. A grainy thumbnail or a lab snapshot fails the register even
  if its rights are clean.
- **The art/witness split is honored in placement** — a photograph does
  not enter a hall of paintings unlabeled; a CC-BY image never shows
  without its credit.
- **`aic-*` ids are a vault dependency — never renamed.** New science
  categories are additive.

---

## 6. Build order (when we move from plan to probing)

Front-loaded with the cleanest source and the one prerequisite (rights),
mirroring how the Gallery and pericopes were built: the hard, durable
core first.

1. **COMPLETE — attribution pathway (§3).** The decoded-work model carries
   rights and credit metadata; flash and Gallery both render labels; the
   reader may hide optional title/artist labels, but required credits remain
   visible. Page Mode must consume the same contract when implemented.
2. **NASA Image Library probe + adapter** (witness-of, mostly PD) —
   Atlas-style live probe (endpoints, the asset-manifest hop, the
   per-item rights field, image URLs, pagination, throttling), then an
   adapter on the museum-adapter pattern. Fills a **Cosmos** intent.
3. **Smithsonian Open Access probe + adapter** (both traditions, CC0) —
   the cleanest natural-history entry; fills a **Wildlife** / natural-
   history intent, and its CC0 art-of holdings extend the existing
   museum model too.
4. **Contact-sheet harvest** for Cosmos and Wildlife, human-reviewed,
   into new pinned collections + (for AIC-style live search, if any axis
   supports it) live pools.
5. **APOD archive pull** (curated, image+explanation) — a concordance-
   grade seed for a future science concordance.
6. **ESO/Hubble and BHL** as CC-BY / PD-by-date enrichments, only after
   the attribution pathway (step 1) is proven in production.
7. **Later, deliberately:** a science `visualProgram` (creation-narrative
   pericopes); GBIF/iNaturalist only if the clean sources prove the
   intent and the per-observation rights burden is worth it.

---

## 7. Open questions (⁇ for the creator)

- **Intent naming.** "Cosmos" / "Wildlife"? Or finer ("Deep Sky",
  "The Heavens", "Creatures", "Natural History")? The Chapel register
  might prefer "The Firmament" / "The Living World".
- **Does the sacred surface use witness-of imagery?** A creation psalm
  under a Hubble deep field is powerful — but is the photographic real
  the right register behind Scripture, or does the Chapel stay with the
  painted/iconographic tradition? A genuine aesthetic-theological call,
  not a technical one.
- **Attribution display** — where credit lives in each presenter without
  breaking the reverent, uncluttered surface (a hover, a corner, a
  fade-in on dwell?).

---

*The frame: R.I.S.E. reads the world, not only its art. The heavens and
the living creatures join the corpus through the same doors the
paintings came through — reader intents, shared pools, rights read per
work, human eyes before any pin — with one new idea (art-of vs
witness-of) and one new obligation (attribution) that must be built
before the first telescope image is ever shown.*
