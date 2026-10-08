# Design: the canonical Home (B4)

Status: Design record, build authorized. Date: 2026-10-05. For Seth (reviews) and Mateo (signs off); both agreed to the build on 2026-10-05. It builds Q1 of the [Consolidated Reader decisions](2026-10-05-consolidated-reader-decisions.md) and §2 "The canonical Home" of the [proposal](../CONSOLIDATED-READER.md); the tracker task is [RDR-019](../tasks/RDR-019.json). Ground: `origin/main` = `e4e9b2f6`. Every `file:line` was read at `fcc88280`; between the two commits only `docs/product/CONSOLIDATED-READER.md` changed, below its §2, so every line cited still holds. "(inferred)" marks what was reasoned, not read. Nothing here was run: the owner's PC cannot take the load, so every check names where it runs. The owner questions are in §11, each with its answer line.

Starts from the winning design ("a home with a window") with the judges' grafts and corrections applied. Where the judges disagreed, the choice and the reason are stated inline.

## 1. Decision

- **Q1 as recorded.** "Adopt 'a home with a window'. The featured reading's field moves full screen; words do not stream on Home; Begin is the only primary action; Continue leads when there is a reading to resume. Home's structure changes only by a joint dated decision after five readers are observed against the acceptance criteria" (`docs/product/discussions/2026-10-05-consolidated-reader-decisions.md:9`). Decided by Mateo; Seth gave his full agreement on 2026-10-05 (`:3`). Build authorized the same day with Seth reviewing (`docs/product/tasks/RDR-019.json:41`).
- **What this build delivers of RDR-019.** Criteria 1, 2, 3, 5 and 6 (`RDR-019.json:13-19`), on the existing backdrop renderer (`reading-backdrop.js`), with the frame fixed by a test.
- **What waits.** Criterion 4 (R2: Begin to first word ≤ 1.5 s, field visible throughout) is not reachable from `Home.js`: the gap is the router's 400 ms fade-out (`src/core/router.js:161-164`), the preparation overlay and 300 ms settle (`src/app/chamber-session-factory.js:135, 434-437`) and the Chamber's 500 ms autoStart (`src/components/read/Chamber.js:514`). The router hold and overlay skip are A3's remainder (RDR-015, still `in_progress`, `RDR-015.json:6-7`) and land as PR 7 below. The field never unmounted is D1 (`FND-010.json:17`). B4 lands the measurement under `test.fail()` so the number is read on every CI run. Criterion 7 is package V (RDR-007, RDR-009).
- **Bad news first.** B4 ships with criterion 4 red by design. Its PR body must say so; RDR-019's acceptance list omits criterion 4 (`RDR-019.json:13-19`) and gains a line pointing at RDR-015.

## 2. The frame

Home is six permanent regions. Each has a rule saying what it may hold. A future experiment (a chooser, an object, a request) is content of the Featured slot or the Field, never a new region. `src/components/home-frame.test.js` (new, PR 5) pins the order of the regions and the hooks, not the words, so copy changes stay cheap.

| Region | Selector | May hold | May not hold |
|---|---|---|---|
| Header | `.sl-header` | Lockup; on desktop (≥ 900 px) `div.home-rooms` with `button.home-room[data-nav="library"]`, `[data-nav="make"]`, `[data-action="settings"]`; the Menu pill; the Menu sheet of eight (A6, unchanged `Home.js:181-197`) | A door to a reading |
| Field | `.home-engine[aria-hidden]` | The featured reading's own engine, full bleed, moving (`reading-backdrop.js:30-82`) | Words |
| Featured slot | `.home-featured`: `p.home-label` (eyebrow), `h1#home-title.home-title`, `p.home-meta`, `p.home-note[role=note]`, `p.home-epigraph[data-face]` | Exactly one reading: today's poem, a roll, an Ask answer, or the in-memory session | A second reading; anything that moves; a form |
| Actions | `.home-actions` | One `.btn-primary` (`[data-home="enter"]` or `[data-home="continue"]`), `[data-home="roll"]`, `[data-home="adjust"]`, `[data-home="ask-open"]` (connected only), the today line `[data-home="enter"]` in the Continue state | A second primary; a parameter |
| Aside | `p.home-about` | The owners' one line, first visit only (PR 8, when the copy exists) | Links or controls |
| Legal | `.portal-footer .portal-legal` | Privacy, Terms (`Home.js:205-213`, unchanged) | — |
| Voice (assistive) | `p.sr-only[data-home-opening]`, `p.sr-only[role=status]`, `.home-alert[role=alert]` | The whole opening as text; the spoken status; errors | — |

Rules that outlive the next experiment: fix the frame, vary the content; Home names a reading, never starts one; no form before feeling; no metaphor carries the page; change by criteria and observation (`CONSOLIDATED-READER.md:57-63`).

## 3. States

| Visitor | Featured slot | Primary | Secondary | The field |
|---|---|---|---|---|
| First visit (no session, flag unset) | Eyebrow TODAY'S POEM; h1 title alone (`poemTitle(pick.label)`); meta `Author · Work · N min · Look`; epigraph = the poem's first line in the look's face | **Begin** (`[data-home="enter"]`, disabled until the poem is here, `Home.js:417`) | Another reading · Adjust · (about line, PR 8) | Today's engine, moving, mounted after first paint (`Home.js:616, 324-333`) |
| Returning, session in memory, not complete | Eyebrow CONTINUE; h1 `session.name` (`src/core/models.js:248`; written from `title` at `src/app.js:678`); meta `N min` from `session.totalDuration` (`models.js:321-326`); no epigraph, no bar | **Continue** (`[data-home="continue"]`) | Another reading · the today line `Today's poem · Roy Butler, by Edgar Lee Masters  Begin ›` (`[data-home="enter"]`). No Adjust (wireframe `CONSOLIDATED-READER.md:117`) | The session's engine via the shim `{ config: { visualConfig: session.visualConfig, colors: session.presentation?.colors ?? null } }` (colours sit at `presentation.colors`: `src/core/jev-config.js:57-65`; the Session keeps `presentation`, `models.js:310-313`); a Library text with no `visualConfig` shows ink (`reading-backdrop.js:81`) |
| Returning, nothing to resume | As first visit, without the about line | **Begin** | Another reading · Adjust | Today's engine |
| After Another reading | Eyebrow BY CHANCE (roll) or AS YOU ASKED (ask); h1 work title; meta `Author · N min · Look` (asked: no look word); `p.home-note` under the meta when an Ask carries limits (`Home.js:70-76`, kept); epigraph in the roll's face | **Begin** | Another reading · Adjust | Cross-fades to the roll's engine over 900 ms (`reading-backdrop.js:25, 108-143`), old layer held at full opacity under the new one (PR 2) |
| Connected (`connectionState().kind !== 'none'`, `src/core/ai-connection.js:37-41`) | As above | As above | + **Ask for a reading** (`[data-home="ask-open"]`); the Menu entry stays (`e2e/reader-connection.js:55-58` depends on it) | Unchanged |
| Reduced motion | Same | Same | Same | One still frame per engine (`reading-backdrop.js:43, 59-61`; attractor reads the query itself, `src/visuals/attractor.js:229-232`); no cross-fade (`reading-backdrop.css:37-40`) |

