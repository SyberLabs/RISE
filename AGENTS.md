# AGENTS.md

## Cursor Cloud specific instructions

RISE is a **client-only browser app** (vanilla-JS SPA built with Vite). There is
**no backend, database, or external service to stand up** — user text is
processed in the browser, and remote content (museum/text APIs) is fetched
anonymously and degrades gracefully when unreachable. The whole product runs
from the Vite dev server.

Standard commands live in `package.json` scripts and `README.md#development`
(`npm run dev`, `build`, `test:run`, `test:e2e`). Notes below are only the
non-obvious things.

### Environment / setup

- Node: repo pins `20.19.0` (`.nvmrc`/`.node-version`); `engines` also allows
  `>=22.12`. The VM's default Node 22.x satisfies `engines` and is what this
  environment is validated against.
- The startup update script runs `npm ci` and `npx playwright install chromium`.
  Chromium's **system** libraries and **ffmpeg** are already in the base image,
  so no `sudo`/apt is needed. If Chromium ever fails to launch on a fresh VM
  (missing shared libs), run `npx playwright install --with-deps chromium`.

### Testing / build gotchas

- Full unit suite (`npm run test:run`) is large (~2800 tests, ~2 min). Two
  paths need the system tools above: `src/core/render/encode-mp4.test.js` hands
  real bytes to `ffmpeg`, and `src/core/render/chamber-paint.test.js` launches
  Playwright Chromium against a live Chamber stage. Without those tools these
  tests fail/skip rather than being stubbed.
- E2E (`npm run test:e2e`) is self-contained: `scripts/playwright-global-setup.mjs`
  builds the app and starts `vite preview` on `127.0.0.1:4317` itself, with
  `VITE_RISE_ARCHIVE_REVIEW=1`. Do **not** start a server manually. It runs
  Chromium only, single worker, with autoplay forced on (Web Audio).
- There is **no lint script**. The closest CI gate is source hygiene:
  `node scripts/ci-hygiene.mjs` (the `hygiene` CI job).

### Running / manual testing

- `npm run dev` serves on `http://localhost:5173/`. The Vite dev server also
  mounts dev-only middleware (Curia `POST /__curia/apply`, Export-MP4) that does
  not exist in the production build.
- Quickest path to exercise the core reading experience in the UI:
  Portal hub → **Try RISE** → pick a canonical reading (e.g. Meditations) →
  **Begin**. Text then streams over time with generative visuals; the **Page**
  control switches to a paginated text view.
- The app persists state in the browser (localStorage/IndexedDB), so a reload
  may land directly on the Portal hub and skip the first-run intro screen.
