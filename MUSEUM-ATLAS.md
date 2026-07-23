# Museum Atlas

One section per institution R.I.S.E. draws imagery from: how its API is
structured, which query axes genuinely FILTER (versus merely rank),
where rights live and what values clear our gate, how images are
served, and the quirks that have burned us. Every claim in this
document was verified with live probes on **2026-07-22** — nothing here
is from memory or from third-party docs. When behavior contradicts
this atlas, re-probe and amend the atlas; do not code around it
silently.

**Why this exists.** Each institution structures its collection
differently, and a query that curates well in one museum's vocabulary
degrades into noise in another's (the founding example: AIC's prose
`q` never filters — six "categories" were once the same 1,946-painting
pool sorted six ways). Cross-institution pools (museum-pins.js) are
only as good as the harvest queries behind them, and harvest queries
are only as good as our knowledge of each API's real semantics.

**The architecture this serves.** A category is a READER INTENT
(Old Masters, Landscapes…), never an institution. Museums contribute
works to shared pools; the institution is provenance metadata on the
work (`sourceName`), not a browsing axis. Live search (AIC) fills the
pool broadly; pinned works (all four institutions) deepen it with
curated, rights-verified, human-reviewed selections.

---

## §1 Art Institute of Chicago (AIC)

**Role:** live-search provider (`src/sources/visual/museum.js`) AND
pins target (`adapters/aic.js`). The only institution we query live in
a reading session.

**Endpoint:** `https://api.artic.edu/api/v1/artworks/search` — GET,
no key, Elasticsearch exposed through PHP-style bracket params
(`query[bool][must][0][term][is_public_domain]=true`). Per-object:
`/artworks/{id}`.

### Filter vs. rank — the founding trap

- Prose `q` only **ranks**. `q=landscape` reports 61,568 "results" —
  it is the whole index sorted by relevance. Never build a category
  on `q`.
- Structured clauses **filter**. The same intent as a bool query
  (`subject_titles.keyword: landscapes` + `artwork_type_id: 1` +
  `is_public_domain: true`) returns exactly 208.

### Reliable axes (verified live)

| Axis | Field | Notes |
|---|---|---|
| Type | `artwork_type_id` (term) | Controlled ints. PD census: Print=18 (24,922), Photograph=14 (8,320), Drawing/Watercolor=5 (5,911), Textile=2 (4,224), 36 (2,815), **Painting=1 (1,946)**, 12 (1,803), 37 (1,783). Always pin a type — the recurring necklace/carpet strays entered through typeless queries. |
| Artist | `artist_title.keyword` (terms) | Exact-match roster. Clean for post-1750 attribution; pre-1750 scatters across "Master of…"/workshop names — use a date range instead. |
| Date | `date_start` (range) | Genuine range filter (`gte`/`lte`). |
| Subject | `subject_titles.keyword` (term/terms) | **UNCONTROLLED VOCABULARY** — see below. |
| Rights | `is_public_domain` (term) | Boolean, institution-asserted. Our gate accepts it as a stated PD basis. |

### The singular/plural subject trap (found 2026-07-22)

AIC's subject tags are folksonomy-grade: `portrait` (1,697 PD works)
and `portraits` (1,678) are **separate, largely disjoint populations**.
Among PD paintings: `portrait` 200, `portraits` 262, intersection only
161 — a single-form `term` query silently forfeits the other form's
exclusive works. Same for `landscape` (235) vs `landscapes` (208).
**Rule: subject clauses use a `terms` array carrying both forms.**
Other substantial PD facets, should intents grow: `vessels` 1,036,
`animals` 730, `flowers` 658, `religion` 513, `gods (deities)` 482.

### Images

IIIF Image API 2.0: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`
(843 is the institution-recommended display width; `full/max` for
full-res). `image_id` comes from the search `fields` projection; items
without one are filtered out. No rate-limit headers are exposed; the
API has throttled us in practice — keep harvest pacing polite.

### Pagination

Deep pagination works (page 101 verified OK). Search `limit` max 100.

---

## §2 Rijksmuseum

**Role:** pins target (`adapters/rijks.js`); 120 works currently
pinned across oldmasters/landscapes/portraits/postimpressionism
(museum-pins.js).

**The old API is dead.** `www.rijksmuseum.nl/api/...` returns 410
Gone; its replacement "RijksData" requires a key we do not hold. The
key-free surface is **Linked Art JSON-LD** at `id.rijksmuseum.nl` /
`data.rijksmuseum.nl`.

### The three-hop object resolution (adapter path)

1. **HumanMadeObject** — `https://id.rijksmuseum.nl/{objectId}`
   (e.g. `200107928` = The Night Watch). Carries `identified_by`
   (Names + the SK- accession Identifier), production, and a
   `representation` ref.