After Another reading while a session is in memory, the session line leaves for that visit; `update()` on the next return re-presents it (`Home.js:128-144`). The proposal's table draws it that way (`:78`); allowing a line back would push a connected phone to 6 targets.

## 4. Layout

Tokens: header 64 px (`src/design-system.css:87`), gutter `clamp(16px, 4vw, 56px)` (`portal-home.css:11`; 51 px at 1280, 16 on phones), spaces 4/8/12/16/24/32 (`:70-75`), control 46 px (`:86`). Breakpoint: desktop is ≥ 900 px, the boundary `portal-home.css:419` already uses. The 640 px sheet rule (`Home.css:247-253`) stays.

**Type, every width.** Eyebrow: JetBrains Mono 12/16 500, 0.14em, uppercase, `--sy-text-2` (the `.portal-eyebrow` recipe, `Home.css:275-287`). h1: Instrument Sans 20/28 500 on desktop, 18/24 on phones wrapping to ≤ 2 lines; the one-line ellipsis and tooltip rule (`portal-home.css:220-231`) stays on desktop. Meta: Instrument Sans 14/20 `--sy-text-2`, parts joined by ` · `, the work hidden under 900 px (`span.home-meta-work`). Epigraph: `font-family: var(--home-face, var(--font-literary))`, weight `var(--home-face-weight, 400)`, desktop `clamp(28px, 2.6vw, 40px)`/1.25 max-width 30ch ≤ 3 lines (`-webkit-line-clamp`), phone `clamp(22px, 6vw, 26px)`/1.3 ≤ 3 lines, ≤ 2 under `@media (max-height: 640px)`; `text-shadow: 0 0 40px var(--sy-bg)` (kept from `.home-still`, `portal-home.css:131`). Face from `data-face` through the design-system tokens, matching the Chamber's own map (`src/components/read/Chamber.css:184-217`): literary → `--font-literary`, display → `--font-display` (Instrument Serif, preloaded `index.html:35`), thick → `--font-stream-thick` 700, mono → `--font-mono`, sans → `--font-primary` (Instrument Sans, preloaded), book → `--font-literary` 600, jp → `--font-jp`. Seven CSS lines, no family names (the comment at `chamber-stream-face.js:10-13` naming Marcellus and Inter is stale against that CSS). Actions: Begin `.btn.btn-primary` 46 px, 16 px 600, padding 0 28px (`portal-home.css:252-255`); Another reading `.btn.btn-secondary`; Adjust and Ask `.home-link` 44 px underlined (`:257-276`); gap 12.

**The dim.** Unchanged tokens: `--home-ink-stream` 86% and `--home-ink-bar` 92% (`portal-home.css:12-13`), the `.home::after` ground from −96 px above the block to the footer (`:78-85`), the footer's own ground (`:295-302`), the 72% header band (`:37-39`). This keeps `Home.test.js:644-657` untouched (judges 2 and 3 over judge 1's single 80% token). The stream's pool (`:106-123`) goes with the stream. Rendered at 360×640 and 1280×800 before merge; the fade start widens only if the window measures short.

**Desktop 1280×800.** Header row 64. Window: `.home-window` is the grid's `minmax(0,1fr)` row (today's `.home-stage`, `portal-home.css:90-99`, with `min-height: 0`), undimmed moving field. Block at the gutter, max-width 640 px, bottom-anchored: eyebrow 16 + 8; h1 28 + 4; meta 20 + 20; epigraph ≤ 3 lines of 41 (two typical, 82) + 24; actions 46 + 24; footer 52. Block ≈ 324 px, top at y ≈ 476; ≈ 316 px of clear field between the header band and the ground's fade. The header rooms: `div.home-rooms` right of the lockup, `button.home-room` 15/20 `--sy-text-2`, hover `--sy-text`, 44 px tall, gap 28 (reviving the dead `Home.css:37-41` values under a new selector), then 20 px, then the Menu pill. `display: none` below 900 px. A `div`, not a second `nav` landmark: the Menu sheet already is "Primary" (`Home.js:181`) and a second landmark naming the same rooms doubles the reader's list (judge 3 over judge 2).

**Phone 390×844 and 360×640.** Header with the Menu pill only. Block full width, gutter 16: eyebrow 16 + 8; h1 ≤ 2 × 24 + 4; meta 20 + 16; epigraph ≤ 3 × 29 (≤ 2 at height ≤ 640) + 20; Begin full width 50 px 17 px (`portal-home.css:457-461`); 12; grid `minmax(0,1fr) auto` (`:452-455`) Another reading | Adjust; Ask, when connected, a full-width third cell; 12; footer 48. Worst case at 360×640 (two-line title, two-line epigraph, Ask): ≈ 390 px below the header; typical ≈ 346, block top y ≈ 294, ≈ 130 px of undimmed field above the fade. Nothing scrolls vertically; `overflow-x: clip` (`:56`) keeps sideways at 0. The phone caption sentence rule (`:436-450`) is deleted; the stack is the same on every width.

**Legal links.** As today: 13 px, 44 px targets (`:304-307`), right-aligned, not counted.

**Focus order, desktop.** library, make, settings, portal-menu-toggle, enter, roll, adjust, (ask-open), Privacy, Terms. Phone: the rooms are display:none, so the order starts at the toggle.

## 5. Begin

