# Fit Mask Repair Design

## Status

Approved for implementation on 2026-08-22.

## Problem

The Visual Interlocution panel currently exposes `Fit` as a font-size choice,
while Gallery-in-the-word masking remains a separate, mostly hidden state.
This split contract produces three visible failures:

1. A fresh desktop Fit session can render ordinary white text instead of the
   configured secondary Gallery inside the glyphs.
2. Desktop fitting measures a flexible field that the fitted word itself can
   enlarge. Short words therefore create a positive feedback loop: the field
   grows, the next word is fitted against the larger field, and the viewport
   jumps or drifts off centre.
3. Procedural mask-ground profiles and the Fractal Flames density adapter do
   not perform their advertised jobs. Opaque procedural void pixels cover the
   cream or dark-slate ground, and the Fractal adapter changes tone without
   increasing visible spatial support.

The mobile layout avoids most of the feedback loop because width constrains
the fitted word first, but it still inherits the contradictory mode and
compositing contracts.

## Product Contract

`Fit` is one atomic reading mode. Selecting it means all of the following:

- the reading is chunked by word;
- each non-empty word is fitted inside a stable, viewport-owned stage box;
- the configured Word source is rendered inside the word glyphs;
- the Room source remains visible outside the glyphs;
- glass and ordinary white text do not compete with the glyph mask.

Selecting Small, Medium, or Large ends Fit masking and restores the ordinary
Gallery presentation selected by the reader. The UI must not require a hidden
Settings toggle or a retired presentation choice to complete Fit.

The existing `continuous-word` value remains readable as a compatibility
alias. New panel interaction must not need to write it. Fit derives mask
authority from the chosen font-size intent, word chunking, and a viable Gallery
configuration.

## Architecture

### 1. One Fit authority

A small pure resolver will answer whether a session is in Fit mask mode. It
will be the only contract used by the Visual Interlocution panel, Chamber mask
activation, and tests. The resolver consumes the font-size intent, chunk mode,
visual mode, and presentation; it does not read DOM state.

When Fit is selected in the panel, the panel writes the minimum canonical
configuration: `fontSize: "fit"`, word chunking, Gallery presentation, and no
glass. Small, Medium, and Large only change font-size intent; they do not erase
the reader's Room or Word source selections.

The legacy `chamberMask` preference remains supported for explicitly masked
word sessions outside the panel, but it is no longer required for Fit.

### 2. Stable geometry

Fit must never measure an element whose dimensions can be changed by the word
being fitted. The Chamber will capture a stable stage box from the rendered
Chamber display/viewport, subtract the actual control-bar and safe-area
occupation, and pass that immutable width and height to the existing glyph
measurement function.

The fitted font must satisfy both glyph bounds and line-box bounds. Its
line-height-adjusted height, horizontal padding, and vertical padding must fit
within the box. The result is clamped to a deliberate minimum and maximum, and
the atom display is prevented from increasing the Chamber's block size.

The same calculation is used on desktop and mobile. Responsive CSS may change
available padding, but it may not provide a second sizing algorithm.

### 3. Honest mask-ground compositing

Mask-ground profiles remain a layer beneath the Word source:

- `transparent` adds no colour plate;
- `light` uses the existing cream token;
- `dark` uses the existing dark-slate token.

Any procedural adapter that claims to reveal a ground must emit transparent
alpha for unoccupied pixels. Fractal Flames will convert only verified void
pixels to alpha zero. Occupied pixels retain their colour and alpha. Collection
and uploaded-image fills remain opaque because their profile is transparent.

This contract deletes the present impossible claim that an opaque
`#0A0A0C` pixel is a "plate hole."

### 4. Bounded Fractal word-fill density

The room Fractal generator, queue, iteration count, and classic full-frame
appearance remain unchanged. Word-fill density is handled only in the existing
post-generation adapter.

For Fractal word fill, the adapter will derive an occupancy mask from
non-void pixels, apply a bounded one-pixel neighbourhood expansion, and then
run the existing locked tone curve on occupied colour. Expansion samples the
strongest neighbouring occupied pixel and never fills beyond the fixed radius.
This makes thin flame filaments legible at desktop resolution without creating
a second iterated-function-system queue or scaling generator work with viewport
area.

Reduced-motion uses the same static spatial operation with the existing milder
tone curve. The adapter remains deterministic and does no histogram-based
auto-exposure.

## Data Flow

1. The reader selects Fit.
2. The panel emits one canonical configuration with Word chunking and Gallery.
3. Session compilation preserves Room and Word source identities.
4. Chamber resolves Fit mask authority before mounting the two-layer Gallery.
5. Chamber captures the stable stage box and fits each word against it.
6. The Word source renders into the mask fill host.
7. The source profile chooses the ground plate.
8. A procedural adapter makes void pixels transparent; the ground shows
   through those voids and the room remains visible outside the glyph.

## Error and Fallback Rules

- Empty and whitespace atoms do not enter Fit measurement or build an SVG
  mask.
- If the stable stage box or glyph measurement is unavailable, Chamber falls
  back to the existing Medium intent for that atom; it must not reuse a stale
  fitted pixel value.
- If the Word source cannot mount, the glyph uses the profile ground colour as
  a legible static fill. The Room Gallery continues independently.
- Resizing invalidates the captured stage box and rebuilds the current fitted
  word and mask once. Atom changes alone do not change the box.
- Fit never changes playback timing, cadence, Room source identity, or Word
  source identity.

## Testing

### Pure and component tests

- Fit authority resolves true only for the canonical viable session and the
  legacy compatibility alias.
- Selecting Fit writes Word + Gallery + no-glass; leaving Fit preserves source
  selections.
- Fitting includes line height and cannot return a size whose line box exceeds
  the stable stage.
- Chamber measures the stable display box rather than `atom-band` or a
  content-grown field.
- Fractal void pixels become alpha zero.
- Occupied Fractal pixels retain non-zero alpha and bounded colour.
- The density pass expands a single occupied pixel by the fixed radius and
  does not alter pixels outside it.
- The room Fractal configuration and generator plan remain byte-for-byte
  unchanged by word-fill adaptation.

### Browser tests

A real Chromium test will exercise the user-visible path at desktop and mobile
viewports. It will assert that:

- selecting Fit activates a persistent glyph mask without opening Settings;
- every sampled atom and its line box remain inside the Chamber stage;
- the Chamber stage dimensions remain constant across short and long words;
- the atom centre remains within a small tolerance of the stage centre;
- a Fractal Word source exposes the configured cream ground through transparent
  voids;
- changing back to Medium removes the Fit mask and restores ordinary Gallery
  text.

## Non-goals

- No second Fractal generator or queue.
- No changes to the full-frame room Fractal appearance.
- No new presentation button or additional mask toggle.
- No redesign of Gallery cadence or source selection.
- No repository-wide line-ending migration; the Windows baseline discrepancy
  discovered during worktree setup is tracked separately from this feature.

## Release Criteria

The repair is releasable when the focused unit/component suites, production
build, hygiene checks, and new desktop/mobile browser corridor pass, and manual
browser inspection confirms stable centring with collection and procedural Word
sources. Any known baseline failure must be reported separately and may not be
represented as caused or fixed by this work.
