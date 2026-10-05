#!/usr/bin/env node
/**
 * Render the attractor vortex through RISE's own offline Chamber stage.
 *
 *   node film/scripts/attractor.mjs [seconds=10] [theme=amethyst] [out]
 *
 * This is the same painter the app's MP4 export uses: one Chromium page
 * painted at an explicit clock, frame by frame, never a screen recording.
 * The attractor system, palette and form come from RISE_CURRENT_THEMES so
 * the vortex is literally a themed reading's field.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChamberPainter } from '../../src/core/render/chamber-paint.js';
import { encodeMp4 } from '../../src/core/render/encode-mp4.js';
import { RISE_CURRENT_THEMES } from '../../src/core/rise-current.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const [secondsArg = '10', theme = 'amethyst', outArg, scaleArg = '1'] = process.argv.slice(2);
const seconds = Math.max(1, Number(secondsArg) || 10);
const outputPath = resolve(outArg || join(HERE, '..', 'out', 'raw', 'attractor.mp4'));
// A smaller stage, upscaled in the cut, draws the one-pixel filament thicker
// and brighter relative to the frame; 1 paints at full 1080p.
const scale = Math.min(1, Math.max(0.25, Number(scaleArg) || 1));

const attractor = RISE_CURRENT_THEMES[theme]?.attractor;
if (!attractor) {
  console.error(`unknown theme ${theme}; one of ${Object.keys(RISE_CURRENT_THEMES).join(', ')}`);
  process.exit(1);
}

const frameRate = { numerator: 24, denominator: 1 };
const frameCount = Math.round(seconds * 24);
const durationMs = Math.round(seconds * 1000);
const plan = {
  seed: `film:${theme}`,
  viewport: { width: Math.round(1920 * scale), height: Math.round(1080 * scale) },
  frameRate,
  frameCount,
  atoms: [],
  audioRuns: [],
  visualRuns: [{
    cueKind: 'visual:field:attractor',
    cue: { kind: 'attractor', config: { ...attractor } },
    fromMs: 0,
    toMs: durationMs
  }]
};

// Silent stereo bed; the film's music is laid in the assembler.
const sampleRate = 48_000;
const audio = { pcm: new Float32Array(Math.round(seconds * sampleRate) * 2), sampleRate, channels: 2 };

const stage = await openChamberPainter({ plan, scale: 1, ffmpegLog: () => {} });
try {
  const started = Date.now();
  const result = await encodeMp4({
    frameRate,
    audio,
    outputPath,
    frames: async index => {
      if (index >= frameCount) return null;
      if (index % 48 === 0) console.log(`attractor ${theme}: frame ${index}/${frameCount}`);
      return stage.capture(index);
    }
  });
  console.log(`${result.path}: ${result.frameCount} frames, ${(result.durationMs / 1000).toFixed(1)} s, ${((Date.now() - started) / 1000).toFixed(0)} s to render`);
} finally {
  await stage.close();
}
