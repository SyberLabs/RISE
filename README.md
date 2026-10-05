# RISE

**A browser-based audiovisual reader.** RISE presents text through time, image, sound, and procedural visuals, so a book can be read as a timed stream or a typeset page.

[**Live app →**](https://rise.syberlabs.io/) · [Architecture](docs/specs/ARCHITECTURE.md) · [Documentation](docs/README.md)

**Status:** Open beta · **License:** Apache 2.0 · **Built by** Mateo Robles (SyberLabs), with engineering infrastructure by Seth Carlson

---

## What it does

- **Chamber** – the reading instrument. Combine a text with a pace, visuals (museum art, NASA/ESA/ESO astronomy, fractal flames, strange attractors, or none) and Web Audio sound.
- **Stream and Page** – one source, two projections: text arriving over time, or a paginated typographic layout.
- **Library** – curated public-domain literature, philosophy, poetry, and scripture, prepared through an editorial pipeline that tracks edition, structure, provenance, and rights.
- **Chapel** – the complete Douay-Rheims Bible (73 books), plus the Rosary and Stations of the Cross paced by a liturgy engine.
- **Workshop and Vault** – author your own audiovisual compositions and save them in the browser.
- **AI reading request** (optional) – describe what you want to read and a bounded decision model picks a book and presentation from the held catalog. Bring your own model: **Connect OpenRouter** (hosted Jev, billed to your OpenRouter account) or **Run locally** (`npm run local`: RISE and pinned Kev-4B on your GPU, no hosted bill). See [docs/USER-OWNED-AI.md](docs/USER-OWNED-AI.md) and [docs/LOCAL-RISE.md](docs/LOCAL-RISE.md).
- **Journeys (unpublished draft)** – [Heaven and Household](docs/journey-editorial/editorial-work.md) is source-bound against Milton and Bryant and remains outside the public catalog.

Reading runs entirely in the browser. Your files and saved work stay in browser storage. See [Privacy](PRIVACY.md).

## Engineering highlights

- **Vanilla JavaScript single-page app** built with Vite; one-way pipeline from source text → timed units → pacing → compiled session → clock-driven player.
- **Content-addressed data plane:** book text is served as SHA-256-named JSON and verified on every read, which removed 15.4 MB from the JavaScript bundle.
- **First load of ~59 KB (brotli, 3 requests)**, held under a 64 KB budget enforced in CI.
- **~2,800 Vitest unit and integration tests** plus Playwright browser tests, including real `ffmpeg` encoding and live Chromium rendering.
- **Generated architecture diagram** and tested design contracts, so documentation cannot drift from the code.
- **Edge backend:** Cloudflare Workers serve the app and a static public decision catalog. The backend runs no AI model and holds no model credential; decisions run on the reader's own connection. Every push to `main` is rebuilt and deployed by GitHub Actions, which then checks that the live site serves that exact commit.

**Stack:** JavaScript (ES modules) · Vite · Web Audio API · Canvas 2D · IndexedDB · Cloudflare Workers · Vitest · Playwright · GitHub Actions

## Quick start

Requires Node.js `20.19+` or `22.12+` and npm.

```bash
git clone https://github.com/SyberLabs/RISE.git
cd RISE
npm ci
npm run dev        # http://localhost:5173/
```

In the app: **Try RISE** → pick a reading → **Begin**. Use **Page** to switch to the paginated view.

### RISE in ChatGPT: Composer

In ChatGPT, RISE is a Composer: the host model composes one sealed Current in a single tool call, RISE admits it, and the reader presses Begin to see it presented. Dive and realtime Live are out of current scope ([decision](docs/product/discussions/2026-10-04-composer-decision.md)).

`rise.current.v1` is that sealed input, compiled through the existing Session Compiler. It accepts bounded segments, a closed visual selection, and exact-span Dive notes, which the current product does not present. See the [contract](docs/specs/RISE-CURRENT-V1-SLICE.md) and [sample document](docs/examples/current-v1.json). To compile the sample locally:

```bash
node --input-type=module -e "import fs from 'node:fs'; import { compileRiseCurrent } from './src/core/rise-current.js'; const input = JSON.parse(fs.readFileSync('docs/examples/current-v1.json', 'utf8')); const session = compileRiseCurrent(input); console.log(session.atoms.length, session.experienceProgram.schema);"
```

This input is provider-neutral and offline. It does not yet stream model tokens, synthesize or synchronize speech, or run inside ChatGPT.

## Contributing

Read [AGENTS.md](AGENTS.md) (working principles) and [docs/PROJECT-KNOWLEDGE.md](docs/PROJECT-KNOWLEDGE.md) (known pitfalls and the reasoning behind non-obvious decisions) before changing anything.

Pull requests must pass the same checks CI runs:

```bash
npm run test:run                              # unit and integration tests
npm run test:e2e:gate                         # fast browser pass (~2 min)
node scripts/ci-hygiene.mjs                   # licenses, credits, reader-facing names
npm run security:audit && npm run security:compat
npm run build && npm run measure:first-load   # first-load size budget
npm run docs:diagram && npx vitest run src/core/system-design.test.js
npm run scriptorium:ci
```

The full test suite needs `ffmpeg` and Playwright Chromium (`npx playwright install chromium`). The browser tests start their own server. Release and rollback steps are in [docs/RELEASING.md](docs/RELEASING.md).

## Project layout

```text
src/
├── audio/        Web Audio, recitation, sound systems
├── components/   UI rooms: Chamber, Library, Chapel, Workshop, Vault, …
├── content/      Archive catalogs, Chapel, imagery, certification records
├── core/         Session compiler, chunking, pacing, player, content store
├── page/         Page projection and layout
├── sources/      Text and image providers
└── visuals/      Procedural and sourced visual systems
scripts/          Corpus preparation, catalog building, CI gates, offline media
worker/           Cloudflare Worker (public decision catalog; retired AI routes answer 410)
local/            Local RISE: launcher, loopback bridge, pinned Kev server
```

## Accessibility

RISE uses motion, changing light, and sound. It respects reduced-motion settings and offers calmer modes; readers sensitive to flashing or rapid motion should use them. RISE makes no medical or therapeutic claims.

## License

Application code is licensed under [Apache 2.0](LICENSE). Names, authored compositions, curated texts, and referenced visual works carry their own terms; see [ASSET-LICENSES.md](ASSET-LICENSES.md) and [NOTICE](NOTICE). Archive texts are public domain. Visual works are shown by reference under their holding institutions' licenses and are never redistributed from this repository.
