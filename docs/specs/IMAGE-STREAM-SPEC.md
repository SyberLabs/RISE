# Image Stream Specification

**A rapid serial stream of images beside the rapid serial stream of words:
frames replacing frames at several per second, never passing through black,
governed by the light it actually puts on the screen.**

Status: PROPOSED. The pure core (`src/core/luminance.js`,
`src/core/flash-meter.js`, `streamFrameAt` in `src/core/visual-presence.js`)
is implemented and tested. The reel compiler, the presenter and the panel
control are not. No surface named `'stream'` is registered, so nothing here
can reach a reader yet. Open questions are marked ⁇.

---

## 1. What was retired, and why it could not be saved

Rhythmic interlocution (RHYTHMIC-VISUAL-PRESENCE-SPEC) is an **event**
economy. At each atom boundary the player rolls a probability
(`src/core/player.js`, `flashChance`), pauses the words, and the cortex
presents one image (`VisualCortex.flash`) for 150 ms to 2 s, fading in and
out of an opaque overlay. `VisualFlashGate` then holds the next event back:
180 ms between starts, three per 1.2 s, a rest of 1.25 times the presence,
45% of any twelve seconds.

Two things follow from that shape.

1. **Every event is itself a flash.** Reading, then image, then reading is a
   pair of opposing luminance changes over most of the screen. That is the
   WCAG 2.3.1 definition of one flash.
2. **The only safety lever was scarcity.** Because the gate counted events
   rather than measuring light, the way to lower risk was to make events
   rarer and further apart. Every rule pushes toward isolated glimpses.

The intent was never isolated glimpses. It was a **stream**: images arriving
the way words arrive in RISE, one replacing the next at speed, so that the
reader receives a visual current alongside the verbal one. The event economy
cannot express that, and making it safe meant switching it off
(`FLASHING_ENABLED = false`). That remains correct for the event economy.
This specification does not turn it back on.

## 2. What the stream is

Rapid serial visual presentation (RSVP) of images. Perception research on
RSVP shows that the gist of a picture is extracted from presentations around
100 ms and shorter, so a stream at 6 to 12 images per second is a legible
medium, not flicker.

- **A stream, not an interrupt.** It has its own clock. The words never
  pause for it. It is a third presenter beside the flash economy and the
  Continuous Field, and it never routes through `flash()`.
- **Frame replaces frame.** No overlay fade, no black between images, no
  opacity transition. Each image is drawn over the last on one canvas.
- **Locked to the display.** A frame is held for a whole number of display
  refreshes (`streamFrameAt`), so every image gets the same exposure and none
  is dropped or doubled by a timer landing between refreshes.
- **Compiled ahead.** The hot path cannot decode, render or analyse images at
  ten per second. A reel is built off the main thread before playback and
  played from decoded bitmaps.

### Rate

| Constant | Value |
| --- | ---: |
| `STREAM_RATE_MIN_HZ` | 4 |
| `STREAM_RATE_DEFAULT_HZ` | 8 |
| `STREAM_RATE_MAX_HZ` | 12 |

At 60 Hz the default holds each frame for 8 refreshes (133 ms, an effective
7.5 Hz). At 120 Hz it is 15 refreshes (125 ms, exactly 8 Hz).

## 3. Safety: measure the light, not the events

### The rule we implement

WCAG 2.3.1 (Three Flashes or Below Threshold), with its definitions:

- A **general flash** is a pair of opposing changes in relative luminance of
  0.1 or more, where the darker state is below 0.80.
- A **red flash** is a pair of opposing transitions involving saturated red:
  `R/(R+G+B) >= 0.8` and a change in `(R - G - B) × 320` greater than 20,
  negative values clamped to 0, with R, G and B linearised.
- A flash only counts when the combined area changing at once is larger than
  25% of a 10 degree visual field. WCAG estimates the field as 341 × 256 CSS
  px, which makes the threshold **21,824 CSS px²** (`FLASH_SAFE_AREA_PX`).
- Content must not flash more than three times in any one second.

RISE keeps one in hand: `STREAM_MAX_FLASHES_PER_WINDOW = 2`.

### How the meter applies it (`src/core/flash-meter.js`)

Each frame is summarised as a coarse grid of cells
(`summarizeFrame`, default 24 × 24), each holding mean relative luminance
and a saturated-red value, both averaged in linear light.

Per cell, the meter tracks turning points: a cell **transitions** when it has
moved by at least the threshold away from its last extreme, in the opposite
direction to its last transition (or in either direction, the first time).
Tracking extremes rather than frame-to-frame differences means a slow
dissolve that adds up to a large change is one transition, and many small
steps cannot hide a large swing.

