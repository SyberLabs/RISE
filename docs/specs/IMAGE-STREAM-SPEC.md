# Image Stream Specification

**A rapid serial stream of images beside the rapid serial stream of words:
frames replacing frames at several per second, never passing through black,
governed by the light it actually puts on the screen.**

Status: PROPOSED. The pure core (`src/core/luminance.js`,
`src/core/flash-meter.js`, `streamFrameAt` in `src/core/visual-presence.js`)
and the fixation-aperture presenter (`src/visuals/image-stream.js`) are
implemented and tested. The surface `'stream'` is registered behind its own
build flag, `IMAGE_STREAM_ENABLED`, which is **off**: while it is off no
reader can reach the stream. The reel compiler and the panel control are not
built. Open questions are marked ⁇.

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

Each frame is summarised as a grid of cells (`summarizeFrame`, one cell
per pixel by default), each holding mean relative luminance and a
saturated-red value, both averaged in linear light. The meter refuses any
coarser grid: a cell's mean cannot see a pattern inverting inside it, so a
checkerboard and its inverse would read as the same grey while every pixel
flashes. Coarse grids serve only to order a reel.

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

### The aperture lowers the risk; the meter is the guard

A stream no larger than the safe area (`apertureIsInherentlySafe`) would,
by WCAG's arithmetic, never hold a transition that counts. That was this
proposal's first argument for building the fixation aperture first, and it
does not hold, because the page cannot see the size the reader sees:

- **Page zoom and magnifiers.** Browser zoom, Android display and text
  scaling, and OS magnifiers enlarge the 140 CSS px canvas on screen, but
  neither `getBoundingClientRect()` nor `visualViewport.scale` reports it.
  At 200% zoom the aperture covers 78,400 px² of the reader's view while the
  page still measures 19,600.
- **Blur and compositing.** The glass tile under the words
  (`backdrop-filter: blur(16px)`, on by default) and any filter, blend mode
  or overlay spread the stream's light past its square. The meter reads the
  canvas, not the screen.
- **Viewing distance.** A phone held close puts more of the visual field
  inside 140 CSS px than WCAG's model assumes (below).

So the fixation aperture **reduces** risk and is **not** a safety guarantee.
The runtime meter is the guard at every size, and **a flash over a small
part of the aperture counts**. Each frame is judged as if the stream covered
`METER_FLOOR_AREA_PX` (64 × the safe area, 1,396,736 CSS px²), or its
measured on-screen area multiplied by the device pixel ratio and pinch-zoom
(each squared, never below 1) if that is more. At the floor a transition
counts once it covers more than 19,600 / 64 = 306.25 of the aperture's
19,600 pixels (1.56%, about a 17.5 px square).

Why 64. The first floor (4×) counted only a change over a quarter of the
aperture: 4,900 pixels, which at 200% zoom already cover 0.9× the safe area,
2.0× at 300% and 5.6× at 500%. At 64× the largest uncounted change (306 px)
covers 7,650 px² at 500% zoom, 0.35× the safe area. The glass tile under the
words (`blur(16px)` with a dark tint) carries a ≥ 0.1 luminance change up to
about 16–20 px past each edge, so that same change can light a 57.5 px square
(3,306 px²) at 100%, which stays under the safe area up to 2.57×
magnification. No floor covers blur at 500%: the 40 px of blur margin alone
covers 40,000 px² there. So magnification the page can see is handled apart
from the floor: the stream refuses to mount on a page that already looks
zoomed (the CSS viewport narrower than the window by more than 10%, or
pinch-zoom above 1), stands down if the device pixel ratio or viewport width
changes while it runs, and multiplies the measured area by the device pixel
ratio and pinch-zoom. **An OS magnifier, which the page cannot see, above
about 2.5× over the glass tile remains a residual risk the floor only
narrows.**

| Regime | Size | What guards it |
| --- | --- | --- |
| Fixation aperture | 140 CSS px square | the runtime meter at its floor area; reels normalised by the compiler (§4) |
| Wide field | larger, up to behind-stream | each reel certified by `certifySequence`, re-checked at runtime |

The cost of the floor: a reel of natural images changes far more than 1.56%
of the aperture by 0.1 in luminance at almost every frame, so **until the
reel compiler normalises luminance (§4), natural-image reels will almost
always trip the meter** within a second and fall back to the Gallery. The
reel compiler, and a decision on OS magnifiers, are preconditions before the
flag may flip.

⁇ The CSS reference pixel is defined by visual angle, so the threshold is
roughly device-independent, but a phone held close subtends more of the
visual field than WCAG's model assumes. Whether to scale the aperture down on
coarse pointers, or by a measured viewing distance, is open.

