# RISE Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four stated constraints with the three real ones, and reshape RISE into five layers (content, engine, shell, intelligence, build) with five rooms, real URLs, no server state, and compressed content.

**Architecture:** The engine (compiler, player, two projections) is untouched. The shell gains a URL adapter and collapses twenty rooms into five behind route aliases. The Worker loses its database-backed catalog route; recommendations run entirely in the browser on the reader's provider. Recitation is encoded to Opus at build and content stays out of the module graph.

**Tech Stack:** Vanilla JS, Vite, Vitest (jsdom), Playwright, Cloudflare Workers static assets, ffmpeg (build only).

**Spec:** `docs/superpowers/specs/2026-10-03-rise-architecture-redesign-design.md`

## Global Constraints

- Node `20.19.0` (`.nvmrc`); install with `npm ci`; run `npm run audio:hydrate` before the unit suite or browser tests.
- Every task is one pull request merged through the required `CI` check, then the live release is verified. No auto-merge.
- `docs/specs/ARCHITECTURE.md` is edited in the same pull request as the code it describes. Its rooms table must match `src/components/*.js` in both directions, every §8 entry needs **Chosen**, **Rejected**, **Why**, **Status** (`settled | open | deferred | reversed`), and the generated diagram between the `GENERATED DIAGRAM` markers is regenerated with `npm run docs:diagram`, never hand-edited.
- `src/core` and `src/visuals` never import `src/components`.
- Out of scope, by owner decision: `src/enterprise/`, kev-check, the render mill, Live Realtime, the MCP relay, the engine layer.
- Old route ids (`portal`, `chapel`, `rosarium`, `via`, `journeys`, `keystones`, `mint`, `today`, `curia`, `workshop`, `vault`, `scriptorium`, `visual-lab`, `visual-catalog`, `emotions`, `chamber`, `chamber-session`, `live`, `library`, `settings`) stay valid for `router.navigate()` for the whole migration.
- Before pushing any task: `npm run test:e2e:gate`, `npx vite build`, `npm run measure:first-load`.

---

## File map

| Path | Responsibility after this plan |
|---|---|
| `docs/specs/ARCHITECTURE.md` | the living spec; §2 three constraints, §5 five rooms, §8 pruned |
| `src/core/system-design.test.js` | guards the spec; gains a §2 check and a four-dependency count |
| `src/core/route-url.js` (new) | pure mapping: route id + data ↔ URL path, plus the alias table |
| `src/core/route-url.test.js` (new) | the mapping, both directions, every alias |
| `src/core/router.js` | calls the mapping on navigate; resolves it on load and `popstate` |
| `src/app.js` | loses BetaGate and the ad-hoc `pushState` branches; one `popstate` handler |
| `src/app/route-manifest.js` | five routed rooms |
| `index.html` | five `view-*` containers |
| `src/components/Read.js`, `Library.js`, `Make.js`, `Settings.js`, `Home.js` | the five rooms; former rooms become their panes or tabs under `src/components/<room>/` |
| `src/core/decision/browser.js` | reads `/content/catalog.json`, not `/api/decision-catalog` |
| `worker/index.mjs`, `wrangler.production.jsonc`, `package.json` | no decision route, no Neon, no Redis, no limiter, no secrets |
| `scripts/build-voice-pack.mjs`, `scripts/hydrate-recitation.mjs`, `src/audio/voice-pack.manifest.json` | Opus recitation |
| `src/core/render/voice-pcm.js` | decodes Opus via `ffmpeg` for export |

---

### Task 1: State the three real constraints

**Files:**
- Modify: `docs/specs/ARCHITECTURE.md:38-61` (§2), `docs/specs/ARCHITECTURE.md:394-415` (§7)
- Test: `src/core/system-design.test.js`

**Interfaces:**
- Produces: a §2 with exactly three numbered items whose first words are `No shared inference`, `A browser, no account`, `Content is static and content-addressed`. Later tasks cite them as §2.1, §2.2, §2.3.

