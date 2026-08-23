# RISE

### Audiovisual Reader

**RISE is a browser-based environment for reading text through time, image, sound, and procedural form.**

[Enter RISE →](https://rise-v2-symbolic-experience.netlify.app/)

---

A text does not have to appear only as a page.

RISE treats reading as an experience that can unfold across multiple dimensions: words can move through time, inhabit a spatial page, coexist with works of art, enter a changing mathematical field, or be arranged into an authored audiovisual composition.

At its center is the **Chamber** — a reading instrument for combining:

- **Text**
- **Time**
- **Image**
- **Sound**

The reader chooses the conditions. RISE conducts the experience.

Alongside the Chamber, RISE carries a **Catholic devotional instrument**: the
Chapel, with the Douay-Rheims in seventy-three books, the Rosary and the
Stations of the Cross prayed on a liturgy engine at measured pace, calendar-aware
mystery sets, and sacred art pinned with verified rights. It is not an extra
room. It is the second thing this project is for, and it is built to the
standard the rest of the codebase is measured against.

---

## The Chamber

A reading begins by tuning four elements.

### Text

Bring your own `.txt` or `.md` file, paste text directly, or enter through RISE's built-in Library and curated collections.

Local text is processed in the browser. It is not uploaded to a RISE backend.

### Time

RISE can present language as a temporal stream rather than a scrolling document.

Choose a reading pace and phrasing mode, then allow the text to arrive unit by unit. Punctuation, sentence structure, authored boundaries, verse lineation, and pacing all participate in the rhythm of presentation.

### Visual

A text may coexist with:

- curated works of art,
- astronomical imagery,
- procedural fields,
- fractal flames,
- strange attractors,
- generative line systems,
- personal images,
- or no imagery at all.

Visuals may appear rhythmically, remain continuously behind the text in **Gallery**, or become part of a deliberately authored score.

Procedural imagery accompanies the text without claiming to illustrate it. The relationship is allowed to remain suggestive, stochastic, and open to interpretation.

### Audio

RISE includes browser-native sound environments, tonal systems, optional recitation, and support for authored audiovisual timing.

Sound is treated as part of the reading environment rather than as background media attached afterward.

---

## Two Ways to Read

RISE currently supports two primary projections of the same reading.

### Stream — reading in time

Text arrives sequentially according to a temporal program.

The Stream can range from restrained phrase-by-phrase reading to highly audiovisual compositions in which image and sound change alongside the text.

### Page — reading in space

The same source can be projected into a bounded typographic composition.

Page Mode preserves structural boundaries, headings, figures, and reading position while allowing the reader to move between paginated and elongated spatial forms.

The source remains the same.

Only its projection changes.

---

## The Library

RISE contains a growing curated archive of literature, philosophy, sacred texts, poetry, history, art writing, and other public-domain or appropriately licensed material.

The Library is not treated as an undifferentiated pile of downloaded books.

Source material is processed through an editorial pipeline concerned with:

- edition identity,
- division structure,
- front matter and apparatus,
- running heads and print artifacts,
- provenance,
- rights,
- visual references,
- and readable segmentation.

When RISE removes or transforms material during corpus preparation, those decisions are treated as editorial acts rather than invisible cleanup.

---

## Art, Science, and Sourced Imagery

RISE can draw from reviewed visual collections rather than unrestricted image search.

Its current visual holdings include museum collections and a curated astronomy collection assembled from sources including NASA, ESA/Hubble, and ESO.

A visual work carries its provenance and rights information with it. When attribution is required, RISE preserves that obligation through the reading surface and the **Curia**, its source and rights record.

The basic rule is simple:

> A work that cannot be shown responsibly should not be shown at all.

---

## Journeys

**Journeys** are authored long-form experiences built from the same primitives available elsewhere in RISE.

A Journey may coordinate:

- multiple texts,
- movements,
- passage boundaries,
- visual programs,
- procedural figures,
- sound,
- transitions,
- and silence.

Rather than adding a separate playback engine, Journeys compile into the same underlying reading system used by the Chamber.

They are compositions *through* RISE rather than videos exported from it.

---

## Workshop and Vault

The **Workshop** is the authoring surface.

It allows a reader to begin turning their own texts, images, sounds, and selections into structured experiences.

The **Vault** preserves those compositions.

RISE is gradually moving toward a common representation for authored experience:

```text
source
  + temporal program
  + visual program
  + audio program
  + transitions
  = experience
```

This model is designed so that a composition can eventually be authored by hand, generated with assistance, saved, exchanged, revisited, and interpreted through multiple reading projections without becoming a collection of unrelated media timelines.

---

## Solarium

The **Solarium** gives RISE a relationship to lived time.

A day is divided into temporal windows — dawn, morning, midday, afternoon, evening, night, and deep night — which can hold recurring reading practices and compositions.

The Solarium is not intended as another content library.

It answers a different question:

> **When should an experience return?**

---

## Design Principles

Several rules have emerged through the development of RISE.

### One source, multiple projections

A text's identity should not depend on whether it is being streamed, paginated, narrated, illustrated, or scored.

### Content authors; the runtime follows

An authored boundary or deliberate textual structure takes precedence over a generic heuristic.

### Absence is better than false substitution

If a requested work, sound, or visual cannot be delivered correctly, RISE prefers stillness or silence to silently replacing it with something else.

### Procedural imagery may accompany, never denote

A generated form may live beside a sentence.

It should not impersonate a historical figure, plate, artwork, or other object the source specifically points toward.

### Provenance travels with the work

Sources, visual objects, and generated material should remain distinguishable.

### Stochasticity is a medium

Not every audiovisual relationship in RISE is authored in advance.

Chance can produce transient correspondences between language and form — meanings that arise through the encounter between computation and perception rather than through literal illustration.

---

## Safety and Accessibility

RISE includes animated imagery, changing light, procedural motion, audio, and optional rhythmic visual presentation.

The project includes safety boundaries for visually intense modes and respects reduced-motion preferences where applicable.

Readers who are sensitive to flashing imagery, rapid motion, or layered sound should use the calmer presentation modes or disable those elements.

RISE is an experimental reading and creative-technology project. It makes no medical, therapeutic, or cognitive-performance claims.

---

## Privacy

RISE is browser-native.

User-provided text files are read locally in the browser and are not uploaded to a RISE server.

Some visual modes retrieve publicly hosted images from external cultural or scientific institutions. Remote-image requests are deliberately configured to avoid sending the reader's RISE page as a referrer.

---

## Development

Requirements:

- Node.js `>=20.19` or `>=22.12`
- npm

Install:

```bash
git clone https://github.com/SyberLabs/RISE.git
cd RISE
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run unit tests:

```bash
npm run test:run
```

Run browser tests:

```bash
npm run test:e2e
```

Browser tests are sharded on CI. To run one shard the way CI does:

```bash
npm run test:e2e -- --shard=1/4
```

### What CI will ask of a change

Every gate can be run locally, and a pull request has to pass all of them.

```bash
node scripts/ci-hygiene.mjs      # licences, icons, manifest, reader-facing names
npm audit --omit=dev --audit-level=high
npm run build && npm run check:first-load   # the first screen has a size budget
npm run docs:diagram             # regenerates the diagram; CI fails if it moved
npm run scriptorium:ci           # a refusal must arrive as an exit status
```

A change that touches only prose — `docs/`, `.agents/`, `.cursor/`, a root
`*.md`, `LICENSE`, `NOTICE` — skips the unit, build, Scriptorium, and browser
jobs. Hygiene and the generated docs still run, because they read those files.

---

## Architecture

RISE is primarily a client-side JavaScript application built with Vite.

```text
src/
├── audio/          Web Audio, recitation, voice and sound systems
├── components/     Chamber, Portal, Chapel, Rosarium, Curia, Library, Journeys, Scriptorium, Workshop, Vault, Sol, Via, Guide, Settings, VisualInterlocutionPanel
├── content/        archive, chapel, imagery, journeys, science, texts, personalized
├── core/           Session compilation, chunking, pacing and shared models
├── page/           Spatial composition and Page projection
├── sources/        Text and visual providers
└── visuals/        Procedural and sourced visual systems

scripts/
├── corpus preparation and auditing
├── science and museum catalog building
├── source-quality studies
└── offline media generation
```

The subsystem dependency graph is generated from these directories rather than
drawn by hand — see the diagram in
[`docs/specs/ARCHITECTURE.md`](docs/specs/ARCHITECTURE.md).

The project uses **Vitest** for unit and integration testing and **Playwright** for browser-level verification.

---

## Status

**Open Beta.**

RISE is actively developed and some systems remain experimental.

The current public application is intended to be used, explored, and tested, but the medium is still evolving. Interfaces, collections, compositions, and experimental systems may change as their roles become clearer through use.

The goal is not to finish every possible feature before release.

It is to make the existing experience coherent enough that another person can enter it, encounter something worthwhile, and return without needing its creator standing beside the door.

---

## Why RISE?

Modern computation has become extraordinarily good at capturing attention.

RISE began from a different question:

> **What else could a computational environment do for attention?**

A browser can hold more than feeds, dashboards, notifications, and optimization loops.

It can also become a place for sustained encounter with language, art, mathematical form, memory, and time.

RISE is one experiment in what that place might be.

---

## License

RISE application code is released under the [Apache License 2.0](LICENSE).

The software licence does not cover everything in this repository. The RISE and
SyberLabs names, authored Journeys and compositions, curated texts, and the
visual works held by reference each carry their own terms —
[ASSET-LICENSES.md](ASSET-LICENSES.md) sets them out, and [NOTICE](NOTICE)
travels with any redistribution.

Archive texts are public domain and remain so. Visual works are held by
reference under the licences of the institutions that hold them, and are never
redistributed from here.

---

**SyberLabs**

*Experimental systems for consciousness, computation, and human–machine experience.*
