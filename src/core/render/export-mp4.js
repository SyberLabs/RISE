/**
 * Render a plan to a local MP4. Node-only encoder adapter.
 *
 * mixAudio receives inventory so spoken narration uses assigned PCM /
 * library recitation bytes — the same mix as driver and distribution.
 */

import { fail } from './errors.js';
import { frameIndexAt } from './clock.js';
import { compileRenderPlan } from './plan.js';
import { renderFrameRgba } from './raster.js';
import { mixAudio } from './audio-mix.js';
import { RENDER_SAMPLE_RATE } from './layout.js';
import { encodeMp4 } from './encode-mp4.js';

function frameWindow(plan, fromMs, toMs) {
  const start = fromMs ? frameIndexAt(fromMs, plan.frameRate) : 0;
  const end = toMs == null
    ? plan.frameCount
    : Math.min(plan.frameCount, frameIndexAt(toMs, plan.frameRate));
  if (end <= start) {
    fail('RENDER_ENCODE_FRAMES', 'MP4 range must contain at least one frame', '$.fromMs');
  }
  return { start, end };
}

export async function exportRenderMp4({
  plan = null,
  job = null,
  program = null,
  sources = null,
  inventory = {},
  sessionInput = null,
  outputPath,
  scale = 1,
  sampleRate = RENDER_SAMPLE_RATE,
  ffmpegPath = null,
  painter = 'chamber',
  fromMs = 0,
  toMs = null,
  audio = null
} = {}) {
  if (!outputPath) fail('RENDER_ENCODE_PATH', 'exportRenderMp4 needs an output path', '$.outputPath');
  const compiled = plan || compileRenderPlan({
    job,
    program,
    sources,
    inventory,
    sessionInput
  });
  const mixed = audio || mixAudio(compiled, { sampleRate, inventory, fromMs, toMs });
  const { start, end } = frameWindow(compiled, fromMs, toMs);

  if (painter === 'clerk') {
    return encodeMp4({
      frameRate: compiled.frameRate,
      audio: mixed,
      outputPath,
      ffmpegPath,
      frames: async (index) => {
        const frameIndex = start + index;
        if (frameIndex >= end) return null;
        return renderFrameRgba(compiled, frameIndex, { inventory, scale });
      }
    });
  }

  const { openChamberPainter } = await import('./chamber-paint.js');
  const stage = await openChamberPainter({ plan: compiled, scale, inventory });
  try {
    return await encodeMp4({
      frameRate: compiled.frameRate,
      audio: mixed,
      outputPath,
      ffmpegPath,
      frames: async (index) => {
        const frameIndex = start + index;
        if (frameIndex >= end) return null;
        return stage.capture(frameIndex);
      }
    });
  } finally {
    await stage.close();
  }
}
