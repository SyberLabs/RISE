# Explicit Application Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the production `window.rise` service locator, make room dependencies explicit, and move room construction into a declarative route manifest without changing persisted or session data.

**Architecture:** `app.js` remains the composition root. `src/app/route-manifest.js` owns lazy room descriptors and injects narrow callbacks or instances into each room. A guarded `src/app/test-bridge.js` replaces the global application object only for development tooling and browser tests.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 7, Vitest 3, Playwright, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-03-explicit-app-boundaries-design.md`

## Global Constraints

- Reader data stays local; unavailable media stays absent.
- Provenance and source structure remain intact.
- Rooms remain lazy-loaded; Portal must not import dormant subsystems.
- Persisted settings, sessions, and Workshop project formats do not change.
- Room constructors never receive a generic `services`, `context`, or `app` bag.
- Production JavaScript contains zero `window.rise` reads or writes.
- Every production change follows red-green-refactor with focused tests.

---

### Task 1: Inject shell capabilities into Portal, Library, Vault, and Settings

**Files:**
- Modify: `src/components/Portal.js`, `src/components/Portal.test.js`
- Modify: `src/components/Library.js`, `src/components/Library.local.test.js`
- Modify: `src/components/Vault.js`, `src/components/Vault.test.js`
- Modify: `src/components/Settings.js`, `src/components/Settings.test.js`

**Interfaces:**
- Produces: `getAudioEngine(): AudioEngine|null`, `getCurrentSession(): Session|null`, and `notify(message, duration?): void` constructor options.

- [ ] **Step 1: Write failing constructor-contract tests**

    const audio = { playClick: vi.fn(), playHiss: vi.fn() };
    const room = new Portal(container, {
      getAudioEngine: () => audio,
      getCurrentSession: () => ({ title: 'Meditations' })
    });
    expect(container.querySelector('.portal-continue').hidden).toBe(false);

For Settings, exercise the current message path with `notify: vi.fn()` and
assert the callback receives the exact message.

- [ ] **Step 2: Verify RED**

    npx vitest run src/components/Portal.test.js src/components/Library.local.test.js src/components/Vault.test.js src/components/Settings.test.js

Expected: injected callbacks are ignored while rooms still read the global.

- [ ] **Step 3: Implement the narrow fields**

    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.notify = options.notify || (() => {});

Replace only matching global reads and delete comments defending discovery.

- [ ] **Step 4: Run Step 2 again; all listed tests pass.**
- [ ] **Step 5: Commit as `refactor: inject shell room capabilities`.**

### Task 2: Inject audio into Chapel, Journeys, Rosarium, and Via

**Files:**
- Modify: `src/components/Chapel.js`, `src/components/Chapel.test.js`
- Modify: `src/components/Journeys.js`; create `src/components/Journeys.dependencies.test.js`
- Modify: `src/components/Rosarium.js`; create `src/components/Rosarium.dependencies.test.js`
- Modify: `src/components/Via.js`; create `src/components/Via.dependencies.test.js`

**Interfaces:**
- Consumes: `getAudioEngine(): AudioEngine|null` from Task 1.
- Produces: devotional rooms with no application-global reads.

- [ ] **Step 1: Write failing sound and lifecycle tests**

    const audio = { playClick: vi.fn(), onChantTrackChange: vi.fn() };
    const room = new Via(container, { getAudioEngine: () => audio });
    container.querySelector('[data-action]')?.click();
    expect(audio.playClick).toHaveBeenCalled();

For Rosarium and Via, call sound start/stop and assert the injected engine owns
`onChantTrackChange` cleanup.

- [ ] **Step 2: Verify RED**

    npx vitest run src/components/Chapel.test.js src/components/Journeys.dependencies.test.js src/components/Rosarium.dependencies.test.js src/components/Via.dependencies.test.js

- [ ] **Step 3: Add `this.getAudioEngine = options.getAudioEngine || (() => null)` and replace every global engine read with one local resolution per handler.**
- [ ] **Step 4: Run Step 2 again; all listed tests pass.**
- [ ] **Step 5: Commit as `refactor: inject devotional room audio`.**

### Task 3: Make Visual Navigator settings writes explicit

**Files:**
- Modify: `src/components/VisualNavigator.js`
- Modify: `src/components/visual-navigator/directory.js`
- Modify: `src/components/VisualNavigator.test.js`, `VisualNavigator.order.test.js`, `VisualNavigator.readercontrols.test.js`, and `VisualNavigator.specimen.test.js`

**Interfaces:**
- Consumes: `settings` and `onSettingsTransaction(changes): void`.
- Produces: directory `writeSettings(changes): void`; no application discovery.

- [ ] **Step 1: Rewrite a settings test without `window.rise`**

    const settings = { chamberFace: 'literary', fontSize: 'medium' };
    const onSettingsTransaction = vi.fn(changes => Object.assign(settings, changes));
    new VisualNavigator(container, { settings, onSettingsTransaction });
    expect(onSettingsTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ chamberFace: 'thick' })
    );

- [ ] **Step 2: Run the four Visual Navigator test files and confirm RED because directory writes still use the global.**
- [ ] **Step 3: Store the supplied settings/transaction callback and pass `writeSettings: changes => this.onSettingsTransaction(changes)` into the directory. Delete global fallback mutation.**
- [ ] **Step 4: Run all `src/components/VisualNavigator*.test.js`; confirm GREEN.**
- [ ] **Step 5: Commit as `refactor: inject visual navigator settings`.**

### Task 4: Remove AudioEngine's UI reach-through

**Files:**
- Modify: `src/audio/engine.js`, `src/audio/engine.lifecycle.test.js`
- Modify: `src/app.js`, `src/app.safety.test.js`

**Interfaces:**
- Produces: `new AudioEngine({ onUnavailable?: (message: string) => void })`.

- [ ] **Step 1: Add a failing blocked-initialization test**

    const onUnavailable = vi.fn();
    const engine = new AudioEngine({ onUnavailable });
    await engine.init();
    expect(onUnavailable).toHaveBeenCalledWith(
      'Audio initialization blocked. Interact to enable.'
    );

- [ ] **Step 2: Run `npx vitest run src/audio/engine.lifecycle.test.js`; confirm the callback is not called.**
- [ ] **Step 3: Accept `{ onUnavailable = () => {} }`, store it, replace the global toast call, and pass `message => this.showToast(message, 4000)` from `App.ensureAudioEngine()`.**
- [ ] **Step 4: Run `npx vitest run src/audio/engine.lifecycle.test.js src/app.safety.test.js`; confirm GREEN.**
- [ ] **Step 5: Commit as `refactor: report audio failures through owner`.**

### Task 5: Inject reading-runtime dependencies into Chamber and ChamberOrbital

**Files:**
- Modify: `src/components/Chamber.js` and focused `Chamber*.test.js` files
- Modify: `src/components/ChamberOrbital.js` and focused `ChamberOrbital*.test.js` files

**Interfaces:**
- Consumes: fixed `audioEngine` for Chamber; lazy `getAudioEngine()` for ChamberOrbital.
- Produces: both reading controllers free of application-global reads.

- [ ] **Step 1: Add failing dependency tests**

    const audioEngine = {
      playClick: vi.fn(), playHiss: vi.fn(), stopSession: vi.fn()
    };
    const chamber = new Chamber(container, { session, player, audioEngine });
    expect(chamber.audioEngine).toBe(audioEngine);

Exercise representative begin, pause, click, volume, exit, and Orbital option
paths so a global read would leave the fake unused.

- [ ] **Step 2: Run focused Chamber safety/settings and Orbital lifecycle/recitation tests; confirm RED.**
- [ ] **Step 3: Store `options.audioEngine || null` in Chamber and use it for Voice, narration, feedback, volume, session lifecycle, and Settings construction.**
- [ ] **Step 4: Store `options.getAudioEngine || (() => null)` in ChamberOrbital and resolve once per handler without making audio eager.**
- [ ] **Step 5: Run `npx vitest run src/components/Chamber*.test.js`; confirm all Chamber and Orbital tests pass.**
- [ ] **Step 6: Commit as `refactor: inject chamber runtime dependencies`.**

### Task 6: Remove Workshop's audio and router reach-through

**Files:**
- Modify: `src/components/Workshop.js`, `src/components/Workshop.test.js`, `src/components/Workshop.import-library.test.js`

**Interfaces:**
- Consumes: `getAudioEngine(): AudioEngine|null`, `onBlueprintsChanged(): void`.
- Produces: Workshop with no router or application knowledge.

- [ ] **Step 1: Add failing capability tests**

    const onBlueprintsChanged = vi.fn();
    const audio = { playHiss: vi.fn(), reloadPersonalSwells: vi.fn() };
    const workshop = new Workshop(container, {
      getAudioEngine: () => audio,
      onBlueprintsChanged
    });

Exercise one click, personal-swell reload, save, and import completion.

- [ ] **Step 2: Run the two Workshop test files; confirm callbacks remain unused.**
- [ ] **Step 3: Store both capabilities, replace sound/reload reads with `this.getAudioEngine()`, and replace router-to-Vault chains with `this.onBlueprintsChanged()`.**
- [ ] **Step 4: Run both Workshop test files; confirm GREEN.**
- [ ] **Step 5: Commit as `refactor: isolate workshop from application globals`.**

### Task 7: Extract routes and replace the global test surface

**Files:**
- Create: `src/app/route-manifest.js`, `src/app/route-manifest.test.js`
- Create: `src/app/test-bridge.js`, `src/app/test-bridge.test.js`
- Modify: `src/app.js`, `src/app.safety.test.js`
- Modify: `scripts/playwright-global-setup.mjs`, `scripts/build-engine-stills.mjs`
- Modify: every `e2e/*.spec.js` file containing `window.rise`

**Interfaces:**
- Produces: `createRouteManifest(operations): RouteDescriptor[]` and `installTestBridge(app, windowObject, { enabled }): object|null`.

- [ ] **Step 1: Write failing manifest tests**

    expect(createRouteManifest(fakeOperations).map(route => route.id)).toEqual([
      'portal', 'keystones', 'vault', 'chamber', 'chamber-session', 'library',
      'journeys', 'workshop', 'settings', 'rosarium', 'curia', 'scriptorium',
      'via', 'chapel'
    ]);

Assert uniqueness and `containerId`, `load`, and `create` functions.

- [ ] **Step 2: Write failing bridge tests**

    const bridge = installTestBridge(app, window, { enabled: true });
    expect(Object.isFrozen(bridge)).toBe(true);
    expect(Object.keys(bridge).sort()).toEqual([
      'ensureVisualCortex', 'getAudioEngine', 'getCurrentSession',
      'getRouterState', 'getSettings', 'getView', 'navigate'
    ]);

Assert `enabled: false` removes or leaves absent `window.__RISE_TEST__`.

- [ ] **Step 3: Run both new tests; confirm RED because modules do not exist.**
- [ ] **Step 4: Move all fourteen lazy room descriptors into `route-manifest.js`; pass Task 1-6 dependencies; reduce App registration to iterating descriptors.**
- [ ] **Step 5: Implement and freeze the seven-operation bridge; install only for `DEV` or `VITE_RISE_TEST_API=1`; bootstrap App module-locally.**
- [ ] **Step 6: Replace e2e/tooling reads with the nearest named bridge operation and set `VITE_RISE_TEST_API=1` for Playwright builds.**
- [ ] **Step 7: Add recursive guards to `src/app.safety.test.js` rejecting production `window.rise` and restricting `__RISE_TEST__` to the bridge/bootstrap/e2e/tooling allowlist.**
- [ ] **Step 8: Verify GREEN**

    npx vitest run src/app/route-manifest.test.js src/app/test-bridge.test.js src/app.safety.test.js src/core/router.test.js
    rg -n "window\.rise" src -g "*.js" -g "!*.test.js"

Expected: tests pass and `rg` returns no matches.

- [ ] **Step 9: Run broad component tests with `npx vitest run src/app*.test.js src/components src/audio/engine.lifecycle.test.js src/core/router.test.js`.**
- [ ] **Step 10: Commit as `refactor: make app composition explicit`.**

### Task 8: Record architecture, verify, review, publish, and merge

**Files:**
- Modify: `docs/specs/ARCHITECTURE.md`
- Modify: review-finding files only when the finding is accepted

- [ ] **Step 1: Add decision 8.27 with Chosen, Rejected, Why, and Status for explicit dependencies, the test-only bridge, and rejection of a universal service bag.**
- [ ] **Step 2: Run `npm run docs:diagram`, `git diff --check`, and `git status --short`; keep only intentional changes.**
- [ ] **Step 3: Run the complete repository verification**

    node scripts/ci-hygiene.mjs
    npm run security:audit
    npm run security:compat
    npm run test:run
    npm run build
    npm run measure:first-load
    npx vitest run src/core/system-design.test.js
    npm run docs:diagram
    npm run test:e2e:gate

Run `npm run test:e2e` when local Chromium is installed.

- [ ] **Step 4: Run thermonuclear review over `git diff origin/main...HEAD`; fix moved-not-deleted complexity, branching growth, weak contracts, wrong-layer logic, and unhealthy file size.**
- [ ] **Step 5: Run pony-tail review; emit `file:Lline: <tag> ...` findings and `net: -<N> lines possible`; delete accepted wrappers, dead flexibility, and redundant compatibility code.**
- [ ] **Step 6: Repeat every Step 3 verification after review fixes; no earlier run counts.**
- [ ] **Step 7: Commit architecture and review fixes as `docs: record explicit application boundaries`.**
- [ ] **Step 8: Push `codex/explicit-app-boundaries`, open a PR to `main`, report before/after global and `app.js` counts plus test/review evidence, then drive conflicts, comments, and CI to green.**
- [ ] **Step 9: Pause before merge for the user's Grok 4.6 pony-tail/thermonuclear/Elon review and Opus 5 review. Triage every concrete finding; fix accepted items; rerun focused checks, full verification, and required CI.**
- [ ] **Step 10: After both external reviews are resolved and a fresh GitHub status shows mergeable with required CI green, merge the PR into `main` as explicitly authorized. Never force-push.**
