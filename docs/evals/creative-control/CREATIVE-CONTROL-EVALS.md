# Creative Control evaluation corpus

What this is for: measuring whether RISE's guidance and library let a model
write readings that work, by something that runs rather than by taste alone
([Creative Control design](../../superpowers/specs/2026-10-08-creative-control-design.md)
§11). Each case is a prompt a reader might give and a reference Current a
model following the guide should be able to write for it, in one style.

```text
docs/evals/creative-control/
  premium-educational/<id>.json   { "prompt": "...", "current": { ...rise.current.v2... } }
  open-field/<id>.json
  streamed/<id>.json              { "prompt": "...", "lines": [ "@say ...", "@hold 1500", ... ] }
```

The worked Currents each style's guidance teaches
(`src/live/guide/styles/*.js`, served as `ui://rise/guide/<style>`) are in
the corpus unchanged; `src/test/eval-creative.test.js` fails if they drift
apart. Every other case is the corpus's own.

A **streamed** case (added 2026-10-10, RISE Live stage 3) is the answer a
model writes as it thinks, in beats, one per line
([the line format](../../specs/LIVE-CURRENT-EVENTS-V1.md), "Beats streamed").
It is read as the Live venue reads one: through the text-stream parser into
the reducer, whole and again cut a character at a time, in a provider's
uneven deltas, and in pairs. It passes only if nothing is dropped or refused
(a scene the admission refuses included), the same Current comes out at
every cut, and that Current then passes everything below.

## Running it

```sh
npm run eval:creative
```

It runs on demand and is not part of CI. `src/test/eval-creative.test.js`
runs the same evaluation over the corpus as a unit test, so a broken case
fails the unit suite on `main`.

## What it measures

For each case, in style and file order:

1. **Acceptance**: the Current goes through the Worker's own `rise_present`
   door (`dispatch` in `worker/mcp-server.mjs`): the MCP size limit, the
   strict validator, and the static admission of every code scene and every
   figure (an SVG scene, `src/core/svg-admission.js`). A refusal
   is printed in the Worker's words, the text a model would read.
2. **Code scenes, headless**: every admitted code scene is run through the
   scene worker's own protocol (`attachSceneWorker`) over a recording 2D
   context that draws no pixels (`src/test/fake-canvas-context.js`), with the
   reading's theme and its style's library defaults, three times:
   - played: the dry frame, 60 frames at 16.7 ms, then each cue its beats
     name, animated, with frames until its tweens land;
   - seeked: every cue with `instant: true`, as a replay delivers them;
   - reduced motion: every cue animated, and no tween may still be moving
     before the next frame.
3. **Figures**: every figure is admitted again by the same function the
   card runs before it draws one, and reported with its size. It is not
   drawn: the browser draws it as an image, in the page only. Every style
   has at least one case with a figure.
4. **Report**: cues answered out of cues sent, frames drawn, the slowest
   frame, frames over the soft budget (24 ms), whether the card's kill switch
   would have ended the scene, and every error with its phase and line.

It exits non-zero on any refusal, any exception a scene throws (on load,
init, a frame or a cue, a rejected tween included), or a tween reduced
motion left moving.

## What it does not measure

- **Pixels.** Nothing is drawn; a scene that draws the wrong picture, or
  nothing, passes. Looking at a reading is still a person's job.
- **The card's frame times.** Times are measured in Node against a context
  that does no work, so they are a proxy: a scene slow here is slow in the
  card, but one fast here may not be fast there.
- **Native engines.** A native scene is checked against its engine's
  manifest by the validator; the engines draw in the page and are not run.
- **WebGL.** A scene that calls `rise.use("webgl2")` fails here (Node has no
  WebGL) and must be judged in a browser.
- **Flashing.** The flash gate samples real pixels; there are none here.
- **Isolation.** The scene code runs in this Node process, not a sandbox.
  Only add cases you have read.

## Adding a case

1. Write the prompt and the Current a model should be able to write for it,
   in the style's directory, as `<current id>.json`.
2. Run `npm run eval:creative` and read the whole report, not only the last
   line.
3. Prefer a case that exercises something the corpus does not yet: a new
   `rise.lib` call, a cue on a hold with `maxMs`, a scene that mixes `rise.ctx`
   with the library, a style's typography under a `look`.
