/**
 * Software compositor for one render frame.
 *
 * Writes RGBA directly. Canvas 2D is not authority — jsdom cannot paint,
 * and live GPU paths are not reproducible.
 */

import { fail } from './errors.js';
import { presentationMs } from './clock.js';
import { RENDER_BACKGROUND, RENDER_TEXT_COLOR } from './layout.js';
import { atomAt, visualRunAt } from './plan.js';
import { kleeStrokes, rasterKlee } from './klee-adapter.js';
import { decodeImage, decodeVideoFrame } from './decode.js';
import { mapVideoSourceTime } from './video-time.js';
import { FONT_CELL, glyphColumns, wrapText } from './font.js';
import {
  DEFAULT_CAPTION_FONT_SIZE,
  captionTextRegion,
  parseCssColor,
  resolveCaptionStyle
} from './caption-style.js';

function fill(rgba, color) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = color.r;
    rgba[i + 1] = color.g;
    rgba[i + 2] = color.b;
    rgba[i + 3] = color.a;
  }
}

function blitCover(dest, dw, dh, src, sw, sh) {
  const scale = Math.max(dw / sw, dh / sh);
  const tw = sw * scale;
  const th = sh * scale;
  const ox = (dw - tw) / 2;
  const oy = (dh - th) / 2;
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.max(0, Math.floor((y - oy) / scale)));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.max(0, Math.floor((x - ox) / scale)));
      const di = (y * dw + x) * 4;
      const si = (sy * sw + sx) * 4;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = 255;
    }
  }
}

function drawGlyph(rgba, width, height, originX, originY, columns, color, pixel) {
  for (let col = 0; col < 5; col += 1) {
    const bits = columns[col];
    for (let row = 0; row < 7; row += 1) {
      if (((bits >> row) & 1) === 0) continue;
      for (let py = 0; py < pixel; py += 1) {
        for (let px = 0; px < pixel; px += 1) {
          const x = originX + col * pixel + px;
          const y = originY + row * pixel + py;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const i = (y * width + x) * 4;
          rgba[i] = color.r;
          rgba[i + 1] = color.g;
          rgba[i + 2] = color.b;
          rgba[i + 3] = 255;
        }
      }
    }
  }
}

function drawTextBlock(rgba, width, height, region, text, color, scale, edgeColor = null) {
  const pixel = Math.max(1, Math.round(2 * scale));
  const cellW = FONT_CELL.width * pixel;
  const cellH = FONT_CELL.height * pixel;
  const maxChars = Math.max(1, Math.floor(region.width / cellW));
  const maxLines = Math.max(1, Math.floor(region.height / cellH));
  const lines = wrapText(text, maxChars).slice(0, maxLines);
  if (wrapText(text, maxChars).length > maxLines) {
    fail('RENDER_TEXT_OVERFLOW',
      'A reading chunk does not fit the profile text region',
      '$.safeAreas.text',
      { text, maxChars, maxLines });
  }
  let y = region.y;
  for (const line of lines) {
    const lineWidth = line.length * cellW;
    let x = edgeColor
      ? region.x + Math.max(0, Math.round((region.width - lineWidth) / 2))
      : region.x;
    for (const character of line) {
      const columns = glyphColumns(character);
      if (edgeColor) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          drawGlyph(rgba, width, height, x + dx, y + dy, columns, edgeColor, pixel);
        }
      }
      drawGlyph(rgba, width, height, x, y, columns, color, pixel);
      x += cellW;
    }
    y += cellH;
  }
}

function assetsById(inventory) {
  const map = new Map();
  for (const asset of inventory?.assets || []) map.set(asset.assetId, asset);
  return map;
}

/**
 * Raster one frame into a new RGBA buffer sized to the job viewport * scale.
 */
export function renderFrameRgba(plan, frameIndex, { inventory = {}, scale = 1, caption } = {}) {
  const width = Math.max(1, Math.round(plan.viewport.width * scale));
  const height = Math.max(1, Math.round(plan.viewport.height * scale));
  const scaleX = width / plan.viewport.width;
  const scaleY = height / plan.viewport.height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  fill(rgba, RENDER_BACKGROUND);

  const timeMs = presentationMs(frameIndex, plan.frameRate);
  const run = visualRunAt(plan, timeMs);
  const assets = assetsById(inventory);

  if (run?.cueKind === 'visual:sourced:project-image' && run.assetId) {
    const decoded = decodeImage(assets.get(run.assetId));
    blitCover(rgba, width, height, decoded.rgba, decoded.width, decoded.height);
  } else if (run?.cueKind === 'visual:video' && run.video) {
    const sourceMs = mapVideoSourceTime({
      presentationMs: timeMs,
      ...run.video
    });
    if (sourceMs != null) {
      const decoded = decodeVideoFrame(assets.get(run.assetId), sourceMs);
      blitCover(rgba, width, height, decoded.rgba, decoded.width, decoded.height);
    }
  } else if (run?.cueKind === 'visual:procedural:klee') {
    const drawing = kleeStrokes({
      seed: plan.seed,
      width: plan.viewport.width,
      height: plan.viewport.height,
      preset: run.cue?.config?.preset || 'harmonic',
      timeMs
    });
    rasterKlee(rgba, width, height, drawing, scaleX, scaleY);
  }

  const atom = atomAt(plan, timeMs);
  if (atom?.text) {
    const style = resolveCaptionStyle(caption);
    if (style) {
      const region = captionTextRegion(width, height, style);
      drawTextBlock(
        rgba, width, height, region, atom.text,
        parseCssColor(style.color),
        scale * (style.fontSize / DEFAULT_CAPTION_FONT_SIZE),
        parseCssColor(style.edgeColor)
      );
    } else {
      const region = plan.safeAreas.text;
      drawTextBlock(rgba, width, height, {
        x: Math.round(region.x * scaleX),
        y: Math.round(region.y * scaleY),
        width: Math.round(region.width * scaleX),
        height: Math.round(region.height * scaleY)
      }, atom.text, RENDER_TEXT_COLOR, scale);
    }
  }

  return { width, height, rgba, timeMs, frameIndex };
}
