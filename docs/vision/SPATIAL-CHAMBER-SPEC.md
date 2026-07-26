# The Spatial Chamber — a second kind of reading room

**The Chamber is entered as one door and opens onto two thresholds: the
Chamber of Time (the Stream) and the Chamber of Space (the Page). Same
reading, same corpus, same imagery — two mediums, each with its own
honest configuration.**

Status: SPEC + v1 build. A sibling to `PAGE-MODE-SPEC` (which built the
Page renderer) and the "Study" stance of `NORTH-STAR.md` given a body.
Rulings by the creator are marked ✦; open questions ⁇.

---

## 1. Why a second chamber, not a setting

Page Mode began as an in-session toggle. That was the wrong frame, and the
system said so in two voices:

1. **The Temporal orbit becomes meaningless in a page.** WPM, curve, and
   chunk mode govern a stream the reader cannot outpace; a page is read at
   the reader's own pace. A setting that invalidates an entire sibling
   panel is not a setting — it is a **mode**.
2. **The spatial medium has parameters of its own** — typography, measure,
   image density, later pagination — with no temporal equivalent.

✦ **Ruling: Page vs. Stream is a change of MEDIUM, not a visual preference.**
It therefore never lives inside the Visual panel (which governs what
appears *behind* a reading, not what a reading *is*).

And it must be **legible at the door**. An in-session button, however
convenient, cannot teach a newcomer that the medium can change. The
threshold does.

## 2. The shape: one door, two thresholds

✦ **Ruling (creator): the portal keeps ONE `CHAMBER` door.** Entering
presents the choice:

```
                    CHAMBER
                       │
        ┌──────────────┴──────────────┐
   Chamber of Time              Chamber of Space
   (the Stream — RSVP)          (the Page — typeset)
        │                              │
   the orbital                    the spatial surface
   (Temporal · Audio · Visual)    (Text · Visual · Page)
```

This preserves the portal's calm hierarchy (which the Two Thresholds work
deliberately restored) while making the medium choice unmissable one step
in. A returning reader passes through in one click; a newcomer is taught
what R.I.S.E. is by being asked.

## 3. The load-bearing discipline: one core, two projections

The danger of a second chamber is **two drifting configuration surfaces**.
The rule that prevents it:

> ✦ **The two chambers SHARE everything about the reading, and differ only
> in the projection's own parameters.**

| Shared (one implementation, both chambers) | Time only | Space only |
|---|---|---|
| Text source & origin | wpm | typography scale |
| `visualProgram` (pericopes) | curve | image density |
| Visual collections / interlocution | chunk mode | *(later: pagination, columns)* |
| Audio / soundscape | presentation surface | |
| Launch identity & persistence | | |

There is **one session compiler, one visual pipeline, one persistence
path**. The Spatial Chamber is not a fork of the orbital; it is a second
*panel* over the same core, and the session it emits differs by a single
field: which projection to render.

✦ **The projection travels as `projection: 'stream' | 'page'` on the
session config** — read by the Chamber to decide which renderer to mount.
Everything else in the payload is identical, which is exactly why the
Page can already typeset any session the Stream can play.

## 4. Visual language: the circle and the cross

The orbital is a **circle** — things orbiting a centre, the grammar of
*time*. The Spatial Chamber is a **cross of rounded rectangles** — the
grammar of *architecture*: a floor plan, a page grid, a codex opening.

✦ The distinction does honest work: a reader can tell at a glance which
medium they are configuring. It is not decoration.

Both inherit the room's material language — the slate/bevel tactility of
the nav tiles and the pavilions, the dim ground, the literary serif.

## 5. v1 parameter set (deliberately minimal)

✦ **Ruling (creator): start minimal.** Ship the shared basics plus only
what clearly matters now; the rest arrives with the grid engine
(`PAGE-MODE-SPEC` §9).

**v1 carries:**
- **Text** — the shared source card (identical to the orbital's).
- **Visual** — the shared collections/interlocution panel. Imagery is
  central to the Page: the pericope binding is the whole point.
- **Page** — the projection's own, small: a **typography scale**
  (the reading measure and size) and an **image density** (how freely
  figures earn full-bleed placement — the compositor's `BLEED_TEXT_DEBT`
  exposed as an intention, not a number).

**v1 deliberately excludes** (and says so rather than stubbing):
pagination vs scroll, multi-column, baseline grid, per-figure overrides.
These belong to the grid engine and arrive with it.

## 6. What must not change

- **Strictly additive.** The orbital, the Stream, the cortex, the flash
  economy, and every persistence path behave exactly as they do today. A
  reader who never chooses Space sees no difference.
- **One binding, two projections.** The Page continues to bind image to
  passage through the same `cueForAtom` the Stream uses.
- **Reverent degradation** everywhere: an unresolvable work leaves no
  frame; a works-less episode is stillness.
- **`aic-*` ids and sacred invariants** untouched.
- **The in-session toggle survives.** Choosing Time and then switching to
  the Page mid-reading remains valid — the threshold adds a front door, it
  does not remove the interior one.

## 7. Build order

1. **The threshold** — the Chamber door opens on the two choices; picking
   Time yields today's orbital unchanged, picking Space yields the spatial
   surface. Remembered so a returning reader is not re-asked forever ⁇.
2. **The spatial surface** — the `+` layout carrying Text · Visual · Page,
   reusing the shared panels verbatim.
3. **`projection` through the payload** — the session carries its
   projection; the Chamber mounts the Page renderer directly when it is
   `'page'` (no toggle press required).
4. **The two v1 spatial parameters** — typography scale and image density,
   wired to the article's measure/size and the compositor's bleed debt.
5. **Verify** — a Gospel chapter entered through the Space threshold
   typesets immediately; the Time threshold is byte-for-byte the reading
   it is today.

---

*The frame is the creator's: the Chamber is of Space or of Time. One door,
two thresholds — the medium choice made legible at the moment of entry,
each room configured in its own honest terms, over one shared core so the
two can never drift.*
