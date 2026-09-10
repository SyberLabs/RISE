# Progressive Glass Envelope Design

## Purpose

When a Chamber phrase uses both Progressive Reveal and glassmorphism, the glass should disclose with the reading instead of exposing the final phrase footprint before its words arrive.

## Requirements questioned

- The text must not be re-laid out as words appear. The final phrase remains in normal layout from the first frame; pending words are only visually hidden.
- The glass does not need one surface per word. One envelope around the revealed prefix communicates progress with less rendering work and no seams between adjacent words.
- Phone glass already acts as a stable, full-width reading band. Growing it would reintroduce movement and backdrop-filter churn on the devices where stability matters most, so the current phone band remains unchanged at widths up to 640px.
- Reduced-motion readers and instant reveals keep the complete slab because no timed disclosure occurs.

## Behavior

On desktop and tablet, the first revealed word creates a rounded glass envelope around that word. Each later word expands the same envelope to the union of all revealed word rectangles. The glass begins a linear glide toward the next bound early enough to arrive at that word's scheduled onset, so ordinary reading cadence produces one continuous motion instead of repeated short hops. A glide is capped at 360ms so a long spoken pause remains a pause. The union is monotonic during an atom, so the envelope never contracts or jumps backward. Wrapped lines expand the envelope vertically and horizontally as one rectangular pane.

The existing atom box retains its padding and border geometry, but its glass paint moves to one `::before` pseudo-element while the progressive envelope is active. The text spans remain above the pseudo-element. This preserves phrase wrapping and positioning while changing only the painted bounds.

At the next atom, a seam, cancellation, or teardown, Chamber clears the previous envelope before scheduling another reveal. If usable word geometry cannot be measured, Chamber falls back to the existing complete slab rather than leaving the text without glass.

## State and ownership

`Chamber` owns the reveal schedule and therefore owns the glass envelope state. `revealAtomWords` initializes the envelope, and the same callback that removes `data-pending` expands it. `cancelReveal` clears timers and envelope state together, preventing a previous atom's timer or geometry from leaking into the next atom.

The element exposes only transient presentation state:

- `is-progressive-glass` selects the pseudo-element paint.
- `is-progressive-glass-ready` makes the measured envelope visible.
- Four CSS custom properties carry the measured rectangle.

No session schema or persisted preference changes are required.

## Verification

- A component regression test proves the first word creates a partial envelope and a later word expands it without moving or removing the final phrase layout.
- Tests prove cancellation clears the envelope and stale timers.
- Tests prove narrow viewports and reduced-motion preferences retain the complete glass slab.
- Existing Chamber safety, stream face, settings, unit, and build gates remain green.
