# Curation-only imagery — retiring Universal Diagrams

*Written 2026-07-28, opening the stint after the Page Mode hardening pass.
Supersedes the Wikimedia portion of SOURCE-EXPANSION-SPEC.md, which assumed
the searched categories would stay.*

---

## 0. The rule

**Every image the system can show is a work someone chose. There is no
keyword-searched imagery anywhere in R.I.S.E.**

This is now a standing invariant, alongside reverent degradation and pinned
sacred imagery. It applies to the sources that exist and to every source added
hereafter.

The Universal Diagrams (Wikimedia) family is retired in full — not curated
down, not partially salvaged. Retired.

---

## 1. Why the rule, and why total

The ten Universal Diagrams categories were **live keyword searches against
Wikimedia category trees**. The museum collections are **pinned accessions**.
A pinned work was chosen once and stays chosen; a searched category returns
whatever the tree holds on the day you ask.

A live audit of all ten (2026-07-28, Commons API, 40 members each) found the
searched shape failing in every way it can fail:

| id | what the search actually returns |
|---|---|
| `microscopy` | **n=0 — the category does not exist on Commons** |
| `solar` | `Category:Sun` is topical: an .ogg audio file, French springs, the Luxor temple |
| `sacred` | contemporary hobbyist "sacred geometry" — the exact woo the system has outgrown |
| `geometry` | `1690625457877-image.png`, `15brezinys-2.png` — scratch files |
| `fractals` | amateur 3D renders; we already GENERATE fractals, better |
| `astronomy` | mostly a *Little of Earth* PNG series, not diagrams |
| `botany` | real plates mixed with colonial-era ethnographic material |
| `haeckel`, `anatomy`, `romantic` | good **today** |

The last row is the reason for total retirement rather than salvage. Haeckel
and the Wellcome anatomical plates are genuinely fine right now — and that is
exactly the trap. Their quality is **an accident of what the category holds
this week**, not a property of anything we control. Keeping them would preserve
the searched *mechanism* while pretending the quality problem was about taste.
The mechanism is the problem.

If those plates are worth showing — and Haeckel plainly is — they are worth
**pinning**, one accession at a time, like every museum work. That is a content
task, not a provider task.

`microscopy` is the other half of the argument. It returned nothing for its
entire life and nobody noticed, because reverent degradation did what it
promises: a work that will not resolve is simply absent. The doctrine is
correct and stays. But it means a searched source can rot invisibly, and a
pinned one cannot.

---

## 2. Why this blocks the source expansion

NASA and the other planned sources were going to arrive **in the same shape** —
a provider wrapping a live query. The audit says that shape does not meet the
floor the museum collections set, so adding more of it multiplies the problem
before fixing it.

Retire first; establish the pinned pattern; then expand into it. NASA imagery
enters as chosen plates with attribution, exactly as a museum work does.

This is North Star §6 restated at the source layer — *reverence over
completeness*. A source that cannot promise a good image should not promise one.

---

## 3. The migration constraint (do not skip)

These ids are load-bearing. Grepped 2026-07-28:

- **`src/components/Vault.js`** — vault presets cite `geometry`, `fractals`
  (line 81) and `haeckel`, `botany` (line 108).
- **`src/content/atrium/collections.js`** — **34 mappings** across 82 total:
  `geometry` ×9, `sacred` ×9, `astronomy` ×5, `botany` ×4, `microscopy` ×2,
  `anatomy` ×2, `solar` ×2, `fractals` ×1.

**A deletion is therefore not a deletion; it is a migration.** Removing
`geometry` outright would strip imagery from nine philosophy collections, and
reverent degradation would hide the loss exactly as it hid `microscopy`.

Every retired id needs an explicit decision:

- **re-point** — to a pinned collection or an existing museum id; or
- **drop deliberately** — the collection reads with no sourced imagery. This is
  a legitimate and often better outcome; many readings are stronger plain, and
  a philosophy collection with no honest image should show none.

Dropping must be a decision on the record, never a silent consequence.
No id is deleted until its dependents are re-pointed and a test asserts the
new mapping.