2. **VisualItem** — the `representation[0].id`. **RIGHTS LIVE HERE**,
   in `subject_to[].identified_by[]` as multilingual Names
   ("Publieke domein" / "Public Domain"; CC0 similarly). Never infer
   rights from the object hop.
3. **DigitalObject** — the VisualItem's `digitally_shown_by[0].id`.
   `access_point[0].id` is the image URL on **`iiif.micr.io`**
   (e.g. `https://iiif.micr.io/PJEZO/full/max/0/default.jpg`) —
   standard IIIF path segments, so `full/843,/0/default.jpg` sizes it.

All three hops run under one shared timeout in the adapter; a miss at
any hop withholds the work (reverent no-fallback).

### Key-free SEARCH exists (discovered 2026-07-22)

`https://data.rijksmuseum.nl/search/collection` — a Linked Art
OrderedCollection over **838,277 objects**, no key. Returns pages of
`{id: <HumanMadeObject URI>, type}` refs that feed straight into the
adapter's hop resolution. This removes the hand-gathered-id-list
dependency for future Rijks harvests.

Supported parameters (probed; unsupported ones 400 with
`Unsupported query parameter`):

| Param | Works? | Example / notes |
|---|---|---|
| `creator` | ✓ | `creator=rembrandt` → 1,463. Substring-tolerant (`frans hals` → 9 paintings). |
| `type` | ✓ | `type=painting` → 5,325 |
| `title` | ✓ | `title=nachtwacht` → 414 (loose) |
| `material` | ✓ | `material=canvas` → 2,676 |
| `technique` | ✓ | `technique=painting` → 4,291 |
| `imageAvailable` | ✓ | `imageAvailable=true` → 734,681 |
| `creationDate` | ✓ | **exact year only** — `creationDate=1642` → 1,186; range syntaxes all fail. Harvest per-year if a range is needed. |
| `q`, `artist`, `text`, `objectType`, `name`, `onDisplay`, `creationDateFrom/To` | ✗ | 400 |

Parameters combine (AND): `type=painting&creator=vermeer&imageAvailable=true`
→ 5. Search returns no rights — **rights are only knowable at the
VisualItem hop**, so every candidate still pays the three-hop
resolution before it can clear the gate.

### Operational notes

- Cold-cache cost: ~3 requests/work. The museum provider resolves
  pins **non-blocking in batches of 8** so the first flash never
  waits; SourceCache (30 days) makes later sessions instant.
- Dutch titles are canonical; some works carry an English Name too.
  Display whichever the adapter surfaces; don't translate.

---

## §3 The Cleveland Museum of Art (CMA)

**Role:** pins target (`adapters/cleveland.js`); used by the Atrium,
not yet contributing to the chamber category pools. Strong in
18th–19th-century European painting; also holds first-rank
Impressionist works (Monet's *The Red Kerchief*, *Water Lilies
(Agapanthus)*).

**Endpoint:** `https://openaccess-api.clevelandart.org/api/artworks`
— GET, no key. Per-object: `/api/artworks/{id}`.

### Query axes — everything genuinely filters

Unlike AIC, Cleveland's prose `q` **filters** (`q=zebra` → 0, not the
whole index). Verified axes:

| Param | Verified | Notes |
|---|---|---|
| `q` | ✓ filters | `q=landscape&cc0=1&has_image=1` → 1,584 |
| `department` | ✓ | `European Painting and Sculpture` → 724 CC0-with-image |
| `type` | ✓ | `type=Painting` → 3,956 CC0-with-image |
| `artists` | ✓ | substring on creator: `artists=monet` → 5, `artists=claude monet` → 5 |
| `created_after` / `created_before` | ✓ real range | sample dates verified in-range, incl. circa forms ("c. 1527") |
| `title` | ✓ | exact-ish: `title=water lilies` → 1 |
| `cc0=1` | ✓ | rights pre-filter — use on EVERY harvest query |
| `has_image=1` | ✓ | 41,475 CC0-with-image objects total |
| `skip`/`limit` | ✓ | offset pagination |

### Rights

