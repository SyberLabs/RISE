/**
 * Deterministic 24-bit BMP encoding for posters and thumbnails.
 * Uncompressed, little-endian, bottom-up. No encoder metadata.
 */

export function encodeBmp(rgba, width, height) {
  const stride = (width * 3 + 3) & ~3;
  const pixelBytes = stride * height;
  const fileSize = 14 + 40 + pixelBytes;
  const bytes = new Uint8Array(fileSize);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelBytes, true);
  for (let y = 0; y < height; y += 1) {
    const srcY = height - 1 - y;
    let offset = 54 + y * stride;
    for (let x = 0; x < width; x += 1) {
      const i = (srcY * width + x) * 4;
      bytes[offset] = rgba[i + 2];
      bytes[offset + 1] = rgba[i + 1];
      bytes[offset + 2] = rgba[i];
      offset += 3;
    }
  }
  return bytes;
}

export function scaleRgba(rgba, width, height, destWidth, destHeight) {
  const out = new Uint8ClampedArray(destWidth * destHeight * 4);
  for (let y = 0; y < destHeight; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y * height) / destHeight));
    for (let x = 0; x < destWidth; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x * width) / destWidth));
      const di = (y * destWidth + x) * 4;
      const si = (sy * width + sx) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = 255;
    }
  }
  return out;
}

export function thumbnailSize(width, height, maxEdge = 320) {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
