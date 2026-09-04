# Explicit application boundaries

**Date:** 2026-09-03
**Status:** approved for implementation planning
**Base:** `main` at `93abca2`

## Problem

RISE's static import graph has a real layer boundary: core and visual modules do
not import components. The runtime graph violates that boundary. Fourteen
production modules read `window.rise` 166 times to find the audio engine,
router, settings, current session, and notifications. The dependency is global,
mutable, absent from constructors, and invisible to the architecture diagram.

The worst concentrations are the modules already hardest to reason about:
`Chamber.js` has 50 reads, `Workshop.js` has 35, and `ChamberOrbital.js` has 31.
The global lets these controllers acquire new responsibilities without changing
their interface. Tests then reproduce the same coupling by constructing fake
`window.rise` objects.

`App.registerViews()` compounds the problem. It occupies about 600 lines of
`app.js` and interleaves four distinct jobs:

1. declaring routes;
2. loading room modules;
3. translating application operations into room callbacks;
4. constructing room instances.

The result is a nominally layered system with a hidden reverse dependency from
rooms back into the application singleton.

## First-principles constraints

The redesign keeps the constraints that define the product:

1. Reader data remains local to the browser.
2. Unavailable media is absent rather than substituted.
3. Provenance remains attached to content and visual assets.
4. Source structure is read rather than inferred.
5. Rooms remain lazy-loaded; the Portal must not pay for dormant subsystems.
6. Existing persisted settings, sessions, and Workshop project formats do not
   change in this refactor.

Everything else is implementation and may be deleted or reorganized.

## Decision

Make `app.js` the only composition root. A room receives every external
capability through its constructor. No component, audio module, visual module,
or core module may discover the application through a browser global.

Move route declaration and room construction to
`src/app/route-manifest.js`. It accepts the application-level operations needed
to assemble rooms and returns declarative route descriptors. This module is
allowed to know the complete application composition because composition is its
single job. It passes only narrow, named options to each room.

Do not introduce a generic `services`, `context`, or `app` object in room
constructors. Such an object would rename the service locator without removing
it.

## Component contracts

### Lazy audio

Audio is deliberately absent until the first interaction. Rooms constructed
before that point receive:

```js
getAudioEngine: () => AudioEngine | null
```

They resolve it only at the moment of a sound-producing interaction and use
optional invocation when it is absent. This preserves silence as graceful
degradation.

The active `Chamber` is different: application startup already awaits
`ensureAudioEngine()` before constructing it. `Chamber` therefore receives the
actual `audioEngine` instance. It must not use a resolver for a dependency that
is guaranteed by its construction path.

### Notifications

Modules that need a user-visible message receive:

```js
notify: (message, duration?) => void
```

`AudioEngine` accepts `onUnavailable` in its constructor. It reports the
blocked-initialization condition through that callback instead of importing or
discovering UI state.

### Current reading

`Portal` receives:

```js
getCurrentSession: () => Session | null
```

The returned session remains in memory only. The callback makes ownership
explicit without copying or persisting it.

### Cross-room updates

`Workshop` currently reaches through the router to refresh Vault after saving
or importing a blueprint. It receives:

```js
onBlueprintsChanged: () => void
```

The composition root implements the callback by asking the router for the
already-created Vault instance. Workshop neither knows that a router exists nor
knows how Vault refreshes itself.

### Settings writes

Visual Navigator currently writes through `window.rise` from a nested directory
helper. Its owning component receives the current settings plus the existing
settings transaction callback and passes a narrow writer into the directory.
The directory never acquires an application reference.

### Ordinary navigation and launch operations

Existing callbacks such as `onNavigate`, `onBeginSession`, and
`onSelectText` remain. They already express the correct boundary and should not
be wrapped again.

## Route manifest

`src/app/route-manifest.js` exports a function that builds the fixed route
descriptor array. Each descriptor contains:

- the canonical route id;
- the container id;
- a lazy `load` operation;
- a `create(container, data)` operation closed over application-level
  capabilities;
- optional activation data already supported by the router.

`app.js` iterates the manifest and calls `router.registerView`. It retains
application lifecycle, settings, session compilation, and loading UI. It no
longer contains room-specific imports or constructor wiring.

The route manifest is not a new router and does not change URL behavior. It is
data for the existing router.

## Bootstrap and test control surface

Production bootstrap constructs the application in module scope:

```js
const app = new App();
void app.init();
```

It does not assign the instance to `window`.

Current browser tests and `scripts/build-engine-stills.mjs` use `window.rise` as
an undocumented control surface. They must not force production code to keep a
service locator. Add `src/app/test-bridge.js`, installed only when either:

- `import.meta.env.DEV` is true; or
- `import.meta.env.VITE_RISE_TEST_API === '1'`.

The bridge is exposed as `window.__RISE_TEST__` and is frozen. It exposes named
test operations rather than the whole App:

- `navigate(view, data)`;
- `getRouterState()`;
- `getView(id)`;
- `getCurrentSession()`;
- `getSettings()`;
- `getAudioEngine()`;
- `ensureVisualCortex()`.

The Playwright build enables `VITE_RISE_TEST_API=1`. Ordinary production builds
do not contain an installed bridge. The engine-still script uses the bridge on
the development server.

