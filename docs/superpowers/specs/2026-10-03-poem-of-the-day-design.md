# Today's poem

> **Home's card is superseded (2026-10-03).** Home now opens on today's poem
> itself, playing silently under its engine, and the card
> (`today-card.js`) is deleted. See
> [2026-10-03-home-already-reading-design.md](2026-10-03-home-already-reading-design.md).
> The pool, the day, the mood and the Today view below still hold.

**Date:** 2026-10-03 · **Status:** as built ·
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

* **Home (idle):** a card under Roll a reading and Ask for one (owner
  decision, 2026-10-03: "much more prominently featured"). One button in an
  Atlas plate: today's mark (drawn once, still; the sky stays Home's live
  plate), *Today's poem, October 3*, the title, the poet, and the poem's first
  line in the reading face. Roll a reading stays the one solid key and on the
  first screen at 390×844 and 360×640. The card loads after first paint;
  until then, or if it cannot load, a plain *Read today's poem* link stands in.
* **The Menu:** *Today's poem*, first after Home.
* **The Today view** (`/today`), on one vertical axis:
  1. Eyebrow: *Today's poem, Saturday 3 October* (the reader's locale, their
     local date).
  2. The mandala: today's mark, folded twelve ways, still once drawn. Under it,
     in mono: *Seed 2026-10-03 · a −2.048 · b … · 12 folds*.
  3. The poem's title (`Instrument Serif`), then *Author, from Work*.
  4. The poem in a plate (double rule, registration ticks in `accent-rise`),
     lines kept, in Crimson Pro, left-aligned in a centred block.
  5. **Begin this poem** (the one solid key), then *A new poem, and a new
     mark, at midnight.*
* **The frame:** the shared room frame (`roomHeader`, `roomEyebrow`,
  `roomAlert` from `src/components/room-chrome.js`), so the header and its
  back control to Home match Chapel and the other quiet rooms. The app body
  does not scroll, so the room scrolls inside itself, as Chapel does.

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
  still (it turned slowly until the backdrop below became the view's live
  plate). Under `prefers-reduced-motion` it draws at once.
* It is `aria-hidden`; the caption is real text.

## The day's engine behind the page

The Today view previews the look the poem will be read in (owner decision,
2026-10-03): the day's own engine runs behind the page, under a scrim that
keeps the middle column mostly ink and lets the engine show at the sides and
between the parts. `mountReadingBackdrop(host, decision)`
(`src/components/reading-backdrop.js`, shared with Home) chooses it from the day's roll:

| Mood | Engine behind the page |
|---|---|
| signal (attractor mode) | `AttractorField`, the reader's own system, palette and form |
| ember (ostensoria or apparitio) | `PlateField` with that one family |
| revel (fractal) | One `FractalFlame` in the reading's colours, the next every 18 s, drifting slowly |

* **One live plate:** the backdrop is the view's live plate, so the mandala is
  now still once drawn, like every sigil.
* **Cost:** engines load on demand after the view shows. The backdrop pauses
  when the view is hidden or the tab goes to the background, resumes on
  return, and is rebuilt at midnight with the new day's mood. Under reduced
  motion each engine holds one still frame. If an engine cannot start, the
  page stays on ink.

## Begin this poem

**Every poem of the day is read under a procedural visual** (owner decision,
2026-10-03: mandatory). The first build handed the reader the bare text, and
the poem played as words on plain black.

* **The day's mood:** `todayDecision(pick)` (`src/core/today-reading.js`)
  composes a roll for the poem's work with `composeRoll`, in a temper drawn by
  the date (`seededRandom('rise-today-reading:<date>')`) from the vivid tempers
  only: those whose visuals are `immersive` or `psychedelic` (today *signal*,
  *ember* and *revel*: attractor, apparitio or ostensoria, and fractal). The
  roll fixes the visual engine, palette, sound, pace and type for the whole
  day.
* **The view names it** before anything plays, as Home names a roll: the mood
  pill and `summarizeJevPlan`'s words (*Fast words, fractal light, excited,
  large bold*).
