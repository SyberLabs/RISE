# R.I.S.E. Architecture

> Recursive Installation of Symbolic Experience
> Runtime architecture and engineering contracts, July 2026

## Runtime shape

R.I.S.E. is a Vite-served browser application. `index.html` provides the shared
view and overlay containers; `src/app.js` owns application startup and wires the
router, components, session compiler, audio engine, source registry, and visual
cortex together.

```text
index.html
  -> App / BetaGate
     -> Router
        -> Portal, Vault, Library, Workshop, SOL, Settings
        -> ChamberOrbital (session preparation)
        -> Chamber + Player (session playback)
     -> SourceRegistry -> providers -> SourceCache
     -> SessionCompiler -> Chunker -> Pacing -> Session
     -> AudioEngine
     -> VisualCortex -> Klee / Fractal / external image pools
```

There is one production entry, not a V1/V2 dual-entry system. Route component
modules are imported on first use, then instances are retained until a shared-container transition or
explicit destruction disposes them.

## Primary boundaries

### Application and navigation

- `src/app.js` is the composition root. It owns global services and translates
  component events into navigation or session compilation.
- `src/core/router.js` owns crossfade transitions, view activation/deactivation,
  the back stack, failure restoration, and the latest navigation request received
  during an active transition.
- Routed components must make document-level listeners lifecycle-aware with
  `activate()`, `deactivate()`, and `destroy()`.
- A view initializer may be asynchronous. A rejected initializer must not leave
  the transition lock held or the previous view hidden.

### Session data pipeline

All launch surfaces must call `src/core/session-compiler.js`.

```text
source records
  -> validate and bound input
  -> chunk each source independently
  -> attach source name and source id to every atom
  -> insert timing-locked source boundaries
  -> apply the selected pacing curve
  -> normalize visual settings
  -> construct Session
```

This is the canonical contract for both duration estimates and playback. Do not
recreate chunk/pacing logic in a component. Current hard limits are 50-1000 WPM,
2,000,000 characters per source, 24 embedded custom images, and 16-200 ms visual
interrupt duration.

`Atom.timingLocked` protects authored pauses and source boundaries from curve
modulation. `Session.totalDuration` is computed from validated positive atom
durations and is the source of truth for duration UI and memory records.

### Playback

`src/core/player.js` owns the playback state machine and animation-frame timing.
The states are `idle`, `playing`, `paused`, `interlocuting`, and `complete`.

- Dynamic speed is included in displayed remaining time.
- Interlocution pauses the reading clock and is awaited.
- A rejected visual handler emits an error and resumes playback.
- Pause, stop, and exit retain ownership if they occur during an interlocution.

`src/components/Chamber.js` is the renderer and interaction layer. It does not
own the authoritative clock.

### Visual interlocution

`src/core/visual-selection.js` is the source-selection contract shared by the
panel, persistence, compiler, and playback boundary. Its families are
`procedural`, `collections`, `personal`, and `blend`. The first three discard
incompatible source IDs; only an explicit `blend` may combine them. Legacy
configs infer their family from their arrays, preserving deliberately mixed
archetypes while preventing future partial-config merges from resurrecting a
previous category.

`src/visuals/visual-cortex.js` is the only flash dispatcher. It owns:

- active visual type selection;
- decoded external-image pools and bounded background hydration;
- abort/version ownership for configuration changes;
- the execution-time consent and photosensitivity checks;
- a burst gate that limits rapid consecutive flashes;
- Klee and fractal preload lifecycle.

The retired Met identifiers are removed from active mixed configurations. A
legacy Met-only saved configuration degrades once to procedural Klee without
attempting a retired provider.

Responsive flashes modulate bounded frequency, duration, generator choice, and
visual signal parameters. They do not bypass the user's selected source set,
consent, photosensitivity mode, or the global flash gate.

### Procedural Klee

`src/visuals/klee-enhanced.js` is the generation engine and
`src/visuals/klee-flashes.js` owns session queues and temporal episodes.

The selectable modes are exactly:

- Architectural
- Chaotic
- Harmonic
- Gravitational
- Twittering

There is no spiral preset. Internal curves may coil where a mode calls for it,
but no symmetrical-spiral variation is exposed as a selectable mode.

