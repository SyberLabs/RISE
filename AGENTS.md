# AGENTS.md

Guidance for anyone (human or agent) working on RISE. Standard commands live in
`package.json` scripts and `README.md#development` (`npm run dev`, `build`,
`test:run`, `test:e2e`); the notes below are only the non-obvious things.

## Architecture at a glance

RISE is a **client-only browser app** (vanilla-JS SPA built with Vite). There is
**no backend, database, or external service to stand up** — user text is
processed in the browser, and remote content (museum/text APIs) is fetched
anonymously and degrades gracefully when unreachable. The whole product runs
from the Vite dev server.

## Environment / setup

- Node: repo pins `20.19.0` (`.nvmrc`/`.node-version`); `engines` also allows
  `>=22.12`.
- Install deps with `npm ci`.
- The full test suite needs two system tools: **`ffmpeg`** and a **Playwright
  Chromium** browser (`npx playwright install chromium`, or
  `npx playwright install --with-deps chromium` if Chromium can't launch due to
  missing shared libraries). Without them, the two tests noted below fail/skip
  rather than being stubbed.

## Testing / build gotchas

- Full unit suite (`npm run test:run`) is large (~2800 tests, ~2 min). Two paths
  need the system tools above: `src/core/render/encode-mp4.test.js` hands real
  bytes to `ffmpeg`, and `src/core/render/chamber-paint.test.js` launches
  Playwright Chromium against a live Chamber stage.
- E2E (`npm run test:e2e`) is self-contained: `scripts/playwright-global-setup.mjs`
  builds the app and starts `vite preview` on `127.0.0.1:4317` itself, with
  `VITE_RISE_ARCHIVE_REVIEW=1`. Do **not** start a server manually. It runs
  Chromium only, single worker, with autoplay forced on (Web Audio).
- There is **no lint script**. The closest CI gate is source hygiene:
  `node scripts/ci-hygiene.mjs` (the `hygiene` CI job).

## Running / manual testing

- `npm run dev` serves on `http://localhost:5173/`. The Vite dev server also
  mounts dev-only middleware (Curia `POST /__curia/apply`, Export-MP4) that does
  not exist in the production build.
- Quickest path to exercise the core reading experience in the UI:
  Portal hub → **Try RISE** → pick a canonical reading (e.g. Meditations) →
  **Begin**. Text then streams over time with generative visuals; the **Page**
  control switches to a paginated text view.
- The app persists state in the browser (localStorage/IndexedDB), so a reload
  may land directly on the Portal hub and skip the first-run intro screen.

## Cursor Cloud specific instructions

- The base VM image already carries `ffmpeg` and Chromium's system libraries, so
  the startup update script only needs `npm ci` and `npx playwright install
  chromium` (no `sudo`/apt).
