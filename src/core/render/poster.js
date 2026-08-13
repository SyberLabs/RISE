/**
 * Poster and thumbnail from one decoded frame.
 * BMP so the bytes are a real image without encoder metadata.
 */

import { frameIndexAt } from './clock.js';
import { renderFrameRgba } from './raster.js';
import { encodeBmp, scaleRgba, thumbnailSize } from './bmp.js';
import { sha256Hex } from './hash.js';

export function posterFrameIndex(plan) {
  const atom = plan.atoms.find(item => String(item.text || '').trim());
  const ms = atom ? atom.startMs : 0;
  return Math.min(plan.frameCount - 1, Math.max(0, frameIndexAt(ms, plan.frameRate)));
}

export async function renderPoster(plan, {
  inventory = {},
  scale = 0.25,
  thumbnailMaxEdge = 160,
  frameIndex = null
} = {}) {
  const index = frameIndex == null ? posterFrameIndex(plan) : frameIndex;
  const frame = renderFrameRgba(plan, index, { inventory, scale });
  const posterBytes = encodeBmp(frame.rgba, frame.width, frame.height);
  const thumb = thumbnailSize(frame.width, frame.height, thumbnailMaxEdge);
  const thumbRgba = scaleRgba(frame.rgba, frame.width, frame.height, thumb.width, thumb.height);
  const thumbnailBytes = encodeBmp(thumbRgba, thumb.width, thumb.height);
  return Object.freeze({
    frameIndex: index,
    width: frame.width,
    height: frame.height,
    posterBytes,
    thumbnailBytes,
    posterHash: `sha256:${await sha256Hex(posterBytes)}`,
    thumbnailHash: `sha256:${await sha256Hex(thumbnailBytes)}`
  });
}
