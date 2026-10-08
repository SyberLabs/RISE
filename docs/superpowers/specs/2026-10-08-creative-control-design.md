# Creative Control: architecture design

Date: 2026-10-08. Status: draft for the owner's review. Owner of the design: Claude coordinator (plugin lane). Decisions in §2 were taken by the owner in conversation on 2026-10-08; everything else is proposed.

Creative Control is the stage after Composer v1. It lets the model that composes a reading also compose its *time* (speak, then let a picture play out, then speak again), its *pictures* (every native visual with parameters, and visuals the model writes as code), its *typography* (face, size, place, emphasis, maths), and its *sound*, inside the same RISE card in ChatGPT, in Claude, and on the reader site. The owner's framing: a Creative Runtime for Machine Intelligence, a dynamic informational interface that improves human information intake or aesthetic experience while letting models act creatively in new ways.

## 0. Summary

One change of contract and three new runtime modules carry the whole stage:

- **`rise.current.v2`** adds `beats` and `scenes` to the Current the model writes. v1 stays valid; a v1 passage is a say-beat.
- **Beats compile onto the score RISE already has** (`rise.experience-program.v1`: movement, visual, audio, reading tracks). No second timeline, no second player.
- **A beat conductor** routes each atom to its clock: spoken atoms to the speech governor (the voice is the clock), hold atoms to the scene runtime (the picture is the clock), shown-only atoms to a timer.
- **A scene runtime** draws generated scenes in a Web Worker on an OffscreenCanvas layer the Chamber mounts: its own thread, a frame budget, a kill switch, a native fallback, and diagnostics back to the model. Native engines keep drawing where they draw today and gain parameter manifests and cues.
- **Typography, maths and sound** are per-beat fields lowered onto the reading and audio tracks and rendered by the Chamber's existing layers plus one new caption layer.

What the reader keeps: Play, Pause, Replay, their text size and face, phone layout, reduced motion, the photosensitivity guard, and one behaviour across hosts. What the model gains: time, pictures, type and sound.

## 1. Objectives and non-goals

Objectives, as the owner stated them:

1. The model creates a visual on the fly, as parameters of a native engine or as code, and passes it to RISE.
2. The model chooses face, text size and the place of the text.
3. Speech is separable from the picture: speak and show a sentence, let the animation play out, speak the next. The first style is "Premium Educational" (3Blue1Brown-like: text as captions over a running animation).
4. Every Visual Navigator and Visual Lab engine is exposed to the model with customisable parameters; the set then expands freely.
5. High-quality guidance keeps generated visuals within styles.
6. Both uses: "give me a RISE reading about X" (subject-specific imagery) and "create your own RISE reading to express yourself".

In scope by the owner's choice: maths typesetting; sound per beat.

Not in this stage (on the roadmap):

- **Reader interaction** inside scenes (drag, scrub, tap to reveal). The runtime is designed so it can be added (a scene receives pointer events through the same message channel) but no beat or API exposes it now.
- **Imagery as its own lane:** a dynamic Wikimedia and museum lookup the model can call and evaluate, not limited to RISE's libraries. It needs its own tool, its own admission and its own credit rules.
- **Dive**, realtime Live, and the public RiseSDK freeze. §15 says when the SDK contract freezes.

## 2. Decisions taken by the owner (2026-10-08)

| Question | Decision |
| --- | --- |
| Who ends a hold? | Every hold has a duration (`ms`). A scene that can tell it has finished may end the hold early, or extend it up to `maxMs`. Pause stops voice and picture together. |
| Visuals over time | A beat either starts a new scene (with a transition) or cues the running one. Native engines answer cues by changing parameters; generated scenes however their code says. |
| Text placement | Named places (centre, caption, top, left, right, none) and sizes relative to the reader's setting. A generated scene may draw its own labels anywhere in its canvas. |
| Typefaces | A curated, self-hosted set, loaded only when a reading uses them. |
| Drawing API for generated scenes | Both: the raw 2D/WebGL context, plus a RISE library whose defaults are the style. The library may become its own research track; a Style links guidance (context) and library defaults (tooling). |
| Broken model code | Admission check on the server with line-numbered diagnostics; inside the card a scene that throws or overruns falls back to a native field; where the host supports it, a runtime report goes to the model's context. |
| Architecture | Grow the Current and compile onto the existing score (approach A); not a new Stage, not model-owned screens. |
| Consistency | Behaviour stays the same across platforms, providers and voices wherever the platform allows. |
| Parameter manifests | Written by the coordinator for every native engine; they seed the RiseSDK contract. |

