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
| `prologue/scenes.js` | The animated prologue drawn in code: paper-cut silhouettes, pages, letters and light, one function of time per shot, plus the pitch as words arriving in time |
| `scripts/animatic.mjs` | Paints `prologue/scenes.js` frame by frame through Chromium's canvas into `film/out/raw/anim-<id>.mp4` |
| `scripts/synth.mjs` | Composes and renders the score in Node (a small deterministic synthesiser) to `film/music/through-the-vortex.wav` |
| `scripts/assemble.mjs` | Cuts the film with ffmpeg from `edl.json`; mixes, ducks and loudness-normalises the sound; writes a contact sheet and YouTube chapters |

Every shot has a ladder: the real clip (`clip`) when it exists, else the
drawn animatic (`fallback`), else a slate. The film is complete at every
rung; adding a Runway clip or the pitch footage only replaces a rung.

Generated output lives in `film/out/` and is not committed. Neither are the
clips you add: `film/runway/`, `film/supplied/`, `film/music/`, `film/voice/`.

## Make the cut

```sh
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4318 &
node film/scripts/record.mjs          # ~3 min: six scenes + cards
node film/scripts/attractor.mjs 12 prism film/out/raw/attractor-prism.mp4 0.5   # ~1 min
node film/scripts/animatic.mjs        # ~35 min: the twelve drawn shots
node film/scripts/synth.mjs           # ~30 s: the score
node film/scripts/assemble.mjs        # ~1 min: film/out/review-cut.mp4
node film/scripts/assemble.mjs --master   # the YouTube upload, slower encode
```

On the Claude Code cloud image, Playwright is newer than the pinned
Chromium; `record.mjs` reads `PLAYWRIGHT_BROWSERS_PATH/chromium` for that
reason. On a machine with its own Playwright browsers nothing is needed.

## What is done, what is not

**Done here (2026-10-05/06):** the screenplay and every Runway prompt; the
Suno brief; the edit; the recording and render pipeline; six real RISE
scenes recorded from the production build; the attractor vortex rendered
through RISE's own stage; the cards, slates and lower thirds; the twelve
prologue shots drawn in code and rendered; the pitch as words arriving in
time; a composed and rendered score; a complete four-minute cut with no
slates.

**What a Runway and Suno pass would replace:** the twelve drawn shots
(`film/runway/`) and the composed score (`film/music/`). Both are
upgrades, not gaps.

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

Two other routes were tried and closed. Figma's image generation works from
a cloud session, but its result URLs are on `figma.com`, which the network
policy also denies, so the still cannot be brought into the cut. Figma's
Weave model runner (which can drive video models) needs the Figma account
linked to Weave first, at app.weavy.ai, under profile settings; once linked
a session can quote and, with your approval of the credit cost, run a video
model per shot.

## Review

`film/out/review-cut.mp4` is the full four minutes. `film/out/review-sheet.png`
is one frame every eight seconds. `film/out/chapters.txt` is the YouTube
chapter list.
