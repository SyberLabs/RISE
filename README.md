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

**No Journey is currently published.** The compiler and the room are built, but the existing scores quote editions the Library no longer serves, and re-anchoring a composition to a different edition is an editorial act rather than a repair. They are on ice until that work is done properly.

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

RISE is client-only. There is no backend, database, or service to stand up — the whole product runs from the Vite dev server.

Requirements:

- Node.js `>=20.19` or `>=22.12`. The repository pins `20.19.0` in `.nvmrc`.
- npm

Install:

```bash
git clone https://github.com/SyberLabs/RISE.git
cd RISE
npm ci
```

Run locally on `http://localhost:5173/`:

```bash
npm run dev
```

To see the reading experience quickly: **Try RISE** → choose a reading → **Begin**. Text then streams over time with generative visuals, and the **Page** control switches to the paginated view.

Build:

```bash
npm run build
```

### Testing

```bash
npm run test:run     # unit and integration (Vitest, ~2800 tests)
npm run test:e2e     # browser tests (Playwright, Chromium)
node scripts/ci-hygiene.mjs   # properties of the committed artifacts
```

Two suites reach outside the browser and need system tools installed. `src/core/render/encode-mp4.test.js` hands real bytes to **`ffmpeg`**, and `src/core/render/chamber-paint.test.js` drives a live Chamber through **Playwright Chromium** (`npx playwright install chromium`). Without them those tests fail rather than quietly stubbing themselves.

The end-to-end suite builds the app and starts its own preview server, so do not start one yourself.

`ci-hygiene.mjs` is the closest thing to a lint gate. It checks properties of shipped artifacts that no unit test can reach: that no credential travels in a delivery URL, that every work owing a credit carries one, that every icon the page promises actually ships, and that no retired name appears in anything a stranger reads.

---

## Documentation

**[docs/README.md](docs/README.md)** indexes every document and says which are contracts the code is held to, which are historical records, and which describe work not yet built. The same pages are published to the [wiki](https://github.com/SyberLabs/RISE/wiki), generated from this repository.

Two worth reading before changing anything:

- **[docs/PROJECT-KNOWLEDGE.md](docs/PROJECT-KNOWLEDGE.md)** — the defect patterns this project keeps rediscovering, and the reasoning behind decisions that look arbitrary from outside.
- **[AGENTS.md](AGENTS.md)** — operating principles, followed by humans and coding agents alike.

---

## Architecture

RISE is primarily a client-side JavaScript application built with Vite.

```text
src/
├── audio/          Web Audio, recitation, voice and sound systems
├── components/     Portal, Keystones, Chamber, Library, Workshop, Vault,
│                   Chapel, Rosarium, Via, Scriptorium, Curia, Journeys,
│                   Guide, Settings, VisualInterlocutionPanel
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

The project uses **Vitest** for unit and integration testing and **Playwright** for browser-level verification.

`docs/specs/ARCHITECTURE.md` holds the engineering contracts these directories are expected to keep.

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