- [ ] **Step 1: Write the failing test** — append to the first `describe` in `src/core/system-design.test.js`:

```js
it('states three constraints, and the four old policies live in §7', () => {
    const section = text.split(/^## 2\. /mu)[1].split(/^## 3\. /mu)[0];
    const items = section.match(/^\d+\. \*\*/gmu) || [];
    expect(items.length, '§2 must list exactly three constraints').toBe(3);
    expect(section).toMatch(/\*\*No shared inference\.\*\*/u);
    expect(section).toMatch(/\*\*A browser, no account\.\*\*/u);
    expect(section).toMatch(/\*\*Content is static and content-addressed\.\*\*/u);
    const contracts = text.split(/^## 7\. /mu)[1].split(/^## 8\. /mu)[0];
    for (const policy of ['Reverent degradation', 'Provenance travels with the work', 'Structure is read, never inferred']) {
        expect(contracts, `${policy} belongs in §7`).toContain(policy);
    }
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/core/system-design.test.js`. Expected: FAIL, `§2 must list exactly three constraints` (received 4).

- [ ] **Step 3: Rewrite §2** to this, verbatim:

```markdown
## 2. The three constraints that decide everything else

Every decision in §8 is downstream of these. They are the axioms; everything
else is a recommendation.

1. **No shared inference.** Every model call runs on the reader's own key or
   on the reader's own machine. RISE never pays for a reader's thinking.
2. **A browser, no account.** There is no identity service and no server-side
   reader state. Nothing a reader types or reads leaves their device unless
   they send it.
3. **Content is static and content-addressed.** Editions, recitation, imagery
   and programs are files named by their hash, built from a content branch
   into `dist/`, and never part of the module graph.
```

- [ ] **Step 4: Move the three policies into §7** as three new bullets at the top of the contracts list:

```markdown
- **Reverent degradation.** A work, image or sound that will not resolve is
  *absent* — never a broken frame, never a substitute. Silence outranks
  approximation.
- **Provenance travels with the work.** A reader can always tell a received
  text from one written here, and every visual carries its rights. The build
  scripts refuse a work without a rights basis.
- **Structure is read, never inferred.** An ingest may not destroy a
  distinction the source made, and may not re-guess one it discarded.
```

Then search the file for `§2.1`, `§2.2`, `§2.3`, `§2.4` and `§2 constraints` and repoint each to the new numbering or to §7 (`grep -n '§2' docs/specs/ARCHITECTURE.md`).

