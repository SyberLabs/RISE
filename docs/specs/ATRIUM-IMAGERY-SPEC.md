# Atrium Imagery Service — Specification

**Status:** proposed
**Supersedes:** the `atr-` Wikimedia category system in `src/content/atrium/atrium-categories.js`
**Constraint:** must not alter Chamber behavior for any non-Atrium reading

---

## 1. Why the current system fails

The Atrium's subject imagery is built on Wikimedia Commons categories. A live
audit of all 20 `atr-` categories (2026-07-21) found the approach unsound —
not misconfigured, but structurally wrong.

**Commons categories are filing, not curation.** "Category:Thomas Paine" means
"files someone tagged as related to Thomas Paine." That correctly includes his
death mask, a modern pub sign bearing his name, a French basic-income article
quoting him, and a NASA Apollo 13 staff photo (tagged for a *Rights of Man*
quotation). None are wrong as filing. All are wrong as imagery for a reading.

Measured, against the exact filters the provider applies:

| Category | Displayable | Genuinely on-subject | Notable strays |
|---|---|---|---|
| `atr-stoicism` | 11 | 6 | Balinese toddler, children's picture books, Egyptian god Heh |
| `atr-us-declaration` | 44 | 18 | archive-sleepover event photos, 1926 postage envelope |
| `atr-marcus-aurelius` | 38 | 19 | Sarmatian campaign maps, a Brussels guildhall |
| `atr-bastille` | 36 | 22 | modern Métro sign, unrelated Don Quixote print |
| `atr-thomas-paine` | 32 | 23 | Apollo 13 staff, a house, a modern pub sign |

**The measurement itself is unreliable.** `atr-james-watt` scored clean on
every automated metric (36 displayable, 19% off-subject) and is still poor in
practice. Filename plausibility is not image quality, and no regex over titles
will become one. This is the decisive finding: the problem cannot be managed
by better filtering, because we cannot measure what we need to measure.

**The target moves.** `verifiedFiles` counts were accurate when written and are
now wrong. Any category can gain a tourist photo tomorrow. An audit of a
mutable upstream is valid only on the day it runs.

**Search does not fix it.** Free-text search against museum APIs reproduces the
same failure: the Met returns a dog kennel for "French Revolution" and an
unrelated landscape painter for "James Watt." Even title-scoped search returns
*The Death of the Virgin* for "Death of Socrates," and returns nothing at all
for objects known to exist. Search ranks; it does not curate.

**Conclusion:** the primitive must be the *work*, not the query.

---

## 2. The model: pinned works

An Atrium collection is an explicit, ordered list of specific artworks, each
pinned by stable identifier in a named collection.

```js
'atr-socrates': {
  name: 'Socrates',
  works: [
    { source: 'met', id: 436105 },   // David, The Death of Socrates, 1787
    { source: 'met', id: 437296 },
    { source: 'aic', id: 111628 }
  ]
}
```

This is what a museum exhibition is: chosen works, not a random draw from the
archive. It is more work per collection, but it is *finite*, *stable*, and —
critically — *verifiable*, because every field the reader sees comes from the
institution's own catalog record rather than from an assertion in a comment.

### What a resolved work carries

Every source adapter normalizes to one shape. Nothing display-side may invent
these fields:

```js
{
  id: 'met:436105',
  title: 'The Death of Socrates',
  artist: 'Jacques Louis David',
  artistBio: 'French, Paris 1748–1825 Brussels',
  date: '1787',
  medium: 'Oil on canvas',
  rights: 'CC0',                  // normalized; see §4
  imageUrl: 'https://…/web-large/DP-13139-001.jpg',
  fullImageUrl: 'https://…/original/DP-13139-001.jpg',
  sourceName: 'The Metropolitan Museum of Art',
  sourceUrl: 'https://www.metmuseum.org/art/collection/search/436105'
}
```

`sourceUrl` is mandatory. A curated reading must be able to cite its imagery,
and Study mode (roadmap item 2) will need exactly this.

---

## 3. Sources

Adapters are added in priority order. Each is a thin module implementing
`resolve(id) -> Work | null`.

