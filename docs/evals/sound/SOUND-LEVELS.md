# The levelled sound catalogue

Every sound RISE offers (the atmospheres, the music and the tones in `SOUND_GROUPS`, `src/audio/sound-list.js`) plays at one loudness: **−29 dBFS RMS, ±2 dB**, measured at the output of the real audio engine at its default levels (soundscape layer 0.85, master 0.7). Before SND-001 the catalogue spanned 42 dB, from the music at about −53 dBFS to the Gateway tone at about −11.5 dBFS, so choosing a sound also chose a volume.

Each sound reaches the band by a trim in dB, `SOUND_TRIM_DB` in `src/audio/sound-levels.js`. The engine multiplies a layer's gain by the trim of the sound it is playing, so a reader's own volume and the voice ducking work from the trimmed level. Sounds that are not offered (a personal bed, a chant bed, the parked Feelings sounds) have no trim.

## The manifest

`levels.json` is the last measurement:

- `measuredAt`: when it was taken.
- `settings`: the engine's levels, its fade-in, the sample rate, and the window measured: 25 seconds from 3 seconds after the start, past the 2-second fade-in.
- `band`: the target and its tolerance, the same as `LEVEL_BAND` in `sound-levels.js`.
- `sounds`: for each offered sound, its `trimDb` and the measured `rmsDbfs` and `peakDbfs`.

`src/audio/sound-levels.test.js` holds the manifest to the code: every offered sound has a trim and nothing else does, each entry was measured with the trim the code ships, and each sits inside the band. A sound that changes level fails the build once it is measured again.

## Measuring again

After changing a sound, or the engine's gain stages:

```sh
node scripts/measure-sound-levels.mjs            # every sound; writes levels.json
node scripts/measure-sound-levels.mjs piano jazz # only these; prints, writes nothing
```

The script starts a Vite dev server, opens headless Chromium with Playwright, starts each sound the way the Chamber does on a fresh engine, and records the engine's last node through an AudioWorklet in real time, three sounds at once (about two and a half minutes for all sixteen). It prints a table with the trim each sound would need to sit at the centre of the band. Copy those trims into `SOUND_TRIM_DB`, measure again, and commit the manifest once every sound is in band. It is a development tool and does not run in CI.
