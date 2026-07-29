/**
 * Encode a real utterance exactly as the browser does, then measure it.
 *
 * A reader reported speech arriving as "the words, only extremely
 * distorted". That is not a load problem and not a timing problem —
 * both of those produce silence or truncation, not distortion — so this
 * takes the model's output through the SAME encoder the Voice uses and
 * asks whether the bytes leaving that function describe the audio that
 * went in.
 *
 *   node scripts/probe-voice-audio.mjs
 *
 * Writes the WAV so it can be listened to directly, because some faults
 * are only obvious in the ear.
 */
import { writeFileSync } from 'node:fs';
import { KokoroTTS } from 'kokoro-js';

// ── the encoder under test, copied verbatim from src/audio/voice.js ──
function wavBuffer(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const ascii = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
}

console.log('Loading Kokoro (q8 — same weights the browser CPU path uses)…');
const tts = await KokoroTTS.from_pretrained(
    'onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });

const TEXT = 'Phrase number one carries enough words to occupy a real moment of reading.';
const audio = await tts.generate(TEXT, { voice: 'af_heart' });

const samples = audio.audio;
const sr = audio.sampling_rate;

console.log('\n── what the model returned ──');
console.log('  ctor          ', samples.constructor.name);
console.log('  length        ', samples.length);
console.log('  byteOffset    ', samples.byteOffset);
console.log('  buffer bytes  ', samples.buffer.byteLength);
console.log('  view bytes    ', samples.byteLength);
console.log('  sampleRate    ', sr, typeof sr);
console.log('  duration      ', (samples.length / sr).toFixed(2), 's');

let min = Infinity, max = -Infinity, clipped = 0, nan = 0, sumsq = 0;
for (const v of samples) {
    if (Number.isNaN(v)) { nan++; continue; }
    if (v < min) min = v;
    if (v > max) max = v;
    if (v < -1 || v > 1) clipped++;
    sumsq += v * v;
}
console.log('  min / max     ', min.toFixed(4), '/', max.toFixed(4));
console.log('  out of [-1,1] ', clipped, `(${(clipped / samples.length * 100).toFixed(2)}%)`);
console.log('  NaN           ', nan);
console.log('  RMS           ', Math.sqrt(sumsq / samples.length).toFixed(4));

// ── round-trip through the encoder ──
const buf = wavBuffer(samples, sr);
const view = new DataView(buf);
console.log('\n── the WAV header written ──');
const tag = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
console.log('  RIFF/WAVE     ', tag(0, 4), tag(8, 4), tag(12, 4));
console.log('  audioFormat   ', view.getUint16(20, true), '(1 = PCM)');
console.log('  channels      ', view.getUint16(22, true));
console.log('  sampleRate    ', view.getUint32(24, true));
console.log('  byteRate      ', view.getUint32(28, true));
console.log('  blockAlign    ', view.getUint16(32, true));
console.log('  bitsPerSample ', view.getUint16(34, true));
console.log('  data bytes    ', view.getUint32(40, true), 'of', buf.byteLength - 44, 'actual');

// Decode back and compare — the encoder is only correct if what comes
// out matches what went in, sample for sample.
let worst = 0, worstAt = -1;
for (let i = 0; i < samples.length; i++) {
    const back = view.getInt16(44 + i * 2, true) / (view.getInt16(44 + i * 2, true) < 0 ? 0x8000 : 0x7fff);
    const err = Math.abs(back - Math.max(-1, Math.min(1, samples[i])));
    if (err > worst) { worst = err; worstAt = i; }
}
console.log('\n── round trip ──');
console.log('  worst error   ', worst.toExponential(3), 'at sample', worstAt);
console.log('  (16-bit quantisation step is', (1 / 0x7fff).toExponential(3) + ')');

writeFileSync('voice-probe.wav', Buffer.from(buf));
console.log('\nWrote voice-probe.wav —', (buf.byteLength / 1024).toFixed(0), 'kB. Listen to it.');
