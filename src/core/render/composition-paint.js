/**
 * Node-only Composition painter.
 *
 * Opens the composition stage once and captures one frame per index at
 * explicit presentation time. Duration is the score; how long the bake
 * takes changes nothing about the movie.
 */

import { fail } from './errors.js';
import { openStageHost } from './stage-host.js';

const STAGE_PATH = '/src/core/render/composition-stage.html';

function decodeFrame(frame) {
  return {
    width: frame.width,
    height: frame.height,
    rgba: Buffer.from(frame.rgba, 'base64')
  };
}

export async function openCompositionPainter({ score, log = console.log } = {}) {
  if (!score) fail('RENDER_COMPOSITION_SCORE', 'Composition paint needs a score', '$.score');
  const { width, height } = score.viewport;
  const { page, close } = await openStageHost({
    stagePath: STAGE_PATH,
    cssWidth: width,
    cssHeight: height,
    dpr: 1,
    subject: 'Composition stage',
    codePrefix: 'RENDER_COMPOSITION'
  });

  try {
    log(`Composition stage ${width}×${height} · ${score.id} · baking…`);
    const baked = await page.evaluate(async (args) => {
      await window.__stage.prepare(args);
      return {
        blossoms: window.__stage.blossoms?.length ?? 0,
        face: document.fonts.check('400 200px Marcellus')
      };
    }, { width, height });
    log(`  ${baked.blossoms} blossoms baked${baked.face ? '' : ' (Marcellus missing — falling back)'}`);
  } catch (error) {
    await close();
    fail('RENDER_COMPOSITION_BAKE',
      'The composition stage failed to bake',
      '$.stage',
      { reason: error.message });
  }

  const fps = score.frameRate.numerator / score.frameRate.denominator;
  const frameCount = Math.round((score.durationMs / 1000) * fps);

  return {
    frameCount,
    frameRate: score.frameRate,
    durationMs: score.durationMs,
    async capture(index) {
      if (index >= frameCount) return null;
      // Presentation time, not wall time: the same index always yields the
      // same frame however long the machine took to get here.
      const elapsedMs = (index * 1000) / fps;
      const frame = await page.evaluate(async (ms) => {
        window.__stage.paint({ elapsedMs: ms });
        return window.__stage.captureRgba();
      }, elapsedMs);
      return decodeFrame(frame);
    },
    async auditPng(palettes, variants) {
      const dataUrl = await page.evaluate(async (args) => {
        await window.__stage.auditPlates(args.palettes, args.variants);
        return window.__stage.capturePng();
      }, { palettes, variants });
      return Buffer.from(String(dataUrl).split(',')[1], 'base64');
    },
    async capturePngAt(elapsedMs) {
      const dataUrl = await page.evaluate(async (ms) => {
        window.__stage.paint({ elapsedMs: ms });
        return window.__stage.capturePng();
      }, elapsedMs);
      return Buffer.from(String(dataUrl).split(',')[1], 'base64');
    },
    close
  };
}