The arithmetic, for deciding it. WCAG's field is 10° over 341 px, about
0.0293° per CSS px, so the safe area is about 18.8 deg² and the 140 px
aperture about 16.9 deg² (90%). On a phone with a 3× display at 460 ppi a CSS
px is about 0.166 mm, so the aperture is about 23 mm square. It reaches the
threshold at about 31 cm from the eye; at 25 cm it covers about 150% of it,
and at 20 cm about 235%. Staying inside the threshold at 25 cm needs a side
of about 114 CSS px, and at 20 cm about 91. **The flag must not be switched
on until this is decided.**

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

## 5. The presenter (built at the fixation aperture, behind its flag)

`src/visuals/image-stream.js`, loaded lazily by the Chamber.

- One canvas, at most 140 CSS px square whatever it is asked for, centred in
  the stage (the Chamber exposes no fixation point; the words are centred, so
  the stage centre is where the eyes rest).
- `requestAnimationFrame` drives it. The display refresh rate is measured
  from frame timestamps over the first half second, to the nearest whole
  hertz, and the first frame holds still until then. After that the stream
  counts refreshes (each timestamp gap rounded to whole refreshes, a missed
  refresh counted as time shown) and `streamFrameAtRefresh` chooses the
  frame, so every frame is held exactly the same whole number of refreshes
  however the timestamps jitter. Choosing from elapsed time instead put frame
  boundaries exactly on refresh instants, where ±0.05 ms of jitter held a
  12 Hz frame four refreshes (15 Hz) and the next six. `streamFrameAt` now
  reads time as the nearest whole refresh for the same reason. Real time
  caps the count: a frame is never replaced sooner than one frame at the
  asked rate (less 2.5 ms of jitter), so a wrongly measured rate (a throttled
  tab, a display that changes its rate) cannot speed the stream up; and when
  the median of the last 30 refresh intervals is more than a fifth away from
  the measured rate, the stream stands down.
- Frame replaces frame: each image covers the whole aperture (cropped, never
  letterboxed) and is drawn over the last, with no clear, fill, fade or
  overlay.
- Every frame is opaque. The meter composites over black, but what lies under
  the canvas is the Gallery, so a frame with any transparency (a PNG with an
  alpha channel) would let light through that the meter never reads. Such
  frames are left out when the stream mounts, and a read-back that is not
  opaque stops the stream.
- A runtime `FlashMeter` observes every frame actually drawn, read back from
  the canvas one cell per drawn pixel. Its area is what the aperture covers
  on screen (multiplied by pinch-zoom, larger if a stylesheet stretches it),
  never less than `METER_FLOOR_AREA_PX`, and unbounded if it cannot be
  measured. A change of device pixel ratio or viewport width while it runs
  (page zoom) stops it. If the meter reports `ok: false`, the meter or anything else in
  a refresh throws, or a frame is held past 500 ms (a stalled display), the
  stream stops for good, hides, and reports one reason once.
- Stands down entirely (never mounts) without a session that accepted the
  photosensitivity notice (`hasFlashingSessionConsent`), under
  photosensitivity mode, the reader's reduced-motion setting,
  `prefers-reduced-motion`, a hidden document, or a media query that cannot
  be asked, or on a page that already looks zoomed. It asks every refresh
  and on every resume, and stops if the session's consent ends (the reading
  closing, cleared data, the error boundary's visual recovery, or a Gallery
  session taking over). It watches the root element's classes from mount, so
  photosensitivity mode or reduced motion switched on at any moment, paused
  or not, ends it; switching the setting off again does not bring it back.
- Decoding is bounded: at most 24 frames, none over eight megapixels (checked
  from the natural size once loaded, before any pixels are decoded), none
  waited on for more than five seconds. A presenter that cannot load is
  caught and logged once; the Gallery stays.
- Pauses with the reading. A seek recomputes the frame from time; nothing is
  replayed to catch up.

**The runtime meter is armed at every size.** The first build let the
aperture's size excuse it: inside 140 px no transition could count, so a
full black-and-white strobe at 12 Hz played. Review found that page zoom and
the glass tile's blur make that size untrustworthy (§3), so the meter now
judges every frame at no less than `METER_FLOOR_AREA_PX`.

**Decisions made while building it.**

1. *The canvas is backed at CSS resolution.* Its backing store is 140 × 140
   whatever the device pixel ratio, and the browser scales it up. The meter
   then reads exactly what is drawn, one cell per backing pixel, at a fixed
   19,600 cells a frame (about 0.5 ms for the summary and the meter in Node
   on a desktop). Backed at 3× it would be 176,400 cells and about 4.6 ms a
   frame, plus a 700 KB read-back. Images are slightly soft on dense screens.
2. *The visual engine never sees `'stream'`.* The launch gate hands the cortex
   Gallery for a stream session, so the event economy's flash path can never
   be configured with the stream, and tells the Chamber separately
   (`imageStream: true`) that it may mount the stream between the Gallery and
   the words. When the stream stops itself the Chamber removes it and the
   Gallery underneath remains: falling back needs no reconfiguration.
