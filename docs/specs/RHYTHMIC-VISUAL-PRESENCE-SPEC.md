# Rhythmic Visual Presence Specification

> Implemented behavioral and runtime contract, July 2026

## Status

- Status: Implemented; extended browser matrix remains a release-verification task
- Scope: Rhythmic visual interlocutions in the Chamber
- Assumption: “2000” means 2000 milliseconds (2 seconds), not 2000 seconds
- Runtime implementation: Complete
- Automated verification: 441 tests passing across 36 files; production build passing
- Browser smoke verification: Presence UI, assistive value text, per-session consent,
  Phrase continuity, concealed next-atom preparation, stable post-presence reveal,
  playback start, and session termination passing
- Atrium impact: None; Atrium development remains paused

## Executive decision

Rhythmic visual duration becomes **Visual Presence** with the following public
range:

| Property | Value |
| --- | ---: |
| Minimum | 150 ms |
| Default | 200 ms |
| Maximum | 2000 ms |

Internally, the persisted property remains `interlocution.duration` to avoid an
unnecessary schema break. The UI calls the parameter **Presence**.

This is not only a larger slider. Durations above approximately 400 ms change
the perceptual category from flash to exposure. Frequency, safety gating,
transitions, progress accounting, and preload demand must therefore become
duration-aware.

## Product intent

The current 16–200 ms range is optimized for subliminal punctuation. At its
shortest values, a user perceives luminance and interruption more readily than
the artwork itself. This is especially reductive for Klee episodes, fractal
flames, harmonographs, and collection imagery.

Visual Presence should create a controlled spectrum:

| Presence | Perceptual role | Intended character |
| --- | --- | --- |
| 150–249 ms | Punctuation | Sharp, immediate, compositional glimpse |
| 250–499 ms | Interruption | Clearly legible visual event |
| 500–999 ms | Exposure | Brief contemplative encounter |
| 1000–2000 ms | Tableau | Deliberate visual presence with spacious recurrence |

The system must preserve three qualities across this spectrum:

1. Every presented visual feels consequential.
2. Longer presences cannot dominate or repeatedly erase the reading stream.
3. Responsive behavior remains bounded by the user’s explicit settings.

## Non-goals

- Do not create a persistent visual mode. Persistent visuals remain the domain
  of Focals, Attractor, and Genesis.
- Do not expose durations longer than 2 seconds in Rhythmic mode.
- Do not rename the internal `flash()` APIs merely for terminology consistency.
- Do not animate Klee geometry during a presence.
- Do not let semantic response override consent, photosensitivity mode, source
  selection, the chosen maximum presence, or cadence limits.
- Do not dynamically change the reading-progress denominator based on future
  stochastic events.

## User-facing controls

### Presence control

Replace the linear 16–200 ms Duration slider with a stepped Presence control:

```text
150 · 200 · 300 · 450 · 700 · 1000 · 1400 · 2000 ms
```

Requirements:

- Default selection: 200 ms.
- Keyboard arrow keys move exactly one step.
- Values below 1000 display as milliseconds, for example `450 ms`.
- Values at or above 1000 display as seconds, for example `1.4 s` and `2.0 s`.
- The accessible value text includes both value and role, for example
  `700 milliseconds, exposure`.
- Runtime normalization accepts any finite value from 150–2000 ms even though
  the UI emits only the curated steps.
- A saved non-step value is displayed at the nearest step without mutating
  storage until the user changes the control.

### Terminology

User-facing copy changes as follows:

| Current | Proposed |
| --- | --- |
| Duration | Presence |
| Responsive Flashes | Responsive Presence |
| Configurable duration (16–200ms per flash) | Configurable presence (150ms–2s per visual) |
| Brief, subliminal flashes | Brief flashes and longer visual exposures |

The mode name **Rhythmic** remains unchanged. Internal engineering terms such as
`interlocution`, `flash`, and `duration` remain valid.

