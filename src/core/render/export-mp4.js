/**
 * Render a plan to a local MP4. Node-only encoder adapter.
 */

import { fail } from './errors.js';
import { compileRenderPlan } from './plan.js';
import { renderFrameRgba } from './raster.js';
import { mixAudio } from './audio-mix.js';
import { RENDER_SAMPLE_RATE } from './layout.js';
import { encodeMp4 } from './encode-mp4.js';
import { openChamberPainter } from './chamber-paint.js';

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
  painter = 'chamber'
} = {}) {
  if (!outputPath) fail('RENDER_ENCODE_PATH', 'exportRenderMp4 needs an output path', '$.outputPath');
  const compiled = plan || compileRenderPlan({
    job,
    program,
    sources,
    inventory,
    sessionInput
  });
  const audio = mixAudio(compiled, { sampleRate });
  if (painter === 'clerk') {
    return encodeMp4({
      frameRate: compiled.frameRate,
      audio,
      outputPath,
      ffmpegPath,
      frames: async (index) => {
        if (index >= compiled.frameCount) return null;
        return renderFrameRgba(compiled, index, { inventory, scale });
      }
    });
  }

  const stage = await openChamberPainter({ plan: compiled, scale, inventory });
  try {
    return await encodeMp4({
      frameRate: compiled.frameRate,
      audio,
      outputPath,
      ffmpegPath,
      frames: async (index) => {
        if (index >= compiled.frameCount) return null;
        return stage.capture(index);
      }
    });
  } finally {
    await stage.close();
  }
}
