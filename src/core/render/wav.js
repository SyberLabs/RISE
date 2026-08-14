/**
 * PCM → WAV. Sidecar for the encoder adapter, not a rights classification.
 */

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
