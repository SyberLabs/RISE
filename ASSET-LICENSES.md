# Asset Licences

The [Apache License 2.0](LICENSE) covers the RISE application code. It does
not cover everything in this repository, and it does not cover everything the
running application displays.

This file sets out the layers, because a single licence file over a project
that is part software and part curated collection would be misleading in both
directions — it would appear to grant what is not SyberLabs' to grant, and to
withhold what is already public.

Counts below are as of **2026-08-06** and are derived from the repository, not
estimated.

---

## 1. The line is drawn by what a thing is, not where it sits

An earlier version of this file drew it by directory, and the directories do
not agree with the materials. It said all program code under `src/` was Apache
2.0, and separately reserved `src/visuals/`, `src/content/atrium/` and
`src/content/chapel/` as creative work. Those directories hold both. Anyone
asking whether `src/visuals/fractal.js` was Apache-licensed code or reserved
material got two answers, which is the same as getting none.

So the boundary below follows the bytes.

## 2. Application code — Apache 2.0

**All program code in this repository**, wherever it sits — engines,
schedulers, chunkers and parsers, providers and adapters, UI components,
tests, build scripts and configuration. This includes the whole of
`src/visuals/`, which is 41 files of rendering machinery and their tests, and
the implementation modules inside `src/content/` — catalogues, handoffs,
itineraries, policies, manifests.

Apache 2.0 was chosen over MIT for three clauses that matter here: the express
patent grant (§3), the requirement that a `NOTICE` file travels with any
redistribution (§4d), and the explicit reservation of trade names and marks
(§6).

Note that `NOTICE` is informational. Apache §4d requires it to travel; it does
not itself modify the licence. This file, not `NOTICE`, is where the
boundary is described.

## 3. Names and marks — reserved

**RISE** and **SyberLabs** are not licensed by the software licence. Apache 2.0
§6 grants no rights in them beyond describing the origin of the work.

## 4. Authored content — © SyberLabs, all rights reserved

Copyright, not the software licence, governs these. They are authorship rather
than program code, and a permissive software grant is not a licence to
republish them.

**Payload files** — authored text, carrying no implementation:

| material | where |
|---|---|
| Starter sequences | `src/content/starters.js` |
| Solarium sequences | `src/content/sol-sequences.js` |
| Journey definitions and their authored programs | `src/content/journeys/demo.js`, `src/content/journeys/war.js` |
| Chapel liturgical arrangement | `src/content/chapel/liturgy/`, `src/content/chapel/chants.js` |
| Specifications and design documents | `docs/` |

**Embedded content in a code file.** Some modules are implementation that
carries an authored string table — `echoes.js` and the liturgy modules are the
pattern. Where that happens: **the implementation is Apache 2.0 and the
authored text it holds is reserved.** Running, modifying and redistributing the
module is granted; lifting the prose out of it is not.

**Curation.** The **selection and arrangement** of the collections below is
original editorial work — which pins were chosen, which were refused, and why.
The works themselves are not SyberLabs'; the curation is.

**What is not claimed.** The visual engines are Apache 2.0 without reservation,
including their output. An earlier draft reserved "procedural visual systems as
compositions" while licensing the code that produces them, which cannot both be
true: a grant to run and modify the engine is a grant to the images it draws.

## 5. Archive texts — public domain

**91 works.** Public-domain texts, principally from Project Gutenberg, ingested
with a recorded source digest and a payload digest so that what was fetched and
what is served can both be verified.

They are **not SyberLabs' to license and remain in the public domain.** Each
work's dossier records its source artifacts, edition statement and rights
basis.

Editorial preparation — division structure, apparatus removal, running-head
trimming — is described in `docs/specs/ARCHIVE-CLEANSING-SPEC.md`. Those
decisions are recorded as editorial acts; they do not create a new claim over a
public-domain text.

## 6. Visual works — held by reference, each under its own licence

**RISE holds pixels only when the institution's host will not serve them.**
A pinned work is otherwise an identifier, a credit and a rights basis; the
pixels are fetched from the institution that holds them. The exception is
the nine Icon Museum Chapel icons under `public/chapel/icons/`, held by
written permission because `iconmuseum.org` now challenges hotlinks.

### Science catalogue — 216 works

`src/sources/visual/science-catalog.generated.json`, rights verified 2026-08-06.

| source | works | licence |
|---|---|---|
| ESA/Hubble | 98 | CC BY 4.0 |
| ESO | 54 | CC BY 4.0 |
| NASA Image and Video Library | 64 | Public domain; NASA asks to be acknowledged as the source |

Every one of the 152 CC BY works carries a composed credit naming both the
creator and the licence, and it is shown whether or not the reader has enabled
optional labels. Where a provider's credit runs too long for the reading
surface, the full text is held in the Curia — which is what makes the
shortening permissible under CC BY 4.0 §3(a)(3).

**These rights are frozen at harvest**, unlike the museum adapters, which
re-verify per object at render. `scripts/build-science-catalog.mjs` is the
controlled refresh.

### Museum collections — pinned by accession

| collection | pins | institutions |
|---|---|---|
| Museum categories | 1,340 | Art Institute of Chicago 621, Rijksmuseum 560, Cleveland Museum of Art 159 |
| Chapel | 284 | Cleveland 81, Metropolitan Museum of Art 75, Rijksmuseum 66, Art Institute 62 |
| Atrium | 75 | Metropolitan Museum of Art 70, Cleveland 5 |

All are CC0 or public domain as declared by the holding institution. The
Cleveland and Rijksmuseum adapters re-verify each object's rights declaration
at resolution rather than trusting the pin.

### Audubon plates — 585

`src/sources/visual/audubon-catalog.generated.json`. Public domain, from the
Cincinnati & Hamilton County Public Library (435 *Birds of America* plates) and
the University of Michigan Library Digital Collections (150 *Viviparous
Quadrupeds*).

### Chapel icons — 14

Nine are used by **written permission** from the holding institution, with the
grant's stated conditions honoured verbatim in the attribution; five are public
domain. A loaned work was deliberately not pinned: an `L` accession is a loan,
and a lender's rights are not the museum's to grant.

## 7. Dependencies

Third-party packages retain their own licences. See `package.json` and the
installed packages' own licence files.

---

## The rule the whole arrangement follows

> A work that cannot be shown responsibly should not be shown at all.

In code this is `artworkMayBeShown` — a work owing a credit that cannot be
composed is withheld rather than displayed bare. It is the same rule as the
imagery's older law, one clause changed: *a work that will not resolve is
absent, never a broken frame.*

---

*This file describes how the project treats its materials. It is not legal
advice, and it is not a substitute for the licences it points at.*