---

## 4. Page Mode gap — the structural cause

Universal Diagrams do not render in Page Mode because Wikimedia categories are
**bare ids** (`haeckel`, `botany`) while every other family is **namespaced**
(`aic-*`, `chapel-*`, `atr-*`, `dore:*`). `_getProviderForCategory` dispatches
on prefix, so a bare id falls through every namespaced branch.

Full retirement closes this gap by removing the only unnamespaced family.
Anything later pinned from these plates enters under a namespace and works in
Page Mode from its first day.

Constraint: `aic-*` ids are a vault dependency and are never renamed.

---

## 5. Absence must be observable

`microscopy` is the lesson. Reverent degradation is right for the *reader* — a
broken frame is worse than silence — but it must not be silent to the
*maintainer*.

A test should probe every registered collection and fail when one resolves to
zero works. Cheap, and it would have caught this the day it broke. Same class
of gap as the earlier lesson that a test's fixtures must not be better-behaved
than real input.

Under curation-only this check becomes strong rather than advisory: a pinned
collection resolving to zero is unambiguously a defect, because nothing about
it depends on what a remote tree holds today.

---

## 6. The Collections IA

The panel currently shows a flat list of 10+ categories under one accordion.
The proposed regrouping — **style** vs **subject** — is the right instinct and
is the same progressive-disclosure move as North Star §4 (stances).

Settle it *after* the retirement. With Universal Diagrams gone the surviving
set is museum collections only, which may not want two headings at all — the
grouping should be designed against what actually remains.

---

## 7. Order of work

1. **Re-point or deliberately drop** every dependent: 34 Atrium mappings, 2
   Vault presets. Tests first — the mapping is the contract.
2. **Retire the Wikimedia family in full**, including the provider's category
   registry. Keep the provider module only if the Atrium's `atr-*` resolver
   still needs it; otherwise retire that too.
3. **Add the absence check** (§5).
4. **Regroup the panel** (§6).
5. **Then** the source expansion (NASA and beyond) enters as pinned works.

### Tranche 2 — the Atrium's atr- categories (DONE, 2026-07-28)

The twenty `atr-` categories were searched too, and are retired. Two
things made this smaller and clearer than expected:

- **A successor already existed.** `imagery/collections.js` holds eleven
  PINNED collections naming museum accessions with artist, title, and
  date — David's *Death of Socrates*, Testa's *Plato's Symposium*. Six
  ids lived in BOTH registries, and the cortex checks pinned first, so
  those were already resolving to real works. Emptying the searched
  registry removed a shadow, not imagery.
- **A prior audit (2026-07-21) had already reached this conclusion** and
  marked the module deprecated, recording the sharpest statement of the
  problem: *Commons categories are FILING, not curation*, and *filename
  plausibility is not image quality*.

That last line corrected this pass's own method. A file-type audit
scored these pools at 90%+ "artwork" — Plato in art 91%, Marcus Aurelius
93% — which looked like grounds to keep them. Inspecting the actual
titles showed the rasters were coins, genealogical charts, a Brussels
building facade, an Esperanto book cover, and a Wellcome engraving of a
woman with a bird on her head. **The metric was measuring file
extensions and calling it curation.** Any future source audit must look
at what the images ARE, not at what the filenames suggest.

No reading lost imagery: every affected record was already overridden by
`imageryPlanFor` (conceptual → fractal, liberation → the Freedom field,
mechanism → blueprint), and all 44 records still resolve to either
pinned works or a procedural engine.

---

## 8. Invariants

- **Curation-only: every image is a chosen work. No keyword-searched imagery.**
  (New, established here.)
- `aic-*` ids are never renamed (vault dependency).
- Sacred imagery is pinned, never searched. Retiring the `sacred` *category* is
  this invariant finally applied evenly — it was a keyword search wearing a
  sacred name, which is precisely what the rule forbids.
- Reverent degradation holds for the reader; §5 adds observability for the
  maintainer without weakening it.
- Content authors; the runtime follows; the cortex renders. Re-pointing a
  collection is a CONTENT decision and belongs in the content layer.