### Frequency explanation

Frequency means the probability of one opportunity at an eligible atom
boundary. Chunking intentionally gives that probability a different expressive
cadence: Word is staccato, Phrase is measured, and Sentence is contemplative.
At 100%, every eligible boundary is considered, but never more than once.

The panel must explain:

> Frequency sets how often a visual may appear between text units. Longer
> presences automatically create more space between appearances.

Frequency is an intent and a ceiling, not a guarantee that every opportunity
will be presented. Consent, source availability, responsive modulation, and
safety budgets remain authoritative vetoes.

## Configuration and migration contract

Define shared constants in one core module rather than repeating numeric limits:

```js
VISUAL_PRESENCE_MIN_MS = 150
VISUAL_PRESENCE_DEFAULT_MS = 200
VISUAL_PRESENCE_MAX_MS = 2000
VISUAL_PRESENCE_STEPS_MS = [150, 200, 300, 450, 700, 1000, 1400, 2000]
```

Normalization rules:

1. Missing or non-finite duration becomes 200 ms.
2. Existing saved durations below 150 ms become 150 ms at the compilation
   boundary.
3. Existing saved durations from 150–200 ms remain unchanged.
4. Values above 2000 ms become 2000 ms.
5. Normalization is idempotent.
6. No migration may auto-enable Rhythmic mode or grant visual consent.

Every default and normalization boundary must consume the shared constants.
This includes Chamber setup, saved blueprints, Vault launch reconstruction,
session compilation, the visual panel, the semantic conductor, and the visual
cortex.

## Responsive Presence contract

Responsive Rhythm currently makes energetic passages shorter and more frequent.
That intent remains, but duration mapping becomes explicit and scales throughout
the new range.

For a user-selected presence ceiling `D` and normalized arousal `A`:

```text
responsivePresence = clamp(round(D × (1 − 0.25 × A)), 150, D)
```

Examples:

| Selected ceiling | Calm, A=0 | Moderate, A=0.5 | Intense, A=1 |
| ---: | ---: | ---: | ---: |
| 150 ms | 150 ms | 150 ms | 150 ms |
| 200 ms | 200 ms | 175 ms | 150 ms |
| 700 ms | 700 ms | 613 ms | 525 ms |
| 2000 ms | 2000 ms | 1750 ms | 1500 ms |

Rules:

- The selected Presence is always a ceiling.
- Responsive Rhythm disabled means the selected value is used exactly.
- Mood → Imagery remains independent from Intensity → Rhythm.
- Responsive frequency retains its existing bounded arousal mapping.
- Semantic response cannot shorten a presence below 150 ms.
- Semantic response cannot lengthen a presence beyond the selected ceiling.

## Duration-aware cadence

### Problem

At 220 WPM, adjacent Word-mode boundaries may be approximately 273 ms apart. A
naive 2-second presence at maximum frequency could produce this pattern:

```text
273 ms reading → 2000 ms visual → 273 ms reading → 2000 ms visual
```

The visual would occupy nearly 90% of wall-clock time. That is no longer an
interlocution; it is replacement of the reading experience.

### Presence budget

The visual safety gate must track successful visible intervals and enforce both
of these constraints:

```text
PRESENCE_WINDOW_MS = 12000
MAX_VISIBLE_DUTY = 0.45
MIN_REST_MS = max(250, presentedDuration × 1.25)
```

Definitions:

- `presentedDuration` is the planned visible duration of the last successful
  presence, including entrance and exit transitions.
- Rest begins when the overlay becomes fully hidden.
- The next presence may start only after `MIN_REST_MS` and only if adding its
  projected interval does not exceed the 45% rolling occupancy budget.
- Rejected probability rolls, unavailable sources, failed renders, and
  photosensitivity vetoes consume neither the rest timer nor occupancy budget.
- The existing rapid-start burst constraints remain as an additional safety
  layer.

