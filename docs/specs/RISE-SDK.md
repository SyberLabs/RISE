# RiseSDK: the renderer contract

**Status: PROVISIONAL v1, `1.0.0-provisional`** (`RISE_SDK_VERSION` in `src/core/rise-sdk.js`). Written 2026-10-08 for CC-008 of the Creative Control stage ([design](../superpowers/specs/2026-10-08-creative-control-design.md), §15). Owner: Claude coordinator (plugin lane). It freezes after the owner's Live Run, the stage's acceptance reading in a host. Until then any part may change, but only together with this document, in the same change.

Earlier records (SDK-001 and SDK-002 in `docs/product/tasks/`, and the [Composer decision](../product/discussions/2026-10-04-composer-decision.md)) said the SDK should wait for observed integration demand. The owner reopened it with the Creative Control stage on 2026-10-08: the parameter manifests and the scene protocol are now real, and this document writes them down as one contract. It does not claim that an outside integrator exists yet.

## 1. Purpose

RISE turns a document called a **Current** into a timed reading: a voice, the words shown as they are spoken, and pictures behind them. This document is for an engineer who has never seen RISE and wants to do one of three things:

- **Write Currents** as another model provider or tool: the shape of the document, every field, every limit, every refusal (§3 to §6).
- **Write a generated scene**: a small JavaScript module that draws a picture RISE runs in an isolated worker (§7).
- **Host RISE** in another MCP host, or embed it: the two tools, the resources, and what the card tells the host's model (§8).

What RISE draws, how it lays out text and which pixels appear are not part of the contract (§10).

Every value below comes from a named constant in the code. `src/core/rise-sdk.js` re-exports the contract's constants in one module, as data only. `src/core/rise-sdk.test.js` checks that every number, name and list in this document equals the code. So if a limit changes, an engine gains a parameter, `rise.lib` gains a call or a message is added, that test fails until this document is updated.

### What "frozen" will mean

After the freeze, `1.x` changes are **additive only**: a new optional field, a new engine, parameter, named cue, style, face, place, size or sound, a new `rise.lib` call, a new message a receiver may ignore, or a looser limit. Anything else is a new major version of `RISE_SDK_VERSION`: removing or renaming anything, tightening a limit, changing what a value means, or making an optional field required. A breaking change to the document also takes a new schema id (`rise.current.v3`), and a breaking change to the worker protocol a new `SCENE_PROTOCOL_VERSION`. A v1 or v2 Current that is valid at the freeze stays valid in every `1.x`.

## 2. Versions

| Constant | Value | Meaning |
| --- | --- | --- |
| `RISE_SDK_VERSION` | `1.0.0-provisional` | This contract. |
| `RISE_CURRENT_SCHEMA` | `rise.current.v1` | The first Current: passages ([RISE-CURRENT-V1-SLICE.md](RISE-CURRENT-V1-SLICE.md)). Still valid. |
| `RISE_CURRENT_SCHEMA_V2` | `rise.current.v2` | The Current with beats and scenes (§3). |
| `SCENE_PROTOCOL_VERSION` | 1 | Messages between the card and a scene worker (§7.10). Sent in `scene/init`. |
| `PROTOCOL_VERSIONS` | `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` | MCP versions the server speaks, newest first (`worker/mcp-server.mjs`). |
| `PROTOCOL_VERSION` | `2026-01-26` | The MCP Apps extension version the card says hello with (`src/live/hosts/mcp-port.js`). |

## 3. The Current v2

A Current is one JSON object. RISE validates it strictly: it refuses anything it does not recognise and never clamps a value or drops a field. The reference validator is `validateRiseCurrent` in `src/core/rise-current.js`. It is a pure function: the server runs it, and the card runs it again. A refusal is a `RiseCurrentError` with a `code`, a JSON `path` (`$.beats[3].hold.ms`) and a message.

```json
{
  "schema": "rise.current.v2",
  "id": "vector-length",
  "title": "How long is a vector?",
  "theme": "cobalt",
  "origin": { "kind": "model", "name": "Your name", "provider": "Who runs you" },
  "scenes": [{ "id": "field", "engine": "attractor" }, { "id": "calm", "engine": "still" }],
  "beats": [
    { "say": "A vector has a direction and a length.", "scene": "field", "sound": "starlight" },
    { "hold": { "ms": 2500 } },
    { "say": "Its length is the square root of x squared plus y squared.", "show": "Its length is $\\sqrt{x^2+y^2}$.", "place": "caption" },
    { "show": "The Pythagorean theorem, in two dimensions.", "hold": { "ms": 2000 }, "scene": "calm", "size": "smaller" }
  ]
}
```

### 3.1 Fields

| Field | Required | Value |
| --- | --- | --- |
| `schema` | yes | `rise.current.v2`. |
| `id` | yes | A trimmed id of at most `RISE_CURRENT_LIMITS.id` characters. |
| `title` | yes | Nonblank text of at most `RISE_CURRENT_LIMITS.title` characters. |
| `origin` | yes | `{ kind, name, provider? }`, where `kind` is `model` or `human`. A model origin must name its `provider`; a human one must not. `name` and `provider` hold at most `RISE_CURRENT_LIMITS.name` characters. It says who wrote the words. It is not a citation. |
| `theme` | no | One of `RISE_CURRENT_THEME_IDS`. A name only: colours come from RISE's own palettes. |
| `look` | no | One of `RISE_CURRENT_LOOKS`: a preset of field, face, size and theme. |
| `style` | no | One of `RISE_CURRENT_STYLES` (§4). |
| `type` | no | `{ text?, caption? }`: the reading's faces, each one of `BEAT_TYPES` (§5). |
| `scenes` | no | At most `BEAT_LIMITS.scenes` scenes (§3.4). |
| `beats` | yes | 1 to `BEAT_LIMITS.beats` beats, in order (§3.2). |