| Adapter | API | Notes |
|---|---|---|
| `met` | `collectionapi.metmuseum.org` | No key. ~490k objects, ~400k CC0. Best for classical antiquity and European painting. |
| `aic` | `api.artic.edu` | Already implemented; reuse the existing client. |
| `rijks` | `rijksmuseum.nl/api` | Key required. Enlightenment portraiture, vast print collection. |
| `ycba` | Yale Center for British Art | Open. British Enlightenment — Paine, Watt. |
| `nypl` | NYPL Digital Collections | Key required. American and Haitian revolutionary material. |
| `cleveland` | `openaccess-api.clevelandart.org` | No key. ~60k CC0. |

Wikimedia is **retained but demoted**: usable only as an explicitly labeled
fallback for subjects no museum covers, never as the primary source for a
curated reading, and never silently.

---

## 4. Rights

`rights` is normalized to one of: `CC0`, `PUBLIC_DOMAIN`, `CC-BY`, `CC-BY-SA`,
`UNKNOWN`.

**A work whose rights cannot be established as public-domain-equivalent is not
eligible for display.** This mirrors the Atrium's existing readiness gates for
text, and it is not negotiable for the same reason: the Atrium's value is that
its material is defensible. Adapters must map their institution's own field —
never infer from the absence of a restriction.

---

## 5. Isolation from the Chamber

The hard requirement. The service must be additive.

1. **Separate module tree.** `src/content/atrium/imagery/` — the service, the
   adapters, and the collections. Nothing under `src/sources/visual/` changes
   behavior for existing categories.
2. **Registration, not modification.** The Atrium registers its collections
   through the existing `registerWikimediaCategoryResolver` seam pattern
   (content → source, never source → content), or an equivalent
   `registerAtriumImageryResolver`. The Chamber's provider registry is
   untouched.
3. **Namespace.** Ids stay `atr-` prefixed and remain absent from the browsable
   Collections list. A reader browsing categories must never encounter
   "Toussaint Louverture" as a generic option; it arrives only with the launch
   that curated it.
4. **No new Chamber defaults.** No Chamber preset, archetype, or SOL sequence
   gains an Atrium collection as a side effect.
5. **Payload boundary holds.** `imagery/` joins the `payload-boundary.test.js`
   roots: the browse graph stays metadata-only.

A test asserts (1)–(3) mechanically: the Chamber's resolved category list must
be byte-identical before and after the service is registered.

---

## 6. Caching and failure

- Resolved works are cached through the existing `SourceCache` under a
  service-specific provider id, so an Atrium launch does not warm or pollute
  Chamber caches.
- A work that fails to resolve is **skipped, not substituted.** A collection
  that resolves to zero works degrades exactly like any other empty source: the
  cortex falls back to the rest of the pool. Silent substitution would
  reintroduce the failure this spec exists to remove.
- Resolution happens at launch (handoff), never during reading.

---

## 7. Curation workflow

Because pinning is manual, the spec includes the tool that makes it tractable:

1. **Propose** — a candidate list per subject, drawn from art-historical
   reference rather than from search results.
2. **Resolve** — a script fetches each candidate and prints title, artist,
   date, medium, rights, and image dimensions.
3. **Review** — a contact sheet (static HTML) renders every candidate at
   thumbnail size. **A human looks at it.** This is the step the current system
   lacks, and no automated metric replaces it.
4. **Commit** — approved works are written to the collection with a comment
   naming the work, so a future reader of the code can verify the pin without
   an API call.

Step 3 is the point of the whole exercise. `atr-james-watt` passed every
machine check and still fails on sight.

---

## 8. Migration

Per Atrium sequence, not big-bang:

1. Build the service, the `met` adapter, and the contact-sheet tool.
2. Curate the philosophy collections (Plato, Socrates, Aristotle, Marcus
   Aurelius, Stoicism) — the strongest museum coverage.
3. Curate the history collections.
4. Delete `atrium-categories.js` only when every sequence has migrated. Until
   then both resolve, with pinned works taking precedence.
5. Correct or remove the stale `verifiedFiles` claims immediately, ahead of the
   migration, since they are currently inaccurate in shipped code.

---

## 9. Acceptance

- [ ] Every Atrium collection resolves to works with complete attribution
- [ ] Every displayed work carries a citable `sourceUrl`
- [ ] No work displays without established public-domain-equivalent rights
- [ ] Chamber category resolution is provably unchanged
- [ ] `imagery/` is inside the payload boundary
- [ ] Every shipped collection has been reviewed on a contact sheet by a human
- [ ] No stale `verifiedFiles`-style claim remains anywhere in the tree