The 45% ceiling is intentional: at the 200 ms default, normal 220 WPM cadence
continues to feel responsive; at 2 seconds, the system automatically creates at
least 2.5 seconds of rest and may create more under the rolling budget.

### Ownership

- `Player` owns semantic-boundary opportunities and probability.
- `VisualFlashGate` owns actual presentation cadence, rest, burst protection,
  and rolling visible occupancy.
- `VisualCortex` commits the gate only after content has rendered successfully
  and immediately before the overlay is shown.
- `Chamber` translates responsive semantic intent into a bounded presentation
  request.

This separation makes chunking an intentional visual-rhythm choice while
preventing hydration failure and render latency from changing the meaning of
Frequency.

## Presentation transitions

The configured Presence is the total time from the overlay becoming visible to
the overlay becoming fully hidden. Transitions are included in that duration;
they are not added on top.

| Presence | Entrance | Exit | Motion character |
| ---: | ---: | ---: | --- |
| 150–249 ms | 0 ms | 0 ms | Deliberate cut |
| 250–699 ms | 32 ms | 32 ms | Restrained soft edge |
| 700–1199 ms | 64 ms | 64 ms | Calm exposure |
| 1200–2000 ms | 96 ms | 96 ms | Tableau arrival and release |

Requirements:

- The hold interval is `presence − entrance − exit`.
- CSS opacity performs transitions; do not create a second JavaScript animation
  loop.
- `prefers-reduced-motion` removes the opacity transition but preserves the
  chosen presence duration.
- Photosensitivity mode remains a complete execution-time veto.
- Child visuals must be ready before the overlay begins its entrance.
- No black or empty intermediary frame may be exposed.
- Exit, stop, destroy, or a configuration epoch change must synchronously hide
  the overlay and invalidate pending completion callbacks.

## Artwork behavior during longer presence

All Rhythmic visuals are stable during one visible presence:

- Klee geometry does not grow while visible; its episode progresses between
  appearances.
- Fractal, neural, rock-garden, harmonograph, and Turrell presentations remain
  still or use only their existing non-flickering field behavior.
- ASCII output remains derived from the same prepared source frame.
- Collection and personal imagery use the already-decoded asset; no network
  request may begin on the presentation hot path.
- Resize may rescale prepared geometry, but must not regenerate the currently
  visible artwork.

Longer visibility makes repetition and weak source quality more perceptible.
Existing shuffle-bag, category balancing, image-quality, and hydration contracts
therefore remain required, but content-provider expansion is outside this spec.

## Player and timing contract

Reading progress continues to represent authored reading time:

- Every atom receives its full authored reading duration without interruption.
- Reading progress freezes while a visual is present.
- The progress denominator never jumps when a stochastic presence occurs.
- At most one opportunity may occur after a completed eligible text atom and
  before the next eligible text atom.
- A successful visual occupies the boundary, then the Player advances exactly
  once; the completed atom is never re-emitted.
- When the overlay reaches full opacity, the next atom is laid out instantly in
  a concealed state. Its reading duration remains untouched until the overlay
  has fully settled, so reveal never exposes a text replacement or fade-in.
- Blank, authored-pause, paragraph-break, and source-boundary atoms break
  eligibility on both sides.
- Rejected opportunities are discarded rather than queued for catch-up.

For accurate session records, the Player completion result should distinguish:

```js
{
  readingDurationMs,
  presenceDurationMs,
  wallDurationMs,
  presentedCount,
  skippedCount
}
```

The visible Chamber progress bar uses reading duration. Memory records may store
the additional fields, but older records without them remain valid.

The visual handler contract should return a structured result:

```js
{
  presented: true | false,
  requestedDurationMs,
  presentedDurationMs,
  reason: 'presented' | 'consent' | 'photosensitivity' | 'cadence' |
          'source-unavailable' | 'render-failed' | 'aborted'
}
```