Every Klee session receives a fresh session seed. Individual artworks derive a
deterministic child seed from the session seed, artwork index, and preset. This
makes an artwork reproducible within its episode while ensuring a new
Gravitational run is not the previous run repeated.

Artworks grow across appearances rather than regenerating on every flash. Their
geometry snapshots are prepared before playback, survive resize through scaled
restoration, and refill in the background. Mode palettes, stroke hierarchy,
alpha, texture, and restrained glow live in the preset style envelopes.

The visible Klee canvas is sized from its observed CSS dimensions and clamped
device pixel ratio. Density analysis and texture byte generation use the Klee
worker when available; bounded synchronous fallbacks preserve compatibility.
The canvas background is `#0A0A0C`, exactly the chamber `--color-void` token.

### Fractal generation

`src/visuals/fractal.js` owns the prepared frame queue and session generation
epoch. `src/visuals/lib/fractal-engine.js` owns fractal planning and worker work.
Session epochs prevent stale work from entering a replacement session. Worker
startup, render tasks, and teardown are bounded; a no-worker environment uses a
single-thread compatibility path.

### External sources and caching

`src/sources/provider.js` defines the provider interface and
`src/sources/registry.js` owns discovery and initialization.

- Provider initialization is retryable after failure.
- Registry initialization is idempotent and returns a status on every call.
- Browser requests carry abort signals and timeouts.
- UI request generations prevent stale provider/category responses from
  replacing the active selection.
- A provider failure degrades that provider, not the application startup.

`src/sources/cache.js` uses IndexedDB with transaction-completion semantics,
TTL, LRU eviction, and direct opaque keys. If IndexedDB is unavailable, it uses
a bounded in-memory cache and exposes the degraded status in cache statistics.

### Audio

`src/audio/engine.js` owns Web Audio nodes, ambient playback, entrainment,
soundscapes, swells, and speech.

Session start/stop operations use generation ownership. A replacement session
cancels and settles an older delayed teardown, and interrupted fades settle their
callers. `destroy()` never restarts ambient audio and disposes the audio context.
Audio initialization errors are surfaced to the application failure boundary.

### Persistence and personal data

Browser persistence is local-only:

- settings, journals, blueprints, SOL plan, orbital preferences/text, and image
  pools use localStorage;
- visual-flash consent uses sessionStorage;
- personal audio and source caches use separate IndexedDB databases.

`src/core/user-data.js` is the inventory for export and clear operations. New
personal stores must be added there in the same change that introduces them.
Source caches are cleared but deliberately not exported.

The BetaGate is invitation UX, not an authorization boundary. Invite data and
codes ship to the browser. Real access control requires a server-side identity
and authorization service.

## Safety and trust rules

- Treat remote metadata, uploaded filenames, pasted text, and saved browser data
  as untrusted at every HTML or URL sink.
- Prefer `textContent`; use `escapeHtml` and `safeUrl` only where templating is
  unavoidable.
- Never auto-grant visual consent from a preset or saved configuration.
- Photosensitivity mode is an execution-time veto, including when enabled during
  a running session.
- Network and worker failure must produce bounded stillness or a local fallback,
  never an unbounded playback stall.

## Verification

```bash
npm run test:run
npm run build
npm run test:coverage
```

Vitest uses jsdom plus a shared Canvas 2D test double. High-risk contracts have
focused tests for session compilation, player recovery, router failure
containment, visual safety, Klee episode/seed ownership, external hydration,
provider aborts, cache degradation, source-browser races, audio lifecycle, and
personal-data inventory.

The supported Node versions are declared in `package.json`. Use Node 20.19+ or
22.12+ so local builds match Vite's runtime requirement.

## Known architectural debt

- Beta access is client-side only and cannot provide security.
- `src/app.js` is still a large composition root; future feature work should move
  session-entry orchestration into a dedicated coordinator rather than growing it.
- Several large content/visual chunks are intentionally substantial. Bundle
  warnings should be addressed through true route/provider lazy loading, not by
  only raising the warning threshold.
- Browser integration tests should supplement jsdom for Web Audio, worker,
  IndexedDB, image decode, DPR resize, and real animation-frame behavior.
