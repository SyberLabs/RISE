import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import * as opus from './opus.mjs';

// Two original PCM tones; exercise the real encoder without a voice model or API.
function wave(frequency) {
  const samples = 2400, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24000, 24); buffer.writeUInt32LE(48000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(2000 * Math.sin(2 * Math.PI * frequency * i / 24000)), 44 + i * 2);
  return buffer;
}

test('a retake has a new immutable URL and leaves the previous audio intact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rise-opus-'));
  try {
    const input = join(dir, 'take.wav'), requested = join(dir, 'same-phrase.opus');
    writeFileSync(requested, 'previous legacy recording');
    writeFileSync(input, wave(220));
    const first = opus.encodeOpus(input, requested);
    assert.equal(typeof first, 'string', 'encoding returns the versioned path used by the manifest');
    const firstBytes = readFileSync(first);
    assert.equal(basename(first), `same-phrase-${createHash('sha256').update(firstBytes).digest('hex')}.opus`);
    assert.equal(firstBytes.subarray(0, 4).toString(), 'OggS');
    writeFileSync(input, wave(440));
    const second = opus.encodeOpus(input, requested);
    assert.notEqual(second, first);
    assert.notDeepEqual(readFileSync(second), firstBytes);
    assert.deepEqual(readFileSync(first), firstBytes);
    assert.equal(readFileSync(requested, 'utf8'), 'previous legacy recording');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the WAV conversion publishes the versioned file and preserves speech timing and prior clips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rise-recite-'));
  try {
    const scripts = join(dir, 'scripts'), audio = join(dir, 'public/audio/recitation/af_heart');
    mkdirSync(join(scripts, 'lib'), { recursive: true });
    mkdirSync(audio, { recursive: true }); mkdirSync(join(dir, 'src/audio'), { recursive: true });
    cpSync(new URL('../encode-recitation.mjs', import.meta.url), join(scripts, 'encode-recitation.mjs'));
    cpSync(new URL('./opus.mjs', import.meta.url), join(scripts, 'lib/opus.mjs'));
    const metadata = { text: 'A sample.', durationMs: 100, onsetsMs: [0, 50], sampleRate: 24000, peak: 0.1 };
    const manifestPath = join(dir, 'src/audio/voice-pack.manifest.json');
    writeFileSync(manifestPath, JSON.stringify({ voices: { af_heart: { entries: { phrase: { ...metadata, asset: '/audio/recitation/af_heart/phrase.opus' } } } } }));
    writeFileSync(join(audio, 'phrase.opus'), 'legacy recording');
    const urls = [];
    for (const frequency of [220, 440]) {
      writeFileSync(join(audio, 'phrase.wav'), wave(frequency));
      execFileSync(process.execPath, [join(scripts, 'encode-recitation.mjs')], { stdio: 'pipe' });
      const entry = JSON.parse(readFileSync(manifestPath)).voices.af_heart.entries.phrase;
      urls.push(entry.asset);
      assert.ok(existsSync(join(dir, 'public', entry.asset)), 'manifest points to the encoded file');
      for (const [key, value] of Object.entries(metadata)) assert.deepEqual(entry[key], value);
      assert.equal(existsSync(join(audio, 'phrase.wav')), false);
    }
    assert.notEqual(urls[0], urls[1]);
    assert.ok(existsSync(join(dir, 'public', urls[0])));
    assert.equal(readFileSync(join(audio, 'phrase.opus'), 'utf8'), 'legacy recording');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the voice-pack builder retains a versioned take, and a forced retake changes only its audio identity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rise-pack-'));
  try {
    for (const path of ['scripts/lib', 'src/audio', 'src/core', 'node_modules/kokoro-js']) mkdirSync(join(dir, path), { recursive: true });
    for (const path of ['scripts/build-voice-pack.mjs', 'scripts/lib/opus.mjs', 'src/audio/voice-pack-key.js', 'src/core/recitation.js']) {
      cpSync(new URL(`../../${path}`, import.meta.url), join(dir, path));
    }
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(join(dir, 'node_modules/kokoro-js/package.json'), '{"type":"module","exports":"./index.js"}');
    // Only the external synthesis boundary is substituted; authoring, encoding and manifest writes are real.
    writeFileSync(join(dir, 'node_modules/kokoro-js/index.js'), `
      import { appendFileSync, readFileSync } from 'node:fs';
      export const KokoroTTS = { from_pretrained: async () => ({ generate: async () => {
        appendFileSync('calls.txt', 'generated\\n');
        return { audio: new Float32Array(2400).fill(0.1), sampling_rate: 24000, toWav: () => readFileSync('take.wav') };
      } }) };
    `);
    const manifestPath = join(dir, 'src/audio/voice-pack.manifest.json');
    writeFileSync(manifestPath, '{"schema":"rise.recitation-voice-pack.v1","voices":{}}');
    writeFileSync(join(dir, 'input.json'), JSON.stringify({ phrases: ['A short original sample.'] }));
    const run = (...args) => execFileSync(process.execPath, ['scripts/build-voice-pack.mjs', '--input', 'input.json', ...args], { cwd: dir, stdio: 'pipe' });
    const entries = () => JSON.parse(readFileSync(manifestPath)).voices.af_heart.entries;
    writeFileSync(join(dir, 'take.wav'), wave(220)); run();
    const first = entries(), key = Object.keys(first)[0], firstBytes = readFileSync(join(dir, 'public', first[key].asset));
    run();
    assert.deepEqual(entries(), first);
    assert.equal(readFileSync(join(dir, 'calls.txt'), 'utf8'), 'generated\n');
    writeFileSync(join(dir, 'take.wav'), wave(440)); run('--force');
    const second = entries();
    assert.deepEqual(Object.keys(second), [key]);
    assert.equal(second[key].text, first[key].text);
    assert.deepEqual(second[key].onsetsMs, first[key].onsetsMs);
    assert.notEqual(second[key].asset, first[key].asset);
    assert.ok(existsSync(join(dir, 'public', second[key].asset)));
    assert.deepEqual(readFileSync(join(dir, 'public', first[key].asset)), firstBytes);
    assert.equal(readFileSync(join(dir, 'calls.txt'), 'utf8'), 'generated\ngenerated\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
