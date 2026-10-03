# Today's poem

**Date:** 2026-10-03 · **Status:** as built (round 3, *Straight in*) ·
**Mockups:** [RISE Poem of the Day canvas](https://claude.ai/artifact/6WM6M9uDFsDTGEgStuWp3G),
pages Round 1–3

## Why

Home asks a reader to choose: roll, ask, or pick a star. A reader who comes
back tomorrow meets the same choice. Today's poem gives every day one short
poem that everyone on the same calendar day shares, read in a vivid look of
its own, so there is a reason to return and something small enough to read in
a minute.

> One poem a day, one tap, in the day's light.

## The product is the reading

Round 3 questioned every part (owner: "challenge everything"). RISE's product
is the reading: pace, imagery and sound. Rounds 1 and 2 put a page in front
of it (Home card → Today page → Begin → the reader's own Ready screen →
Begin), which repeated what the reader already does (title, length, Begin)
and added parts nobody needed.

| Part | Verdict |
|---|---|
| The Today page (`/today` as a room) | **Deleted.** The reader is the destination |
| The date-seeded mandala, its seed line | **Deleted.** The reading never showed it; the day's engine is its identity |
| The mood's plan words ("Fast words, fractal light…") | **Deleted.** The engine shows the look |
| *Read it first* | **Deleted.** The reader has a Page mode |
| The live backdrop engine on a page | **Deleted** with the page |
| One poem a day for everyone, the day's mood and engine, Home's card, the Menu entry, `/today` | **Kept** |

## What a reader sees

* **Home (idle):** a card under Roll a reading and Ask for one. One button:
  on the left, on ink, *Today's poem · Revel*, the title (two lines at most;
  the button's name holds all of it) and the first line; on the right, a still
  of the day's engine at full strength. **Begin today's poem** is a line
  button, so Roll stays the one solid key. Roll stays on the first screen at
  390×844 and 360×640, and the footer stays on the first screen at 1280×800.
  The card loads after first paint; until then, or if it cannot load, a
  plain *Begin today's poem* link stands in.
* **Pressing it** begins the reading at once: the tap is the gesture that
  lets the reader play without its Ready screen. A failure shows Home's alert:
  *Today's poem couldn't be opened. Try again.* with the cause behind
  *Details*.
* **The Menu:** *Today's poem*, first after Home, does the same.
* **`/today`:** opens the reading itself and hands the address back to `/`,
  so leaving does not open it again. A cold load has no gesture, so it stops
  on the reader's own Ready screen (title, length, Begin).
* **Leaving the reading** returns Home, where the card waits.

## Which poem

* **The pool:** every division of `spoon-river-anthology` and
  `lyrical-ballads` of **400 words or fewer**, read from
  `src/content/archive/division-index.json` without loading any text: 244 +
  31 poems.
* **The works take turns.** One work had 244 of 275 poems, so eight days in
  nine were Spoon River. Each work keeps its own order, shuffled once with
  the fixed seed `rise-today-v2:<workId>` (FNV-1a then mulberry32). Day `n`
  (`Date.UTC(localYear, localMonth, localDay) / 86400000`) reads work
  `n mod 2`, poem `⌊n / 2⌋ mod` that work's count. Everyone on the same local
  date reads the same poem, and no poem of a work repeats until the work has
  given every one.
* **The text:** `resolveJevReading(decision, { entryId, label })` opens the
  exact division under the same edition gate as Home's rolls, and refuses it
  if its label is not the one the index named.

## The day's look

**Every poem of the day is read under a vivid procedural visual** (owner
decision, 2026-10-03: mandatory). `todayDecision(pick)`
(`src/core/today-reading.js`) composes a roll for the poem's work in a temper
drawn by the date from the immersive or psychedelic ones: *signal* (an
attractor field), *ember* (apparitio or ostensoria) and *revel* (fractal). The
roll fixes the engine, palette, sound, pace and type for the whole day. The
card shows the engine as a 480 px still (`public/engine-stills/card/`, built
by `scripts/build-card-stills.mjs` from the shipped stills, so Home never
downloads a full 525 KB still).

## Every day by itself

The card reads the date when Home shows, and while Home shows it turns over at
local midnight (`watchLocalDay`, `src/core/local-day.js`) and whenever the tab
becomes visible again, so a laptop that slept through midnight shows the new
poem when it wakes.

## Decisions

| Question | Decision |
|---|---|
| Server route | **None.** The pick is pure and runs in the browser; the text is the static, hashed payload already served |
| A page for the poem | **None** (round 3). Rounds 1 and 2 built one; it stood between the reader and the reading |
| Which works | **Spoon River Anthology and Lyrical Ballads**, taking turns day by day |
| Home's card | The day's engine still, mood, title and first line, from `src/content/archive/today-openings.json` (built by `scripts/build-today-openings.mjs` with the reader's own `divideSections`; a test keeps it in step) |
| Home's one gradient | **Kept.** The card is two panes (words on ink, engine beside), not a shaded image |
| Audio | The day's soundscape; no recitation (voice packs cover the Keystones only) |
| Sharing image | **Not now.** Direction C's poster is a later, separate idea |

## Built from

* `src/core/today-poem.js`: `todayPools`, `todayPool`, `todayPoem(date)` →
  `{ workId, entryId, label, seed, dayNumber }` (pure).
* `src/core/today-reading.js`: `todayDecision(pick)`.
* `src/app/today.js`: `todaySession(date)`, the session `app.launchToday()`
  hands to `handleBeginSession`, with `origin.experience: 'today'`
  (`src/app/chamber-exit.js` returns it Home).
* `src/app.js`: `launchToday()` and the `/today` start-up path.
* `src/components/today/today-card.js`: Home's card. `src/components/Portal.js`
  and `portal-home.css`: the card slot, its lazy load, `beginToday()`, the day
  watch and the Menu entry.

## Testing

* `today-poem.test.js`: the pools, the same poem all day, the works taking
  turns, no repeat within a work until it has given every poem.
* `today-reading.test.js`: a vivid temper on every day of a cycle, admitted
  like any roll. `today-poem.integration.test.js` and `src/app/today.test.js`
  (built content): every pick names a released verse division with that id and
  label; the session plays the exact poem as verse, in the day's look, and
  returns Home.
* `today-card.test.js`, `Portal.test.js`: the card's engine still, mood,
  title, first line and name; one solid key; the card and the Menu begin the
  reading; an error stays on Home; midnight; the link when the card cannot
  load.
* `local-day.test.js`, `today-openings.test.js`, `chamber-exit.test.js`.
* `e2e/today.spec.js`: at 390 and 1280 the card begins the exact poem under a
  procedural visual, Roll and (on a desk) the footer stay on the first screen,
  nothing scrolls sideways, and leaving returns Home; the Menu begins it;
  `/today` opens it and hands the address back to `/`.