A field that is not listed is refused. So is a `null` optional field (leave it out). A v2 Current with `segments` is refused: passages belong to v1.

### 3.2 Beats

Which fields a beat has decides its kind:

| Kind | Has | Spoken | Shown | Lasts |
| --- | --- | --- | --- | --- |
| say | `say`, optional `show`, no `hold` | `say` | `show` if given, else `say`; nothing with `place: "none"` | as long as the voice takes |
| hold | `hold`, no `say`, no `show` | nothing | the running scene | §3.3 |
| show | `show` and `hold`, no `say` | nothing | `show` | `hold.ms`, shared by its words |

Any other combination is refused (`BEAT_KIND`).

| Beat field | Required | Value |
| --- | --- | --- |
| `say` | no | Text the voice says, at most `BEAT_LIMITS.text` characters. |
| `show` | no | Text shown instead of `say`, at most `BEAT_LIMITS.text` characters. May hold maths (§5). |
| `hold` | no | `{ ms, maxMs? }`, whole milliseconds. `ms` from `BEAT_LIMITS.holdMinMs` to `BEAT_LIMITS.holdMaxMs`; `maxMs` at least `ms` and at most `BEAT_LIMITS.holdMaxMs`. |
| `scene` | no | The id of a declared scene, started at this beat. It keeps running under the following beats until another starts. |
| `cue` | no | A signal to the running scene when this beat begins (§6.3, §7.4): matches `BEAT_CUE_PATTERN`, at most `BEAT_LIMITS.cue` characters. Refused with no scene running. |
| `transition` | no | `{ ms }`, 0 to `BEAT_LIMITS.transitionMaxMs`, how long the new scene takes to fade in. Default `BEAT_LIMITS.transitionDefaultMs`. |
| `place` | no | One of `BEAT_PLACES` (§5). |
| `size` | no | One of `BEAT_SIZES` (§5). |
| `type` | no | One of `BEAT_TYPES`: a face for this beat (§5). |
| `emphasis` | no | At most `BEAT_LIMITS.emphasis` words, each nonblank and at most `BEAT_LIMITS.emphasisLength` characters, to set apart. The voice is unchanged. |
| `sound` | no | A sound id: an atmosphere or music bed that stays (`soundscape`), a one-off `tone`, or `none`. The ids are the `enum` of the tool's input schema (`SOUND_IDS` in `src/audio/sound-ids.js`). |

A beat that starts a scene and cues it reaches the scene it started. Text may not contain the playback markers `[PAUSE]`, `[FLASH]`, `[HOLD]`, `|` or U+E000 (`CURRENT_RESERVED_TEXT`).

### 3.3 How long a hold lasts

- A hold with no `maxMs` lasts exactly `ms`.
- A hold with `maxMs`, under a generated scene that exports `reportsCompletion = true`, ends when the scene calls `rise.done()`. It never ends sooner than `SCENE_LIMITS.earliestDoneMs` into the hold, and it ends at `maxMs` if the scene never calls `done`.
- Any other hold lasts `ms`. So does a hold whose scene fails or is frozen: it then runs on `ms` from where it began.
- Pause stops the voice, the hold and the scene's time together.

### 3.4 Scenes

A scene is either a **native engine** with parameters or **generated code**, never both (`SCENE_CODE`). Ids are unique within the Current.

| Scene field | Required | Value |
| --- | --- | --- |
| `id` | yes | A trimmed id of at most `BEAT_LIMITS.id` characters. |
| `engine` | no | One of `SCENE_ENGINES` (§6). Given with `params`, never with `code`. |
| `params` | no | The engine's parameters, each held to its manifest (§6.2). Unknown names and out-of-range values are refused. |
| `code` | no | A generated scene's module: at most `BEAT_LIMITS.code` bytes of UTF-8, with `export default` (§7). |

### 3.5 Limits

| Constant | Value | Meaning |
| --- | --- | --- |
| `BEAT_LIMITS.beats` | 64 | Beats per Current. |
| `BEAT_LIMITS.scenes` | 8 | Scenes per Current. |
| `BEAT_LIMITS.code` | 24,576 | UTF-8 bytes of one scene's `code`. |
| `BEAT_LIMITS.text` | 4,000 | Characters of one `say` or `show`. |
| `BEAT_LIMITS.totalText` | 20,000 | Characters of `say` and `show` in all. |
| `BEAT_LIMITS.id` | 120 | Characters of a scene id. |
| `BEAT_LIMITS.cue` | 40 | Characters of a cue. |
| `BEAT_LIMITS.emphasis` | 8 | Emphasised words per beat. |
| `BEAT_LIMITS.emphasisLength` | 40 | Characters of one emphasised word. |
| `BEAT_LIMITS.holdMinMs` | 200 | Shortest hold. |
| `BEAT_LIMITS.holdMaxMs` | 60,000 | Longest hold, and the most `maxMs` may be. |
| `BEAT_LIMITS.transitionMaxMs` | 5,000 | Longest scene transition. |
| `BEAT_LIMITS.transitionDefaultMs` | 600 | The transition a beat that sets none gets. |
| `RISE_CURRENT_LIMITS.id` | 120 | Characters of the Current's id (and a v1 segment's). |
| `RISE_CURRENT_LIMITS.title` | 200 | Characters of the title. |
| `RISE_CURRENT_LIMITS.name` | 120 | Characters of `origin.name` and `origin.provider`. |
| `MCP_CURRENT_BYTES` | 65,536 | UTF-8 bytes of the whole Current as JSON, through the MCP host path (`src/live/hosts/mcp-size.js`). |
| `BEAT_CUE_PATTERN` | `^[A-Za-z0-9_:=.-]+$` | What a cue may be; the input schema uses the same pattern. |