3. *Declined or photosensitive means Gallery, not nothing.* A reader who
   declines the notice, or reads with photosensitivity mode on, gets the
   Gallery (which carries no risk to consent to) rather than a blank stage.
4. *A page-first launch never streams*, including when the reader leaves the
   page for the stream view.
5. *Frames come from the Gallery's own pool*: up to 24 of the URLs its pool
   holds when the Chamber opens, decoded as CORS images so their pixels can be
   read back. An image served without CORS is left out rather than tainting
   the canvas. Procedural works are not in that pool, so a procedural-only
   reading has no frames and shows Gallery; the reel compiler (§4) replaces
   this.
6. *A hidden tab pauses it.* The Player pauses a reading when its page is
   hidden and plays it again on return, and the stream follows the Player, so
   a pause is never mistaken for a stall. The stream never mounts on a hidden
   page; were the display to stop refreshing while the stream ran (with the
   Player still playing), the return would read as a stall and stop it.
7. *Readers' seeks do not move the stream.* Free-running (§6) means the
   stream's clock has no mapping from a position in the text; `seek()` exists
   on the presenter for the phase-locked option.
8. *Turning the visuals off or changing them ends the stream for the
   reading.* Off in the Look sheet or the visual direction, any cue that is
   not a Gallery pool change (a still, a field, a scene, a focal, the change
   the Live venue holds for its shut eye), and any change of look remove it
   and withdraw its grant. Turning visuals back on does not bring it back:
   only a new launch, which raises the notice again, can. Off already in
   force at launch, or chosen while frames decode, mounts nothing. Follow
   text, which puts a still on the visual engine directly, ends it too,
   including a reading that follows its text from the first frame. A stream
   that stops itself (its meter, a stall, zoom, a setting, the refresh check)
   withdraws the grant the same way.
9. *Photosensitivity mode outranks an earlier acceptance.* The consent
   request checks the mode before any scope already accepted.

## 6. Coupling to the words

Decided: free-running, for the first presenter.

- **Free-running** (built): the stream has its own rate and
  clock in the presenter, and the reading's pause, seek and end drive it.
  Simplest, and the rate the reader sets is the rate they see.
- **Phase-locked**: the stream advances k frames per word, so a long word or a
  pause holds the image stream too. The clock then belongs to the player, and
  rate varies with reading speed and pacing.

`streamFrameAt` is a pure function of elapsed time either way, so the choice
moves the clock's owner, not its arithmetic.

## 7. Switches

- `FLASHING_ENABLED` stays `false`. The stream is not the event economy.
- `IMAGE_STREAM_ENABLED` (`src/core/visual-presence.js`) is the stream's own
  build flag, `false`. `'stream'` is registered in `PRESENTATION_SURFACES`
  and resolves to the Continuous Field whenever the flag is off, even if
  `FLASHING_ENABLED` were switched back on. `presentationFlashes('stream')` is
  true, so every gate that asks raises its notice.
  `flashing-disabled.test.js` proves the off state;
  `image-stream-enabled.test.js`, `chamber-session-factory.stream.test.js` and
  `Chamber.image-stream-enabled.test.js` state what changes when it flips.

| `IMAGE_STREAM_ENABLED` | Reading asks for `'stream'` | Notice | What the reader gets |
| --- | --- | --- | --- |
| off | anything | none | Gallery; the presenter is never loaded |
| on | accepted | raised first | Gallery with the stream over it |
| on | declined | raised first | Gallery |
| on | photosensitivity mode on | none | Gallery |
| on | opens as a page | none | Gallery, never the stream |
| on | a Composer Current | none | cannot ask for it |

- Before the flag flips: the phone aperture (§3 ⁇), the notice's wording
  (it still describes brief exposures between moments of reading), and the
  reel compiler (§4), without which most real reels trip the armed meter
  within a second. The reader can end the stream mid-reading with Off in
  the Look sheet, pause, or the photosensitivity or reduced-motion settings.
  A consent request that blocks without showing the notice (the dialog
  missing from the page) is a known gap, left for the notice's rework.
- A property test belongs beside the compiler: random reels at
  `STREAM_RATE_MAX_HZ` in a wide-field aperture, after compilation, never
  certify with more than `STREAM_MAX_FLASHES_PER_WINDOW` flashes in a window.

## 8. Order of work

1. Pure core: luminance summaries, the flash meter, the stream clock. **Done.**
2. Presenter at fixation-aperture size, free-running, behind its flag.
   **Built, flag off.**
3. Reel compiler with normalisation, ordering and certification.
4. Wide-field regime, runtime meter fallback, pattern check.
5. Panel control (rate, regime) and the photosensitivity notice.
