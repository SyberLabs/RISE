# Source Expansion — Science Imagery (Cosmos & Natural History)

**Extending R.I.S.E.'s imagery beyond the art museum: the heavens and
the living world, sourced with the same rights discipline and reverent
register the Chapel and Atrium already hold.**

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
pool model (MUSEUM-ATLAS), the Gospel pericope concordance, the Atrium's
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

### Gap 1 — the licence name is dropped exactly when a provider is helpful

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

### Gap 2 — an uncreditable work is displayed rather than withheld

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

### Gap 3 — CC-BY-SA is not distinguished from CC-BY

The detector marks both credit-required, which is right, but they are not
the same licence class. Wildlife imagery on Wikimedia and iNaturalist is
a mixture of BY, BY-SA and CC0, so the ledger must record which — before
harvest, not after.

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

---

## 4. How science intents reach the reader

Three routes, reusing machinery that already exists:

1. **Free readings (Atrium / Library / paste)** — a science text selects
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
  might prefer "The Firmament" / "The Living World"; the Atrium register
  might prefer plainer scientific names. (Mirrors the ATRIUM/SOLARIUM
  naming instinct.)
- **Does the sacred surface use witness-of imagery?** A creation psalm
  under a Hubble deep field is powerful — but is the photographic real
  the right register behind Scripture, or does the Chapel stay with the
  painted/iconographic tradition and leave the cosmos to the Atrium? A
  genuine aesthetic-theological call, not a technical one.
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
