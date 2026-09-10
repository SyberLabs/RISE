# Progressive Glass Envelope Design

## Purpose

When a Chamber phrase uses both Progressive Reveal and glassmorphism, the glass should disclose with the reading instead of exposing the final phrase footprint before its words arrive.

## Requirements questioned

- The text must not be re-laid out as words appear. The final phrase remains in normal layout from the first frame; pending words are only visually hidden.
- The glass does not need one PAINTED surface per word, and must not have one: a backdrop-filter per word is N filtered layers. One pane carries the paint; per-word disclosure is a mask on it, which costs no extra filtering and, because mask layers composite additively by default, leaves no seam between adjacent words. Measured in Chromium: across the overlap of two adjacent bands the mask never falls below 244/255.
- Phone glass already acts as a stable, full-width reading band. Growing it would reintroduce movement and backdrop-filter churn on the devices where stability matters most, so the current phone band remains unchanged at widths up to 640px.
- Reduced-motion readers and instant reveals keep the complete slab because no timed disclosure occurs.

## Behavior

On desktop and tablet, the glass pane covers the whole atom box and never moves. What discloses is its mask: each revealed word contributes one band over itself, ramped from nothing to solid across 24px at each end, and the bands sum. Adjacent words overlap by two ramps and add back to solid, so a phrase reads as one continuous pane with no seam between words. The outermost band dissolves rather than stopping, so the glass has no edge.

Nothing animates. A word and its band share one timer and arrive together; between onsets the glass is completely still.

WHY NOT AN ENVELOPE THAT GROWS. Two earlier versions expanded a single rectangle to the union of the revealed words — first in short eased hops per word, then as one continuous linear glide timed to reach each word at its onset. Both were reported as feeling anxious, "like watching a loading bar", and the second more than the first. The reason is not the curve. A hard frontier advancing left to right over a known distance IS a progress indicator, whatever it moves on; easing changes only the bar's character, and constant velocity is the one signature that machines have and living things do not. Worse, a glide timed to arrive at each word LEADS the reader — the boundary is always slightly ahead of the word being read, which is a metronome one can see. Removing the edge removes all three problems at once, and removes the motion with them.

The existing atom box retains its padding and border geometry, but its glass paint moves to one `::before` pseudo-element while the progressive envelope is active. The text spans remain above the pseudo-element. This preserves phrase wrapping and positioning while changing only the painted bounds.

At the next atom, a seam, cancellation, or teardown, Chamber clears the previous envelope before scheduling another reveal. If usable word geometry cannot be measured, Chamber falls back to the existing complete slab rather than leaving the text without glass.

## State and ownership

`Chamber` owns the reveal schedule and therefore owns the glass envelope state. `revealAtomWords` initializes the envelope, and the same callback that removes `data-pending` expands it. `cancelReveal` clears timers and envelope state together, preventing a previous atom's timer or geometry from leaking into the next atom.

The element exposes only transient presentation state:

- `is-progressive-glass` selects the pseudo-element paint.
- `is-progressive-glass-ready` makes the measured envelope visible.
- Three CSS custom properties carry the mask: its layer list, and the position and size of each band.

No session schema or persisted preference changes are required.

## Verification

- A component regression test proves the first word creates one band and a later word ADDS a second, leaving the first untouched, without moving or removing the final phrase layout.
- A test proves the mask does not change at all between one word's onset and the next, which is the property the whole design exists for.
- Tests prove cancellation clears the envelope and stale timers.
- Tests prove narrow viewports and reduced-motion preferences retain the complete glass slab.
- Existing Chamber safety, stream face, settings, unit, and build gates remain green.