## 3. Constraints measured in the field

These are facts, not assumptions; each was measured on 2026-10-08 unless noted.

- **Claude renders the card in its own sandbox origin** (`{hash}.claudemcpcontent.com`), `document.write`s RISE's page into an inner frame with `allow-scripts allow-same-origin allow-forms`, and applies a Content Security Policy with `base-uri 'self'`, `script/style/img/font/media/worker-src 'self' … https://rise.syberlabs.io`, `connect-src … https://rise.syberlabs.io`, and `frame-src blob: data:`, plus `worker-src 'self' blob:`. So: generated code **can** run in a `blob:` Web Worker; fonts **must** come from rise.syberlabs.io; nothing may be framed from elsewhere.
- **The handshake** (frame → page → `ui/initialize` → `tool-input` → `tool-result`) completes in about 150 ms. Claude advertises `hostCapabilities.updateModelContext: { text, image }`, the channel for runtime reports.
- **Claude's tool result ceiling** is about 150,000 characters before it is written to a file instead of passed inline. RISE admits 65,536 bytes per Current today (`MCP_CURRENT_BYTES`).
- **ChatGPT's sandbox policy is unmeasured.** Whether it allows `blob:` workers, and what it does with `base-uri`, must be measured before generated scenes are promised there (§15, CC-001).
- **The Worker that admits a Current is a Cloudflare Worker**: no `eval`, no `new Function`. Static admission must parse, not run.
- **RISE already self-hosts seven faces** (`public/fonts`): Crimson Pro, Instrument Serif, Instrument Sans, Inter, Space Grotesk, JetBrains Mono, Marcellus.
- **The score already has what beats need:** `rise.experience-program.v1` with movement, transition, visual, audio, swell, reading, narration and thread tracks; visual cue kinds `still | focal | field | sourced | procedural | video`; clips up to 60 s; a strict validator that refuses rather than clamps.
- **The Player's completion seam** (`player.govern({ duration, completion })`) lets a governor decide when an atom is over. The speech governor is its only consumer today; it is the seam the beat conductor joins.
- **The Chamber** is a 5,000-line class that already owns a `VisualFieldDirector` (exclusive lifecycle of persistent visual fields, `applyCue`, `controlVisual`, pause/resume) and a `VisualFlashGate`. New work mounts into these; it does not grow the class.

## 4. Architecture

```
 model ──rise_present({ current })──▶ Worker (Cloudflare)
                                        ├─ validateRiseCurrent (v1 | v2)
                                        ├─ admitScenes: parse, restrict, size   ──▶ refusal + diagnostics
                                        └─ result: structuredContent.current
                                                     │
 card (Chamber in the host's sandbox, or the reader site)
   ├─ compileRiseCurrent ─▶ lowerBeats ─▶ Experience Program ─▶ Session (atoms)
   ├─ Player ◀─ beat conductor ◀─┬─ speech governor (voice clock)
   │                             ├─ scene runtime (picture clock)
   │                             └─ timer (shown-only beats)
   ├─ VisualFieldDirector ─┬─ native engines (manifests, cues)      main thread
   │                       └─ SceneLayer ─▶ scene worker (blob module, OffscreenCanvas)
   ├─ caption layer (place, size, face, emphasis, maths)
   └─ audio engine (sound cues)
```

Modules, each new unless marked, each with one job and its own tests:

| Module | Job | Depends on |
| --- | --- | --- |
| `src/core/rise-current.js` (existing) | Validate v1 and v2; lower v2 beats and scenes onto the Experience Program | `beats.js`, `experience-program.js` |
| `src/core/beats.js` | The beat vocabulary: validation, limits, lowering of beats to movement/visual/audio/reading clips and hold atoms | `experience-program.js`, `typography.js` |
| `src/core/typography.js` | Faces (self-hosted registry), places, sizes, emphasis; lowering to reading-track cues; CSS variables | — |
| `src/core/math-typeset.js` | `$…$` and `$$…$$` in `show` text to HTML through self-hosted KaTeX, lazily loaded, `trust: false` | KaTeX (vendored) |
| `src/live/beat-conductor.js` | One governor on the Player's seam that routes each atom to its clock | `speech-governor.js`, `scenes/scene-runtime.js` |
| `src/scenes/scene-protocol.js` | Messages between the Chamber and a scene worker; versioned | — |
| `src/scenes/scene-runtime.js` | Host side: lifecycle, clock, cues, hold completion, budgets, flash gate, fallback, report | `scene-protocol.js`, `visual-safety.js` |
| `src/scenes/scene-worker.js` | Worker entry: loads the admitted code as a module, owns the OffscreenCanvas, runs frames, forwards `done`, catches errors | `scene-library.js` |
| `src/scenes/scene-library.js` | The `rise` object given to generated code: context, size, theme, fonts, tweens, axes, plots, vectors, labels, `done()` | — |
| `src/scenes/manifests/*.js` | One parameter manifest per native engine (`visual-control-contract.js` generalised) | each engine |
| `src/components/read/scene-layer.js` | The canvas the Chamber mounts for a scene, transferred to the worker; sizing, transitions, hidden-card pause | `scene-runtime.js` |
| `src/components/read/caption-layer.js` | Renders beats placed at caption/top/left/right with a readability scrim; collapses to caption on phones | `typography.js`, `math-typeset.js` |
| `worker/scene-admission.mjs` | Static admission of scene code: parse (acorn), restrictions, export shape, size; diagnostics | acorn |
| `src/live/guide/` | The Composer guide split by concern; `styles/premium-educational.js` first | — |

Boundaries that must hold:

- The Player learns nothing about speech or scenes. It asks its governors; the conductor answers.
- The Chamber mounts `SceneLayer` and `CaptionLayer` and forwards pause, resume, resize and visibility. It does not know the worker protocol.
- The scene worker has no DOM, no host port, no storage, no timers beyond the frame it is given. It receives a canvas, a clock, cues and a theme; it returns frames, `done`, and errors.
- Admission is static on the server and dynamic in the card; neither trusts the other's absence.

## 5. The Current v2 contract

```jsonc
{
  "schema": "rise.current.v2",
  "id": "vectors-length",
  "title": "How long is a vector?",
  "origin": { "kind": "model", "name": "Claude", "provider": "Anthropic" },
  "theme": "cobalt",                       // v1 theme ids
  "look": "nocturne",                      // v1 looks remain; a look is a scene + typography preset
  "style": "premium-educational",          // names a Style (§11); optional
  "type": { "text": "book-serif", "caption": "humanist-sans" },   // reading-wide defaults, by role or face id

  "scenes": [
    { "id": "field",  "engine": "attractor", "params": { "energy": 0.4 } },
    { "id": "vector", "code": "export default function scene(rise) { /* … */ }" }
  ],

  "beats": [
    { "say": "Here is a vector.", "place": "caption", "scene": "vector", "cue": "draw" },
    { "hold": { "ms": 3000, "maxMs": 8000 }, "cue": "rotate" },
    { "say": "Its length is the square root of x squared plus y squared.",
      "show": "Its length is $\\sqrt{x^2+y^2}$.",
      "place": "centre", "size": "larger", "emphasis": ["length"], "sound": "chime" },
    { "show": "The Pythagorean theorem, in two dimensions.", "hold": { "ms": 2500 }, "place": "top", "size": "smaller" }
  ]
}
```

Beat kinds, decided by which fields are present:

| Kind | Fields | Spoken | Shown | Timed by |
| --- | --- | --- | --- | --- |
| say | `say`, optional `show` | `say` | `show` if present, else `say`; nothing when `place: "none"` | the voice |
| hold | `hold`, no `say`, no `show` | — | the running scene | the scene (`ms`, `maxMs`) |
| show | `show` + `hold`, no `say` | — | `show` | `hold.ms` |

Fields any beat may carry: `scene` (start this scene; transition `transition: { ms }` optional, default 600), `cue` (a string, delivered when the beat begins; a beat with `scene` and `cue` starts the scene then cues it), `place`, `size` (`smaller | as-set | larger | display`), `type` (face role or id for this beat), `emphasis` (words of `show`/`say` to set in the emphasis style), `sound` (an id from `SOUND_GROUPS`, or `chime`).

