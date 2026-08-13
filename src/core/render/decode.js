/**
 * Hash-derived deterministic decoders for admitted image/video bytes.
 *
 * Phase 1 does not ship a pinned PNG/H.264 decoder. Inventory may supply
 * explicit rgba/width/height; otherwise the content hash paints a stable
 * field so mapping and compositing can be tested without a codec.
 */

function hexByte(hash, offset) {
  const hex = String(hash || '').replace(/^sha256:/, '');
  const slice = hex.slice(offset % Math.max(1, hex.length), (offset % Math.max(1, hex.length)) + 2);
  return Number.parseInt(slice.padEnd(2, '0'), 16) || 0;
}

export function decodeImage(asset) {
  if (asset?.rgba && asset.width && asset.height) {
    return {
      width: asset.width,
      height: asset.height,
      rgba: asset.rgba
    };
  }
  const width = 16;
  const height = 16;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const r = hexByte(asset?.contentHash, 0);
  const g = hexByte(asset?.contentHash, 2);
  const b = hexByte(asset?.contentHash, 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = (b + x * 3 + y) & 255;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}

export function decodeVideoFrame(asset, sourceTimeMs) {
  if (typeof asset?.decodeFrame === 'function') {
    return asset.decodeFrame(sourceTimeMs);
  }
  const width = 16;
  const height = 16;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const t = Math.max(0, sourceTimeMs | 0);
  const r = hexByte(asset?.contentHash, 0);
  const g = (hexByte(asset?.contentHash, 2) + (t >> 4)) & 255;
  const b = (t * 3) & 255;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = (b + x + y) & 255;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba, sourceTimeMs: t };
}