- [ ] **Step 5: Run the guard and the diagram** — `npx vitest run src/core/system-design.test.js && npm run docs:diagram && git diff --stat docs/specs/ARCHITECTURE.md`. Expected: PASS; the diagram leaves no extra diff.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/ARCHITECTURE.md src/core/system-design.test.js
git commit -m "State the three constraints that decide RISE, and demote four policies to contracts"
```

---

### Task 2: Delete BetaGate

**Files:**
- Delete: `src/components/BetaGate.js`, `src/components/BetaGate.css`, any `src/components/BetaGate*.test.js`
- Modify: `src/app.js:16` (import), `src/app.js:140-240` (the gate mount), `docs/specs/ARCHITECTURE.md` (rooms table row, §7 bullet, any §8 mention)
- Test: `src/app.safety.test.js`, `src/core/system-design.test.js`, `e2e/` specs that mention the gate (`grep -rln "BetaGate\|beta-gate\|invite" e2e src --include='*.test.js'`)

**Interfaces:**
- Produces: the app boots straight to the first screen. The audio-unlock gesture the gate used to provide (`src/app.js:147` comment) moves to the first screen's own begin control. Confirm with `grep -n "resumeAudio\|unlockAudio\|AudioContext" src/app.js src/components/Portal.js`.

- [ ] **Step 1: Write the failing test** in `src/app.safety.test.js`:

```js
it('boots with no invitation gate', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/BetaGate/u);
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/app.safety.test.js -t "no invitation gate"`. Expected: FAIL.
- [ ] **Step 3: Remove the import and the mount.** Where `new BetaGate(gateContainer, {...})` was, call the callback it used to call on admission directly (read the `onAdmit`/`onEnter` option passed at `src/app.js:223` and inline its body). Delete the two component files and the gate's container from `index.html` if one exists (`grep -n gate index.html`).
- [ ] **Step 4: Fix the browser suite.** Any `e2e/*.spec.js` that clicks through the gate loses those steps. Run `npm run test:e2e:gate`. Expected: PASS.
- [ ] **Step 5: Update the spec.** Remove the BetaGate row from the rooms table, the §7 bullet about it, and add to §8:

```markdown
### 8.41 There is no invitation gate

- **Chosen:** the first screen is the first screen.
- **Rejected:** `BetaGate`, which shipped invite codes to the browser.
- **Why:** a gate that admits to being "not a security boundary" (former §7)
  costs a click and a module on every first visit and locks nothing. §2.2
  rules out the only version that would.
- **Status:** settled.
```

- [ ] **Step 6: Run the guards** — `npx vitest run src/core/system-design.test.js src/app.safety.test.js`. Expected: PASS.
- [ ] **Step 7: Commit** — `git commit -am "Delete BetaGate: a door that locked nothing"`.

---

### Task 3: Serve the catalog as a static file and delete the database

**Files:**
- Modify: `scripts/lib/content-plane.mjs` (write `public/content/catalog.json`), `src/core/decision/browser.js:10` (`CATALOG_PATH`), `worker/index.mjs:34-48`, `wrangler.production.jsonc` (secrets, ratelimits), `package.json` (drop `@neondatabase/serverless`, `@upstash/redis`), `package-lock.json` via `npm uninstall`
- Delete: `worker/decision-catalog.mjs`, `worker/decision-catalog-netlify.test.js`, `scripts/seed-rise-books.mjs`, `scripts/seed-rise-books.sql`, `scripts/seed-rise-sounds.sql`, `scripts/seed-jev-options.sql`
- Test: `src/core/decision/browser.test.js` (exists? `ls src/core/decision/*.test.js`), `worker/index.test.js`, `src/core/system-design.test.js:139-151`

**Interfaces:**
- Consumes: `readPublicCatalog(body)` from `src/core/decision/catalog.js` — it already validates the JSON shape the Worker returned. The static file must satisfy the same shape; read `catalog.js` and the Neon query in `worker/decision-catalog.mjs` and emit the same fields.
- Produces: `GET /content/catalog.json` → the public catalog; `CATALOG_PATH = '/content/catalog.json'`.

- [ ] **Step 1: Write the failing test** in `src/core/decision/browser.test.js`:

```js
it('reads the catalog from the static content plane, not an API', async () => {
    const { CATALOG_PATH, loadPublicCatalog, resetCatalogForTests } = await import('./browser.js');
    resetCatalogForTests();
    expect(CATALOG_PATH).toBe('/content/catalog.json');
    const calls = [];
    const fetcher = async (url) => { calls.push(url); return { ok: true, json: async () => validCatalogFixture }; };
    await loadPublicCatalog(undefined, { fetcher });
    expect(calls).toEqual(['/content/catalog.json']);
});
```
  where `validCatalogFixture` is the smallest object `readPublicCatalog` accepts (copy one from an existing catalog test).

- [ ] **Step 2: Run it** — expected FAIL on the path.
- [ ] **Step 3: Emit the file.** In `scripts/lib/content-plane.mjs`, after the manifest is built, write `public/content/catalog.json` with the same fields `worker/decision-catalog.mjs` selected from Neon, sourced from the works manifest. Add a unit test in `scripts/lib/content-plane.test.mjs` (exists? check) asserting the file parses with `readPublicCatalog`.
- [ ] **Step 4: Change the path** in `browser.js` and run step 1's test. Expected: PASS.
- [ ] **Step 5: Delete the server side.** Remove the `/api/decision-catalog` block from `worker/index.mjs` so unknown `/api/*` fall through to the existing 404. Delete the files listed above. `npm uninstall @neondatabase/serverless @upstash/redis`. Remove `secrets` and `ratelimits` from `wrangler.production.jsonc`.
- [ ] **Step 6: Update the dependency guard.** In `src/core/system-design.test.js:146-150` change `6` → `4` and the sentence match to `/four production dependencies/u`; in `ARCHITECTURE.md` §8.10 reword the sentence to "four production dependencies" and drop the two from its list. In §1 remove the PostgreSQL and Redis sentences. Add to §8:

```markdown
### 8.42 The catalog is a file

- **Chosen:** `public/content/catalog.json`, written by the content-plane build.
- **Rejected:** Neon PostgreSQL behind an Upstash Redis cache behind a rate
  limiter, serving the same fifteen rows.
- **Why:** §2.3. A catalog of fifteen editions that changes on an editorial
  act is content. It needs no database, no cache, no secrets and no limiter,
  and removing them removes the Worker's only state and two of six production
  dependencies.
- **Status:** settled.
```

- [ ] **Step 7: Run** `npx vitest run src/core worker && npx vite build && npm run measure:first-load`. Expected: PASS. Deploy note for the coordinating agent: remove the three secrets from the Cloudflare dashboard after the release is verified.
- [ ] **Step 8: Commit** — `git commit -am "Serve the catalog as a static file; delete Neon, Redis and the decision route"`.

---

### Task 4: Encode recitation as Opus

**Files:**
- Modify: `scripts/build-voice-pack.mjs:220-280` (write `.opus` via `ffmpeg`, manifest `format: 'opus'`, `mimeType: 'audio/ogg; codecs=opus'`), `scripts/hydrate-recitation.mjs` (restore the `.opus` tree), `src/audio/voice-pack.manifest.json` (regenerated), `src/audio/voice.js:411` (decode path, already uses `decodeAudioData`, which decodes Opus in Chromium, Firefox and Safari 17+), `src/core/render/voice-pcm.js` (export decode: shell out to `ffmpeg -i in.opus -f wav -` instead of `decodeWav`)
- Test: `scripts/build-voice-pack.test.mjs` (exists? check; create if not), `src/core/render/voice-pcm.test.js`, `src/core/render/encode-mp4.test.js`

**Interfaces:**
- Produces: manifest entries `{ asset: '/audio/recitation/<voice>/<key>.opus', mimeType: 'audio/ogg; codecs=opus' }`; `pack.format === 'opus'`.

- [ ] **Step 1: Write the failing test** in `src/core/render/voice-pcm.test.js`:

```js
it('accepts an opus asset path and decodes it to PCM', async () => {
    const pcm = await loadVoicePcm({ asset: '/audio/recitation/af_heart/fixture.opus' }, { root: FIXTURE_ROOT });
    expect(pcm.sampleRate).toBe(48000);
    expect(pcm.channelData[0].length).toBeGreaterThan(0);
});
```
  (adapt the exported function name to the one `voice-pcm.js` actually exports; create a two-second fixture with `ffmpeg -f lavfi -i sine=frequency=440:duration=2 -c:a libopus -b:a 64k src/core/render/fixtures/fixture.opus`).

- [ ] **Step 2: Run it** — expected FAIL (`.opus` rejected by the `.wav` check).
- [ ] **Step 3: Change the build.** In `build-voice-pack.mjs`, after `audio.toWav()`, pipe the bytes through `ffmpeg -f wav -i pipe:0 -c:a libopus -b:a 64k -ac 1 -ar 48000 -f ogg pipe:1` with `execFileSync`, write `${key}.opus`, set the manifest fields. Use `execFileSync('ffmpeg', [...], { input: wav })`.
- [ ] **Step 4: Change the export decode** in `voice-pcm.js`: when the asset ends in `.opus`, run `ffmpeg -i <path> -f f32le -ac 1 -ar 48000 pipe:1` and wrap the result as the same PCM object `decodeWav` returned. Keep `decodeWav` for the mixer's own `mix.wav`.
- [ ] **Step 5: Regenerate the pack** on the audio branch: `npm run release:voice:build`, commit the `.opus` tree to `rise/audio-assets`, update `hydrate-recitation.mjs` to restore that tree, and delete the WAV files from the branch in the same commit so the branch does not double.
- [ ] **Step 6: Run** `npm run audio:hydrate && npx vitest run src/core/render src/audio && npm run test:e2e:gate`. Expected: PASS. Record `du -sh public/audio/recitation` before and after in the pull request body.
- [ ] **Step 7: Spec.** Mark §8.5 **Status:** `reversed` with one line: "Reversed 2026-10: recitation is Opus at 64 kbps; §9's largest cost is gone." Remove the matching §9 bullet.
- [ ] **Step 8: Commit** — `git commit -am "Encode recitation as Opus at build; WAV never ships"`.

---

### Task 5: Give every route a URL

**Files:**
- Create: `src/core/route-url.js`, `src/core/route-url.test.js`
- Modify: `src/core/router.js:66` (`navigate` pushes the URL unless `options.replaceUrl === false`), `src/app.js:600-625` and `src/app.js:870-880` (delete the hand-written `pushState` branches), `src/app.js:1346-1400` (one `popstate` handler that calls `routeFromPath`), `docs/specs/ARCHITECTURE.md` §8.12
- Test: `src/core/route-url.test.js`, `e2e/` new spec `e2e/url-routing.spec.js`

**Interfaces:**
- Produces:
```js
// src/core/route-url.js
export const ROUTE_ALIASES = { portal: 'home', chapel: 'library', rosarium: 'library', via: 'library', journeys: 'library', keystones: 'library', mint: 'library', today: 'library', curia: 'library', workshop: 'make', vault: 'make', scriptorium: 'make', 'visual-lab': 'make', 'visual-catalog': 'make', emotions: 'settings', 'chamber-session': 'read', chamber: 'read', live: 'read' };
export function pathForRoute(id, data = {}) // → '/library/chapel/genesis/1', '/read?work=meditations', '/'
export function routeFromPath(pathname, search = '') // → { id, data } or null
```
  In this task the aliases map onto the *existing* room ids (the right-hand side is the current id, e.g. `chapel: 'chapel'`) and Tasks 6–8 flip each entry as its family collapses. The paths are fixed now so links never change again.

- [ ] **Step 1: Write the failing tests**:

```js
import { describe, it, expect } from 'vitest';
import { pathForRoute, routeFromPath, ROUTE_ALIASES } from './route-url.js';

describe('route urls', () => {
    it('round-trips every route id', () => {
        for (const id of Object.keys(ROUTE_ALIASES)) {
            const path = pathForRoute(id);
            expect(path.startsWith('/')).toBe(true);
            expect(routeFromPath(path).id).toBe(ROUTE_ALIASES[id]);
        }
    });
    it('carries chapel data', () => {
        const path = pathForRoute('chapel', { bookId: 'genesis', chapter: 1 });
        expect(path).toBe('/library/chapel/genesis/1');
        expect(routeFromPath(path).data).toEqual({ bookId: 'genesis', chapter: 1 });
    });
    it('keeps the three public keystone paths and the live path', () => {
        expect(routeFromPath('/try')?.id).toBeTruthy();
        expect(routeFromPath('/live')?.id).toBeTruthy();
    });
    it('returns null for an unknown path', () => {
        expect(routeFromPath('/nothing/here')).toBeNull();
    });
});
```
  Read `TRY_RISE_PATH`, `LIVE_PATH`, `VISUAL_LAB_PATH`, `VISUAL_CATALOG_PATH` and `keystoneSlugFromPath` in `src/app.js` and `src/content/keystones.js` and fold every one of those paths into the table so the existing public URLs stay identical.

- [ ] **Step 2: Run** `npx vitest run src/core/route-url.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the two functions as a table of `{ id, pattern, build(data), parse(match) }` rows, no regex library.
- [ ] **Step 4: Wire the router.** In `Router.navigate`, after the view is active, `history.pushState({ id, data }, '', pathForRoute(id, data))` (or `replaceState` when `options.replace`). Add a `Router` constructor option `history` defaulting to `window.history` so jsdom tests can pass a fake. Replace the branches at `src/app.js:600-625` and `870-880` with nothing, and reduce the `popstate` handler to: resolve `routeFromPath(location.pathname, location.search)`, keep the Rosary hash guard, and `navigate(id, { data, replace: true, skipStack: true })`. On cold load, do the same before the first render.
- [ ] **Step 5: Browser test** `e2e/url-routing.spec.js`: navigate Home → Library → a Chapel chapter, assert `page.url()` ends with `/library/chapel/<book>/<n>`, `page.reload()`, assert the same chapter is showing, `page.goBack()`, assert the Library.
- [ ] **Step 6: Run** `npx vitest run src/core src/app* && npm run test:e2e:gate && npx playwright test e2e/url-routing.spec.js`. Expected: PASS.
- [ ] **Step 7: Spec.** §8.12 → **Status:** `reversed`, with: "Reversed 2026-10: every room has a path in `src/core/route-url.js`; a reading can be bookmarked and shared, and Back works everywhere, not only on the Keystone paths." Remove the §9 bullet "Most rooms have no address."
- [ ] **Step 8: Commit** — `git commit -am "Give every route a URL through one mapping"`.

---

### Task 6: Collapse the Library family

**Files:**
- Create: `src/components/library/` and move `Chapel.js`, `Rosarium.js`, `Via.js`, `Journeys.js`, `Keystones.js`, `Mint.js`, `today/TodayPoem.js`, `Curia.js` into it as panes (`git mv`, keep file names)
- Modify: `src/components/Library.js` (mount a pane by `data.pane`), `src/app/route-manifest.js` (delete eight route entries, pass their capabilities into `Library`), `index.html` (delete eight `view-*` containers), `src/core/route-url.js` (flip the eight aliases to `'library'` with `data.pane`), `docs/specs/ARCHITECTURE.md` rooms table and §5 support-module paragraph
- Test: each pane's existing `*.test.js` moves with it; `src/core/route-url.test.js`; `src/core/system-design.test.js`; `npm run test:e2e:gate`

**Interfaces:**
- Consumes: `routeFromPath('/library/chapel/genesis/1')` → `{ id: 'library', data: { pane: 'chapel', bookId: 'genesis', chapter: 1 } }`.
- Produces: `new Library(container, { ...existingOptions, paneCapabilities: { chapel: {...}, rosarium: {...}, ... } })` and `Library#showPane(name, data)`. Each pane keeps its current constructor signature; `Library` constructs it lazily inside its own container the first time the pane is shown, and calls `activate()/deactivate()/destroy()` on it exactly as `Router` did.

- [ ] **Step 1: Write the failing test** in `src/components/Library.test.js`:

```js
it('opens a chapel chapter as a pane of the Library', async () => {
    const library = new Library(container, { ...options, paneCapabilities });
    await library.showPane('chapel', { bookId: 'genesis', chapter: 1 });
    expect(container.querySelector('[data-pane="chapel"]')).not.toBeNull();
    expect(library.activePane).toBe('chapel');
});
```
- [ ] **Step 2: Run** — FAIL (`showPane` undefined).
- [ ] **Step 3: Implement `showPane`** with a `PANES` map `{ chapel: () => import('./library/Chapel.js'), ... }` mirroring the lazy loaders being removed from the manifest. Move the eight manifest `create` bodies into `Library` as the pane factories, with the capability objects passed in by `route-manifest.js` under `paneCapabilities`.
- [ ] **Step 4: Flip the aliases** and delete the eight manifest entries and containers. Every call site `onNavigate('chapel', data)` keeps working because `Router.navigate` resolves aliases through `ROUTE_ALIASES` first (add that one line to `navigate` if Task 5 did not).
- [ ] **Step 5: Spec.** Rooms table: one `Library` row, "the prepared editions, scripture, liturgies, journeys, keystones and the day's poem, with provenance on every edition"; move the eight module paths into the support-modules paragraph. Add §8.43:

```markdown
### 8.43 Liturgies, journeys and keystones are programs in the Library, not rooms

- **Chosen:** one Library room with panes; the Rosary, the Stations, a journey,
  a keystone sequence and the day's poem are catalog entries that open a pane.
- **Rejected:** a routed room per corpus, nine in all.
- **Why:** each was a different door onto the same engine with the same
  compiler behind it. A room costs a container, a route, a lifecycle and a
  row in this table; a program costs a line of data. §2.3.
- **Status:** settled.
```
- [ ] **Step 6: Run** `npx vitest run src/components src/core src/app* && npm run test:e2e:gate && npm run docs:diagram`. Expected: PASS, diagram regenerated and committed.
- [ ] **Step 7: Commit** — `git commit -am "Fold nine corpus rooms into Library panes"`.

---

### Task 7: Collapse Make and Settings

**Files:**
- Create: `src/components/make/` ← `Workshop.js`, `Vault.js`, `Scriptorium.js`, `VisualLab.js`, `VisualCatalog.js`; `src/components/Make.js`
- Move: `Emotions.js` → `src/components/settings/Emotions.js`
- Modify: `src/components/Settings.js` (an "Affect" section that mounts Emotions on toggle), `src/app/route-manifest.js`, `index.html`, `src/core/route-url.js` (flip six aliases), `docs/specs/ARCHITECTURE.md`
- Test: `src/components/Make.test.js` (new), `src/components/Settings.test.js`, `src/core/route-url.test.js`, `src/core/system-design.test.js`

**Interfaces:**
- Produces: `new Make(container, { tabCapabilities })`, `Make#showTab(name, data)` with the same lazy-mount and lifecycle contract as `Library#showPane` in Task 6; `routeFromPath('/make/workshop')` → `{ id: 'make', data: { tab: 'workshop' } }`; `routeFromPath('/settings/affect')` → `{ id: 'settings', data: { section: 'affect' } }`.

- [ ] **Step 1: Failing test** `src/components/Make.test.js`:

```js
it('shows the workshop as a tab and keeps the vault mounted when switching', async () => {
    const make = new Make(container, { tabCapabilities });
    await make.showTab('vault');
    await make.showTab('workshop');
    expect(make.activeTab).toBe('workshop');
    expect(container.querySelector('[data-tab="vault"]').hidden).toBe(true);
});
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement `Make`** by copying the `showPane` shape from `Library` into a shared helper `src/components/room-panes.js` (`createPaneHost({ container, loaders, factories })` returning `{ show, active, destroy }`), and have both `Library` and `Make` use it. Do this only now, when there are two callers.
- [ ] **Step 4: Settings.** Add the Affect section: a toggle bound to the existing Emotions preference and, when on, the Emotions list mounted below it from `./settings/Emotions.js`.
- [ ] **Step 5: Manifest, containers, aliases, spec.** Delete six routes and six containers. Rooms table rows: `Make` ("authoring: composition, saved work, the Scriptorium, the visual lab and catalog") and `Settings` ("preferences, affect, export and erase"). §8.44 in the same form as 8.43, titled "Authoring is one room with tabs".
- [ ] **Step 6: Run** the same command as Task 6 step 6. Expected: PASS.
- [ ] **Step 7: Commit** — `git commit -am "Fold five authoring rooms into Make and Emotions into Settings"`.

---

### Task 8: Collapse Read and Home, finish the spec

**Files:**
- Move: `ChamberOrbital.js` → `src/components/read/ChamberOrbital.js`; `src/live/host/LiveHost.js` stays, mounted by `Read`
- Create: `src/components/Read.js` (owns the Chamber container, the Orbital setup pane and the live host), `src/components/Home.js` (`git mv Portal.js Home.js`)
- Modify: `src/app/route-manifest.js` (five entries), `index.html` (five containers), `src/core/route-url.js` (flip remaining aliases, `portal → home`), `src/app/chamber-session-factory.js` (unchanged API, called from `Read`), `docs/specs/ARCHITECTURE.md` §1, §3 (regenerated), §5, §8, §9
- Test: `src/components/Read.test.js` (new), `src/core/current.test.js` (must still pass: `new Player` only in the factory), `src/core/route-url.test.js`, `src/core/system-design.test.js`, full `npm run test:run`, `npm run test:e2e`

**Interfaces:**
- Produces: `routeFromPath('/read')` → `{ id: 'read', data: {} }` (setup pane); `/read?work=<id>` → `{ id: 'read', data: { workId } }` (begin); `/live` → `{ id: 'read', data: { live: true } }`. `Read` calls the existing `operations.handleBeginSession` and `chamber-session-factory`; it does not construct a Player.

- [ ] **Step 1: Failing test** `src/components/Read.test.js`:

```js
it('opens on the setup pane with no work, and on the chamber with one', async () => {
    const read = new Read(container, { ...capabilities });
    await read.open({});
    expect(read.activePane).toBe('setup');
    await read.open({ workId: 'meditations' });
    expect(read.activePane).toBe('chamber');
});
```
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement `Read`** with the pane host from Task 7. Rename `Portal` to `Home` (class and file), keeping its options.
- [ ] **Step 4: Finish the manifest**: exactly `home`, `read`, `library`, `make`, `settings`. `ROUTE_ALIASES` now maps all twenty old ids onto these five.
- [ ] **Step 5: Spec.** Rewrite §1's room list to the five rooms; §5 rooms table to five rows plus `Guide` as an overlay and the support-module paragraph listing every file under `src/components/*/`; regenerate §3. Re-read every §8 entry and set **Status** honestly: `reversed` for 8.1 (there is a Worker, but it holds no state), 8.12, 8.5; `settled` where the reason still holds; delete nothing. Rewrite §9 to the costs that remain: the five pull requests' alias table, the ffmpeg build dependency, no access control.
- [ ] **Step 6: Run everything** — `npm run audio:hydrate && npm run test:run && npm run test:e2e && npx vite build && npm run measure:first-load && npm run docs:diagram && git status --porcelain docs/specs/ARCHITECTURE.md`. Expected: all PASS, spec unchanged by the generator.
- [ ] **Step 7: Commit** — `git commit -am "Five rooms: Home, Read, Library, Make, Settings; spec rewritten to match"`.

---

## Self-review

- **Spec coverage.** §1 → Task 1. §3.1 content → Tasks 3, 4 (content out of the repository beyond audio is deferred to the coordinating agent and noted in the spec's §5; the audio branch already proves the mechanism). §3.2 engine → no task, by design. §3.3 shell → Tasks 2, 5, 6, 7, 8. §3.4 intelligence → Task 3. §3.5 build → Tasks 3, 4. §4 spec shape → every task edits the spec in the same change; Task 8 finishes it.
- **Placeholders.** Steps that say "read X and fold it in" name the exact file and symbol to read. No TBDs.
- **Names.** `pathForRoute`, `routeFromPath`, `ROUTE_ALIASES` (Task 5) are used unchanged in 6, 7, 8. `showPane` (6), `showTab` (7) and `open` (8) all sit on the `createPaneHost` helper introduced in Task 7; Task 6 builds `showPane` inline and Task 7 extracts it when the second caller appears.