Scenes: `{ id, engine, params }` for native engines (params validated against the engine's manifest) or `{ id, code }` for generated scenes (`code` is an ES module with a default export; §8). `{ id, engine, params, code }` is refused: a scene is one or the other.

Limits (validated, refused with path and code as v1 does): 64 beats; 8 scenes; 24,576 bytes of `code` per scene; `say`/`show` 4,000 characters each; 20,000 characters of text in all; `hold.ms` 200–60,000; `maxMs ≥ ms`, ≤ 60,000; `emphasis` 8 entries of ≤ 40 characters; `cue` ≤ 40 characters, `[A-Za-z0-9_-]`; `type` from the registry; `sound` from the list. Whole Current ≤ `MCP_CURRENT_BYTES` (65,536) in this stage; CC-006 raises it once real readings show the need.

Compatibility: a v1 Current is accepted unchanged and lowered as before. v2 drops `dives`. A v2 Current without `beats` is refused (`segments` belongs to v1). Unknown fields are refused, as today.

Validation stays a pure function (`validateRiseCurrent`) shared by the Worker and the card; the card never trusts the Worker's absence and re-validates on admission.

## 6. Compilation onto the score

`lowerBeats(current)` produces the Experience Program `materializeValidatedRiseCurrent` already builds, with these clips:

- **movement track:** one movement per say/show beat, anchored to a synthetic source span per beat (the `show` text, or the `say` text when there is no `show`), so word spans, emphasis and restart points keep their character coordinates. A hold beat has a movement of its own with a source of one non-breaking space, so the Player sees one atom.
- **visual track:** a `field` or `procedural` clip for a native scene (renderer from the manifest, config from `params`), a new cue kind **`scene`** for a generated one (`{ kind: 'scene', sceneId, codeHash }`), anchored from the beat that starts it to the beat before the next `scene`. Cues become clip metadata `{ at: beatIndex, cue }`, delivered by the runtime when the beat begins.
- **reading track:** per-beat typography `{ place, size, type, emphasis }`; the beat's `show` when it differs from `say`.
- **audio track:** a cue clip per `sound`, anchored to the beat.

Atoms: say beats compile to phrase atoms as passages do (`compileRiseCurrent`), carrying `sourceId` = the beat's synthetic segment id. Hold beats compile to one atom with `modality: 'hold'`, `duration: hold.ms`, and `hold: { ms, maxMs, sceneId }` on the atom. The existing `speech-governor` maps atoms to segment character ranges through `atom-map.js`; hold atoms map to none and are declined by it (its `complete` returns `null` for atoms without a segment, which it already does for seams).

The Experience Program validator gains the `scene` visual cue kind and the `hold` modality; nothing else in the score changes. `lowerExperienceProgram` passes scene clips to the Chamber's visual schedule as it passes fields.

## 7. Runtime: beats, holds and cues

**Beat conductor** (`src/live/beat-conductor.js`): installed on the Player like the speech governor, ahead of it. For each atom:

- `modality: 'hold'`: returns a completion promise from the scene runtime: resolve at `hold.ms` unless the scene has declared `reportsCompletion`, in which case resolve when the scene posts `done`, no earlier than 200 ms and no later than `hold.maxMs`; on scene failure resolve at `ms`.
- shown-only atoms (a `show` beat): `duration: hold.ms`, no completion.
- everything else: decline (`null`), so the speech governor decides.

It also fires beat starts: when the Player begins an atom that is the first of a beat, the conductor delivers that beat's `scene` (start, with transition) and `cue` to the runtime, and its `sound` to the audio engine. For a say beat, "begins" is the Player's start of the first atom, which the speech governor already aligns to the voice's first word.

**Scene runtime** (`src/scenes/scene-runtime.js`), one instance per Chamber:

- `start(scene, { transitionMs })`: for a native scene, `VisualFieldDirector.applyCue(fieldCue)`; for a generated scene, mount a `SceneLayer`, create a worker from `scene-worker.js` (built by Vite as a module worker), send `init { code, size, theme, reducedMotion, fonts }`; the worker imports `code` as a `blob:` module. The previous scene retires through the director's cross-fade.
- `cue(name, { instant })`: native → `controlVisual` per the manifest (`cues` map names to parameter sets); generated → `cue` message.
- `tick`: the host drives time. The worker receives `frame { t, dt }` at display rate while playing, and nothing while paused; `t` is scene time, which stops on pause, so Pause stops voice and picture together.
- `seek(beatIndex)`: on Replay or a seek, the runtime recreates the scene and replays the cues of earlier beats with `instant: true`, then resumes frames. A scene that ignores `instant` animates through them.
- `done`: a worker message; honoured only during a hold of that scene.
- `dispose`: terminates the worker and releases the canvas.

**Budgets and the kill switch:** the worker reports frame duration with each frame; three frames over 24 ms in any one second, or any frame over 200 ms, or an exception, is a failure. On failure the runtime terminates the worker, applies the scene's fallback (`fallback` on the scene if given, else the look's field), resolves any open hold at its `ms`, and records a diagnostic (§12). A worker that stops answering is terminated after 1 s.

