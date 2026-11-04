/**
 * Render a plan to a local MP4. Node-only encoder adapter.
 *
 * mixAudio receives inventory so spoken narration uses assigned PCM /
 * library recitation bytes — the same mix as driver and distribution.
 */

import { fail } from '../../src/core/render/errors.js';
import { frameIndexAt } from '../../src/core/render/clock.js';
import { renderFrameRgba } from '../../src/core/render/raster.js';
import { mixAudio } from '../../src/core/render/audio-mix.js';
import { RENDER_SAMPLE_RATE } from '../../src/core/render/layout.js';
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
  plan,
  inventory = {},
  outputPath,
  scale = 1,
  sampleRate = RENDER_SAMPLE_RATE,
  ffmpegPath = null,
  painter = 'chamber',
  fromMs = 0,
  toMs = null,
  audio = null,
  caption,
  // HOW A PLATE MOVES. `openChamberPainter` has always taken these; nothing
  // reached them, so every rendered plate ran on the defaults - a 6% drift
  // over the whole run, which is roughly a twentieth of a pixel per frame
  // and rounds away to nothing in 8-bit video.
  motion = null
} = {}) {
  if (!outputPath) fail('RENDER_ENCODE_PATH', 'exportRenderMp4 needs an output path', '$.outputPath');
  const mixed = audio || mixAudio(plan, { sampleRate, inventory, fromMs, toMs });
  const { start, end } = frameWindow(plan, fromMs, toMs);

  if (painter === 'clerk') {
    return encodeMp4({
      frameRate: plan.frameRate,
      audio: mixed,
      outputPath,
      ffmpegPath,
      frames: async (index) => {
        const frameIndex = start + index;
        if (frameIndex >= end) return null;
        return renderFrameRgba(plan, frameIndex, { inventory, scale, caption });
      }
    });
  }

  const { openChamberPainter } = await import('./chamber-paint.js');
  const stage = await openChamberPainter({ plan, scale, inventory, caption, ...(motion || {}) });
  try {
    return await encodeMp4({
      frameRate: plan.frameRate,
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
