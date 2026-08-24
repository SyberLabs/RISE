# Visual Navigator — migration into the Chamber

Status: **Implemented 2026-08-23.** Decisions D1–D4 were approved. This is the map used to replace the Orbital's
`VisualInterlocutionPanel` (VIP) with the `VisualNavigator`
(SCRIPTORIUM redesign, Step 4).

## 1. What we are moving, and what we found

VIP is **2,147 lines**, guarded by **1,717 lines of tests**, and it is
**Chamber-only** — `ChamberOrbital.initVisualPanel` is its one mount. The
Workshop does not use it (`Workshop.test.js` asserts `#vi-panel-container` is
null). So this migration touches the Chamber and nothing else.

VIP does far more than pick a field. Its `onChange` is wired into Living Text,
the photosensitivity safety modal, SOL curated-program locking, launch-held
focals (the Chapel rose), Face/Size, `atriumCollections`, and `onFitRequested`.
Any replacement has to answer for each of those, not just the five modes.

## 2. Who owns what, after the migration

| Concern | Today (VIP) | After |
| --- | --- | --- |
| **The field** — Off / Focal / Gallery / Dynamic + substyles + blend | mode selector + source family + word-source + per-mode bodies | **VisualNavigator** (already built), emitting `configPatch` |
| **The text** — Face / Size / Ink | `renderChamberFaceRow` / `renderChamberSizeRow` | **VisualNavigator's second root** (the prototype's *Text*), writing `rise.settings` via the existing `chamber-type-size` / `chamber-stream-face` helpers |
| **Fit coupling** (`chunkMode=word`, recitation off) | `onFitRequested` callback | unchanged — the Text→Size→Fit leaf fires the same callback |
| **Living Text** | a toggle in the panel | a small sibling toggle the navigator emits (independent of field) |
| **Cadence** (Gallery crossfade pace) | presentation + `galleryCadence` | a Gallery-only control on the navigator (`galleryCadence`) |
| **SOL curated program** (read-only pool) | `programInfo` banner + locked pool | navigator gains a **program-locked mode** (banner + read-only) |
| **Launch-held focal** (Chapel rose) | `isLaunchHeldFocal` + release unlocks program | navigator's Focal leaf respects the held state; releasing it unlocks as today |
| **Personal uploads** (customVisuals / global pool) | upload + management UI | **reused as-is**, opened from the Personal leaf — NOT rebuilt in this migration |
| **Photosensitivity consent** | modal before Rhythmic flashes | **retired from the reader path** — see §4 D1 |
| **Workshop** | — (never used VIP) | unchanged |

## 3. Commit sequence — each green before the next

1. **Navigator gains the reader-facing states.** Add to `VisualNavigator`
   (pure component + jsdom tests, no Chamber change): the Text root
   (Face/Size/Ink → `rise.settings` + `onFitRequested`), the Living Text
   toggle, the Gallery Cadence control, a **program-locked/read-only mode**,
   and **held-focal** handling.
2. **The config adapter carries everything.** Extend
   `visual-taxonomy-config` so `selectionFromConfig`/`configPatch` round-trip
   Text, Living Text, and cadence too — the navigator must emit the *whole*
   `visualConfig` the Chamber consumes, not just the field. Tests round-trip
   each saved mode.
3. **Mount in the Chamber.** `ChamberOrbital.initVisualPanel` mounts
   `VisualNavigator` instead of VIP. Wire `onChange` to store the merged
   config; preserve `onFitRequested`, launch-held-focal release, and program
   lock. Remove the safety-consent trigger from the reader path (D1).
4. **Tests + e2e.** Repoint `ChamberOrbital.origin.test.js` (it clicks
   `[data-visual-mode]` today) at the navigator; retire or fold
   `VisualInterlocutionPanel.test.js`; run the full unit suite **and** the
   browser suite (`mobile`, `page-*`, `recitation`) — this is the step the
   headless layer cannot vouch for.
5. **Retire VIP by dependency.** Once the Chamber mounts the navigator and no
   import of `VisualInterlocutionPanel` remains, delete its `.js`/`.css`/
   `.test.js` — the same delete-by-dependency the Atrium had, not delete-by-name.

Follow-ups, out of this migration: flash authoring in the Workshop (behind the
consent gate), and the live engine preview in the navigator's Pokédex slot.

## 4. Decisions to confirm before Step 1

- **D1 · Retire the photosensitivity consent from the reader path?**
  *Recommend yes.* Flashes are the only thing that trips it, and flashes move
  to the Workshop (authored, behind the gate). Gallery is continuous — never a
  flash — and Dynamic and Focal do not flash, so the reader's field selection
  has nothing left to consent to. The consent flow stays in the Workshop for
  authored flashes.
- **D2 · Navigator owns Text (Face/Size/Ink) as its second root?**
  *Recommend yes* — it is exactly the prototype's *Text* root, and it makes the
  navigator a complete replacement rather than leaving a stray Text control.
- **D3 · Personal uploads reuse the existing management UI, not rebuilt?**
  *Recommend yes.* The Personal leaf opens the current customVisuals / global-
  pool management; rebuilding upload/quota handling is out of scope here.
- **D4 · Delete VIP at the end?**
  *Recommend yes*, once nothing imports it — it is Chamber-only, so the mount
  swap makes it dead code.

Decisions D1–D4 were approved and the five-step sequence was completed. The
Navigator now owns the Chamber field and text controls, preserves curated
reading identity, reuses personal focal and shared-pool management, and is the
only visual control mounted by `ChamberOrbital`.
