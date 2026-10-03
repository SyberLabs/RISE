# The night library as RISE's home

**Date:** 2026-10-03 · **Status:** as built · **Supersedes:**
[2026-09-28-oracle-home-design.md](2026-09-28-oracle-home-design.md)

## Why

The Oracle made Home one object and one key. It said nothing about what was
inside: a reader met a sphere, not a library. The night library shows the
library itself. Every released work is a star, so the reader sees that there
are texts to read before choosing anything, and can choose one directly.

> Every star is a text you can read.

```
Home            proposes a reading     (Roll a reading, or pick a star)
Reader Setup    lets the reader alter  (Adjust first)
Chamber         performs it            (Start reading, or Begin)
```

## The screen

* **Desk (900px and wider):** the sky fills the page under the header. The
  text panel sits on the left over an ink scrim that fades out before the
  stars begin.
* **Phone (under 900px):** the sky is a band at the top (34svh, at least
  220px) and the panel sits below it on ink. Roll a reading is on the first
  screen at 390×844 and 360×640. A result may scroll. Nothing scrolls sideways.
* The header, the one Menu, the Continue strip and Privacy · Terms stay as
  they were. The footer also carries one line on the reader's AI: what asking
  needs (with *connect OpenRouter* and *run RISE locally*), or what is
  connected (with Disconnect).

## States

Two fields. `Portal.view` is what the panel shows: `idle | result | ask`.
`Portal.busy` is the `data-home` hook of the work in progress, or null.
While busy, every control holds, the pressed one carries `aria-busy`, and
the sky quickens; while asking, the ask field is also read-only. The view
does not change until the work lands.

| View | The panel |
|---|---|
| idle | "Every star is a text you can read." · **Roll a reading** (the one solid key) · **Ask for one** · today's poem card ([spec](2026-10-03-poem-of-the-day-design.md)) |
| result | The mood pill · the title · "Author, from the opening section" · three parts, each with **Redraw**: *The text*, *The mood* (temper and plan words), *The passage* (the opening lines, in the reading face) · **Start reading** · **Roll again** · **Adjust first** · *Ask for something specific instead*. The chosen star flares |
| ask, connected | "What would you like to read?" field (240 characters, microphone, help) · **Ask** · **Roll instead**. Enter asks; Shift+Enter is a new line |
| ask, not connected | "Asking needs your own AI." · **Connect OpenRouter** · **Run RISE locally** · *Roll instead* · About your connection |

* **A star** rolls for its work (`rollReading({ previous, workId })`), so
  picking the star already shown still changes its mood and passage. Picks are ignored
  while Home is rolling, asking or opening a reading.
* **Redraw** keeps the other two parts: the text keeps the temper and section,
  the mood keeps the work and section, the passage keeps the work and temper.
  A RISE original has one division, so it has no passage Redraw.
* **An asked result** has no temper. Its mood reads *As you asked*. A Redraw
  on it is a roll that keeps the other parts and draws a temper.
* The status line speaks every result, as before. Errors keep their alert,
  with the cause behind a closed *Details*.
* The result lives with Home while the tab is open. A fresh load starts empty.

Hooks for tests: `data-home="roll | ask-open | ask | enter | adjust |
redraw-text | redraw-mood | redraw-passage | roll-instead"`.

## Decisions

| Question | Decision |
|---|---|
| The orb | **Deleted** (owner decision, 2026-10-03), with its flick and phone-shake roll, the iOS motion permission, the beige keycaps and the "MODEL J-82 · PHOSPHOR VOLUME" plate |
| When asking is offered | **From the start**, beside Roll a reading (owner decision). It was hidden until a first roll |
| A result's shape | **Three parts with their own Redraw**, inside the panel (from mockup B), rather than three large plates |
| Loading the sky | **After first paint, lazily** (`NightSky` and `librarySky` are dynamic imports). Every word and control is in the served HTML. If either import or `librarySky()` fails, the panel works without a sky |
| The one gradient | The ink scrim. Everything else is Atlas tokens and classes (`.btn`, `.sy-spectrum`) |

## Built from

* `src/components/Portal.js`, `Portal.css` (the page) and `portal-home.css`
  (the panel and the sky band).
* `src/components/night-library/NightSky.js`: the sky (a canvas and one
  button per star, with group labels). Home calls `start`, `stop`, `flare`,
  `setBusy` and `destroy`.
* `src/core/library-sky.js`: `librarySky()`, the stars, links and groups.
* `src/core/roll.js`: `rollReading` keeps any part it is given.
* `src/app/jev-reading.js`: `openingLines(decision)`, the opening of the
  division the reading will open.

## Removed

* `src/components/oracle/` (`OracleObject.js`, `orb.js`, `oracle.css`).
* The Oracle styles in `Portal.css`, `fitAnswer`, and the window's answer
  markup.

## Open questions

* **Busy controls are `disabled`**, as on the Oracle, so focus drops while
  Home rolls. The wormhole's contract (`docs/specs/INVOCATION-SKINS.md`) asks
  for `aria-disabled` instead.
* **The work count** ("31 works: 15 classics and 16 RISE originals") in the
  idle mockup is not shown.
* **The Chamber's first-read choice** still follows a reader's first rolled
  reading only.