**Photosensitivity:** the `SceneLayer` samples the composited frame at 8×8 every 100 ms and feeds the Chamber's `VisualFlashGate`; a scene that would flash more than three times a second is frozen on its last safe frame and the hold runs on `ms`. Generated code cannot opt out.

**Reduced motion:** the worker receives `reducedMotion: true`; the library's tweens complete in one step and its continuous motions idle. Holds still hold.

**Hidden card:** the Chamber already pauses fields when hidden; the layer forwards that as `pause`/`resume`.

**Transitions:** cross-fade of the layer's opacity over `transition.ms` (default 600), the director's mechanism.

## 8. The scene API for generated code

A scene is an ES module whose default export receives `rise` and returns an object:

```js
export default function scene(rise) {
  const { ctx, size, theme, lib } = rise;          // ctx: CanvasRenderingContext2D (OffscreenCanvas)
  const v = lib.vector({ x: 3, y: 2, color: theme.accent, label: 'v' });
  const axes = lib.axes({ x: [-1, 4], y: [-1, 3] });
  return {
    cue(name, { instant } = {}) {
      if (name === 'draw') return lib.tween(v, { t: 1 }, { ms: 800, instant });
      if (name === 'rotate') return lib.tween(v, { angle: Math.PI / 2 }, { ms: 2000, instant }).then(() => rise.done());
    },
    frame(t, dt) {                                 // called by the runtime; draw the current state
      lib.clear(); axes.draw(); v.draw();
    }
  };
}
```

`rise` provides: `ctx` (2D) or `gl` (WebGL2) by the scene's choice at init (`rise.use('webgl2')` before first frame); `size { width, height, dpr }` and `onResize`; `theme` (the reading's colour theme: `background, text, accent, muted, highlight` and the full palette); `fonts` (faces loaded into the worker's `FontFaceSet` so `ctx.fillText` and `lib.label` render in RISE's faces); `reducedMotion`; `lib`; `done()` (signals the current hold may end). A scene that will call `done` declares `export const reportsCompletion = true`; without the declaration its holds run on `ms` and `done` is ignored, so a scene cannot end a hold by accident.

`lib` (the first release): `clear`, `axes`, `grid`, `plot(fn | points)`, `vector`, `point`, `line`, `arc`, `polygon`, `label(text, { at, font, size })`, `tween(target, props, { ms, ease, instant })`, `ease` (standard curves), `color` (theme-aware helpers), `path` (Bezier). The library is deliberately small; §11 says how a Style sets its defaults. Maths inside scene labels is not typeset in this stage (labels are canvas text); captions typeset maths (§10).

Not available, and refused by admission when referenced: `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts`, dynamic `import()`, `eval`, `Function`, `postMessage`, `self`/`globalThis` property access, `indexedDB`, `caches`, `navigator`, `setTimeout`/`setInterval` (time comes from `frame`), and any `import` statement. The restriction is enforced by the parse (§12), and the worker additionally shadows those names with throwing stubs before importing the module, so a bypass that survived parsing still fails loudly.

## 9. Native engines and manifests

Every engine in `ENGINE_CATALOG` gets a manifest beside its code, generalising `ATTRACTOR_VISUAL_MANIFEST`:

```js
export const MANIFEST = Object.freeze({
  id: 'fractal',
  surface: 'fractal',
  parameters: {
    energy:     { kind: 'number', min: 0, max: 1, default: 0.5, step: 0.01, cueable: true, label: 'Energy' },
    complexity: { kind: 'number', min: 0, max: 1, default: 0.5, cueable: true },
    symmetry:   { kind: 'integer', min: 1, max: 8, default: 4, cueable: false },
    hue:        { kind: 'number', min: -180, max: 180, default: 0, cueable: true },
    recipe:     { kind: 'flame-recipe', cueable: false }          // Living Flame's full recipe, validated by flame-recipe.js
  },
  cues: { calm: { energy: 0.2 }, surge: { energy: 0.9 }, warm: { hue: 30 } },
  readableOverText: true, requiresCanvas: true, holdsTime: false
});
```

