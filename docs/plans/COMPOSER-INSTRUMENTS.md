# Composer instruments

**Status:** Intent, for LIVE-003. It describes the code on `main` as of 2026-10-05 and adds no instrument. The three instruments are exactly the visuals a Current may name, `RISE_CURRENT_VISUALS = ['still', 'attractor', 'genesis']` (`src/core/rise-current.js:23`). The fixtures are in `src/live/fixtures/explanations.js` and tested in `explanations.test.js`.

A Composer answer is one sealed Current ([decision](../product/discussions/2026-10-04-composer-decision.md)). Each passage names one instrument. The answer names one of the nine themes. The model supplies no number, colour, CSS or renderer setting. What each theme draws with is RISE's fixed table, `RISE_CURRENT_THEMES` (`rise-current.js:122-131`).

## The rule underneath all three

**The words and the voice carry the explanation. The instruments carry atmosphere.** None of the three draws the subject: an attractor behind a passage about weather is not Lorenz's attractor, and a genesis composition behind a forest is not a forest. A reader who sees nothing, hears nothing, or has imagery held still loses no fact. That is what makes it safe for a model to choose, and safe for a reader to switch off. So "explanatory versus atmospheric" means two things here. `still` is the explanatory default: it leaves the passage to the words. The two moving instruments add a mood to a passage the words already explain.

## The three

| | `still` | `attractor` | `genesis` |
|---|---|---|---|
| What it is | No field. The reading stands on its theme's page colour | A strange-attractor filament that turns slowly (`AttractorField`, `src/visuals/attractor.js`) | A Klee-like composition that grows, rests, then dissolves into the next (`KleeField`, `src/visuals/klee-field.js`) |
| Purpose | Attention on the words: definitions, numbers, caveats, conclusions | Motion, energy, process, things in flux | Growth, emergence, accumulation, slow change |
| Role | Explanatory default | Atmospheric | Atmospheric |
| What the theme sets | Page colours only | System, palette and form, e.g. `cobalt` → Thomas, blue, mirror. With no theme, the renderer's defaults | Preset, e.g. `jade` → gravitational |
| Timing | Nothing moves | Continuous | About 28 s to grow, 9 s at rest, a 1.6 s crossfade (`klee-field.js:22-24`) |
| Reader control in the embed | None. "Calmer" or "more vibrant" on a still passage is refused, because there is nothing to adjust | The only adjustable instrument: intensity 0.4 to 0.75, default 0.65 (`ATTRACTOR_VISUAL_MANIFEST`), through "more vibrant / make it calmer" | None |
| Reduced motion | — | Holds one still of the same field. An intensity change applies at once, without the 320 ms ease | Holds one finished composition and does not dissolve |
| Photosensitivity mode | — | Not read. It never flashes | Holds still |
| Flashing | Never | Never | Never. The change between compositions is a 1.6 s crossfade |
| Assistive technology | The text is the content | Canvas is `aria-hidden` | Canvas is `aria-hidden` |
| Needs | Nothing | A 2D canvas | A 2D canvas |

Every Current lowers to a continuous presentation, so none of the three ever reaches the photosensitivity notice or the flash path. See the embed safety record (`docs/experiments/EMBED-SAFETY-2026-10-05.md`, [SyberLabs/RISE#409](https://github.com/SyberLabs/RISE/pull/409)), which also covers what reaches the ChatGPT frame and what does not.

## Limits shared by all three

- One instrument per passage, chosen from a closed list. The instrument changes only at a passage boundary.
- One theme per answer. Whatever a passage says does not change the colours.
- At most 16 passages (`RISE_CURRENT_LIMITS`). The answer's visual rhythm is therefore coarse by design.
- The instrument says what a passage is *like*, as the model's guide puts it (`src/live/adapters/current-guide.js`). It is never evidence, and it never stands in for a word.

## Three explanations, three demands

| Fixture | Theme | still | attractor | genesis | Demand |
|---|---|---|---|---|---|
| `BLACK_HOLES_CURRENT` (`src/test/sealed-current.js`) | none (RISE ink) | 3 | 2 | 1 | Mixed: a still frame for each fact, motion for mergers and waves, growth for the first image |
| `FOREST_AFTER_FIRE` | `jade` | 3 | 0 | 3 | Contemplative: mostly still, growth where something grows, nothing that turns |
| `WEATHER_CHAOS` | `cobalt` | 1 | 5 | 0 | Dynamic: the attractor carries it, and only the limit it arrives at is still |

The tests check, for each: it is admitted by `validateRiseCurrent` and by the Worker's `rise_present`, it compiles to a continuous Session, and its demand matches the table. The two new ones are written the way the guide asks a model to write: a short first passage, a theme, no Dive notes (a Composer presentation offers no Dive) and no sources (a Current carries none). The black-hole Current keeps the Dive notes it has always carried. The validator still accepts them, and the embed does not show them.

## Neural, Flame and Gallery stay out

Neural is a specimen and score visual in the catalog with `current.supported: false` (`src/core/visual-catalog.js:71-80`). It is not in `RISE_CURRENT_VISUALS`, and the validator refuses it. Flame and Gallery are refused the same way. The fixture tests assert all three refusals. Admitting any of them is separate work, and each of these steps is an owner decision:

1. Change the sealed contract (`RISE_CURRENT_VISUALS` is pinned by FND-006, so this is a v2 Current or an explicit contract change).
2. Give it a fixed per-theme mapping beside `RISE_CURRENT_THEMES`.
3. Define its reduced-motion and photosensitivity behaviour, and test that it never flashes.
4. Add Worker admission tests and witness it in the embed on the exact release.

## For the Reader lane's engine catalog (B3)

When the engine catalog gains its `composer` flag, **its Composer view must equal `RISE_CURRENT_VISUALS`**: still, attractor and genesis, in that order and nothing else. The test runs in that direction, catalog checked against the Current constants and never the reverse ([Consolidated Reader §5](../product/CONSOLIDATED-READER.md)). A catalog that lists a fourth Composer engine fails the test. It does not widen what a model may send.

## Not decided here

- Whether the model's guide should say what each instrument is for, as the *Purpose* row does. Today it says only that `visual` "says what a segment is like". Changing it changes what host models are told, and it should be tried in a host session before it lands.
- Whether `still` should ever take a quiet field of its own. That would change the presentation, not the contract, and belongs with LIVE-004.