No-op results must not be counted as visible time or successful interlocutions.
Visual failures must never become playback failures.

## Preload demand

Preload estimation is based on eligible semantic boundaries and remains
presence-aware. It must classify actual adjacent atoms rather than treating raw
atom count as interchangeable across chunk modes.

For estimation only:

```text
opportunities = eligibleBoundaries × frequency
restLimitedPresentations = eligibleBoundaryDuration / minimumPresenceRest
preloadTarget = ceil(min(eligibleBoundaries, opportunities,
                         restLimitedPresentations)) + 2 headroom
```

Rules:

- The estimate may conservatively overprepare by a small bounded amount.
- Generator and decoded-image pool caps remain authoritative.
- Session launch still requires only the established minimum-ready contract;
  a larger target continues warming in the background.
- No preload calculation may use raw atom count without verifying that each
  adjacent pair forms an eligible semantic boundary.

## Safety and consent copy

The consent dialog must stop describing every event as subliminal. Proposed
core copy:

> Rhythmic Visuals introduces brief flashes and visual exposures between moments
> of reading. Presence can range from 150 milliseconds to 2 seconds. The system
> limits rapid recurrence, but high-contrast visual changes may still affect
> photosensitive individuals.

The dialog must continue to communicate:

- possible photosensitivity, migraine, visual-processing, and motion-sensitivity
  concerns without making medical safety claims;
- the available global photosensitivity override;
- the ability to disable Rhythmic visuals at any time;
- that maximum recurrence is constrained even when Frequency is 100%.

Consent remains session-scoped and must be checked again at execution time.

## Observability

Development diagnostics should expose bounded counters without logging every
frame:

```js
{
  opportunities,
  probabilityRejected,
  cadenceRejected,
  sourceRejected,
  renderRejected,
  presented,
  visibleDurationMs
}
```

These diagnostics are local and ephemeral. This spec does not introduce remote
analytics or persist behavioral telemetry.

## Implementation surfaces

Expected runtime changes:

| Surface | Responsibility |
| --- | --- |
| `src/core/visual-presence.js` | Shared limits, steps, normalization, transition policy |
| `src/core/session-compiler.js` | Canonical 150–2000 ms normalization |
| `src/core/conductor.js` | Responsive Presence mapping |
| `src/core/player.js` | Structured results, counters, time accounting, duration-aware estimate |
| `src/core/visual-safety.js` | Rest and rolling occupancy budget |
| `src/visuals/visual-cortex.js` | Structured result, gate commit, deterministic total visibility |
| `src/visuals/visuals.css` | Tiered opacity transitions and reduced-motion override |
| `src/components/VisualInterlocutionPanel.js` | Presence steps, formatting, accessible copy |
| `src/components/VisualInterlocutionPanel.css` | Stepped-control presentation |
| `src/components/ChamberOrbital.js` | New default and saved preference normalization |
| `src/components/Chamber.js` | Responsive request/result handoff |
| `src/app.js` | Presence-aware preload target |
| `src/components/Vault.js` | Blueprint/session reconstruction default |
| `index.html` | Updated consent language |
| `ARCHITECTURE.md` | Final production contract after implementation |

The implementation is a **moderate behavioral refactor**. Extending the numeric
range is mechanical; the material work is duration-aware cadence, structured
presentation results, long-presence lifecycle cleanup, progress accounting, and
cross-boundary regression coverage.

## Acceptance criteria

### Configuration

- [x] Missing duration normalizes to 200 ms.
- [x] A saved 80 ms value normalizes to 150 ms.
- [x] Values at 150 ms and 2000 ms round-trip correctly.
- [x] Values above 2000 ms cannot reach the renderer.
- [x] No default remains at 80 ms or 33 ms for user-configured Rhythmic mode.

### Responsive behavior