`params` in a scene are validated against the manifest (kind, range) and refused otherwise. A `cue` names either a manifest cue or `set:<parameter>=<value>` (validated the same way). `cueable: false` parameters change only at scene start. The Visual Lab's four flame controls are the fractal manifest; the Navigator's choices become the `composer: true` set, so the catalog and the model see the same engines. Order of manifests: attractor (exists), fractal (Lab), klee, living-flame (recipe), harmonograph, turrell, neural, rockgarden, ostensoria, apparitio, night-streaks.

## 10. Typography, placement and maths

**Faces** (`src/core/typography.js`): a registry of self-hosted faces by id and role, loaded on first use through `FontFace` from `/fonts/` (through `siteUrl`, so the card loads them from RISE). Shipped today: `crimson-pro` (book serif), `instrument-serif` (display serif), `instrument-sans` (humanist sans), `inter` (ui sans), `space-grotesk` (geometric sans), `jetbrains-mono` (mono), `marcellus` (display caps). Added for this stage, open licence, subset to Latin: `caveat` (handwritten), `barlow-condensed` (condensed), `fraunces` (soft display serif). Roles the model may name: `book-serif, display-serif, humanist-sans, geometric-sans, mono, display, handwritten, condensed`. The reader's own face setting (`chamberFace`) still applies to the centre text unless the beat or Current sets a face; the model's choice is a default, the reader's an override, consistently on every host.

**Places:** `centre` (today's atom display), `caption` (lower third, one or two lines, a scrim at 40% of the background colour for contrast), `top` (upper third), `left`/`right` (a column of at most 38em measure; on viewports under 600 px these render as `caption`), `none` (spoken only). The caption layer lives beside the atom display and is driven by the reading track.

**Sizes:** steps relative to the reader's size chip: `smaller` (−1 step), `as-set`, `larger` (+1), `display` (+2, title cards). Never below the reader's minimum.

**Emphasis:** listed words are wrapped in `.is-emphasised`, the Chamber's existing class, by the atom painter; the voice is unchanged.

**Maths:** `$…$` and `$$…$$` in `show` text render through KaTeX (self-hosted, ~75 KB brotli with its font subset, loaded only when a reading contains `$`), `trust: false`, `throwOnError: false`, `strict: 'ignore'`; the output is inserted into the caption or atom display. The voice speaks `say`, so the model writes the spoken form itself ("x squared"). When `show` has maths and no `say`, nothing is spoken.

## 11. Styles, guidance and sound

A **Style** is a named bundle: guidance text for the model (how to write beats and scenes in this style, with two worked Currents), library defaults (easing, stroke widths, label faces, palette roles), and typography defaults. `style` on a Current selects it; the card applies the defaults, the Worker's tool description lists the styles with one line each, and the full guidance is served by a `resources/read` of `ui://rise/guide/<style>` so the description stays short. First style: **premium-educational**. Second, for free expression: **open-field** (the ten looks' guidance, consolidated). The Composer guide (`current-guide.js`, 5 KB today) splits into `src/live/guide/` by concern: contract, looks, styles, examples.

**Sound:** a beat's `sound` is an id from `SOUND_GROUPS` (atmospheres, music, feelings, tones) or `chime` (a short tone added to the tones group); it fires when the beat begins and pauses with the reading. A `sound` on a say beat with an atmosphere or music id sets the bed for the rest of the reading; a tone or chime plays once.

**Evaluation:** `docs/evals/creative-control/` holds prompts and reference Currents per style; a script (`npm run eval:creative`) runs each through validation, admission and a headless frame run of every scene, and reports refusals, fallbacks and frame budgets. This is how guidance quality is measured, not by taste alone.

## 12. Admission and diagnostics

**On the server** (`worker/scene-admission.mjs`), for every `{ code }` scene, in order: size ≤ 24,576 bytes; parse with acorn as an ES module (`ecmaVersion: 2022`); exactly one default export, a function; no `import` declarations; no dynamic `import()`; no identifier from the banned list in any position (§8); no `with`, no labelled `debugger`; a `reportsCompletion` export, if present, a boolean. Any failure refuses the whole tool call with `isError: true` and text of the form:

