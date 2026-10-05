# RISE Reader: evidence for a consolidated Reader

Status: Record. Date: 2026-10-04. An investigation agent prepared this for Mateo and Seth from the code, production probes and GitHub history. It is the evidence behind the [Consolidated Reader proposal](../CONSOLIDATED-READER.md), which cites it as "report §n".

Tree: `origin/main` = `97ca014f`; production `/release.txt` returned the same SHA. Tags: **[code]** in `origin/main` (file:line) · **[test]** named test · **[observed]** seen in production with a Playwright probe (Chromium, ANGLE on an AMD RX 5700, D3D11) · **[claimed]** stated in a PR or doc · **[inferred]** the investigator's reading.

History note: `origin/main` starts at `4e3a3125` (#211, 2026-09-26; 159 commits). Older history is in GitHub PRs #1–#210 and the local ref `codex/backup-main-pre-sync-2026-08-24` (initial commit `94ad18ba`, 2026-07-10). Authors: `sdcarlson` (Seth Carlson), `sykosyber` (Mateo Robles). Probe data, screenshots and frames were kept outside the repository. Names such as `run-setup-imagery-1280x800@2/cut-3.13s.jpg`, `setup-*.png` and `setup-count.json` below identify those runs; re-running the probes reproduces them.

## The ten findings that matter most

1. **Stutter cause, high confidence, reproduced on production.** Living Flame (#266, 2026-09-28) wipes its accumulated image on every quality-tier change: `_measure` → `_applyQuality(true)` reallocates particles, resizes the canvas and clears the image (`field.js:224-247`, `gl-flame.js:358-391`) after the frame is presented, so one empty frame reaches the screen and the image rebuilds from ~7%. It fires about twice in the first ~7 s of every flame and per new passage block, through Follow text (the default of Reader setup's "Read with imagery"). At DPR 2 the flame vanished for a frame at 3.13 s (`run-setup-imagery-1280x800@2/cut-3.13s-before.jpg` vs `cut-3.13s.jpg`); at DPR 1 it dims ~40%. No test covers `nextQualityTier`.
2. **Other dark or stuttering moments, measured:** Ember plates fade near-black ~4–5 s at every ~15.5 s rotation (by design: the new plate is held at progress 0); a ~1 s freeze at each plate rotation on a phone viewport with 4x CPU slowdown; ~4 s of black after Home's "Read it with sound" before the reading's visuals fade in; the attractor runs ~26 fps on a desktop GPU and never steps down (#392 stepped down below 40 fps; #371 moved it to below 25 fps).
3. **Home redesigned at least six times, four in eight days:** Portal with marble pavilions (July) → Try RISE seal (Aug) → Jev request box (#203, #264) → Oracle ROLL ball (#297, 09-30) → night library of stars (#373, 10-03 17:24) → deleted 4.5 h later by #388 "a reading already under way" (21:54). Today's poem changed shape four times that afternoon. Home now plays today's poem silently with no real home; its Menu uses pre-#377 room names.
4. **Visual Lab and Reader setup share no engine.** The Lab is Living Flame only; Reader setup never lists it. The Visual Catalog lists the nine registry engines. Workshop keeps its own copy of the list. Home's backdrop draws only three families and renders them differently from the reading.
5. **Sound and colour mismatches.** Reader setup offers 3 soundscapes; Jev, rolls, Workshop and the in-reading Jev panel offer 24. Four colour vocabularies (11 accents, 9 colour themes, 10 attractor palettes, plate palettes). Face and size are set in three places.
6. **Configuration burden.** Reader setup: 11 controls on the first screen (desktop and phone), ~29 settings behind them (ARCHITECTURE says "forty"). Rarely meaningful: pure-tone settings, personal sound upload, progressive text arrival, word border, glyph and preset benches.
7. **"Revel" is a temper, not a word mode:** word chunks at 300–400 WPM with fractal visuals (#297). The previous-word echo exists only in Home's text stream (#388); the reading shows one unit at a time. Today's poem is word-by-word about five days in six [inferred], phrase when recited. Reader setup defaults to word. No *recorded* phrase-preference evidence was found in the repo (the owner reports it from user testing).
8. **Fill (Fit with imagery inside the words)** needs four settings across three panels: word chunking, a Gallery field, Thick face with Fit size, an ink choice (~2,700 combinations). Specs record the desktop flaw (a fitted short word enlarges its own field; the layout drifts); on a phone the width caps the word. Off by default; rolls use Fit size only with plain ink, so Home never shows Fill.
9. **Composer touchpoints.** Composer uses the session compiler (sentence chunks), the Player in live mode, the whole reading view, field mounting for the attractor and Genesis, the 9 colour themes (each mapped to an attractor look and a Genesis preset), and the attractor's "more vibrant / make it calmer" control. Consolidation risks: renaming or merging colour themes; giving the attractor a single owner. Stable contracts: `rise.current.v1`, `rise.experience-program.v1`, the compiler input, the Player API, the visual-control contract.
10. **History is truncated at #211.** Since 2026-09-21: 194 PRs merged (158 by sdcarlson, 36 by sykosyber), 81 on 09-27 alone.

## 1. Home page history

**Present behaviour [observed, code].** Home has no home: today's poem plays silently and full screen (10-04: "Roy Butler, by Edgar Lee Masters", Ember temper), with its own engine (`src/components/reading-backdrop.js:30-82`) and a streamed opening (`src/components/reading-stream.js:43-113`) showing the previous unit dimmed above the current one (`home-desktop.png`). Actions: Read it with sound, Another reading, Library (becomes Adjust after a roll) (`Home.js:240-263, 295-316`). The Menu (`Home.js:181-205`) lists Home, Ask for a reading, Today's poem, Library, Sequences, Compose, Reader setup, Guide, Settings, Wormhole, Live reading, Chapel, Scriptorium, Visual Lab, Emotions, Curia — pre-#377 names; Read, Make and Today are not entries.

| # | Merged | PR / commit | Author | First screen | Led with | Why |
|---|---|---|---|---|---|---|
| 0 | 07-10 | `94ad18ba` "R.I.S.E. v2" | sykosyber | Video sigil; Chamber primary; Vault, Library, Workshop, SOL | Chamber | Baseline |
| 1 | 07-13 | `af195ac3` | sykosyber | SOL becomes a living strip | Chamber | "opaque nouns" |
| 2 | 07-21→24 | `eace88ca`, `09b8c6ac`, `23c9d8a3`, `0decec36` | sykosyber | Atrium and Solarium marble pavilions, Chapel lamp | Chamber with invitations | Busy doors pulled the eye three ways |
| 3 | 08-02→06 | Premium mobile threshold 1–3; `4908de59` | sykosyber | Phone stage; "Audiovisual Reader" | Chamber | Acronym retired |
| 4 | 08-20→25 | #1–#7, `a0c4146a`, #23/#24, #75, #77, #82, #85 | both | Vessel; Enter Chamber; Vault, Library, Workshop; Try RISE seal; orbs; Continue | Enter Chamber, Try RISE | "nine ways in now offers seven" |
| 5 | 09-27 | #203, #224, #235, #238, #254/#259/#261 | sdcarlson | Jev request box with length, pace, chunking, sound, visual choices; 30 s first read; Atlas chrome | Typing to Jev | Jev-first direction; first-read measurement |
| 6 | 09-28 | #264 | sdcarlson | "What do you want to experience?" → preview → Play | Request, then preview | A request got an unexplained classical reading |
| 7 | 09-30 | #297 (prototype #272/#273) | sykosyber | WebGL 8-ball, one key, ROLL; Roll again / Enter; Adjust; ask; Wormhole | Chance | "Home was a request box … RISE becomes a machine you approach" |
| 8 | 10-03 17:24 | #373, #375, #379, #374/#376 | sdcarlson | A star per released work; a star rolls; three-part result with Redraw; Today card | Star map | Oracle replaced |
| 9 | 10-03 21:54 | #388, #393, #394, #395 | sdcarlson | Today's poem playing silent, full screen; Ask moved to the Menu | A reading in progress | Night library "too busy and not premium … star map didn't land … read like a form … wasn't immersive" |
| 10 | 10-04 | #377 | sdcarlson | Same screen; `Portal.js` → `Home.js` | — | Five rooms |

Today's poem on 10-03: 17:56 page with a date mandala (#374); 18:28 Home card with vivid visuals (#376); "Eclipse" redesign (#386, closed); 20:52 page deleted (#387); 21:54 card removed (#388).

## 2. Reader capability inventory

**Entrances [code].** All end in `compileSession` and the one Player from `chamber-session-factory.js`.

| Entrance | Path | Through Reader setup? |
|---|---|---|
| Home: Read it with sound | `Home.proceed` → `launchToday` / `launchJevReading` | No |
| Home: Adjust | Reader setup, preloaded | Yes |
| Home: Another reading | Vivid roll (`roll.js:196-206`) | No |
| Ask for a reading | `home-ask.js` → reader's OpenRouter or local Kev | No |
| Today's poem | Menu or `/today` (`app/today.js`) | No |
| Library | `handleTextSelection` → Reader setup | Yes |
| Chapel | `launchChapelReading` → Reader setup | Yes |
| Rosary, Stations | Own liturgy clock | No |
| Journeys | Empty list | — |
| Keystones | `/keystone/<slug>` | No |
| Minted sequences | `/p/<slug>` | No |
| Make: Workshop preview, Vault, Scriptorium | Make tabs | No |
| Visual Lab: Use in reading | Living Flame recipe | No |
| Visual Catalog | `/live?catalog=attractor` or `klee` | No |
| Wormhole | `/wormhole.html`, same roll | No |
| Scene demos | `/night-drive`, `/jev-scene-demo` | No |
| Continue | Resumes the in-memory session | No |
| `/live` | Live host | No |
| ChatGPT Composer | `/live?embed=mcp` | No |

**Projections.** Stream and Page over the same Session: Reader setup's Mode control (`ChamberOrbital.js:687-695`), the reading bar ("Read as a page"), Jev's projection field, `compileRiseCurrent`'s projection option. Rolls force Stream (`roll.js:163`).

**Chunk modes.**

| Mode | Compiler | Reader setup | Jev / tempers | Composer | Other |
|---|---|---|---|---|---|
| word | Default | Default | ember, revel; half of signal | No | Fit requires it |
| phrase | Yes | Yes | nocturne, garden, salon; half of signal and vigil | No | Forced by Recitation and by a recited Today's poem |
| sentence | Yes | Yes | plainsong; half of vigil | Always | — |
| paragraph | Yes | Not offered | Jev may choose | No | — |

Code: `session-compiler.js:67,164`; `ChamberOrbital.js:216, 298, 451`; `today-reading.js:17-22`; `rise-current.js:293`. Text arrival is Instant or Progressive; rolls force Instant.

**Pace.** Reader setup WPM slider 100–500, step 10, default 200 (arrow keys while reading); compiler bounds 50–1000; Jev only 100/150/200/250/300/400/500 (`jev-reading.js:20`). Six curves (flat, induction, ascent, wave, climax, breath; `pace-profiles.test.js`); Jev omits breath (`jev-reading.js:19`).

**Type and colour.** 7 faces; 5 sizes (S, M, L, XL, Fit); 11 accents in Settings only; 9 colour themes used by Jev, rolls, Today, Composer and the reading's Jev panel (`Chamber.js:798-830`), not in Reader setup or Settings; attractor and plate palettes are separate lists. Face and size are set in Settings, Reader setup's Type panel, and the reading's panels.

**Engine and mode × surface** (● offered; ◐ constrained; ○ absent). RS = Reader setup (Visual Navigator) · Lab = Visual Lab · Cat = Visual Catalog · WS = Workshop · Jev = Ask · Roll = Home roll tempers · Today · HomeBD = Home's backdrop · Drawer = the reading's Visual direction drawer and Follow text · Composer = `rise.current.v1`.

| Engine | RS | Lab | Cat | WS | Jev | Roll | Today | HomeBD | Drawer | Composer |
|---|---|---|---|---|---|---|---|---|---|---|
| Off / still | ● | ○ | ○ | ● | ● | ◐ plainsong | ○ | ○ | ● stillness | ● default |
| Focal (8 glyphs + personal image) | ● | ○ | ○ | ● | ◐ breath glyph | ◐ vigil | ○ | ○ | ○ | ○ |
| Attractor | ◐ look controls withdrawn (`visual-taxonomy.js:104-122`) | ○ | ● | ● | ◐ palette; kaleido; neon → night drive | ◐ signal | ◐ | ● | ● + kaleidoscope | ● theme sets look; vibrant/calmer |
| Night streaks | ○ | ○ | ○ | ○ | ◐ neon only | ○ | ○ | ○ | ○ | ○ |
| Genesis (Klee field) | ● + preset | ○ | ● | ● | ● | ◐ garden | ○ | ○ | ● | ● preset from theme |
| Klee Lines (gallery) | ○ | ○ | ● | ● | ● | ◐ | ○ | ○ | ○ | ○ |
| Harmonograph | ● | ○ | ● | ● | ● | ◐ | ○ | ○ | ● | ○ |
| Iris Plates | ● | ○ | ● | ● | ● | ◐ ember | ◐ | ● | ○ | ○ |
| Spectral Plates | ● | ○ | ● | ● | ● | ◐ ember | ◐ | ● | ○ | ○ |
| Fractal Flames | ● Gallery | ○ | ● | ● | ● forced when psychedelic | ◐ revel | ◐ | ● hard cut every 18 s | ○ | ○ |
| Turrell | ● | ○ | ● | ● | ● | ◐ | ○ | ○ | ● | ○ |
| Neural Networks | ● | ○ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| Rock Garden | ● | ○ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| Living Flame | ◐ only via Follow text | ● only engine | ○ | ● | ○ | ○ | ○ | ○ | ● energy, complexity, symmetry, colour | ○ |
| Museum, science, personal imagery | ● | ○ | ○ | ● + uploads | ○ | ○ | ○ | ○ | ◐ | ○ |
| Fit with imagery ("Fill") | ● | ○ | ○ | ◐ | ◐ plain/accent/same | ◐ Fit with plain ink | ◐ | ○ | ○ | ○ |

Mismatches: four separate engine lists (Workshop's hand-copied, `workshop-visual-assets.js:11-20`); Home's backdrop draws 3 families (`reading-backdrop.js:30-82`); Home's fractal is a live canvas with hard cuts while the reading's is cross-faded WebP stills; the attractor has two owners (`visual-cortex.js:2086-2100`); Jev and Reader setup cannot reproduce each other's readings; the imagery stance sets cadence 0.3 but the chips are 0, 0.5, 1 [inferred].

**Sound.**

| Sound | Reader setup | Jev / rolls / Today | Workshop | In-reading Jev panel | Composer |
|---|---|---|---|---|---|
| Soundscapes (24, `soundscapes.js:879-917`) | 3 | 24 (`jev-config.js:3-7`) | 24 | 24 | None |
| Chant | Chapel only | ○ | ○ | ○ | ○ |
| Pure tones (3 × 4 delivery × 3 waveforms) | ● | ○ | ○ | ○ | ○ |
| Personal MP3 swells | ● | ○ | ● | ○ | ○ |
| Recitation voice packs (Opus, phrase-locked) | Sequences with the capability | ElevenLabs recitation for Today (#390) | ○ | ○ | ○ |
| Browser speech / synthetic voice | ○ | ○ | ○ | ○ | ● |
| Ambient drone | Settings toggle; never plays in a reading | — | — | — | — |

## 3. Configuration burden [observed: `setup-count.json`, `setup-*.png`]

| Layer | Desktop | Phone |
|---|---|---|
| First screen | 11 controls, no scroll | Same 11, no scroll |
| Adjust opened | 14 | 14 |
| Timing | 13 (WPM slider with 41 values, 6 curves, 3 chunk modes, 2 arrival modes) | 13 |
| Sound | 9; 16 with a tone chosen | 9 / 16 |
| Visuals | 8 at the top, then column drill-down | 18 visible (15-tile carousel) + "Aa" type button |

Behind those (code): 15 fields, 8 focal glyphs, 6 Genesis presets, 7 harmonograph climates, 4 blendable Gallery engines, imagery pools 3 + 6 + 1 + 2 personal, 3 cadences; type: 7 faces, 5 sizes, ink (3 answers + 6 engines + 12 pools), 3 borders; toggles Living Text and Glass. About 29 reader-facing parameters (ARCHITECTURE §8.26 says "forty"); Settings duplicates face and size and adds the accent.

[inferred] What matters most: text, WPM, word vs phrase, visuals on/off and which, sound bed, Stream or Page. Rarely meaningful: pure-tone delivery and waveform, personal swells, progressive arrival, most of the six curves, word border, Glass, Living Text, focal glyph, climate, Genesis preset, cadence. Hidden couplings: Recitation silently locks chunking to phrase; Fill spans three panels; choosing an engine switches Follow text to Hold.

## 4. Revel

- `revel` is a temper (`roll.js:115-120`): word chunks, 300–400 WPM, climax or wave curve, psychedelic fractal, lively cadence, thick or sans face, Fit or XL, prism colours. Introduced with #297 (09-30).
- The previous-word echo is Home's text stream (`reading-stream.js:105-113`; 38% opacity; #388; #395 changed the entrance to a 120 ms move). The reading itself shows one unit [observed].
- Today's poem draws signal, ember or revel by date (`today-reading.js`; `today-reading.test.js`, `roll.test.js`): word-by-word ~5 days in 6 [inferred], phrase when recited. Reader setup and the compiler default to word; Composer uses sentence.
- No recorded phrase-preference evidence in docs, ~30 PRs mentioning "phrase", issues or project memory; the first-read pilots (#239/#240) recorded readiness only. (The owner reports phrase was widely preferred in user testing.)

## 5. Fill (Fit with imagery)

- Mechanism: an SVG glyph mask paints a Gallery field inside one fitted word (`fit-mask-repair-design.md`; `fit-mask-runtime.js`, `fit-projection.js`, `chamber-text-material.js`).
- Preconditions (`chamber-text-material.js:11-39`; reasons shown in `markup.js:43-49`): word chunking, a Gallery field, the Thick face, the Fit size, an ink choice plus a border, and a legacy Settings toggle "Show imagery through words".
- History: #25, #29, #32, #34–#37, #39, #68–#70, #79, #81, #83, #84, #100, #105, #126, #385. Tests: `e2e/fit-mask*.spec.js`, `scene-stack-fit.spec.js`, `Chamber.mask.test.js`.
- Desktop vs mobile [claimed]: a desktop feedback loop where the word enlarges its own field and drifts; "mobile avoids most … because width constrains the fitted word". Desktop collection rooms later got their own sizing (`2026-09-09-workshop-audio-fit-boundaries-design.md`).
- Phone setup crosses three sheets plus "Aa"; ~2,700 combinations [inferred]. Off by default; rolls use Fit size only with plain ink (`roll.js:163-166`), so Home never shows Fill.

## 6. The stutter

**Most likely cause (high confidence, reproduced): Living Flame clears its image on tier changes.** Setup: Reader setup, "Read with imagery" (Follow text + Living Flame), 1280×800 at DPR 2, text hidden, WebGL instrumented. Tier steps at −1.55 s and +3.04 s, each with a particle reallocation, canvas resize and image clear; at the second, one frame's centre brightness fell from 21.8 to 9.6 (the bare background) and rebuilt within ~100 ms (`run-setup-imagery-1280x800@2/cut-3.13s-before.jpg`, `cut-3.13s.jpg`). At DPR 1 it dims ~40% for one frame.

Mechanism: `nextQualityTier` (`field.js:31-42`) steps up after 3 windows at p95 ≤ 18 ms, down above 20 ms, with a 3 s cooldown; tiers 32k–262k particles at DPR 0.75–1.5; every flame starts at tier 1. `_applyQuality(true)` (`field.js:224-247`) → `setParticleCount` → `setSize` (sets canvas size, reallocates the image buffer, `clearHistory`, `gl-flame.js:358-391`) → `reset`, after the frame is presented. Rebuild decay 0.93/frame (`gl-flame.js:447, 479-482, 520`): ~7% first frame, ~50% by frame ten. Same wipe on resize (`field.js:154`), clock jump > 1.5 s (`field.js:299`), incompatible recipe (`field.js:351`). Fires ~twice per mount on capable GPUs and per new passage block (second mount at 54.73 s). Arrived with #266 (09-28); older engines redraw or cross-fade with no accumulated image. No test covers the tier policy; #266's browser runs used SwiftShader.

Other contributors, ranked:
- Ember plates' designed fade: new plate held at progress 0 for the 2.5 s dissolve (`plate-field.js:243`); centre brightness 48 → 9.5, ~4 s near black, every ~15.5 s [observed].
- Phone freeze at plate rotation: 915 ms and 1,241 ms long tasks at 390×844@3 with 4x slowdown [observed].
- Home → reading gap: ~4 s of black after "Read it with sound" (visuals start 4.7 s after the click, fade in over 1.5 s; `run-entry-revel`) [observed].
- Attractor ~26 fps (frame interval median 38 ms, p95 49 ms); #371 moved step-down from below 40 fps to below 25 fps (`attractor.js:186-190`), so it never degrades. Jerky, never black.
- Attractor canvas cleared at mount: `resize()` sets canvas size even when unchanged (`attractor.js:328`) [observed: set twice at mount].
- Fractal snapshot pauses: synchronous `toDataURL` (`visual-cortex.js:1571`), 60–159 ms every ~9.75 s [observed]; #397 measured 156–319 ms on 3x phones [claimed].
- Leftover Home bakes during the reading (`reading-backdrop.js:146-172`): 81 ms and 112 ms long tasks [observed].
- Unconfirmed: one fully black frame including text (`run-today-1280x800/cut-15.25s.jpg`), not reproduced in three more runs.

Not supported by evidence: #397's fractal worker (smooth over 40 s); #396 (Home only); #392 quality steps (never clear the canvas); Gallery and flame-to-flame cross-fades (smooth). Limits: one GPU, headless; no phone, Safari or weak GPU.

## 7. The last 14 days

194 PRs merged, 31 closed unmerged; 81 merges on 09-27, 30 on 09-30, 32 on 10-03.

| Theme | PRs | Reversals and churn |
|---|---|---|
| Home | #203, #224, #235, #238, #259, #261, #264, #272/#273, #280, #297, #366, #373, #375, #379, #388, #393–#395, #377 | Four doors in eight days; #224's page deleted by #280; #235 removed by #297; #264's panel removed by #297; Oracle deleted 3 days later (#373); night library deleted 4.5 h later (#388); Redraw added by #373, removed by #379 and #388 |
| Today | #374, #376, #381, #386 (closed), #387, #390 | All on 10-03 |
| Reader setup and chrome | #173, #250, #253, #267, #270, #382, #385, #402 | — |
| Visual engines | #172, #263, #266, #268, #364, #365, #392, #371, #395–#397 | #392's threshold reversed by #371 |
| Audio | #171, #212/#213, #216, #219–#222, #232, #236, #242, #246, #377, #390 | Recitation hosting moved three times; soundscapes 3 → 24 for Jev only |
| Jev / Kev | #175 … #308, #377 | Neon + Redis added 09-27, deleted by #377 10-04 |
| Live / Composer | #298–#300, #319, #324, #327, #347, #359, #360, #362, #364–#366, #369–#371, #398–#403; closed #301–#318, #361, #367, #368, #372 | Dive and Live built 09-29 → 10-03, descoped by #401 and #403 |
| Deletions and rooms | #325–#358, #377 | Create room added by #265 (09-27), removed by #358 (10-03) |
| CI | #185–#230, #271/#281/#287, #190 → #378 | Agentic review fail-closed, then pass-without-key; browser tests off the PR gate, then back |
| Workshop / Vault | #290–#293, #310, #383, #384 | — |
| EnterpRise | #274, #283–#289 | — |
| Affect | #296 | — |

Duplicated systems: 4 engine lists; 4 colour vocabularies; 3 places to set face and size; 2 renderers of one reading (Home's stage and stream vs the reading's visual system); 2 owners of the attractor; 3 surfaces over one roll (Home, Wormhole, Today); 2 features called "dive".

## 8. Composer touchpoints

**Contract.** `rise.current.v1` (`rise-current.js`): up to 16 segments; `visual` is `still`, `attractor` or `genesis` (line 23); `theme` one of the 9 colour themes (line 26). The model's guide is generated from these constants (`current-guide.js`); the Worker (`mcp-server.mjs`, tool `rise_present`, off unless `MCP_ENABLED`) validates with the same code.

**Lowering.** (1) A `rise.experience-program.v1` program (`rise-current.js:217-271`); (2) `compileSession` with sentence chunks (`rise-current.js:284-297`); (3) the Player in live mode (`setLive`, `extend`, `govern`); (4) the reading view via `chamber-session-factory`, `live-handoff`, `live-present` (`LiveHost.js:151-156`).

**Look.** Each theme maps to an attractor system, palette and form plus a Genesis preset (`rise-current.js:122-131`), with page colours from `jevColors`. Cues are field cues mounted by `mountVisualFieldCue` and the Visual Field Director.

**Controls** (`controls.js`, `dive:false` since #403): Begin, Interrupt / Resume, Stop, and "Visual change" ("more vibrant" / "make it calmer"; `visual-control.js:2-8`) driving `AttractorField.controlVisual` within `ATTRACTOR_VISUAL_MANIFEST` (#364). Voice: browser speech or synthetic. Tests: `e2e/live-mcp.spec.js`, `mcp-port.test.js`, `runtime.test.js`, `controls.test.js`, `current.test.js`.

**Shared with the Reader:** compiler, Player, the whole reading view, factory; Visual Field Director, `AttractorField`, `KleeField`; colour themes and palettes, visual style definitions; `admitCatalogVisual`; Settings for face and size (an iframe under ChatGPT likely gets defaults [inferred]).

**Composer-specific:** `src/live/**`, `worker/mcp-server.mjs`, `src/app/live-*.js`.

**Unused by Composer:** Reader setup, Visual Navigator, stances, soundscapes, Fill, Gallery engines, Living Flame and Follow text, tempers, Home.

**What consolidation could break [inferred]:** renaming or merging colour themes (model-facing contract); changing attractor looks or presets (every theme's look); giving the attractor a single owner (breaks `controlVisual`, the only visual control); changing sentence chunking or pacing (narration timing); changing the reading view's bar or field mounting (the embed is the reading view).

**Stable contracts:** `rise.current.v1`, `rise.experience-program.v1`, the compiler input, the Player API, `visual-control-contract.js`, and the constructor guards in `current.test.js`.

## Open questions

1. Which stutter does the user see: Living Flame (reproduced), Ember's fade to void, or the Home → reading gap? A recording on their display (note its pixel ratio) would settle it.
2. Is the ~4 s of black after "Read it with sound" intended?
3. Should Living Flame join Reader setup's list, or should Follow text stop defaulting to it?
4. Is Ember's 2.5 s dissolve plus ~4 s of near black wanted?
5. Was #371's threshold change deliberate, given ~26 fps on a desktop GPU?
6. Is there recorded evidence for the phrase preference? (Owner reports user testing.)
7. Which single colour vocabulary is intended? Composer is bound to the 9 themes.
8. Should the Menu use the five room names?
9. Do Settings reach the ChatGPT embed?
