# Today's poem

**Date:** 2026-10-03 · **Status:** approved direction, not built ·
**Mockups:** [RISE Poem of the Day canvas](https://claude.ai/artifact/6WM6M9uDFsDTGEgStuWp3G)
(direction B, "Kaleidoscope sigil", chosen by the owner)

## Why

Home asks a reader to choose: roll, ask, or pick a star. A reader who comes
back tomorrow meets the same choice. Today's poem gives every day one short
poem that everyone in the same calendar day shares, and a mark drawn from the
date, so there is a reason to return and something small enough to read in a
minute.

> One poem a day, and a mark drawn from the date.

## What a reader sees

* **Home (idle):** one quiet link under Roll a reading and Ask for one:
  *Read today's poem*. It is a ghost control (`data-nav="today"`); Roll a
  reading stays the one solid key.
* **The Today view** (`/today`), on one vertical axis:
  1. Eyebrow: *Today's poem, Saturday 3 October* (the reader's locale, their
     local date).
  2. The mandala: today's mark, folded twelve ways, turning slowly. Under it,
     in mono: *Seed 2026-10-03 · a −2.048 · b … · 12 folds*.
  3. The poem's title (`Instrument Serif`), then *Author, from Work*.
  4. The poem in a plate (double rule, registration ticks in `accent-rise`),
     lines kept, in Crimson Pro, left-aligned in a centred block.
  5. **Begin this poem** (the one solid key), then *A new poem, and a new
     mark, at midnight.*
* **Back:** the room's back control returns to Home, as Keystones does.

## Which poem

* **The pool:** every division of `spoon-river-anthology` and
  `lyrical-ballads` of **400 words or fewer**, read from
  `src/content/archive/division-index.json` (`labels`, `divisionWords`)
  without loading any text. Today that is 244 + 31 = 275 poems. It drops *The
  Spooniad*, the *Epilogue*, and the long Lyrical Ballads narratives.
* **The order:** the pool is shuffled once with a fixed seed
  (`rise-today-v1`, FNV-1a then mulberry32), so the two works interleave.
* **The day:** `dayNumber = Date.UTC(localYear, localMonth, localDay) /
  86400000`; today's poem is `pool[dayNumber mod pool.length]`. Everyone on
  the same local date reads the same poem, and no poem repeats within a cycle
  of the pool's length.
* **The text:** only the chosen work loads (`releaseArchiveTexts()` →
  `getDivisions()`), and the entry must have the id **and** the label the
  index named, as Keystones checks. A mismatch is an error, never a different
  poem.
* The seed changes only when the pool's rules change. Changing the canon
  reshuffles the order; that is accepted.

## The mark

* `params(seed)` from `src/vendor/syber/syber-sigil.js` gives the de Jong
  parameters and box for the date string. The vendored kit is not edited.
* A new `drawMandala(canvas, seed, { folds = 12, animate })` plots each point
  `folds` times, rotated by `2π·k/folds` about the box centre and mirrored on
  odd folds. Each fold accumulates into one of six colour channels (`ice`,
  `blue`, `violet`, `magenta`, `amber`, `accent-rise`), added together on
  `ink` with log density, so dense cores burn toward white, as the kit's
  sigils do.
* It draws in over about sixteen frames as the loading state, then stays
  still. The canvas turns slowly (CSS, 240 s per turn). Under
  `prefers-reduced-motion` it draws at once and does not turn.
* It is the view's one live plate. It is `aria-hidden`; the caption is real
  text.

## Begin this poem

Begin opens the reader directly, with the same shape the Library's
`readEntry` builds: `text` is the entry's content, `textSource` is
*Work · Label*, `verseLines` is `entry.verse === true`, and `continuation` is
`{ kind: 'library-division', workId, editionId, sourceRevision, entryId,
entryIndex, entryCount, noun }`. It goes through `app.handleBeginSession`,
with `origin` naming the Today view so that leaving the reading returns there.

## States

| State | What shows |
|---|---|
| loading | Eyebrow, the mandala drawing in, title and byline from the index, skeleton lines in the plate, Begin busy |
| ready | Everything above; Begin enabled |
| error | `sy-alert--danger`: *Error. Today's poem could not be loaded.* and **Try again**. The mark still draws |

The view reads the date when it activates. A reader who keeps it open past
midnight sees the new poem the next time they open the view; there is no
timer.

## Decisions

| Question | Decision |
|---|---|
| Server route | **None.** The pick is pure and runs in the browser; the text is the static, hashed payload already served |
| Which works | **Spoon River Anthology and Lyrical Ballads**, the two released works made of short, named poems with lines kept |
| Repeats | **None within a cycle** (275 days today) |
| Home entry | **One ghost link** in the idle panel. Not in the Menu |
| Title on Home | **No.** The link says *Read today's poem*, so Home does not load the pool |
| Audio | **None.** Recitation packs cover the Keystones only |
| Sharing image | **Not now.** Direction C's poster is a later, separate idea |

## Built from

* `src/core/today-poem.js`: `todayPoem(date)` → `{ workId, entryId, label,
  seed, dayNumber }` (pure), and the pool.
* `src/components/today/mandala.js`: `drawMandala`.
* `src/components/today/TodayPoem.js` and `today-poem.css`: the view.
* `src/app/route-manifest.js`, `index.html` (`view-today`) and `src/app.js`
  (`/today` in `PUBLIC_ROOM_PATHS` and the start-up path check).
* `src/components/Portal.js`: the idle link.

## Testing

* `today-poem.test.js`: the pool rules and size, the same poem for the same
  local date, the next poem tomorrow, no repeat within a cycle, and a local
  date that differs from the UTC one.
* `mandala.test.js`: fold transforms (rotation and mirror), and that a
  canvas is drawn once under reduced motion.
* `TodayPoem.test.js`: loading, then ready with the poem's lines; Begin hands
  `handleBeginSession` the verse flag and the continuation; a label mismatch
  shows the error and Try again recovers.
* `Portal.test.js`: the idle panel has the link and it navigates to `today`.
* Regenerate the architecture diagram (`npm run docs:diagram`).