```
Scene "vector" was refused: line 14, column 7: `fetch` is not available to a scene.
Scene "vector" was refused: line 3: a scene is an ES module with one default export function.
```

Line and column come from acorn; the message names the rule. The model repairs and re-calls in the same turn; the reader sees nothing until a Current is accepted.

**In the card**, before the first frame, the runtime runs a dry frame (`frame(0, 0)`) and the first cue with `instant: true` inside the worker; an exception there is a failure before anything is shown, so the fallback shows from the start.

**Runtime report:** on any scene failure, the runtime writes one line per failure (`scene "vector": TypeError: v.draw is not a function at scene.js:14:5, frame 3`) to the port's `updateModelContext` where the host advertises it (Claude does; ChatGPT unmeasured). The text is RISE's, never the scene's, so a scene cannot inject instructions into the model's context. The same lines appear in `?measure=1` output and in the Worker's witness log when it is on.

## 13. Security model

Trust boundaries: the model's Current (untrusted) → Worker validation → the card's re-validation → scene code in a worker (untrusted, isolated) → pixels. The card keeps RISE's authority (the host port, storage, fonts, speech); the worker has none of it.

- **Isolation:** scene code runs in a dedicated Web Worker created from RISE's own module (`scene-worker.js`, same origin) which imports the admitted code from a `blob:` URL. The worker has no DOM, no port to the host, no storage (`indexedDB` and `caches` are shadowed and banned), no network (`fetch` banned and shadowed; the sandbox's `connect-src` would admit only rise.syberlabs.io anyway).
- **Liveness:** the main thread is never blocked by scene code; a runaway worker is terminated (§7). Memory is bounded by the browser's worker limits and by terminating on failure; a per-scene canvas is capped at the layer's size × device pixel ratio ≤ 2.
- **Readers' safety:** the flash gate and reduced motion are enforced outside the worker (§7).
- **Prompt injection:** scene text is pixels; runtime reports are RISE-authored; `cue` names and ids are bounded and matched by pattern.
- **Hosts:** nothing in the card's CSP declaration changes; no new domain. The admission and the restrictions are the same on both hosts and on the reader site.
- **What we do not promise:** a scene can compute anything (within budget) and draw anything; content moderation of pictures is the host model's responsibility, as it is for text.

## 14. Testing and verification

Unit, per module, with the existing fakes (virtual clock, fake speech, fake port): `beats.test.js` (validation, lowering, limits), `beat-conductor.test.js` (routing, hold completion with `ms`/`maxMs`/`done`, failure at `ms`), `scene-runtime.test.js` (lifecycle, budgets, kill switch, seek with instant cues, flash gate, report), `scene-library.test.js` (tweens under reduced motion, instant), `typography.test.js`, `math-typeset.test.js`, `scene-admission.test.js` (a corpus of accepted and refused scenes with their diagnostics), one manifest test per engine (`attractor-manifest.test.js` is the model).

Browser (`e2e/live-mcp.spec.js`, the self-contained card under the sandbox the test already applies): a v2 Current with a say beat, a hold, a generated scene and a caption plays through; a scene that throws falls back and the hold ends at `ms`; a scene that flashes is frozen; Pause stops the scene's `t`; Replay restores the scene state through instant cues. A fixture scene lives in `src/scenes/fixtures/`.

Field: measured in Claude with the recorder used on 2026-10-08 (handshake, `updateModelContext` delivery) and in ChatGPT once CC-001 has measured its sandbox. First-load budget (`measure:first-load`) is unaffected: every new module is loaded on first use.

## 15. Delivery plan

Tracker lane `live-sdk`, milestone "Creative Control", tasks CC-001 … CC-008, each its own spec → plan → PR cycle; this document is the stage's design, not the plans.

