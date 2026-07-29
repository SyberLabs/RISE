/**
 * Render the curated voices to WAV so they can be judged by ear.
 *
 * The picker offers five of Kokoro's twenty-four. That shortlist came
 * from the model's own grades, which is a reasonable prior and no
 * substitute for listening.
 *
 *   node scripts/probe-voice-samples.mjs [dtype]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { KokoroTTS } from 'kokoro-js';

function wav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const ascii = (o, t) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
    ascii(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return Buffer.from(buffer);
}

const dtype = process.argv[2] || 'q8';
const VOICES = ['af_heart', 'af_bella', 'bf_emma', 'am_michael', 'am_fenrir'];
const TEXT = 'I would tell you how beautiful and amazing the world is, '
           + 'but all of this arises from their ignorance of good and evil.';

console.log(`Loading Kokoro (dtype=${dtype})…`);
const tts = await KokoroTTS.from_pretrained(
    'onnx-community/Kokoro-82M-v1.0-ONNX', { dtype, device: 'cpu' });

mkdirSync('voice-samples', { recursive: true });
for (const voice of VOICES) {
    const a = await tts.generate(TEXT, { voice });
    const file = `voice-samples/${voice}-${dtype}.wav`;
    writeFileSync(file, wav(a.audio, a.sampling_rate));
    let peak = 0; for (const v of a.audio) if (Math.abs(v) > peak) peak = Math.abs(v);
    console.log(`  ${file.padEnd(38)} ${(a.audio.length / a.sampling_rate).toFixed(2)}s  peak ${peak.toFixed(3)}`);
}
console.log('\nDone — open the voice-samples folder.');
