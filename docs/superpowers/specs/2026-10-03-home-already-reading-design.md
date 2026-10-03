# Home, already reading

**Date:** 2026-10-03 · **Status:** as built · **Supersedes:**
[2026-10-03-night-library-home-design.md](2026-10-03-night-library-home-design.md) ·
**Mockups:** direction D of the second round ("Already reading": on arrival,
after Another reading, phone), chosen by the owner

## Why

The owner rejected the night library on four counts: it was too busy and did
not feel premium; the star map did not land; a result read like a form; and
none of it was immersive. Home now *is* a RISE reading in progress. A reader
meets the thing RISE does before being asked to choose anything.

```
Home            is already reading      (today's poem, silent)
Reader Setup    lets the reader alter   (Adjust)
Chamber         performs it, with sound (Read it with sound)
```

## The screen

Under a transparent header (the lockup and the one Menu):

* **The engine**, full-bleed: the reading's own visual, the one the Chamber
  will run (`mountReadingBackdrop`, `src/components/reading-backdrop.js`).
* **One ink scrim**: a radial pool under the stream and a band under the
  header and the bar, so every word keeps 4.5:1 even over a white engine.
* **The stream**, centred: the reading's opening, unit by unit, at the
  reading's pace (`ReadingStream`, `src/components/reading-stream.js`), silent.
* **The bar**: on the left a caption over the reading's name; on the right
  **Read it with sound** (the one solid key), **Another reading** (a line
  key) and a text link. A 1px hairline under it follows the stream.
* **Continue reading**, when a session exists, as a small pill above the bar.
* **Privacy · Terms** small in the bottom corner (posted on Home, as CalOPPA
  asks).
* **Phone (under 900px):** the caption in one line, then the solid key at full
  width, then Another reading beside the link. The solid key is on the first
  screen at 390×844 and 360×640.

| Reading | Caption | Name | Link |
|---|---|---|---|
| Today's poem (on arrival) | Today’s poem | *John M. Church, by Edgar Lee Masters* | **Library** |
| Rolled | *Revel: fast words, fractal light, chase, large bold* (temper, then `summarizeJevPlan`) | *Oedipus Rex, by Sophocles* | **Adjust** |
| Asked | *As you asked: …* (and RISE's note on what it cannot do) | | **Adjust** |

## Behaviour

* **On arrival** Home loads today's poem after first paint: `todayPoem(new
  Date())`, `todayDecision(pick)` (the reading the Today page uses), and the
  opening passage and poet from `today-openings.json`. It streams phrase by
  phrase as verse. At local midnight, while shown, it turns to the next day's
  poem unless the reader has chosen another reading.
* **Another reading** rolls `rollReading({ previous, vivid: true })`. The new
  engine mounts in its own layer and fades in over the old, which is
  destroyed once the fade ends; the stream plays `openingLines(decision)` in
  the reading's unit, pace and curve. Pressing it again rolls again.
* **Read it with sound**: today's poem opens exactly as the Today page's Begin
  does (`resolveJevReading(decision, { entryId, label })` → the app's
  `handleBeginSession`, passed in as `onBeginSession`, with the continuation's
  noun *poem*); a rolled or asked reading goes through `onLaunchJevReading`.
  Leaving the reading returns to Home on the same reading.
* **Ask for a reading** is in the Menu. It opens a native `<dialog>` with the
  ask view the night library had, moved unchanged: connected, a labelled field,
  microphone, **Ask** and **Cancel**, and the connected account with
  Disconnect; not connected, *Asking needs your own AI.*, **Connect
  OpenRouter**, **Run RISE locally**, **Cancel** and *About your connection*.
  Returning from OpenRouter reopens it. An asked reading becomes Home's.
* **Nothing runs behind a reading**: leaving Home pauses the engine and stops
  the stream; returning resumes both. A hidden tab pauses the engine too.
* **Without an engine** (no WebGL, a refused engine, or none for the reading)
  Home reads on ink; the text and every control still work.

## Accessibility

* The stream is decoration (`aria-hidden`); the opening is also real text
  (`sr-only`), and a polite status line speaks the reading: *Today’s poem:
  John M. Church, by Edgar Lee Masters*, or after a roll *Revel. Oedipus Rex,
  by Sophocles. Fast words, …*.
* The reading's name is the page's one `h1`. Focus runs: Menu, Read it with
  sound, Another reading, the link (Continue comes after them, though drawn
  above).
* Reduced motion: the engine holds a still frame and swaps without a fade;
  the stream shows the opening still.
* Nothing a reader must read is under 12px; every key is a 44px target.

## Decisions

| Question | Decision |
|---|---|
| What Home opens on | **Today's poem**, the same reading as the Today page, so everyone that day meets the same one. A fresh load starts there again |
| Tempers Home rolls | **Vivid only** (signal, ember, revel), so Home never goes to plain black |
| Where asking lives | **The Menu**, in a dialog (owner-approved mockups). The footer AI line is gone; the dialog says what is connected |
| Privacy and Terms | **A small corner link on Home**, not only the Menu, to stay conspicuously posted |
| Loading | Header, caption and keys are in the first paint; the poem's modules, the openings file (about 30 KB gzip), the engine and the stream load right after it. First load stays under the 64 KB budget |
| The one gradient | The ink scrim. Everything else is Atlas tokens and classes |

## Built from

* `src/components/Portal.js`, `Portal.css` (the page) and `portal-home.css`
  (the engine, scrim, stream, bar and dialog).
* `src/app/route-manifest.js`: Home receives `onBeginSession`.

## Removed

* `src/components/night-library/` (`NightSky.js`, its test and CSS) and
  `src/core/library-sky.js` with its test.
* `src/components/today/today-card.js` and its test.
* The result panel (three parts, Redraw), Roll a reading, picking a star,
  *Roll instead*, and the footer's AI line.