**The handover now (unchanged route).** Begin → `proceed('enter')` (`Home.js:488-507`) → `onLaunchToday` → `launchToday` (`src/app.js:737-742`) → `todaySession` (`src/app/today.js:25-41`: exact division, origin `today`) → `handleBeginSession` (`app.js:672-707`: `compileSession` sync, `currentSession = session` at :705, `router.navigate('chamber-session')`, address stays `/`). A roll: `launchJevReading` → `resolveJevReading` (`app.js:710-717`), `/read/session`. The router aliases to room `read`, pane `chamber` (`route-url.js:39, 76`), deactivates Home (pausing the stage, `Home.js:628`), fades `#view-home` out 400 ms and hides it (`router.js:161-164, 335-341`), builds Read with the chamber pane hidden (`Read.js:45, 65-70`), the factory raises the overlay at `:135`, settles 300 ms at `:434`, lowers it at `:437`, `new Chamber` at `:444`, the router unhides and fades `#view-read` in 400 ms (`:189-190`), and the Chamber's 500 ms timer calls `player.play()`, which paints `#atom-display` synchronously (`Chamber.js:459-514`). Fixed waits: 1.2 s before any network. RDR-015 measured 1,730–2,356 ms on a dev build (`RDR-015.json:37`).

**What B4 does now.** Home's frame at the press is a still epigraph over a paused field, so the hand-off reads as a hold, then today's gap. B4 adds no work to the press path (the face font is already loaded for the epigraph). B4 keeps `pause`, not `destroy`, at launch: `deactivate` runs before the fade-out (`router.js:161-163`) and `destroy` removes the layer at once (`reading-backdrop.js:156-163`), so destroying there would put bare ink under the 400 ms fade, a new black frame (both judges rejected Design 2's destroy-at-launch).

**What the preparation screen becomes (PR 7, A3's remainder, RDR-015, M reviews the factory).** (1) For a `launchesReading` move (`router.js:114`) from Home: keep `#view-home` visible and under `#view-read`, unhide Read at opacity 0 above it, `fadeIn` 400 ms, and only then deactivate and hide Home, so Home's last frame is the ground until the reading's field is up. (2) In the factory, `const quiet = live || session.origin?.view === 'home'`; use the stub `ui` and skip the 300 ms settle for `quiet` (`:38-39, 434`). `FLASHING_ENABLED` is false (`src/core/visual-presence.js:43`), so the "consent before overlay" order guards nothing today. (3) The Escape-during-launch return (`router.js:235-241`) leaves Home visible, which the hold already does. Predicted first word: today's 1.73–2.36 s minus 400 minus 300 = 1.03–1.66 s on a dev build (arithmetic on RDR-015's numbers, not a measurement). The 500 ms autoStart stays (shared with the Composer presentation, `factory:449`).

**Measurement (PR 6, `e2e/home-begin.spec.js`, CI only, `test.fail()` until PR 7).** Stamp `performance.now()` on `pointerdown` of `[data-home="enter"]`; a `MutationObserver` on `#view-read`'s subtree for the first non-empty `#atom-display` (`Chamber.js:3242-3301`); a rAF sampler recording per frame `#view-home` opacity/hidden, `.reading-stage-layer.is-shown`, `#loading-overlay` class, `#view-read` opacity and the field nodes (`.chamber-scheduled-field.is-active`, `#chamber-continuous-field` layers, plate canvases). Pass: `t_word − t0 ≤ 1500`; overlay keeps `hidden` (the `smoke.spec.js:206` pattern); every sample has a field node visible at opacity > 0; `PerformanceObserver('longtask')` longest ≤ 50 ms (the `live.spec.js:341-375` probe). One case per vivid temper through `showDecision(tools, composeRoll({ temper }))` (`home.spec.js:226-231` pattern) plus today's poem. Headless Chromium is SwiftShader: CI numbers bound CI, not the owner's PC.

**What D1 removes.** The second renderer (`reading-backdrop.js` deleted), the still-to-live dissolve, the cortex kept off Home's first paint against the gate (`app.js:197-212`), the embed witnessed again (`FND-010.json:15-19`).

## 6. Continue and Adjust

**Continue.** Source: `app.currentSession`, memory only (`app.js:106`; written at :654, :705, :934; nulled at :437, :1084). Home reads `getCurrentSession` (`route-manifest.js:20`) in `syncContinue` at construction and on every router re-entry (`Home.js:124, 143`). Shown iff a session exists and was not released. B4 adds `releaseSession(session)` to the factory's operations (`app.js:468-494`): `if (this.currentSession === session) this.currentSession = null`. Called in `onExit` (`factory:463-467`) when `player.sessionState?.state === 'complete'` (`src/core/player.js:978`), read before `player.stop()` (inferred: stop may reset state), and in the failure path before `router.back()` (`factory:518-531`). A mid-reading exit keeps it. Press → `onNavigate('chamber-session', session)` (`Home.js:594-597`, moved into the `.home` delegate so the busy rule covers it, `:415-421`). **Limit, stated plainly:** the Chamber and Player are disposed on exit (`factory:483-488`; `room-panes.js:92-105`), a new Player starts at atom 0 (`models.js:344-351`), the Player has no seek, and nothing writes a position. Continue reopens the reading from its first word. So Home prints `N min`, never "left", and no bar; the wireframe's bar (`:115`) waits for a Player addition and a persisted session. Known hole, pre-existing: browser Back mid-reading bypasses `onExit` (`Read.js:90-92` forwards to a Chamber method that does not exist) and leaves the Chamber mounted; Continue then re-shows that instance by identity (`room-panes.js:66`). Not B4's; worth its own tracker item.

**Adjust.** Always the third action for today's poem, a roll and an ask; hidden in the Continue state. Press → `onAdjustReading(reading.decision, reading.exact ?? null)` (`Home.js:495`, one argument added) → `app.js:454` `adjustJevReading: (decision, exact) => this.adjustJevReading(decision, exact)` → `adjustJevReading(decision, exact = null)` calls `resolveJevReading(decision, exact)` (`jev-reading.js:152-155`; `exactDivision` :138-145) → `origin.adjusted = true` → `router.navigate('chamber', { data: { text, source, config } })` (`app.js:723-728`) → room `read` pane `setup` (`route-url.js:38, 75`) → `Read.js:40-43` → `ChamberOrbital.loadText` (`ChamberOrbital.js:1896+`). `homeReading`'s today branch carries `exact: { entryId: pick.entryId, label: pick.label }` from the pick (`Home.js:386-389`). Without it, Adjust on today's poem opens the plan's `section: 'first'` (`today-reading.js:21`), not the day's poem. The wormhole's `adjust(decision)` (`invocation.js:65-69`) is unchanged: one argument, `exact` null. Leaving an adjusted reading returns to setup (`chamber-exit.js:85-89`), as the Oracle ruling records. A recited day's voice is a Begin-only path (`today.js:32-37`); Adjust opens the silent plan.

## 7. The seven criteria as tests

| # | Criterion | Test that fails if it is not met |
|---|---|---|
| 1 | One primary; ≤ 7 desktop, ≤ 5 phone, legal excluded | `Home.test.js` (rewritten): `[...querySelectorAll('.home .btn-primary')]` equals `[enter]` (or `[continue]` with a session); a counting case lists every visible `button, a[href]` outside `.portal-nav, dialog, .portal-legal` in each state and asserts 7 (jsdom shows the header rooms). `e2e/journeys.spec.js:10` kept. New e2e case in `home.spec.js`: at 1280×800 count visible targets by `getBoundingClientRect` = 7, at 390×844 = 4, then `connectTestOpenRouter` and 8 / 5. Counts: desktop first visit = Library, Make, Settings, Menu, Begin, Another reading, Adjust; Continue state = the same with Continue and the today line for Begin and Adjust; phone 4; connected +1 (desktop 8: owner question 2). |
| 2 | No stream, no sound before a press | `Home.test.js`: no `reading-stream` mock; after `arrive`, `.home-epigraph` text equals the opening's first line and no `.reading-stream-*` node exists; `vi.useFakeTimers` then `vi.getTimerCount()` is 0 after `present()` apart from the day watch; advance 5 s, epigraph unchanged. e2e: `.reading-stream-current` count 0; before the press `smoke.spec.js:41-52`'s `audioState` reports `sessionActive false` and `contextState !== 'running'`. `home-preload.test.js:20-27` fails if `home-preload.js:23` outlives the import. |
| 3 | Five rooms, 1 click desktop, 2 taps phone | `Home.test.js`: `.home-rooms [data-nav=library]` click → `onNavigate('library')`; `[data-nav=make]` → `make`; settings copy dispatches `rise-open-settings` (`Home.js:599-605`; `app.js:1236-1238`). e2e `home.spec.js` at 1280×800: click each header room with the Menu closed → `library`, `make` (Workshop, `route-url.js:81`), `/settings`; `[data-home=adjust]` → read/setup. `portal-hit-test.spec.js:76-87` already hit-tests every visible `[data-nav]` and now covers the header copies. `smoke.spec.js:81-83` holds the Menu of eight and three `.portal-nav [data-nav]` (the rooms sit outside `.portal-nav`). |
| 4 | Begin to first word ≤ 1.5 s, field visible throughout | `e2e/home-begin.spec.js` (§5), CI only, `test.fail()` in PR 6, plain in PR 7. If it stays red there, criterion 4 is recorded open in RDR-015, not hidden in B4. |
| 5 | Continue iff resumable, then primary | `Home.test.js`: with `getCurrentSession: () => session` the eyebrow is Continue, the h1 the name, `.btn-primary` is `[data-home=continue]`, the today line is `[data-home=enter]`, Adjust absent, `stage.show` receives `config.visualConfig` from the session, press → `onNavigate('chamber-session', session)`, today line → `onLaunchToday`; after a roll the line is gone and Adjust is back; `update()` re-presents the session. Factory unit test (`chamber-session-factory.personal.test.js` pattern): `onExit('close')` with `sessionState.state === 'complete'` calls `releaseSession(session)`; with `'paused'` it does not; the failure path calls it before `router.back()`. e2e: begin today's poem, Escape + End reading → `[data-home=continue]` is the one `.btn-primary`; play a shortest division at 500 wpm to completion, Return → Begin leads, no Continue. |
| 6 | First-load holds; field after first paint | CI's `measure:first-load` on the PR (`.github/workflows/ci.yml:79-80`) ≤ 64 KB (`scripts/measure-first-load.mjs:40`; last recorded 59.8 KB, PR #393). Review check: no new `<link>`/`<script>` in `index.html`, no new static import in `src/app.js` (the gate weighs only those, `measure-first-load.mjs:47-59`). `Home.test.js:133-135` kept (`stages.made` empty before `activate`). |
| 7 | Five readers observed before structural change | Not a code test. `home-frame.test.js` makes a structural change a visible edit; its header names `docs/product/discussions/` as where a dated joint record must exist first. RDR-007 and RDR-009 run on the B4 release. |

## 8. What is removed, and what replaces it

| Removed | Replaced by |
|---|---|
| The stream: `reading-stream.js` (114 lines), `.css`, `.test.js` (198); `playStream`, `setProgress`, the `play()` call (`Home.js:316-372`); `.home-stream`, the hairline (`:235, :252`); `portal-home.css:101-139, 278-293, 420-424, 463-478`; `home-preload.js:23`; `ci.yml:59`; `system-design.test.js:73` (housekeeping); `ARCHITECTURE.md:403-405` sentence; the generated diagram edge | `p.home-epigraph`, one still line in the look's face; `[data-home-opening].sr-only` kept (`e2e/today.spec.js:41-45` reads it) |
| `Read it with sound` (`Home.js:246`) | `Begin`, same hook, same disabled rule |
| The bar's Library/Adjust link (`:248, :300-303, :523-526`) | Adjust always; Library in the header rooms and the Menu |
| `Title, by Author` h1 (`:57, :65`) and the plan line as label (`:68, :79`) | Title alone; `Author · Work · N min · Look` meta; the plan words stay in the sr-only status (zero visual cost; `e2e/request-preview.spec.js:56` holds) |
| The Continue pill (`:38-42, :251, :594-597`; `portal-home.css:160-189`; `Home.css:499-551`) | The Continue state of the slot |
| The phone caption sentence (`portal-home.css:436-450`), the desktop bar as a row (`:191-207, :426-430`) | One stacked column at every width |
| `.home-stage` min-height 160 (`:92`) | `.home-window`, min-height 0 |
| The `Home.js` header comment (`:1-25`) | Rewritten: a home with a window |
| Kept: demo pages (`:257-284`), busy rule, alert, status, Menu of eight, first-read preview (`:81-82, :498-500`), midnight turnover (`:617`), no-WebGL path, Ask dialog, `ReadingStage` (D1 deletes it) | — |

## 9. Contracts and tests

**Unit.**
- `src/components/Home.test.js`: `:20-43` stream mock deleted; `arrive` (`:101-105`) waits for `.home-title` and a non-empty `.home-epigraph`; `:123-137` actions `['Begin','Another reading','Adjust']`, eyebrow text, no `.home-stream`; `:139-167` epigraph = first line, `[data-face]` = `decision.config.presentation.chamberFace`, meta `Author · Work · N min · Look`, status `Today's poem: Roy Butler, by Edgar Lee Masters. 2 minutes. Ember.`, hairline assertion gone, engine block (`:155-161`) kept; `:169-177` order `['library','make','settings','portal-menu-toggle','enter','roll','adjust', legal, legal]`; `:193-215` stage pause/resume only; `:229-240` Adjust always; `:269-295` eyebrow `By chance`, h1 `Oedipus Rex`, meta `Sophocles · N min · Revel`, status keeps the plan words, epigraph swaps when `openingLines` resolves, cross-fade assertion kept; `:297-306` deleted; `:331-341` becomes "the epigraph is empty while the opening loads and stays empty if it cannot be read"; `:358-429` warm-up triggered by `present()` writing the epigraph; `:432-460` plus `onAdjustReading(decision, { entryId, label })` for today and `(decision, null)` after a roll; `:489-494` becomes the header rooms; `:496-511` the Continue state; `:530-568`, `:593-657` unchanged.
- `src/components/Home.jev.test.js:187-189`: h1 `Ulysses`, meta `James Joyce · Ulysses · N min`, eyebrow `As you asked`, status keeps the plan words; new case: with `acceptOpenRouterKey(KEY)` `.home-actions [data-home=ask-open]` is visible and opens the dialog; without, hidden.
- New `src/components/home-frame.test.js`: region order and hooks (§2).
- `src/app/chamber-session-factory.personal.test.js` (or a sibling): the `releaseSession` cases (§7, criterion 5).
- `src/components/reading-backdrop.test.js:211-222`: right after the second `show`, both layers carry `is-shown` (`[true, true]`); after 900 ms one layer, old destroyed.
- `src/core/today-poem.test.js`: the pick carries `words`. `src/app/jev-reading.test.js` (or nearest): `openingLines` returns `words`.
- `src/app/home-preload.test.js`, `src/core/system-design.test.js:44-54`, `src/app/today.test.js:45`, `src/core/roll.test.js`: unchanged files; the first two go green by the edits named in §8.
- `src/core/user-data-keys.test.js`: enforces registering `rise_home_seen_v1` (PR 8).

**Browser.**
- `e2e/home.spec.js`: `openHome` (`:11-14`) waits for `.home-title` non-empty; `streaming()` (`:31-35`) deleted; `:45-64` selectors `enter, roll, adjust, .portal-legal-link`, primary `Begin`, plus the counting case; `:66-84` column geometry (caption bottom ≤ enter top on both widths; roll and adjust share a row on phone); `:86-109` the new Tab order, ≥ 12 px and ≥ 44 px rules kept; `:111-134` and `:136-157` keep their round trips with the return assertion rewritten to the Continue state (eyebrow Continue, `.btn-primary` is `[data-home=continue]`, the today line present) because the heading changes on return (judge 3's catch at `:131, :156`); `:141` kept; `:159-183` kept plus a today's-poem Adjust case asserting `paneInstance('setup').config.continuation.entryId` equals the day's `entryId`; `:185-201` kept with the epigraph wait; `:203-211` epigraph unchanged after 2.5 s, stage transition 0; `:213-220` kept; `:222-236` kept plus the connected worst case; `:238-249` deleted; `:251-267` kept; `:309-330` selectors `.home-epigraph, .home-label, .home-title, .home-meta, .home-link, [data-home=roll], .portal-legal-link`, light points in the window above the block.
- `e2e/portal-hit-test.spec.js:128` waits for `.home-title`; `:134` `[data-home=adjust]` replaces library; `:158` waits for `.home-epigraph`; `:174` drops the stream selectors, adds `.home-room, .home-meta, .home-epigraph`.
- `e2e/request-preview.spec.js:52` h1 `Ulysses`; `:54` label `^As you asked$`; `:56` unchanged (plan words in the status).
- Unchanged: `smoke.spec.js:32, 75-88, 112`; `today.spec.js:36-64` (`[data-home=enter]` and `[data-home-opening]` survive); `journeys.spec.js`; `url-routing.spec.js:16, 49`; `fixtures.js:24-32` (tolerates an inline nav); `reader-connection.js:55-58`; `wormhole.spec.js:33-40, 241-246`; `keystones.spec.js:10`; `chunk-reload.spec.js:29`; `jev-steering.spec.js:180-183`. Stale comments at `fixtures.js:71`, `jev-steering.spec.js:181`, `journeys.spec.js:8`, `home.spec.js:4-9` reworded.
- Locators: `[data-nav="library"]` now exists twice on desktop. Every tree click is scoped to `.portal-nav` or uses `.first()`; the hit test uses `document.querySelector` (first). New tests scope to `.home-rooms`.

**Oracle and wormhole invariants kept.** Home composes only through `rollReading({ previous, vivid: true })` (`Home.js:473`; `roll.js:196-206`); every featured decision passes `validateJevRecommendation` (`jev-reading.js:118`); the two doors stay `launchJevReading` and `adjustJevReading` (`route-manifest.js:15-18`), the latter gaining only an optional `exact`; the wormhole hands its decision through the same two (`invocation.js:65-69`) and keeps its Menu link (`Home.js:196`); a reading entered from Home exits to Home, via Adjust to setup (`chamber-exit.js:83-92`); `src/wormhole/*` and `e2e/wormhole.spec.js` untouched. The ChatGPT contracts (`CONSOLIDATED-READER.md` §5) are untouched; B4 edits no file in that table. The factory edits (PR 3, PR 7) are M's to review because it hosts live Currents.

## 10. Build plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans, task by task. Steps use `- [ ]`.

**Goal:** Home becomes a home with a window: one featured reading, still, with one way in and the rooms one click away.
**Architecture:** `Home.js` keeps its class, grid and `ReadingStage`; the stream is deleted; the slot, header rooms, Continue state and Ask toggle are labels, attributes and listeners Home already has. Three small app-side changes (`exact`, `releaseSession`, the cross-fade hold) land first as their own PRs.
**Tech stack:** vanilla JS, Vite, vitest (jsdom), Playwright.
**Spec:** this document.

**Global constraints.** Read-only rule for the plan's author does not bind the builder, but: every PR branches from `main` in a worktree under `D:\syberlabs\nise.worktrees` (never the main folder); one heavy process at a time on the owner's PC; locally run only the single unit file named in the task (`npx vitest run <file>`); browser suites and `measure:first-load` run on CI; `node scripts/build-architecture-diagram.mjs` runs once, alone, in PR 4a. Hook names kept: `enter`, `roll`, `adjust`, `ask-open`, `continue`, `[data-home-opening]`. No new `<link>`/`<script>` in `index.html`; no new static import in `src/app.js`. Nothing under 12 px; every gradient from the two ink tokens. Phone fits 390×844 and 360×640 with no vertical scroll. Merge one PR at a time through the required `CI` check; verify the live release after each.

### PR 1: minutes and the exact division (data only, no visible change)

**Files.** Modify `src/core/today-poem.js:42`, `src/app/jev-reading.js:211`, `src/app.js:454, 723-728`. Tests `src/core/today-poem.test.js`, `src/app/jev-reading.test.js` (add if absent, beside the module), `src/app.js` has no unit test: the `exact` thread is proven by PR 4b's Home test and the e2e Adjust case.
**Produces.** `todayPoem()` → `{ workId, entryId, label, words, seed, dayNumber }`; `openingLines(decision)` → `{ text, verse, words }`; `App.adjustJevReading(decision, exact = null)`.

- [ ] Test (today-poem): `expect(todayPoem(new Date(2026, 9, 5)).words).toBe(DIVISION_INDEX[pick.workId].divisionWords[pick.entryId])`. Run `npx vitest run src/core/today-poem.test.js`; expect FAIL (`words` undefined).
- [ ] Implement: at `today-poem.js:42` push `{ workId, entryId, label, words: work.divisionWords[entryId] }`. Run; PASS.
- [ ] Test (jev-reading): with a released decision, `(await openingLines(decision)).words` is a positive number. Run; FAIL.
- [ ] Implement at `:211`: `return { text: openingOf(entry.content, 240), verse: entry.verse === true, words: Number(entry.words) || 0 };`. Run; PASS.
- [ ] `app.js:454` → `adjustJevReading: (decision, exact) => this.adjustJevReading(decision, exact)`; `:723` → `async adjustJevReading(decision, exact = null)`; `:725` → `resolveJevReading(decision, exact)`. The existing e2e Adjust case (`home.spec.js:159-183`) must stay green on CI.
- [ ] Commit: `Carry word counts to Home and the exact division to Adjust`.

### PR 2: the cross-fade holds the old layer (R1 on Another reading)

**Files.** Modify `src/components/reading-backdrop.js:133-142`; test `src/components/reading-backdrop.test.js:211-222`.

- [ ] Test: after the second `show`, `expect(layers().map(l => l.classList.contains('is-shown'))).toEqual([true, true])`; after `advanceTimersByTimeAsync(900)`, one layer, `old.destroy` called once. Run `npx vitest run src/components/reading-backdrop.test.js`; FAIL on `[false, true]`.
- [ ] Implement: delete `:133`; in the paused/reduced branch (`:134-137`) `end(old)` stays; inside the timer (`:138-141`) `end(old)` removes the node, so no class change is needed. Run; PASS.
- [ ] Commit: `The stage keeps the old engine at full strength under the incoming one`.

### PR 3: a finished or failed reading releases the session (M reviews)

**Files.** Modify `src/app.js:468-494` (add `releaseSession`), `src/app/chamber-session-factory.js:463-467, 518-531`; test `src/app/chamber-session-factory.personal.test.js` (add cases; its `operations()` helper is the shape).

- [ ] Test 1: build a session with `atoms: [{}]`, `visualConfig: { visualMode: 'off' }`; make `ensureVisualCortex` resolve and the Chamber import stubbed (`vi.mock('../components/read/Chamber.js')` capturing `onExit`); call `onExit('close')` with `player.sessionState.state = 'complete'`; expect `op.releaseSession` called with the session. Test 2: state `'paused'` → not called. Test 3: `ensureVisualCortex` rejects with a plain error → `releaseSession` called before `router.back`. Run the file; FAIL (`releaseSession` is not a function / not called).
- [ ] Implement: `app.js` operations gain `releaseSession: session => { if (this.currentSession === session) this.currentSession = null; }`. Factory `onExit`: first line `const complete = player.sessionState?.state === 'complete';` then after `player.stop()`: `if (complete) operations.releaseSession?.(session);`. Failure path: before `operations.router.back()` add `operations.releaseSession?.(session);`. Run; PASS.
- [ ] Commit: `A finished or unopened reading no longer offers Continue`.

### PR 4a: the still window (stream out, slot in, Begin)

**Files.** Modify `src/components/Home.js` (header comment, `homeReading`, `renderHome`, `present`, `play`, delete `playStream`/`setProgress`), `portal-home.css`, `Home.css` (delete `:499-551`), `src/app/home-preload.js:23`, `src/core/system-design.test.js:73`, `docs/specs/ARCHITECTURE.md:403-405`, `.github/workflows/ci.yml:59` (coordinator's file: one line removed), regenerate the diagram. Delete `reading-stream.js`, `.css`, `.test.js`. Tests: `Home.test.js`, `Home.jev.test.js`.
**Produces.** `homeReading()` returns `{ decision, temper, eyebrow, title, meta: [author, work, minutes, look], note, spoken, exact, today, firstReadPreview, face }`; `present(reading, opening)` writes eyebrow, title (+tooltip), meta, note, epigraph (after the font hold), status; `epigraphOf(opening, tools)`.

- [ ] Rewrite `Home.test.js` first, as listed in §9 (one commit of red tests). Run `npx vitest run src/components/Home.test.js`; FAIL across the board for the right reasons (no `.home-epigraph`, actions still `Read it with sound`).
- [ ] Implement `renderHome`: `<div class="home-window"></div>`, alert, `<div class="home-featured"><p class="home-label"></p><h1 class="home-title" id="home-title"></h1><p class="home-meta"></p><p class="home-note" role="note" hidden></p><p class="home-epigraph"></p></div><div class="home-actions">${button('enter','Begin','primary',' disabled')}${button('roll','Another reading','secondary')}<button class="home-link" type="button" data-home="adjust">Adjust</button></div>`, then the sr-only opening and status.
- [ ] Implement `homeReading`: today → `eyebrow: TODAY, title, meta: [author, work, minutes(pick.words, decision.config.wpm), capital(temper)], exact: { entryId: pick.entryId, label: pick.label }`; roll → `eyebrow: 'By chance'`, title from the decision (`roll.js:183`); ask → `'As you asked'`, no look word. `minutes = (words, wpm) => words ? \`${Math.max(1, Math.round(words / wpm))} min\` : ''`. `spoken` keeps the plan words for a roll or ask (`summarizeJevPlan`) so `request-preview.spec.js:56` holds.
- [ ] Implement `present`: write the parts; `node.dataset.face = resolveChamberStreamFace(decision.config.presentation?.chamberFace)`; `showEpigraph(text)`: `await Promise.race([document.fonts?.load(\`${weight} 1em ${getComputedStyle(node).fontFamily}\`), new Promise(r => setTimeout(r, 300))])` then set text if the reading is still this one. `epigraphOf`: verse → first non-empty line; prose → `tools.openingOf(text, 90)`. Move the idle warm-up (`:359`) to after the epigraph renders. `play()` calls `showEngine()` only. `showDecision`'s callback writes meta minutes and the epigraph.
- [ ] CSS: the §4 rules; seven `data-face` lines using `--font-*` tokens; delete the stream rules. Run `Home.test.js` and `Home.jev.test.js` (with its `:187-189` update); PASS. `home-preload.test.js` and `system-design.test.js` PASS after the edits.
- [ ] Run `node scripts/build-architecture-diagram.mjs` once, alone. Commit: `Home is a home with a window: the opening set still, Begin the one key`.
- [ ] CI: PR job (unit set, `vite build`, `measure:first-load`, the gate: `portal-hit-test`, `request-preview`, `smoke`, `journeys`, `url-routing`, `keystones` updated per §9) plus a manual full-validation dispatch for `home.spec.js`, `today.spec.js`. Screenshots at 1280×800, 390×844, 360×640 from the CI artifacts or a single local `vite preview` run with nothing else open; measure the undimmed window and `scrollWidth − innerWidth`.

### PR 4b: the rooms in the header, Adjust always, Ask when connected

**Files.** `Home.js` (`render` header, click delegate, `subscribeConnection` in the constructor, unsubscribe in `destroy`), `Home.css` (`.home-rooms`), `portal-home.css` (phone third cell), tests `Home.test.js`, `Home.jev.test.js`, e2e `home.spec.js`, `portal-hit-test.spec.js`.

- [ ] Tests: header rooms call `onNavigate`/dispatch settings; focus order; counting case (7); `ask-open` hidden without a key, visible and opening the dialog with `acceptOpenRouterKey(KEY)`. Run both unit files; FAIL.
- [ ] Implement: markup `<div class="home-rooms"><button class="home-room" type="button" data-nav="library">Library</button><button class="home-room" type="button" data-nav="make">Make</button><button class="home-room" type="button" data-action="settings">Settings</button></div>` before the toggle (the existing `[data-nav]` and `[data-action]` loops at `:586-605` bind them). Actions gain `<button class="home-link" type="button" data-home="ask-open" hidden>Ask for a reading</button>`; delegate branch `else if (action === 'ask-open') this.asking.open();`; `this.stopConnection = subscribeConnection(() => this.syncAsk())`, `syncAsk()` sets `hidden = connectionState().kind === 'none'`. Home never calls `takeConnectionNotice`. Run; PASS.
- [ ] Commit: `Library, Make and Settings one click away on a desk; Ask on Home for a connected reader`.

### PR 4c: Continue leads

**Files.** `Home.js` (`syncContinue` → `present(continueReading(session))`, delegate branch `continue`, the today line, `update()` resets `chosen` on re-entry when a session leads), `portal-home.css` (`.home-line`), tests `Home.test.js` (criterion 5 cases), e2e `home.spec.js` (return assertions, Continue cases).

- [ ] Tests first (§7, criterion 5). Run `Home.test.js`; FAIL.
- [ ] Implement `continueReading(session)` → `{ eyebrow: 'Continue', title: session.name, meta: [minutesFromMs(session.totalDuration)], spoken: \`Continue: ${session.name}. N minutes.\`, session, primary: 'continue', engine: { config: { visualConfig: session.visualConfig, colors: session.presentation?.colors ?? null } } }`. `present` renders the primary as `[data-home="continue"]` text `Continue`, hides Adjust, shows `<button class="home-line" type="button" data-home="enter"><span>Today's poem · <title>, by <author></span><span>Begin</span></button>` (an SVG chevron aria-hidden). `showEngine` uses `reading.engine ?? reading.decision`. Run; PASS.
- [ ] Commit: `Continue leads when a reading is in memory`.

### PR 5: the frame test and the tracker

**Files.** New `src/components/home-frame.test.js`; `docs/product/tasks/RDR-019.json` (acceptance gains "Criterion 4 (R2) is held by RDR-015 and FND-010" and "Criterion 7 is RDR-007/RDR-009"; activity line; evidence refs to the PRs).

- [ ] Test: mount Home, assert `[...container.querySelectorAll('.sl-header .home-rooms, .portal-menu-toggle, .home-engine, .home-featured > *, .home-actions, .portal-footer .portal-legal')]` order and the hook set `['enter','roll','adjust','ask-open']` (and `continue` with a session). Header comment names the joint-decision rule. Run; PASS on first run is expected here: this test pins existing structure (say so in its comment; it is a guard, not a feature).
- [ ] Commit: `Pin Home's frame; record where criterion 4 lives`.

### PR 6: the R2 measurement, expected to fail

**Files.** New `e2e/home-begin.spec.js` (§5), in the `full` project (CI only); `test.fail()` with a comment naming PR 7.

- [ ] Write the spec; dispatch full validation on CI; confirm it reports an expected failure with the numbers in its annotation (`test.info().annotations`). Commit: `Measure Begin to first word on CI`.

### PR 7: A3's remainder (RDR-015; M reviews the factory)

**Files.** `src/core/router.js:161-192` (hold `#view-home` under `#view-read` for a `launchesReading` move from `home`; z-order: `#view-read` above), `src/app/chamber-session-factory.js:38-39, 434` (`quiet`), `src/components/portal-home.css` if the held engine needs `z-index` under the Read view; `e2e/home-begin.spec.js` loses `test.fail()`; a router unit test for the hold order; RDR-015 updated with CI's numbers.

- [ ] Test first: router test asserting, for a launch from home, `#view-home.hidden` stays false until after `fadeIn` resolves; factory test asserting `showLoading` is not called when `session.origin.view === 'home'`. Then implement; then CI full validation reads `home-begin.spec.js`. If the number is still over 1,500 ms, RDR-015 stays open with the measured value and the next cut is named (the 500 ms autoStart is C3/D1's).

### PR 8: the one line on what RISE is (when the owners supply the copy)

**Files.** `Home.js` (`p.home-about` under the actions, shown when `localStorage` lacks `rise_home_seen_v1`; written in `activate` once, try/catch), `src/core/user-data-keys.js` (register `homeSeen: 'rise_home_seen_v1'`), `portal-home.css` (14/20, one line), tests `Home.test.js`, `user-data-keys.test.js`.

- [ ] Test: first mount shows the line; after `activate` the key is set; a second mount hides it; a throwing `localStorage` still renders. Implement; PASS. Render at 360×640: the line must stay one line (copy ≤ 60 characters) or the window shrinks.

**What runs where.** Locally: the single unit file each task names. CI PR job: the fixed unit set (`ci.yml:55-77`, minus `reading-stream.test.js`), `vite build`, `measure:first-load`, the gate. CI manual dispatch after each of PR 4a–4c, 6, 7: the full browser suite (`home.spec.js`, `today.spec.js`, `home-begin.spec.js`, `wormhole.spec.js`). Screenshots at the three sizes after 4a, 4c and 8; the first-load number recorded in each PR body.

## 11. Owner questions

1. **The one line on what RISE is** (first visit only; PR 8 waits for it). Proposed, theirs to replace: "RISE reads a text to you: words at a reading pace, over light and sound made for it." At or under 60 characters keeps it one line at 360 px; the proposal above is longer and would wrap.

   Answer (Mateo, 2026-10-07): "Texts read to you, with light and sound made for them." (54 characters). PR 8 builds it.
2. **Criterion 1 on a connected desktop.** The §2 table puts Ask on Home when connected (`:81`), which makes the desktop 8. Default built: Ask shows on Home at every width when connected and criterion 1 reads "7, or 8 when the reader's own AI is connected". Alternative: Ask in the Menu only on desktop (phone keeps 5). A cold production load is never connected (the key is tab memory, `ai-connection.js:24`), so the case is rare.

   Answer: pending.
   Default if unanswered: Ask shows on Home at every width when connected; criterion 1 reads "7, or 8 when the reader's own AI is connected".
3. **Continue's word.** It reopens the reading from its first word until a Player start index and a kept position exist. Keep "Continue" (today's behaviour made honest, no "left", no bar), or use "Read again" until then?

   Answer: pending.
   Default if unanswered: Continue.
4. **The visible words**, decided here and reversible: eyebrows TODAY'S POEM, BY CHANCE, AS YOU ASKED, CONTINUE; the look word is the temper's name (Signal, Ember, Revel) until C1 renames Ember to Iris.

   Answer: pending.
   Default if unanswered: the words above.
5. **May B4 merge with criterion 4 red** under `test.fail()` (PR 6) while PR 7 lands next?

   Answer: pending.
   Default if unanswered: yes; the PR body and RDR-019 say so.

## 12. Risks

- Criterion 4 ships failing; if PR 7's hold and skip do not reach 1.5 s on CI, the remaining cut (the 500 ms autoStart) is C3/D1 territory and RDR-015 stays open with the number.
- The factory is edited twice (PR 3, PR 7); it hosts live Currents, so M's review is on the critical path and `live-mcp` must stay green.
- Continue reopens from the first word; a reader who left at minute five gets minute one. Browser Back mid-reading leaves the Chamber mounted and may let audio run on (pre-existing; needs its own tracker item).
- A revel session behind Continue shows the default flame palette only if `presentation.colors` is missing; for Home-launched readings it is present (`jev-config.js:63`), so the shim matches the reading. Verify on the build.
- The epigraph's face: only thick and mono ever fetch (Instrument Sans and Serif are preloaded; Crimson Pro is the literary face). The 300 ms `fonts.load` race hides the swap on a normal network, not a slow one. A thick 700 epigraph at 33 px beside a 14 px meta reads loud; the 30ch measure and clamp bound it. Render each of the six faces before merge.
- The 360×640 window is ≈ 130 px of undimmed field in the typical case and less with a two-line title and Ask; the about line (PR 8) must stay one line. Render and measure before merge; widen the ground's fade only if the render shows it short (aesthetic-authority: look, do not reason from the CSS).
- R5: Home's engines are only paused at launch; a pending plate bake and an in-flight flame worker survive (`reading-backdrop.js:146-172`; `plate-field.js:301-304`). PR 7's hold keeps them running ~400 ms longer. The longtask probe in `home-begin.spec.js` is the guard; if it fails, destroy the stage once `#view-read` has faded in.
- Twelve spec files touch Home's selectors; the hook names are kept so round-trip specs change their waits, not their logic. Two `[data-nav="library"]` nodes on desktop: every existing locator is scoped or uses `.first()`; new ones must be.
- `ci.yml:59` lists `reading-stream.test.js`; deleting the file without that line breaks the PR job. The coordinator owns that file.
- `today-openings.json` (72 KB raw) is fetched on every cold Home visit for one opening a day; not B4's to change.
