# RISE: Symbolic Reading Environment

RISE is an immersive browser-based reading interface for focused, audiovisual text exploration. It combines rapid serial visual presentation, configurable pacing, procedural visual modes, and a Web Audio atmosphere engine into a single client-side experience.

Live demo: https://rise-v2-symbolic-experience.netlify.app/

## What It Is

RISE is a front-end systems project, not a medical or therapeutic device. It explores how interface design, pacing, audio, local file handling, and generative visuals can make dense texts easier to enter and inhabit.

The application runs entirely in the browser. User-uploaded text files are processed locally and are not sent to a backend.

## Core Features

- Orbital setup interface for configuring a reading session.
- Chamber view for RSVP-style text playback.
- Pacing curves for induction, arousal, wave, climax, and flat reading modes.
- Web Audio atmosphere engine with careful gain ramping and silent-exit handling.
- Procedural visual modes inspired by geometric, atmospheric, and generative art systems, including a persistent strange-attractor field (Aizawa, Thomas, Halvorsen).
- Time-aware SOL menu with a live solar dial, suggesting sequences aligned with the hour of day.
- Local file upload for `.txt` and `.md` documents.
- Library of public/curated source material and modular starter sequences.
- Netlify-ready Vite deployment.

## Repository Structure

```text
src/
  audio/          Web Audio engine and session sound handling
  components/     Portal, Library, Chamber, Workshop, orbital controls
  content/        curated starter sequences and public text registry
  core/           pacing, chunking, player, sequencing, memory helpers
  sources/        text/visual source providers and caches
  visuals/        procedural visual systems

public/
  audio/          public demo audio assets
  *.mp4           public visual/demo assets

content/
  sample source text for local testing
```

## Run Locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

## Public Release Boundaries

This public package intentionally excludes:

- `node_modules/`,
- `dist/`,
- `.netlify/`,
- private local text caches,
- private ingestion scripts,
- unpublished working notes.

The live app supports user-provided local files, but this repository does not ship private reading material.

## Safety Notes

RISE includes animated visuals and audio. It should be used with ordinary caution by people sensitive to flashing visuals, intense motion, or layered sound. The project is an experimental interface and makes no medical, therapeutic, or cognitive-performance claims.

## Portfolio Framing

RISE is best presented as a polished creative-technology artifact: a shipped browser experience that combines interaction design, frontend architecture, procedural media, audio systems, local-file workflows, and careful UX safety boundaries.
