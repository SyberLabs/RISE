# B2b: page chrome follows the reading's theme — 2026-10-07

The third line of FND-008 and Q6 of the [Consolidated Reader decisions](2026-10-05-consolidated-reader-decisions.md): "The nine themes are the only colours a reader or a model sees. The Settings accent is removed and page chrome follows the reading's theme." [B2a](2026-10-05-one-colour-vocabulary-design.md) did the engine side; this is the rest.

## What was decided

| Question | Answer | Why |
|---|---|---|
| What goes | The Settings Accent row (four offered colourways of eleven), the stored `chamberAccent` and `chamberAccentNamed`, `src/core/chamber-accent.js`, the ten `:root[data-accent]` blocks, `public/accent-boot.js` with its `<head>` tag and cache rule, the Chamber's "Accent did not take." report | A second colour vocabulary beside the nine themes; nothing else read it |
| What a reading with a theme does to the page | While it is on screen, `<html>` takes the theme's accent (`--color-accent`, its RGB, `--color-threshold`); when it goes, the root returns to its ground state | So what is drawn outside the Chamber in a reading (Settings opened mid-reading, anything on the body) is in the reading's colours |
| What a reading without one does | Nothing: the ground state, Home's slate and ivory | B2a gave untitled readings no default theme; the default look's colour arrives with the looks |
| Home and the rooms | The ground state, always | The chrome follows *a reading*; Home has none on screen |
| Under a host (the ChatGPT card) | The Chamber does not touch the root | The host's frame paints its own theme on the root (`LiveHost.paintEmbedTheme`) |
| One reading replacing another | The root belongs to the reading that painted it last; the outgoing one, torn down after, cannot clear it | The router mounts the next Chamber before the last is disposed |
| The ink on an accent fill | Unchanged (`--color-on-accent`, dark) | Every theme accent holds it at 6.6:1 or better; a test holds that for any future theme |
| A reader who had chosen a colourway | It is dropped on the next load; nothing is migrated | There is nothing to map eleven sittings onto that the reader chose; their reading's theme now colours the page |

## Where it lives

`src/core/chrome-theme.js` (paint and clear, one owner), called from `Chamber.applySessionColors` and `Chamber.destroy`. Tests: `src/core/chrome-theme.test.js`, `Chamber.settings-door.test.js` "the page chrome follows the reading's theme", `app.safety.test.js` "keeps no accent of the reader's own", `Settings.test.js` "offers no accent". Rendered: a cobalt reading begun from Home sets the root's accent to the Chamber's (`#58B8FF`); Home's root is unpainted.

Not in this change, and RDR-026's: the "Show imagery through words" toggle and the ambient drone.