Per-object `share_license_status`: `"CC0"` clears; `"Copyrighted"` or
anything else falls to UNKNOWN and is withheld (adapter behavior).
**Trap:** the SEARCH endpoint's `fields` projection returned `null`
for `share_license_status` even inside a `cc0=1` result set — the
per-object endpoint is authoritative for rights; never trust the
search projection for gate decisions. (`cc0=1` remains a sound
pre-filter; the adapter's per-object check is the gate.)

### Images

Direct URLs (not IIIF) in `images`: `web` (~748px), `print` (~2,849px),
`full` (~4,609px), plus `annotation`. Adapter maps `web` → imageUrl,
`print`/`full` → fullImageUrl.

### Metadata quirk

`creators[0].description` bundles name + bio:
`"Henri Rousseau (French, 1844–1910)"`. The adapter splits on the
parenthetical so attribution lines match other institutions.

---

## §4 The Metropolitan Museum of Art (Met)

**Role:** pins target (`adapters/met.js`). **Pinned ids only —
firmly.** The Met's search is the least trustworthy of the four:

- `q` is loose ranking: `q=zebra&hasImages=true` → 131.
- The index is **unstable between calls**: `artistOrCulture=true&q=vermeer`
  returned `total: 10` on one call and `total: 0, objectIDs: []` on
  an identical retry moments later (verified 2026-07-22). Any harvest
  script must treat a Met search response as a hint, retry across
  time, and never as ground truth.
- Search params that exist: `hasImages`, `isHighlight`,
  `isPublicDomain` (works: vermeer+PD → 46), `medium` (`Paintings` →
  11,048), `departmentId` (11 = European Paintings → 2,619),
  `dateBegin`/`dateEnd`, `artistOrCulture` (unstable, above).
- Search returns **objectIDs only** — every candidate costs a
  per-object fetch (`/objects/{id}`).

**Endpoint:** `https://collectionapi.metmuseum.org/public/collection/v1`
— GET, no key. Documented courtesy limit 80 req/s; be far politer.

### Rights & images (per-object)

`isPublicDomain: true` is the only value that clears. Images are
direct URLs: `primaryImage` (full-res) / `primaryImageSmall`; empty
string when none. PD objects generally have images; non-PD objects
return empty image fields even when `hasImages` matched.

---

## §5 Rights ledger

Per-institution rights signal → our RIGHTS basis
(`src/content/atrium/imagery/works.js`). The gate everywhere:
**absence of a stated restriction is not permission** — only an
explicit institutional statement clears.

| Institution | Field / location | Clearing values | Basis |
|---|---|---|---|
| AIC | `is_public_domain` on the object | `true` | PUBLIC_DOMAIN |
| Rijksmuseum | `subject_to[].identified_by[].content` on the **VisualItem** (hop 2) | "Public Domain" / "Publieke domein"; CC0 names | PUBLIC_DOMAIN / CC0 |
| Cleveland | `share_license_status` on the **per-object** record | `"CC0"` exactly | CC0 |
| Met | `isPublicDomain` on the object | `true` | PUBLIC_DOMAIN |

Institutions that FAILED the gate and why (do not re-litigate without
new facts): **Yale LUX** — relevant material, but empty `subject_to`
(no machine-readable rights) and 401 IIIF manifests; an adapter would
have to infer rights, which it must not.

---

## §6 Reader intent → per-institution harvest axis

The translation table: for each category (reader intent), the best
query axis at each institution. "—" means the institution shouldn't
feed that intent (weakness or no reliable axis).

| Intent | AIC (live + pins) | Rijksmuseum (pins) | Cleveland (pins) | Met (pins) |
|---|---|---|---|---|
| Old Masters | `date_start` 1400–1700 + type Painting | `type=painting&creator=<roster>` (Rembrandt, Vermeer, Hals, Steen, ter Borch, de Hooch, Heda…) | `created_after=1400&created_before=1700&type=Painting&department=European Painting and Sculpture&cc0=1` | hand-pinned ids only |
| Impressionism | artist roster (`artist_title.keyword`) | — (thin) | `artists=<name>&cc0=1` per roster name | hand-pinned ids only |
| Post-Impressionism | artist roster | `creator=van gogh` | `artists=<name>&cc0=1` | hand-pinned ids only |
| Ukiyo-e | artist roster + type Print | possible (`creator=hiroshige`) — unexplored | `department=Japanese Art` — unexplored | hand-pinned ids only |
| Landscapes | subject `[landscape, landscapes]` + type Painting | `creator=ruisdael` etc. | `q=landscape&type=Painting&cc0=1` (q filters here) | hand-pinned ids only |
| Portraits | subject `[portrait, portraits]` + type Painting | per-creator | `q=portrait&type=Painting&cc0=1` | hand-pinned ids only |

**Standing harvest discipline** (from ATRIUM-IMAGERY-SPEC.md and hard
lessons): every harvest ends in a **contact sheet for human review** —
search curates nothing, eyes do. Rights are checked per work at the
authoritative location (col. 2 of §5). URLs are taken from the API,
never hand-built (5 of 7 hand-built Commons hashes were wrong).
Watch for register (biblically/thematically on-theme is not
sufficient), name-traps (a portrait *of* a Joseph is not Joseph
imagery), and pendant/school pieces.
