# The Feelings sounds are parked

Decided by the owner on 2026-10-09: "lets strip out all Feelings actually. we need to do a full improvement of them before bringing them back (tbd)."

The Feelings group held eleven soundscapes: wonder, mystery, triumph, chase, haunted, sad, angry, happy, excited, thrilling and scary. From this change nothing in RISE offers or names one. A reader cannot choose one, a look or Today cannot play one, a model cannot pick one, and a Current that names one is refused. Their synthesis code stays in the tree for the rework.

## What was removed

- **The sound list.** The Feelings group is gone from `SOUND_GROUPS` (`src/audio/sound-list.js`), so the Chamber's look sheet, the setup Sound panel and every other picker built on it offer four groups: Silence, Atmospheres, Music and Tones.
- **What a composition may name.** The ids are gone from `SOUND_IDS` (`src/audio/sound-ids.js`). That list is the source for both the v2 Current validator (`src/core/beats.js`) and the Worker's MCP input schema enum (`worker/mcp-server.mjs`). A beat that names one is refused with `BEAT_SOUND`.
- **What can be created.** `SOUNDSCAPES` (`src/audio/soundscapes.js`) no longer lists them, so `createSoundscape` returns null for them. The Workshop's soundscape picker and the Workshop agent's offered soundscapes (`src/core/curator-context.js`) read `SOUNDSCAPES`, so they lost them too.
- **What Jev and Kev may choose.** The eleven rows are gone from `src/content/decision-catalog.json` and the ids are gone from `JEV_AUDIO_IDS` (`src/core/jev-config.js`), so the menu a model chooses from no longer holds them. The code that forced `triumph` onto a "triumphant ending" (`requestsTriumphantEnding`, the `triumphant` alias and the instruction that named it) went with them.
- **The Composer guide.** Open Field taught `mystery` and used it in a worked Current. It now names `faded-signal` (`src/live/guide/styles/open-field.js`, and the same Current in `docs/evals/creative-control/open-field/a-thought-forming.json`).
- **Evaluation inputs.** The Kev evaluation cases and option files under `scripts/` expect each parked sound's stand-in. The arena's known-probability controls (`scripts/arena/controls.json`) name offered sounds in place of wonder, mystery, happy, sad and haunted.

## Substitutions

| Where | Was | Now |
| --- | --- | --- |
| Look **Flame** | wonder | aurora |
| Look **Iris** | triumph | starlight ("…under starlight") |
| Look **Revel** | chase | night-drive ("…and a night drive") |
| Today | Revel's chase on 2026-10-09; Iris's triumph on 2026-10-08 | night-drive; starlight |
| Portable example *Energetic* | thrilling, chase | night-drive, night-drive (new identity `portable-ccde7f0ab9c4b4d09fa07528789680b7`) |
| Open Field worked Current | mystery | faded-signal |

A saved reading, a saved setup preference or a saved Workshop project that names a parked sound plays its stand-in (`PARKED_SOUNDS` and `standInSound` in `src/audio/sound-ids.js`). The fallback is applied where those are read: the `Session` model, the setup preferences (`ChamberOrbital`) and the Workshop project's defaults.

| Parked | Stand-in |
| --- | --- |
| wonder | aurora |
| mystery | faded-signal |
| triumph | starlight |
| chase | night-drive |
| haunted | faded-signal |
| sad | faded-signal |
| angry | night-drive |
| happy | starlight |
| excited | night-drive |
| thrilling | night-drive |
| scary | aurora |

## Where the parked code lives

- `src/audio/cinematic-pieces.js`: wonder, mystery, chase, triumph and haunted (`CINEMATIC_SOUNDSCAPES`, beside Starlight, which stays offered).
- `src/audio/soundscapes.js`: the six mood beds (`MOOD_BEDS`: sad, angry, happy, excited, thrilling, scary). All eleven are reachable for the rework as `PARKED_SOUNDSCAPES`, which nothing in the app reads.
- `src/core/render/audio-mix.js` and `src/core/render/cinematic-piece-sample.js`: their offline beds for export, kept and still tested.

## The Decision Arena's first run

The committed arena run (`public/content/arena/run-1c8b7b636f83.json`) was captured against the old catalog, cases, options and controls. Its integrity tests re-scored it against whatever those files held at the current commit, so any change to the sound catalog would have failed them. The inputs it was captured with are now pinned in `scripts/arena/inputs/1c8b7b636f83/`, each checked against the hash the run recorded, and `arena.mjs report` takes `--catalog`. The run still reproduces its recorded scores byte for byte.

## Bringing them back

They come back only after:

1. a quality rework of each sound, and
2. an owner listening pass that accepts it.

Returning a sound means listing its id again in `SOUND_IDS`, `SOUND_GROUPS`, `JEV_AUDIO_IDS` and the decision catalog, moving it out of `PARKED_SOUNDS`, and deciding whether the looks above go back to it.