| Id | Sub-project | Depends on | Ships to readers |
| --- | --- | --- | --- |
| CC-001 | Measure ChatGPT's sandbox (worker-src blob, base-uri, updateModelContext) with the card as deployed; record in `claude-mcp-apps-sandbox` and a discussion doc | — | nothing (evidence) |
| CC-002 | Beats: `rise.current.v2` validation and lowering, hold atoms, the beat conductor, say/hold/show with native scenes only, `sound` | — | time structure, in both hosts and on /live |
| CC-003 | Typography, placement and maths: faces registry (+3 faces), caption layer, sizes, emphasis, KaTeX | CC-002 | captions, type, maths |
| CC-004 | Native manifests and cues: manifests for all 11 engines, `params` validation, cues through `controlVisual`, Visual Lab and Navigator exposure | CC-002 | every engine, with parameters |
| CC-005 | Scene runtime and library: worker, protocol, OffscreenCanvas layer, budgets, flash gate, seek, library v0, fixtures, e2e | CC-002, CC-001 | generated scenes (Claude; ChatGPT per CC-001) |
| CC-006 | Admission and diagnostics: server static admission, dry frame, runtime report, raised Current size if needed | CC-005 | repair loop |
| CC-007 | Styles and guidance: premium-educational and open-field, guide split, `ui://rise/guide/<style>`, eval corpus and `npm run eval:creative` | CC-003, CC-004, CC-005 | quality |
| CC-008 | RiseSDK contract freeze: manifest + scene protocol versioned and documented as the renderer contract, after CC-004/005 have run against real readings | CC-005, CC-007 | the SDK |

Sequencing: CC-001 and CC-002 start together (CC-001 is a measurement, a day). CC-003 and CC-004 follow CC-002 in parallel, one owner each. CC-005 is the long pole and starts as soon as CC-002's conductor exists. CC-006 lands with or right after CC-005. CC-007 runs alongside from CC-003 onward and is the gate for calling the stage done. CC-008 is deliberately last.

Each sub-project's witness is a reading in Claude (and ChatGPT once measured) plus the reader site, by the owner, against its acceptance list; the stage's acceptance is a Premium Educational reading composed by a host model from a one-line prompt, playing on a phone and a desktop with voice, captions, a generated scene and a hold, with no fallback.

## 16. Risks and open questions

- **ChatGPT's sandbox** may refuse `blob:` workers. Then generated scenes are refused there with a clear message and native scenes still work; CC-001 decides before CC-005 promises anything.
- **OffscreenCanvas in workers** is supported in Chrome, Edge, Firefox and Safari ≥ 16.4 (iOS included). Older Safari falls back to native scenes; the runtime detects support and the Worker's refusal text says so.
- **Fonts in workers:** `FontFace` in a worker's `FontFaceSet` is supported in the same browsers; the library falls back to system faces if a face fails to load.
- **Clock drift between voice and scene:** scene time is driven by the host's frame loop and paused with the Player; a say beat's cue fires on the voice's first word; a hold's `ms` is scene time. Drift cannot accumulate across beats because every beat re-anchors.
- **Model quality:** the eval corpus (CC-007) is the measure; the library's defaults are the main lever, the guidance the second.
- **Chamber size:** everything mounts through the director and two small layers; if the Chamber must grow by more than ~150 lines for this stage, that is the signal to extract the stage composition first.
- **KaTeX and Trusted Types:** KaTeX output is inserted as HTML; the pending Trusted Types work (B5) must cover it, or the caption layer renders maths into a shadow root with a policy. Decide in CC-003.
- **Open:** whether `look` survives as a shorthand once styles exist (proposal: yes, as a style with one scene); whether a scene may request WebGPU (no, in this stage); whether holds may be interrupted by the reader's tap to continue (a form of interaction; roadmap).

## 17. Check against the operating principles

- **Requirements questioned, and deleted:** free coordinates for text (deleted for named places); arbitrary fonts (deleted for a self-hosted set); a second player (deleted); model-owned screens (deleted); reader interaction and imagery lookup (moved out, each with a reason). What remains is what the owner named plus two things that make 3Blue1Brown-style readings possible at all (maths, hold completion).
- **Every layer earns its place:** the worker is isolation and liveness, not ceremony; the conductor is one function on an existing seam; the caption layer is the one new surface the text needs; manifests are the contract the SDK will freeze.
- **Fundamentals before details:** the timeline (beats on the existing score) is settled before any drawing API; the drawing API is small and may change.
- **Verified by something that ran:** every sub-project ends with unit tests, a browser test under the real sandbox rules, and a witness in a host, as the Composer work did; the stage's acceptance is a real reading.
- **The reader's experience:** one behaviour across hosts and voices; the reader's settings win; safety guards cannot be escaped by generated code.