Some browser tests currently mutate a room instance obtained from the router.
`getView(id)` temporarily preserves that ability. This is explicitly test-only;
production components cannot import the bridge. A later test-design change may
replace those mutations with user-level setup, but that is not required to cut
the production dependency seam.

## Error handling

- A missing lazy audio engine produces silence.
- A rejected audio initialization is reported through `onUnavailable` and the
  existing application notification surface.
- Existing error-boundary recovery remains authoritative for audio and visual
  subsystem failures.
- Route loader and constructor errors continue through the existing router and
  application loading failure paths.
- Dependency injection adds no retry, fallback engine, compatibility global,
  or parallel state store.

## Migration order

The migration proceeds from small consumers to large consumers so each step is
independently testable:

1. Add structural guards and the route-manifest contract test.
2. Add constructor dependencies to Portal, Library, Vault, Chapel, Journeys,
   Rosarium, Via, and Settings; update their focused tests.
3. Inject the audio engine into Chamber and a lazy resolver into
   ChamberOrbital.
4. Inject Workshop's audio resolver and blueprint-change callback.
5. Inject the Visual Navigator settings writer.
6. Inject `AudioEngine.onUnavailable`.
7. Add the guarded test bridge and migrate browser/tooling consumers.
8. Extract the route manifest and reduce `App.registerViews()` to registration.
9. Delete the `window.rise` bootstrap assignment and every compatibility path.
10. Record the boundary in the canonical architecture decision register and
    regenerate its import diagram.

Production code and its focused tests move together. There is no interval in
which both global and injected production paths are accepted.

## Tests and automated guards

### New structural tests

1. Scan production JavaScript and fail on `window.rise`.
2. Fail on `__RISE_TEST__` outside `src/app/test-bridge.js`, bootstrap wiring,
   browser tests, and named development scripts.
3. Assert the route manifest contains every canonical route exactly once and
   preserves all fourteen current route ids.
4. Assert a production-mode bootstrap does not install a global control
   surface.

### Focused behavior tests

- Each room sound interaction calls the injected engine when present and stays
  inert when absent.
- Portal reads current-session state through its callback on initial render and
  router re-entry.
- Workshop emits `onBlueprintsChanged` after save and import operations.
- Visual Navigator applies settings through its injected writer.
- AudioEngine reports blocked initialization through `onUnavailable`.
- The test bridge exposes only its documented keys and is frozen.

### Repository verification

Before integration:

```text
node scripts/ci-hygiene.mjs
npm run security:audit
npm run security:compat
npm run test:run
npm run build
npm run measure:first-load
npx vitest run src/core/system-design.test.js
npm run docs:diagram
npm run test:e2e:gate
```

Run the full Playwright suite when local Chromium is available. The architecture
diagram command must leave the worktree clean.

## Acceptance criteria

1. Production modules contain zero `window.rise` reads or writes.
2. The only browser control surface is the explicitly guarded test bridge.
3. Every room dependency is visible in its constructor options.
4. The route manifest owns all fourteen route declarations.
5. `app.js` contains no room-specific dynamic imports and is materially smaller
   than its current roughly 1,500 lines.
6. Startup remains lazy and the first-load budget does not regress.
7. Persisted data and compiled session shapes are unchanged.
8. Unit, build, architecture, hygiene, security, and browser-gate checks pass.
9. A final thermonuclear maintainability review finds no structural blocker.
10. A final pony-tail review identifies and removes unjustified abstraction,
    dead flexibility, and code that can be replaced by a more direct native
    flow; its remaining net-line opportunity is reported in the PR.

## Deliberately rejected alternatives

### Keep `window.rise` for convenience

Rejected. Convenience is the defect: any component can silently acquire any
application responsibility.

### Wrap the application in a `services` object

Rejected. A universal bag is still a service locator, now with a constructor
argument.

### Make AudioEngine eager

Rejected. It would simplify injection by regressing startup and violating the
established lazy-loading decision.

### Introduce a framework or state container

Rejected. The problem is dependency ownership, not missing rendering or state
technology. A framework migration would add more concepts than it removes.

### Split Workshop, Chamber, and VisualCortex in the same change

Rejected as a primary objective. Their size is real debt, but decomposing them
before their dependencies are explicit moves hidden coupling between files.
Targeted extraction is allowed only when it directly enables this boundary.

### Unify animation clocks in the same change

Rejected. It changes runtime timing semantics and belongs in a separate design
after the dependency graph is explicit.

## Expected deletion

This change deletes the production service-locator path, the comments defending
it, repeated router reach-through, and most of the imperative route-registration
body. New code is limited to the route data, the guarded test bridge, and tests
that enforce the boundary. The intended result is fewer concepts in production,
not merely the same concepts spread across more files.

After all automated verification, review the complete diff in this order:

1. thermonuclear code-quality review for boundary leaks, moved-not-deleted
   complexity, branching growth, weak contracts, and unhealthy file size;
2. pony-tail review for dependencies, wrappers, speculative flexibility, and
   direct line deletion.

Fix accepted findings, rerun the relevant focused tests and the full repository
verification, then create the pull request.
