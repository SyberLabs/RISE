#!/usr/bin/env node
/**
 * Render a RISE composition to MP4.
 *
 *   node scripts/render-composition.mjs
 *   node scripts/render-composition.mjs --preview        (six stills, no mux)
 *   node scripts/render-composition.mjs --audit          (candidate plates)
 *   node scripts/render-composition.mjs --out out/compositions
 *
 * A composition is not a reading, so this does not go through the render
 * kernel. It shares the browser host, the clock and the encoder, which is
 * everything the two paths genuinely have in common.
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mixAudio } from '../src/core/render/audio-mix.js';
import { encodeMp4 } from '../src/core/render/encode-mp4.js';
import { openCompositionPainter } from '../src/core/render/composition-paint.js';
import { GARDEN_SCORE } from '../src/content/compositions/garden.js';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';

installContentPlaneFetch();

const ROOT = dirname(fileURLToPath(import.meta.url));
const SCORES = { garden: GARDEN_SCORE };
const PREVIEW_STOPS = [0.06, 0.24, 0.42, 0.58, 0.76, 0.99];
const MAX_BITRATE_KBPS = 10_000;

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  if (next == null || next.startsWith('--')) return true;
  return next;
}

const scoreId = String(arg('--id', 'garden'));
const preview = Boolean(arg('--preview', false));
const audit = Boolean(arg('--audit', false));
const AUDIT_PALETTES = ['verdant', 'teal', 'iris', 'peacock', 'lilac', 'reliquary'];
const AUDIT_VARIANTS = 5;
const outRoot = resolve(arg('--out', join(ROOT, '..', 'out', 'compositions')));

/**
 * The bed is the only thing a composition borrows from the score model:
 * `mixAudio` needs runs and a duration, and nothing more. The score also
 * places Aurora's halo, so the swell arrives and leaves inside the piece
 * rather than being cut off by its end.
 */
function audioPlanFor(score) {
  return {
    durationMs: score.durationMs,
    loudnessLufs: null,
    audioRuns: [{
      cueId: 'bed',
      cueKind: 'audio:soundscape',
      cue: { kind: 'soundscape', soundscapeId: score.soundscape, halo: score.halo },
      fromMs: 0,
      toMs: score.durationMs,
      fadeMs: 1_600,
      gain: 1
    }],
    narrationRuns: []
  };
}

async function main() {
  const score = SCORES[scoreId];
  if (!score) {
    console.error(`Unknown composition: ${scoreId}. Known: ${Object.keys(SCORES).join(', ')}`);
    process.exit(1);
  }
  mkdirSync(outRoot, { recursive: true });

  const painter = await openCompositionPainter({ score });
  try {
    if (audit) {
      const png = await painter.auditPng(AUDIT_PALETTES, AUDIT_VARIANTS);
      const path = join(outRoot, `${score.id}-plate-audit.png`);
      writeFileSync(path, png);
      console.log(`  ${AUDIT_PALETTES.length}×${AUDIT_VARIANTS} candidate plates → ${path}`);
      return;
    }

    if (preview) {
      for (const stop of PREVIEW_STOPS) {
        const ms = Math.round(score.durationMs * stop);
        const png = await painter.capturePngAt(ms);
        const path = join(outRoot, `${score.id}-preview-${String(ms).padStart(5, '0')}ms.png`);
        writeFileSync(path, png);
        console.log(`  ${path}`);
      }
      console.log(`\n${PREVIEW_STOPS.length} stills · ${outRoot}`);
      return;
    }

    const outputPath = join(outRoot, `${score.id}.mp4`);
    const audio = mixAudio(audioPlanFor(score));
    console.log(`Muxing ${score.title} · ${painter.frameCount} frames → ${outputPath}`);
    await encodeMp4({
      frameRate: score.frameRate,
      audio,
      outputPath,
      maxBitrateKbps: MAX_BITRATE_KBPS,
      frames: (index) => painter.capture(index)
    });
    const manifest = {
      out: outRoot,
      id: score.id,
      title: score.title,
      seed: score.seed,
      durationMs: score.durationMs,
      frames: painter.frameCount,
      blossoms: score.blossoms.length,
      soundscape: score.soundscape,
      bytes: statSync(outputPath).size,
      path: outputPath
    };
    writeFileSync(join(outRoot, `${score.id}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`\n${score.title} · ${(manifest.bytes / 1048576).toFixed(1)} MB · ${outputPath}`);
  } finally {
    await painter.close();
  }
}

await main();