* **The exact poem:** `resolveJevReading(decision, { entryId, label })` opens
  that division instead of the roll's section, under the same edition gate as
  Home's rolls, and refuses it if its label changed. A refusal leaves the poem
  on screen with *This poem could not be opened. Try again.*

The session keeps the reader's shape: `text` is the entry's content,
`verseLines` is `entry.verse === true`, and `continuation` is the
`library-division` one (noun *poem*). It goes through `app.handleBeginSession`,
with `origin` naming the Today view so that leaving the reading returns there
(`src/app/chamber-exit.js`). Begin is busy while the reader opens and ready
again afterwards, so a reader who comes back can begin the poem again.

## States

| State | What shows |
|---|---|
| loading | Eyebrow, the mandala drawing in, title and byline from the index, skeleton lines in the plate, Begin busy |
| ready | Everything above; Begin enabled |
| error | `sy-alert--danger`: *Error. Today's poem could not be loaded.* and **Try again**. The mark still draws |

**Every day by itself.** The view and Home's card read the date when they
show, and while shown they turn over at local midnight (one timer to the next
midnight, `watchLocalDay` in `src/core/local-day.js`) and whenever the tab
becomes visible again, so a laptop that slept through midnight shows the new
poem when it wakes. Hidden views stop watching.

## Decisions

| Question | Decision |
|---|---|
| Server route | **None.** The pick is pure and runs in the browser; the text is the static, hashed payload already served |
| Which works | **Spoon River Anthology and Lyrical Ballads**, the two released works made of short, named poems with lines kept |
| Repeats | **None within a cycle** (275 days today) |
| Home entry | **A card** in the idle panel, and a Menu entry (was one ghost link) |
| Title and first line on Home | **Yes**, from `src/content/archive/today-openings.json`: 304 first lines, titles and poets precomputed by `scripts/build-today-openings.mjs` with the reader's own `divideSections`, so Home never downloads a work (a work is about 230 KB). A test keeps it in step with the works |
| Turning over | **At local midnight and on waking**, while shown (was: only on the next visit) |
| Audio | **None.** Recitation packs cover the Keystones only |
| Sharing image | **Not now.** Direction C's poster is a later, separate idea |

## Built from

* `src/core/today-poem.js`: `todayPoem(date)` → `{ workId, entryId, label,
  seed, dayNumber }` (pure), and the pool.
* `src/components/today/mandala.js`: `drawMandala`.
* `src/components/today/TodayPoem.js` and `today-poem.css`: the view.
* `src/app/route-manifest.js`, `index.html` (`view-today`) and `src/app.js`
  (`/today` in `PUBLIC_ROOM_PATHS` and the start-up path check).
* `src/components/today/today-card.js`: Home's card; `src/core/local-day.js`:
  the local date and `watchLocalDay`, apart from the pool so Home does not
  import the division index.
* `src/components/Portal.js` and `Portal.css`: the card slot, its lazy load,
  the day watch while Home shows, and the Menu entry.

## Testing

* `today-poem.test.js`: the pool rules and size, the same poem for the same
  local date, the next poem tomorrow, no repeat within a cycle, and a local
  date that differs from the UTC one.
* `mandala.test.js`: fold transforms (rotation and mirror), and that a
  canvas is drawn once under reduced motion.
* `TodayPoem.test.js`: loading, then ready with the poem's lines; Begin hands
  `handleBeginSession` the verse flag and the continuation; a label mismatch
  shows the error and Try again recovers.
* `Portal.test.js`: the link at once, the card after Home shows (Roll still
  the one solid key), the card turning over at midnight, the link kept when
  the card cannot load, and the Menu entry.
* `local-day.test.js`: midnight, the next midnight, and a tab that wakes on a
  new day. `today-openings.test.js`: the openings file agrees with the works.
  `today-card.test.js`: title, poet, first line, label and the still mark.
* `today-poem.integration.test.js`: against the built content, every poem in
  the pool names a released verse division with that id and label.
* `e2e/today.spec.js`: Home's link and the `/today` address, no sideways
  scroll at 390 and 1280, Begin plays exactly the poem shown, and leaving the
  reading returns to the poem with Begin ready.
* Regenerate the architecture diagram (`npm run docs:diagram`).
