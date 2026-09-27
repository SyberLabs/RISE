# RISE — engineering overview

A recruiter- and hiring-manager-scannable summary of what this codebase is and what was engineered. For the product story, see [README.md](../README.md). For the full architecture, see [specs/ARCHITECTURE.md](specs/ARCHITECTURE.md).

## What it is (30 seconds)

RISE is a **browser-first application** — an audiovisual reading environment. Text is compiled into timed atoms, played by a clock-driven engine, and painted in a Chamber over procedural visuals and Web Audio. Reading runs entirely in the browser; a small Cloudflare Worker serves the app and the optional Ask Jev book recommendation.

Live app: [rise.syberlabs.io](https://rise.syberlabs.io/)

**Try in 60 seconds:** Portal → **Try RISE** → **Meditations** → **Begin**. Text streams over generative visuals. Use **Page** for the spatial projection.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Browser (Vite SPA, vanilla JS) |
| Build | Vite 7, content-addressed data plane |
| Tests | Vitest (~2,800 unit), Playwright (browser smoke) |
| Audio / visuals | Web Audio API, Canvas 2D, procedural engines |
| Production deps | 3 (`sql.js`, Neon serverless driver, Upstash Redis client) |
| Deploy | Cloudflare Workers, gated GitHub Actions release with rollback |
| Recommendation service | Cloudflare Worker, Neon PostgreSQL, Upstash Redis, OpenRouter |

## Architecture (one diagram)

```text
index.html → app.js
  Router → Portal, Library, Chamber, Chapel, Workshop, …
  SessionCompiler → Chunker → Pacing → Session
  Player (clock) + Chamber (renderer)
  ContentStore (hash-verified fetch + Cache Storage)
  AudioEngine + VisualCortex
```

Immutable reader content (books, scripture) lives in `/content/<sha256>.json`, not in the JavaScript bundle. The hash is the URL; bytes are verified on every read.

## Measurable outcomes (recent)

| Metric | Before | After |
|--------|--------|-------|
| First load (brotli) | ~252 KB / 10 requests | **~59 KB / 3 requests** |
| Book text in JS bundle | 15.4 MB (83% of JS) | **0** |
| `dist/` JavaScript | ~18 MB | **~3 MB** |
| Dead code removed | — | **~4,600 lines** |
| Unit tests | ~2,800 | ~2,800 (0 failed) |

First-load budget is enforced in CI (`npm run measure:first-load`, ceiling 64 KB brotli).

## Engineering practices

- **Certification chain:** edition identity tied to bytes; re-ingest withdraws certification; models flag, humans disposition. First certified work: *Meditations* (see `src/content/archive/certifications.json`).
- **Living architecture doc** with test guards (`src/core/system-design.test.js`) so diagrams and room registers cannot drift from code.
- **CI:** every pull request runs build, hygiene, security, first-load budget, and design-contract checks; full unit tests (ffmpeg + Chromium for real encode/paint paths), Scriptorium CLI exit-status matrix, and sharded browser tests run on `main`.
- **Content plane:** build-time manifest + runtime `ContentStore` with digest verification (same pattern as content-addressed storage in distributed systems, without adding a server).

## Interview whiteboard path

If asked to explain the core loop in five minutes:

1. **Source record** (text + metadata) enters `session-compiler.js`.
2. **Chunker** breaks text into atoms (word / phrase / line) with durations.
3. **Pacing curve** modulates atom timing; boundaries stay locked.
4. **Session** is the compiled artifact (atoms + visual/audio programs).
5. **Player** advances the clock; **Chamber** paints the current atom; **VisualCortex** dispatches flashes on eligible boundaries.

One source, multiple projections: the same Session feeds Stream (temporal) and Page (spatial).

## Repository map

```text
src/core/           Session compiler, player, content store, chunker
src/components/     UI rooms (Chamber, Portal, Library, …)
src/content/        Archive catalogues, Chapel, certification records
src/visuals/        Procedural engines, visual cortex
scripts/            Corpus ingest, CI gates, offline render, certification prep
docs/specs/         Architecture and contracts
```

## Author

Mateo Robles (SyberLabs) — product vision, editorial authority, UX. Engineering infrastructure and system design review: Seth Carlson.