A **transition event** happens on a frame when the area of cells
transitioning on that frame exceeds the safe area. Flashes in a window are
`floor(events / 2)`. Area is summed over the whole aperture, which
over-counts against WCAG's "any one 10 degree field" and so errs safe.

`certifySequence(frames, { frameMs, areaPx })` plays a reel through a fresh
meter for two full loops, so the wrap from last frame to first is checked,
and reports the worst window.

### The lever that makes it tractable: the aperture

If the whole stream occupies no more than the safe area, **no transition can
ever count**, whatever the images are and however fast they change
(`apertureIsInherentlySafe`). RSVP research uses small central images in any
case, and RISE already centres the reader's gaze on the word's fixation
point. So there are two regimes.

| Regime | Size | What makes it safe |
| --- | --- | --- |
| Fixation aperture | at most 21,824 CSS px² (about 147 px square) | geometry alone |
| Wide field | larger, up to behind-stream | each reel certified by `certifySequence`, re-checked at runtime |

**Build the fixation aperture first.** Its safety follows from its size, so
it does not depend on the analysis code being right.

⁇ The CSS reference pixel is defined by visual angle, so the threshold is
roughly device-independent, but a phone held close subtends more of the
visual field than WCAG's model assumes. Whether to scale the aperture down on
coarse pointers, or by a measured viewing distance, is open.

### What the meter cannot see

- **The display.** Software controls the signal, not panel brightness, HDR
  tone mapping or how close the reader sits. The stream stays opt-in behind a
  photosensitivity notice even when certified.
- **Spatial patterns.** Dense regular high-contrast stripes are a separate
  trigger (ITU-R BT.1702) that luminance arithmetic does not catch. Klee
  lines and the harmonograph draw exactly that kind of figure. The reel
  compiler needs a pattern check (stripe count and contrast across the
  frame) before those engines feed a wide-field reel.

## 4. The reel compiler (not built)

Runs in a worker. Input: the active image pools the cortex already warms
(procedural engines and sourced categories). Output: an ordered list of
`ImageBitmap`s and their frame summaries.

1. Render or decode each candidate at aperture size.
2. Summarise it (`summarizeFrame`).
3. **Normalise outliers.** Tone-map frames whose mean luminance sits far
   outside the reel's band, and desaturate cells that read as saturated red.
4. **Order for neighbours.** Greedy nearest neighbour on the luminance grid,
   so consecutive frames differ in content more than in light.
5. **Certify.** `certifySequence` at the reel's rate and the aperture's real
   area. A failing reel drops its worst frame, or halves its rate, and
   certifies again. A reel that still fails is not played.

## 5. The presenter (not built)

`src/visuals/image-stream.js`, mounted like the Continuous Field.

- One canvas. `requestAnimationFrame` drives it; `streamFrameAt` chooses the
  frame from elapsed presentation time; the display refresh rate is measured
  from frame timestamps over the first half second.
- A runtime `FlashMeter` observes every frame actually drawn. If it ever
  reports `ok: false`, the stream stops and the Continuous Field takes the
  aperture. This is the second, independent, fail-closed check behind
  certification.
- Stands down entirely under photosensitivity mode and
  `prefers-reduced-motion`.
- Pauses with the reading. A seek recomputes the frame from time; nothing is
  replayed to catch up.

## 6. Coupling to the words

⁇ The one decision that shapes the architecture.

- **Free-running** (default in this proposal): the stream has its own rate and
  clock in the presenter, and the reading's pause, seek and end drive it.
  Simplest, and the rate the reader sets is the rate they see.
- **Phase-locked**: the stream advances k frames per word, so a long word or a
  pause holds the image stream too. The clock then belongs to the player, and
  rate varies with reading speed and pacing.

`streamFrameAt` is a pure function of elapsed time either way, so the choice
moves the clock's owner, not its arithmetic.

## 7. Switches

- `FLASHING_ENABLED` stays `false`. The stream is not the event economy.
- The stream gets its own build flag when its presenter lands. Registering
  `'stream'` in `PRESENTATION_SURFACES` happens in the same change, with
  `flashing-disabled.test.js` extended so that, while the flag is off, every
  input naming it still resolves to the Continuous Field. That test already
  lists `'stream'` among its hostile inputs.
- A property test belongs beside the compiler: random reels at
  `STREAM_RATE_MAX_HZ` in a wide-field aperture, after compilation, never
  certify with more than `STREAM_MAX_FLASHES_PER_WINDOW` flashes in a window.

## 8. Order of work

1. Pure core: luminance summaries, the flash meter, the stream clock. **Done.**
2. Presenter at fixation-aperture size, free-running, behind its flag.
3. Reel compiler with normalisation, ordering and certification.
4. Wide-field regime, runtime meter fallback, pattern check.
5. Panel control (rate, regime) and the photosensitivity notice.