- [x] With Responsive Rhythm off, selected Presence is exact.
- [x] At a 200 ms ceiling, arousal maps only within 150–200 ms.
- [x] At a 2000 ms ceiling, arousal maps only within 1500–2000 ms.
- [x] Mood response can be disabled without disabling rhythm response and vice
      versa.

### Cadence

- [x] Word, Phrase, and Sentence evaluate Frequency at their own eligible atom
      boundaries and never create an opportunity inside an atom.
- [x] A 100% Frequency setting considers every eligible boundary at most once.
- [x] Blank and timing-locked pause boundaries produce no opportunity.
- [x] A 200 ms presence at normal WPM remains responsive at high Frequency.
- [x] A successful 2000 ms presence is followed by at least 2500 ms of rest.
- [x] Projected visible occupancy cannot exceed 45% of the 12-second window.
- [x] Failed and unavailable presentations consume no cadence budget.
- [x] Rapid-start burst protection remains active independently of occupancy.

### Presentation

- [x] Total measured visibility matches requested Presence within one animation
      frame plus test sampling tolerance.
- [x] Transition time is included inside, not added to, Presence.
- [x] A prepared visual is stable throughout one presence.
- [x] No empty frame appears before collection or procedural content.
- [x] Stop, exit, and destroy leave no visible overlay or late callback.

### Playback

- [x] Reading progress freezes smoothly during presence and resumes without a
      jump.
- [x] Every atom completes before a presence begins.
- [x] A long presence advances exactly once afterward and never re-emits the
      completed atom.
- [x] The next atom is stable behind the opaque overlay before reveal, and none
      of its reading duration is consumed while concealed.
- [x] Completion distinguishes reading, presence, and wall-clock duration.
- [x] A skipped presentation does not enter visible-duration accounting.

### Safety and accessibility

- [x] Photosensitivity mode vetoes every duration at execution time.
- [x] Consent language accurately states the 150 ms–2 second range.
- [x] Reduced-motion mode removes fades without shortening visibility.
- [x] The stepped control is keyboard-operable and exposes meaningful value
      text to assistive technology.

## Verification plan

Automated coverage must include:

1. Presence normalization and migration boundaries.
2. Responsive mappings at arousal 0, 0.5, and 1.
3. Rolling-duty and minimum-rest simulations using a deterministic clock.
4. Successful, skipped, failed, and aborted structured presentation results.
5. Exact 150, 200, 700, and 2000 ms visibility timing.
6. Pause, exit, and destroy during a 2-second presence.
7. Boundary integrity, single-opportunity behavior, and no atom re-emission
   across Word, Phrase, and Sentence.
8. Duration-aware preload bounds.
9. Panel keyboard operation, formatting, saved-value display, and consent copy.

Browser validation must exercise at least these matrices:

| Chunking | Responsive Rhythm | Presence | Frequency | Source |
| --- | --- | ---: | ---: | --- |
| Word | Off | 150 ms | 100% | Klee |
| Phrase | On | 200 ms | 100% | Klee |
| Sentence | Off | 700 ms | 50% | Collection |
| Phrase | On | 2000 ms | 100% | Klee |
| Sentence | Off | 2000 ms | 100% | Collection |

For each case, record actual start/end transitions, successful presentation
count, cadence veto count, atom continuity, progress continuity, and final
overlay cleanup.

## Rollout sequence

1. Introduce shared constants and normalization tests.
2. Implement responsive mapping and the duration-aware safety budget.
3. Add structured VisualCortex results and Player accounting.
4. Add deterministic tiered transitions and lifecycle cancellation.
5. Replace the UI control and update consent language.
6. Update preload estimation and persisted defaults.
7. Run the complete automated and browser verification matrix.
8. Update `ARCHITECTURE.md` only after the runtime contract is implemented and
   verified.

## Final design principle

Presence should not make the visual louder merely by keeping it onscreen longer.
As duration expands, recurrence and motion must become more restrained. The
result should feel like punctuation becoming contemplation—not a flash system
turning into repeated camera cuts.