### 3.6 Catalogs

| Constant | Value | Meaning |
| --- | --- | --- |
| `RISE_CURRENT_THEME_IDS` | `classic`, `amethyst`, `prism`, `ember`, `cobalt`, `jade`, `rose`, `citrine`, `silver` | Colour themes. |
| `RISE_CURRENT_LOOKS` | `plain`, `gallery`, `nocturne`, `garden`, `flame`, `signal`, `iris`, `revel`, `vigil`, `inlay` | Looks. |
| `RISE_CURRENT_STYLES` | `premium-educational`, `open-field` | Styles (§4). |
| `SCENE_ENGINES` | `still`, `attractor`, `genesis`, `living-flame`, `fractal`, `turrell`, `neural`, `rockgarden`, `harmonograph`, `ostensoria`, `apparitio` | Native engines (§6). |

### 3.7 Refusal codes

| Code | Refused when |
| --- | --- |
| `CURRENT_OBJECT` | Something that must be a plain object is not. |
| `CURRENT_UNKNOWN_FIELD` | A field is not in the contract (or is `__proto__`, `constructor`, `prototype`). |
| `CURRENT_ID` | An id is empty, untrimmed or too long. |
| `CURRENT_DUPLICATE_ID` | Two scenes share an id. |
| `CURRENT_TEXT` | Text is blank, not a string, or too long. |
| `CURRENT_RESERVED_TEXT` | Text holds a playback marker. |
| `CURRENT_TOTAL_TEXT` | All the text together is over `BEAT_LIMITS.totalText`. |
| `CURRENT_THEME` | `theme` is not a theme id. |
| `CURRENT_LOOK` | `look` is not a look id. |
| `CURRENT_STYLE` | `style` is not a style id. |
| `CURRENT_ORIGIN` | `origin.kind` is neither `model` nor `human`. |
| `CURRENT_PROVIDER` | A model origin has no provider, or a human one has one. |
| `SCENE_COUNT` | `scenes` is not an array of at most `BEAT_LIMITS.scenes`. |
| `SCENE_ENGINE` | `engine` is not a native engine. |
| `SCENE_PARAM` | A parameter is unknown to the engine, or outside its bounds. |
| `SCENE_CODE` | A scene has both engine and code, or code that is too large or has no `export default`. |
| `BEAT_COUNT` | `beats` is missing, empty, or too long. |
| `BEAT_KIND` | A beat's fields fit no kind (§3.2). |
| `BEAT_HOLD` | `hold.ms` or `hold.maxMs` is out of bounds. |
| `BEAT_SCENE` | `scene` names no declared scene. |
| `BEAT_CUE` | A cue does not match the pattern, is too long, has no running scene, or is not one the running engine takes. The message lists the cues it takes. |
| `BEAT_TRANSITION` | `transition.ms` is out of bounds. |
| `BEAT_PLACE` | `place` is not a place. |
| `BEAT_SIZE` | `size` is not a size. |
| `BEAT_TYPE` | `type` (on a beat or in the Current's `type`) is not a role or face. |
| `BEAT_EMPHASIS` | `emphasis` has too many words, or a blank or long one. |
| `BEAT_SOUND` | `sound` is not a sound id. |

An unknown `schema` is refused too. The server adds two refusals that are not codes: a Current over `MCP_CURRENT_BYTES`, and a scene its admission refuses (§7.7).

### 3.8 Version 1 stays valid

A `rise.current.v1` Current is passages (`segments`), each with text, an optional visual from `RISE_CURRENT_VISUALS` and optional Dive notes. It is accepted unchanged. Its contract is [RISE-CURRENT-V1-SLICE.md](RISE-CURRENT-V1-SLICE.md). Its limits:

| Constant | Value | Meaning |
| --- | --- | --- |
| `RISE_CURRENT_VISUALS` | `still`, `attractor`, `genesis` | The visual a v1 passage may name. |
| `RISE_CURRENT_LIMITS.segments` | 16 | Passages per v1 Current. |
| `RISE_CURRENT_LIMITS.segmentText` | 4,000 | Characters of one passage. |
| `RISE_CURRENT_LIMITS.totalText` | 20,000 | Characters of all passages. |
| `RISE_CURRENT_LIMITS.dives` | 8 | Dive notes per passage. |
| `RISE_CURRENT_LIMITS.diveText` | 600 | Characters of one Dive note. |

## 4. Styles

A style is a named bundle (`STYLES` in `src/core/styles.js`). It gives a place, size and faces to every beat that shows text and sets none of its own, and `rise.lib` defaults to every generated scene. A hold takes no typography. Faces set on the Current or on a beat override the style's, role by role. A model reads a style's full guidance with the `rise_guide` tool (§8).

| Style | Place | Size | Text face | Caption face | Ease | Stroke | Grid alpha |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `premium-educational` | `caption` | `as-set` | `book-serif` | `humanist-sans` | `smooth` | 2.5 | 0.12 |
| `open-field` | `centre` | `as-set` | — | `display-serif` | `out` | 2 | 0.25 |

Each style also sets a label font for `rise.lib`, a CSS font string naming one of RISE's faces. A Current with no style gets the library's own defaults:

| Constant | Value | Meaning |
| --- | --- | --- |
| `LIBRARY_DEFAULTS.ease` | `smooth` | The tween curve a call leaves out. |
| `LIBRARY_DEFAULTS.stroke` | 2 | Line width in CSS pixels. |
| `LIBRARY_DEFAULTS.gridAlpha` | 0.25 | Opacity of `grid`. |
| `LIBRARY_DEFAULTS.labelFont` | `14px sans-serif` | Font of `label`. |

## 5. Typography

**Places.** `BEAT_PLACES` says where a beat's text goes:

| Constant | Value | Meaning |
| --- | --- | --- |
| `BEAT_PLACES` | `centre`, `caption`, `top`, `left`, `right`, `none` | `centre` is the reading's own line; `caption` is the lower third; `top` is the upper third; `left` and `right` are a column, which a narrow screen shows as a caption; `none` is spoken and not shown. |
| `BEAT_SIZES` | `smaller`, `as-set`, `larger`, `display` | Steps from the size the reader chose: one down, none, one up, two up. Never past the reader's smallest or largest size. |
| `TYPE_ROLES` | `book-serif`, `display-serif`, `humanist-sans`, `geometric-sans`, `mono`, `display`, `handwritten`, `condensed` | Faces by what the text is for. The guide teaches roles. |
| `BEAT_TYPES` | `book-serif`, `display-serif`, `humanist-sans`, `geometric-sans`, `mono`, `display`, `handwritten`, `condensed`, `crimson-pro`, `instrument-serif`, `instrument-sans`, `space-grotesk`, `jetbrains-mono`, `marcellus`, `caveat`, `barlow-condensed`, `inter` | What `type` may name: a role, or a face id. |

**Faces.** `TYPE_FACES` in `src/core/typography.js`. RISE serves every face itself (`public/fonts`), because a host's card may load fonts only from RISE's origin.

| Face | Role | Weight |
| --- | --- | --- |
| `crimson-pro` | `book-serif` | 400 |
| `instrument-serif` | `display-serif` | 400 |
| `instrument-sans` | `humanist-sans` | 400 |
| `space-grotesk` | `geometric-sans` | 500 |
| `jetbrains-mono` | `mono` | 400 |
| `marcellus` | `display` | 400 |
| `caveat` | `handwritten` | 500 |
| `barlow-condensed` | `condensed` | 500 |
| `inter` | — | 400 |

A beat's `type` wins. Without one, a beat placed at `centre` takes the Current's (or style's) `type.text`, and a beat placed elsewhere takes `type.caption`. When nothing names a face, the reader's own face setting stands.

**Maths.** In `show`, `$…$` is inline maths and `$$…$$` displayed maths. RISE typesets it with its own copy of KaTeX (`trust: false`), loaded only when a reading has maths. Until it loads, the formula shows as its TeX source. The voice says `say`, so write the spoken form there ("x squared").

## 6. Native scenes and manifests

Each native engine has a **manifest** (`SCENE_MANIFESTS` in `src/scenes/manifests.js`). The same manifests drive the validator, the score, the cue delivery and the guide the model reads (`describeManifests()`).

### 6.1 The manifest shape

```js
{
  id: 'attractor',            // what a scene's "engine" names
  kind: 'field',              // 'still' | 'field' (persistent engine) | 'procedural' (pattern engine)
  surface: 'attractor',       // what a cue command addresses
  readableOverText: true,     // the engine is quiet enough to read words over
  parameters: {
    system:    { type: 'enum', values: ['aizawa', 'thomas', 'halvorsen'], default: 'aizawa', cueable: false },
    intensity: { type: 'number', minimum: 0.4, maximum: 0.75, default: 0.65, cueable: true }
    // type 'integer' is a number that must be whole
  },
  cues: { calm: { intensity: 0.45 }, bright: { intensity: 0.75 } }   // named cue -> parameters it sets
}
```

A parameter that is `cueable` changes while the engine runs. Every other parameter applies only when the scene starts. The visual-control path has an older manifest of the same shape for the attractor (`ATTRACTOR_VISUAL_MANIFEST` in `src/core/visual-control-contract.js`), which also carries `requiresCanvas: true`. Nothing reads `requiresCanvas` today, and the scene manifests do not carry it.

### 6.2 Engines

| Engine | Kind | Surface | Readable over text | Named cues |
| --- | --- | --- | --- | --- |
| `still` | `still` | `still` | yes | — |
| `attractor` | `field` | `attractor` | yes | `calm` (intensity=0.45), `bright` (intensity=0.75) |
| `genesis` | `field` | `genesis` | yes | — |
| `living-flame` | `field` | `living-flame` | yes | `calm` (energy=0.15), `surge` (energy=0.9), `warm` (hue=30), `cool` (hue=-40) |
| `fractal` | `procedural` | `fractal` | yes | — |
| `turrell` | `procedural` | `turrell` | yes | — |
| `neural` | `procedural` | `neural` | yes | — |
| `rockgarden` | `procedural` | `rockgarden` | yes | — |
| `harmonograph` | `procedural` | `harmonograph` | yes | — |
| `ostensoria` | `procedural` | `ostensoria` | yes | — |
| `apparitio` | `procedural` | `apparitio` | yes | — |

| Engine | Parameter | Type | Range or values | Default | Cueable |
| --- | --- | --- | --- | --- | --- |
| `attractor` | `system` | enum | `aizawa`, `thomas`, `halvorsen` | `aizawa` | no |
| `attractor` | `palette` | enum | `white`, `red`, `blue`, `gold`, `purple`, `neon`, `jade`, `rose`, `citrine`, `silver` | `gold` | no |
| `attractor` | `form` | enum | `mirror`, `kaleido`, `bilateral` | `mirror` | no |
| `attractor` | `intensity` | number | 0.4 to 0.75 | 0.65 | yes |
| `attractor` | `speed` | number | 0.25 to 4 | 1 | no |
| `genesis` | `preset` | enum | `harmonic`, `chaotic`, `twittering`, `architectural`, `gravitational` | `harmonic` | no |
| `living-flame` | `preset` | enum | `ember-cathedral`, `violet-nebula`, `glacial-silk`, `solar-bloom`, `verdant-current`, `prismatic-knot` | `ember-cathedral` | no |
| `living-flame` | `energy` | number | 0 to 1 | 0.35 | yes |
| `living-flame` | `complexity` | number | 0 to 1 | 0.55 | yes |
| `living-flame` | `hue` | number | -180 to 180 | 0 | yes |
| `living-flame` | `symmetry` | integer | 1 to 8 | 1 | no |
| `living-flame` | `intensity` | number | 0 to 1 | 0.35 | no |
| `harmonograph` | `climate` | enum | `auto`, `emberDawn`, `solarFlare`, `midnightWater`, `stormViolet`, `jadeVeil`, `whiteHeat` | `auto` | no |
| `ostensoria` | `palette` | enum | `auto`, `iris`, `reliquary`, `ember`, `ice`, `verdant`, `lilac`, `teal`, `sepia`, `peacock`, `rose`, `citrine` | `auto` | no |
| `apparitio` | `palette` | enum | `auto`, `prism`, `marian`, `ember`, `holo` | `auto` | no |

Engines not listed in the second table take no parameters. A `params` object for them must be empty or left out.

### 6.3 Cues to a native engine

A beat's `cue` under a native scene is one of two forms. Anything else is refused (`BEAT_CUE`), and the message names the cues the engine takes.

- **A named cue** from the engine's `cues`, such as `calm`.
- **`set:<parameter>=<value>`** on a `cueable` parameter, such as `set:hue=30`. The value is a decimal number (an optional minus sign and fraction, no exponent) and must be within the parameter's bounds.

The card lowers a cue to commands of the shape `{ surface, parameter, value }`, one per parameter it sets, and delivers them when the beat begins. That shape is checked again where it is applied (`validateVisualCommand`). A renderer that implements this contract takes the same commands.

## 7. Generated scenes

A generated scene is a picture the model writes as code. RISE checks the code on the server without running it (§7.7). In the card, it runs the code in a dedicated Web Worker on an `OffscreenCanvas` behind the words. Generated scenes are promised for Claude only. They are not promised for ChatGPT until its sandbox has been measured (§10).

### 7.1 The module

`code` is the text of one ES module (ES2022). Its single default export is a function. It receives `rise` and returns an object with `frame(t, dt)` and, optionally, `cue(name, { instant })`. This is the example the guide gives every model:

```js
export const reportsCompletion = true;
export default function scene(rise) {
  const { lib } = rise;
  const plane = lib.axes({ x: [-1, 4], y: [-1, 3] });
  const v = lib.vector({ x: 3, y: 2, label: 'v', t: 0 });
  return {
    frame(t, dt) {
      lib.clear();
      lib.grid(plane);
      plane.draw();
      v.draw(plane);
    },
    cue(name, { instant }) {
      if (name === 'draw') return lib.tween(v, { t: 1 }, { ms: 900, instant });
      if (name === 'turn') return lib.tween(v, { angle: Math.PI / 2 }, { ms: 1500, instant }).then(() => rise.done());
    }
  };
}
```

- The default export runs once. It must return an object with a `frame` function, or the scene fails at `init`.
- `frame(t, dt)` draws the whole picture each time it is called.
- `cue(name, { instant })` is optional. It may return a promise; a rejected promise counts as a failure.
- `export const reportsCompletion = true` (a boolean literal, nothing else) declares that the scene calls `rise.done()`. Without it, `done` is ignored and a scene cannot end a hold by accident (§3.3).

### 7.2 The `rise` object

| Member | What it is |
| --- | --- |
| `ctx` | The canvas's 2D context, created the first time it is read. |
| `use('webgl2')` | Switch to WebGL2 instead. Call it before the first frame and before reading `ctx`. It returns the context. |
| `gl` | The WebGL2 context after `use('webgl2')`, otherwise `null`. |
| `size` | `{ width, height, dpr }`: CSS pixels, and the device pixel ratio, capped at `SCENE_LIMITS.maxDpr`. The same object is updated on resize. |
| `theme` | The reading's colours: `background`, `text`, `accent`, `muted`, `highlight`. |
| `reducedMotion` | `true` when the reader asked for reduced motion. |
| `fonts` | An empty list in this version. Labels draw in the system's faces. |
| `lib` | The drawing library (§7.3), with the style's defaults. |
| `done()` | Says the current hold may end (§3.3). |

### 7.3 `rise.lib`

Coordinates: `axes` returns a *frame*, the mapping from scene units to device pixels that the other calls draw on. `label` takes CSS pixels.

| rise.lib | Signature | What it does |
| --- | --- | --- |
| `clear` | `clear(color?)` | Fill the canvas with the background (or `color`). First in every frame. |
| `axes` | `axes({ x: [x0, x1], y: [y0, y1] }, { color, labels, margin }?)` | A frame with `draw()`, `toX(x)`, `toY(y)`, `origin`, and the range. |
| `grid` | `grid(frame, { step, color, alpha }?)` | Grid lines at every `step`. |
| `plot` | `plot(frame, fn or points, { color, width, samples, to }?)` | A curve of `x => y` or `[[x, y], …]`; tween `to` (0 to 1) to draw it. |
| `vector` | `vector({ x, y, from, color, label, t, angle, width })` | An arrow; returns its state with `draw(frame)`. Tween `t` (how much is drawn) and `angle` (radians). |
| `point` | `point(frame, [x, y], { color, radius, label }?)` | A dot. |
| `line` | `line(frame, [x0, y0], [x1, y1], { color, width, dash }?)` | A segment. |
| `arc` | `arc(frame, [cx, cy], radius, from, to, { color, width }?)` | An arc; angles in radians. |
| `polygon` | `polygon(frame, [[x, y], …], { color, alpha, outline }?)` | A filled shape. |
| `label` | `label(text, { at: [x, y], color, font, align, baseline, alpha })` | Canvas text at CSS pixels. |
| `tween` | `tween(target, { property: value }, { ms, ease, instant }?)` | Moves numbers on RISE's clock; returns a promise. With `instant`, or reduced motion, it lands at once. |
| `tick` | `tick(dt)` | Advances every tween. The worker calls it before each frame; a scene does not. |
| `ease` | `ease.linear`, `smooth`, `in`, `out`, `inOut` | Easing curves, `t => t`. |
| `color` | `color(name, alpha?)` | A theme colour by name, with an alpha. |
| `palette` | `palette` | The theme colours by name. |
| `moving` | `moving` | How many tweens are still running. |

### 7.4 The clock

The card owns time. It sends `frame` messages only while the reading plays, one at a time: it waits for each frame to finish before it sends the next. `t` is scene time in milliseconds and stops while the reading is paused. `dt` is the time since the last frame, cut short after a long gap, so that a hidden tab does not make the scene jump. Before the first visible frame the worker runs `frame(0, 0)` once. An error there fails the scene before anything is shown. A cue is delivered when the beat that names it begins. Cues sent before the scene is ready wait in order.

`instant` is part of the protocol: a scene must land on a cue's end state at once when `instant` is true. The card sends `instant: false` in this version. Replaying earlier cues instantly on Replay or seek ([design](../superpowers/specs/2026-10-08-creative-control-design.md) §7) is not built.

### 7.5 Reduced motion

With `rise.reducedMotion` true, every `rise.lib` tween completes in one step. A scene that animates by its own arithmetic should also honour the flag. Holds still last their time.

### 7.6 What a scene may not use, and why

A scene has no network, no storage, no DOM, no timers of its own, no way to speak for the worker, and no way to build code from strings. The names are declared once, in `BANNED_SCENE_NAMES` (`src/scenes/scene-bans.js`), and enforced by two locks:

- **Shadowed in the worker and refused by admission:** `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport`, `BroadcastChannel`, `Worker`, `SharedWorker`, `importScripts`, `indexedDB`, `caches`, `navigator`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `postMessage`, `FontFace`
- **Refused by admission only:** `eval`, `Function`, `self`, `globalThis`, `window`

The first list is `SHADOWED_GLOBALS`. Before it loads the code, the worker replaces each of those names with a stub that throws and cannot be put back. `FontFace` is there because its `load()` fetches a URL. The second list is `STATIC_ONLY_NAMES`: names the worker cannot shadow, either because they are the worker itself or because they reach every global. The parse refuses them. The worker also seals the `constructor` of every function prototype, because `[].constructor.constructor` reaches `Function` without naming it. If any name cannot be shadowed or any prototype sealed, the code is not run.

Why: the code is untrusted. It runs with none of RISE's authority: no host port, no storage, no fonts, no speech, and no network beyond what the host's sandbox would block anyway. Time comes only from `frame`, so that Pause stops the picture.

### 7.7 Admission on the server

`admitSceneCode` in `worker/scene-admission.mjs` parses every `code` scene with acorn as an ES2022 module and never runs it. The rules:

1. At most `BEAT_LIMITS.code` bytes of UTF-8.
2. The code parses as a module. A module is strict, so `with` is a syntax error.
3. Exactly one default export, a plain function (not async, not a generator).
4. No `import` of any kind, no `import()`, no `export … from`.
5. No `debugger`.
6. No banned name used as a name, anywhere. A local variable with a banned name is refused too. A property name such as `a.fetch` or `{ fetch: 1 }` is allowed.
7. A `reportsCompletion` export, if present, is a boolean literal.

One refused scene refuses the whole `rise_present` call (`isError`). The text has one line per problem: up to `MAX_SCENE_LINES` lines across all scenes, sorted by position. Each line reads `Scene "<id>" was refused: line L, column C: <rule>.`, and the column counts from one. A final line asks the model to repair the code and call again. For example:

```text
Scene "vector" was refused: line 2, column 16: `fetch` is not available to a scene, and the name is refused even as a local name.
```

### 7.8 Budgets and failure in the card

| Constant | Value | Meaning |
| --- | --- | --- |
| `SCENE_LIMITS.frameSoftMs` | 24 | A frame slower than this is slow. |
| `SCENE_LIMITS.frameSoftCount` | 3 | This many slow frames within one second is a failure. |
| `SCENE_LIMITS.frameHardMs` | 200 | One frame slower than this is a failure. |
| `SCENE_LIMITS.silenceMs` | 1,000 | A worker that has not answered a frame for this long is a failure. |
| `SCENE_LIMITS.earliestDoneMs` | 200 | The soonest into a hold that `done` may end it. |
| `SCENE_LIMITS.lumaEveryMs` | 100 | How often, in scene time, the worker samples brightness for the flash gate. |
| `SCENE_LIMITS.maxDpr` | 2 | The device pixel ratio a scene draws at, at most. |

An exception in loading, `init`, a frame or a cue is also a failure. On failure the card terminates the worker and shows the reading's fallback visual (the look's field, or a still) for that scene's beats, and it does not run that scene again in that reading. Any open hold runs on its `ms`. The failure is reported (§8.4).

**Photosensitivity.** The worker samples its own picture every `SCENE_LIMITS.lumaEveryMs` (an 8×8 average brightness) and reports it to the card. The card feeds the samples to the same flash gate every RISE visual answers to (`VisualFlashGate`). A scene that would flash is frozen on its last frame, its holds run on `ms`, and the freeze is reported. A scene cannot opt out.

### 7.9 Where a scene runs

The worker is RISE's built `src/scenes/scene-worker.js`, started by `src/scenes/create-scene-worker.js`: a classic worker from a `blob:` URL in a host's card; RISE's own module worker on its pages. In a card the page's origin may be opaque, and a module worker's script is fetched in a mode a `blob:null` URL cannot pass, so there it would never load. Either way the worker imports the admitted code with `import()` from a second `blob:` URL. It holds the transferred canvas and has nothing else of the page.

### 7.10 The worker protocol

Messages are plain objects with a `type`. A receiver drops any message whose type it does not know, and reads a known one field by field. Nothing the worker sends is run by the card.

| Message | Type | Fields |
| --- | --- | --- |
| `TO_WORKER.init` | `scene/init` | `version` (`SCENE_PROTOCOL_VERSION`), `code`, `width`, `height`, `dpr`, `theme`, `reducedMotion`, `library` (the style's defaults), `canvas` (transferred) |
| `TO_WORKER.frame` | `scene/frame` | `t`, `dt` (milliseconds) |
| `TO_WORKER.cue` | `scene/cue` | `name`, `instant` |
| `TO_WORKER.resize` | `scene/resize` | `width`, `height`, `dpr` |
| `TO_WORKER.dispose` | `scene/dispose` | none |
| `TO_HOST.ready` | `scene/ready` | `reportsCompletion` |
| `TO_HOST.frameDone` | `scene/frame-done` | `t`, `ms` (how long the frame took) |
| `TO_HOST.cued` | `scene/cued` | `name` |
| `TO_HOST.done` | `scene/done` | none |
| `TO_HOST.luma` | `scene/luma` | `value` (0 to 1), `t` |
| `TO_HOST.error` | `scene/error` | `message`, `where` (`scene.js:line:column` or `null`), `phase` (`load`, `init`, `frame` or `cue`) |

## 8. The host protocol (MCP)

RISE is an MCP server at `MCP_PATH` on its own origin (`worker/mcp-server.mjs`). It uses Streamable HTTP in its simplest form: every request is a POST with one JSON body and gets one JSON answer, with no stream and no session. It keeps nothing, calls no model and holds no key. It is off unless switched on. How it was checked, and against what, is in [LIVE-MCP.md](../plans/LIVE-MCP.md).

| Constant | Value | Meaning |
| --- | --- | --- |
| `MCP_PATH` | `/api/mcp` | The endpoint. |
| `TOOL_NAME` | `rise_present` | The tool that presents a Current. |
| `GUIDE_TOOL_NAME` | `rise_guide` | The tool that returns a style's guidance. |
| `APP_URI` | `ui://rise/current` | The card the host shows for a `rise_present` call. |
| `APP_MIME` | `text/html;profile=mcp-app` | The card's type. |
| `MAX_SCENE_LINES` | 10 | Scene refusal lines in one answer. |

### 8.1 `rise_present`

- **Input:** `{ current }` and nothing else. `current` is `oneOf` the v1 and v2 schemas (`currentJsonSchema`, `currentJsonSchemaV2`). Every limit and catalog in the schema comes from the validator's constants. Where JSON Schema cannot say what the validator checks, the schema is looser, never stricter.
- **Accepted:** the text `RISE accepted this Current for presentation to the reader.` and `structuredContent: { current }`. That means it is accepted, not that it has played.
- **Refused:** `isError: true` with text a model can act on: `RISE refused this Current: <message> (<path>). Correct it and call rise_present again.`, a size refusal, or the scene lines of §7.7. An argument beside `current` is refused by name.
- **Annotations:** read-only, not destructive, idempotent, closed world. No authentication.
- The description holds the guide to writing a Current, generated from the same constants, and one line per style.

### 8.2 `rise_guide`

- **Input:** `{ style }`, one of `RISE_CURRENT_STYLES`, and nothing else.
- **Result:** that style's full guidance and two worked Currents, as one text block. Anything else gets `isError` and the list of styles. It exists because some hosts (claude.ai) let only the reader attach resources, and the model can only call tools.

### 8.3 Resources

- `ui://rise/current` (`text/html;profile=mcp-app`): the card. Its `_meta.ui.csp` names only RISE's origin.
- `ui://rise/guide/<style>` (`text/markdown`): the same text `rise_guide` returns, for hosts whose model reads resources. Any other guide address is `-32002`.

### 8.4 What the card tells the host's model

When a generated scene fails in the card, the card sends `ui/update-model-context` with one text block, if the host offered `hostCapabilities.updateModelContext.text` when the card said hello (Claude does). The host keeps only the latest update, so each one carries every line so far:

```text
RISE could not run part of the reading it is showing; the reader sees its fallback instead:
scene "vector": frame — the scene’s own words: "TypeError: v.draw is not a function" at scene.js:14:5
scene "vector": frozen — it would flash more than three times a second; its last frame stays
```

The lines are RISE's words. A scene's own error message is quoted as data, with control characters removed and double quotes replaced, so a scene cannot write instructions into the model's context. A failed send costs nothing, because the reader already sees the fallback.

| Constant | Value | Meaning |
| --- | --- | --- |
| `PORT_LIMITS.report` | 2,000 | Characters of one update. |
| `PORT_LIMITS.reportLine` | 400 | Characters of one line. |
| `PORT_LIMITS.reports` | 5 | Updates per Current. |

The same lines go to the browser console as `[RISE scene]`.

## 9. Versioning

- **The document** carries its version in `schema`: `RISE_CURRENT_SCHEMA` and `RISE_CURRENT_SCHEMA_V2`. A reader of Currents accepts both.
- **The worker protocol** carries `SCENE_PROTOCOL_VERSION` in `scene/init`.
- **The whole contract** is `RISE_SDK_VERSION`. It moves when anything in this document changes: the patch number for wording only, the minor number for an addition, the major number for a break (§1).
- **The MCP layer** follows MCP's own versions (`PROTOCOL_VERSIONS`) and the Apps extension's (`PROTOCOL_VERSION`). They change when MCP changes, not when this contract does.

An embedder imports the contract's values from `src/core/rise-sdk.js`, which holds no logic, and validates with `validateRiseCurrent` from `src/core/rise-current.js`. RISE does not yet publish these as a package; they live in this repository.

## 10. What is not promised

- **No pixels.** The same Current may look different across releases, hosts and screens. Engine rendering, layout, scrims, transitions and the exact text sizes are RISE's to change. Only the names, values and behaviours above are the contract.
- **No moderation.** A scene can draw anything within its budget. The words and pictures a model composes are the host model's responsibility, as its text is.
- **ChatGPT is unmeasured.** Whether ChatGPT's sandbox allows `blob:` workers and `ui/update-model-context` has not been measured (CC-001, pending). Until it is, generated scenes are promised for Claude only, and native scenes everywhere.
- **The internal score is not the contract.** How a Current lowers to RISE's Experience Program and Session (`compileRiseCurrent`) may change without a version bump.
- **Not in this version:** reader interaction inside scenes, an imagery lookup a model can call, fonts inside the scene worker, WebGPU, instant cue replay on seek, and Dive or realtime Live.

## 11. How this document is kept true

`src/core/rise-sdk.test.js` fails when:

1. a value in any table headed *Constant | Value* differs from the constant it names, or names a constant the contract does not export;
2. a key of `BEAT_LIMITS`, `RISE_CURRENT_LIMITS`, `SCENE_LIMITS` or `LIBRARY_DEFAULTS` has no row here, or an export of `src/core/rise-sdk.js` is not named here;
3. the field tables differ from the tool's input schema, or the refusal codes from the validators' own;
4. the style, face, engine or parameter tables differ from `STYLES`, `TYPE_FACES` or `SCENE_MANIFESTS`, or the engines differ from what `describeManifests()` tells the model;
5. the `rise.lib` table differs from the keys of `createSceneLibrary(…)`, the message table from `TO_WORKER` and `TO_HOST`, or the banned lists from `SHADOWED_GLOBALS` and `STATIC_ONLY_NAMES`;
6. the example module, the refusal line or the report lines differ from what the guide, the server and the card produce;
7. `src/core/rise-sdk.js` exports a function, or imports anything outside the core and the scenes.
