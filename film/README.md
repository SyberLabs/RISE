# film/ — "RISE: Through the Vortex"

A four-minute YouTube film: an animated prologue through a vortex, a phoenix,
SyberLabs, Mateo Robles; then the real pitch; then RISE itself.

| File | What it is |
|------|------------|
| `SCREENPLAY.md` | The film shot by shot, with the Runway prompt for every animated shot and the recording brief for the real pitch |
| `MUSIC-AND-SOUND.md` | The Suno prompts and lyrics, the marks the song must turn on, voice-over, loudness |
| `YOUTUBE.md` | Title, description, chapters, tags, thumbnail |
| `edl.json` | The timed edit: every shot, its source, duration, in-point, lower thirds |
| `scripts/record.mjs` | Records RISE's own surfaces from the production build (Wormhole, Home, Keystones, the Chamber, the Page, Visual Lab) and renders title cards, slates and lower thirds |
| `scripts/attractor.mjs` | Renders the attractor vortex through RISE's offline Chamber stage, frame-accurate |
| `scripts/assemble.mjs` | Cuts the film with ffmpeg from `edl.json`; mixes, ducks and loudness-normalises the sound; writes a contact sheet and YouTube chapters |

Generated output lives in `film/out/` and is not committed. Neither are the
clips you add: `film/runway/`, `film/supplied/`, `film/music/`, `film/voice/`.

## Make the cut

```sh
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4318 &
node film/scripts/record.mjs          # ~3 min: six scenes + cards
node film/scripts/attractor.mjs 12 prism film/out/raw/attractor-prism.mp4 0.5   # ~1 min
node film/scripts/assemble.mjs        # ~1 min: film/out/review-cut.mp4
node film/scripts/assemble.mjs --master   # the YouTube upload, slower encode
```

On the Claude Code cloud image, Playwright is newer than the pinned
Chromium; `record.mjs` reads `PLAYWRIGHT_BROWSERS_PATH/chromium` for that
reason. On a machine with its own Playwright browsers nothing is needed.

## What is done, what is not

**Done here (2026-10-05):** the screenplay and every Runway prompt; the
Suno brief; the edit; the recording and render pipeline; six real RISE
scenes recorded from the production build; the attractor vortex rendered
through RISE's own stage; the cards, slates and lower thirds; a full-length
review cut with slates where the generated and supplied shots go.

**Not possible from the cloud session, and why:**

1. **Runway.** The session's network policy denies `app.runwayml.com` and
   `api.dev.runwayml.com`, and the Claude in Chrome extension is not
   attached to a cloud session. Thirteen clips are specified in
   `SCREENPLAY.md` §5. Generate them, save them under `film/runway/` with
   the listed names, re-run `assemble.mjs`.
2. **Suno.** `suno.com` is denied the same way. The prompt is in
   `MUSIC-AND-SOUND.md`. Save the track as
   `film/music/through-the-vortex.mp3`. The existing **RISE UP** song in
   Drive works too; §3 of that file says how.
3. **The real pitch.** No footage of Syko pitching SyberLabs and RISE exists
   in the repository, Drive or Gmail. Record it to the brief in
   `SCREENPLAY.md` Act 4 and drop it at `film/supplied/syko-pitch.mp4`.

To let a cloud session do steps 1 and 2 itself: in the environment's
settings, allow `app.runwayml.com`, `api.dev.runwayml.com` and `suno.com`
under network access, and add a Runway API key as the `RUNWAYML_API_SECRET`
environment variable (never paste it into chat). Suno has no public API, so
it still needs a browser: a Claude Desktop or Remote Control session on your
own computer, where the Chrome extension is available.

## Review

`film/out/review-cut.mp4` is the full four minutes. `film/out/review-sheet.png`
is one frame every eight seconds. `film/out/chapters.txt` is the YouTube
chapter list.
