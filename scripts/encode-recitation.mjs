/**
 * Transcode the hydrated recitation WAV tree to Ogg Opus and rewrite the
 * voice-pack manifest to match. Speech metadata (durationMs, onsetsMs, peak,
 * sampleRate) describes the speech, not the container, so it is kept.
 * Each WAV is deleted only after its Opus file exists and is non-empty.
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeOpus } from './lib/opus.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECITATION = join(ROOT, 'public', 'audio', 'recitation');
const MANIFEST = join(ROOT, 'src', 'audio', 'voice-pack.manifest.json');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
let encoded = 0;
for (const voiceId of readdirSync(RECITATION)) {
  const dir = join(RECITATION, voiceId);
  if (!statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter(file => file.endsWith('.wav'))) {
    const key = name.slice(0, -4);
    const wavPath = join(dir, name);
    const opusPath = join(dir, `${key}.opus`);
    encodeOpus(wavPath, opusPath);
    if (!existsSync(opusPath) || statSync(opusPath).size === 0) {
      throw new Error(`Opus encode produced nothing for ${wavPath}`);
    }
    const entry = manifest.voices?.[voiceId]?.entries?.[key];
    if (entry) {
      entry.asset = `/audio/recitation/${voiceId}/${key}.opus`;
      entry.mimeType = 'audio/ogg; codecs=opus';
    }
    rmSync(wavPath);
    encoded += 1;
  }
}
for (const pack of Object.values(manifest.voices || {})) pack.format = 'opus';
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Encoded ${encoded} recitation file(s) as Opus`);
