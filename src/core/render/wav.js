/**
 * PCM ↔ WAV. Sidecar for the encoder adapter, not a rights classification.
 * Recitation packs ship IEEE float; the mix sidecar is PCM16.
 */

function asBytes(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return null;
}

function asciiAt(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function encodeWav({ pcm, sampleRate, channels }) {
  const samples = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    const s16 = clipped < 0 ? Math.round(clipped * 0x8000) : Math.round(clipped * 0x7fff);
    view.setInt16(44 + i * 2, s16, true);
  }
  return bytes;
}

/**
 * Decode PCM16 or IEEE-float WAV into interleaved Float32.
 * Unknown compressions refuse — the mixer does not invent samples.
 */
export function decodeWav(input) {
  const bytes = asBytes(input);
  if (!bytes || bytes.byteLength < 44) {
    throw new Error('WAV is truncated');
  }
  if (asciiAt(bytes, 0, 4) !== 'RIFF' || asciiAt(bytes, 8, 4) !== 'WAVE') {
    throw new Error('Expected a RIFF WAVE file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let pcm = null;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = asciiAt(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.byteLength) throw new Error('WAV chunk overruns the file');
    if (id === 'fmt ') {
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bits = view.getUint16(start + 14, true);
    } else if (id === 'data') {
      if (!channels || !sampleRate || !bits) throw new Error('WAV data arrived before fmt');
      const frameBytes = channels * (bits / 8);
      if (frameBytes < 1 || size % frameBytes !== 0) {
        throw new Error('WAV data is not aligned to a sample frame');
      }
      const frames = size / frameBytes;
      pcm = new Float32Array(frames * channels);
      if (format === 1 && bits === 16) {
        for (let i = 0; i < pcm.length; i += 1) {
          pcm[i] = view.getInt16(start + i * 2, true) / 0x8000;
        }
      } else if (format === 3 && bits === 32) {
        for (let i = 0; i < pcm.length; i += 1) {
          pcm[i] = view.getFloat32(start + i * 4, true);
        }
      } else {
        throw new Error(`Unsupported WAV format ${format}/${bits}`);
      }
    }
    offset = end + (size % 2);
  }
  if (!pcm) throw new Error('WAV has no data chunk');
  return Object.freeze({ pcm, sampleRate, channels, frames: pcm.length / channels });
}
