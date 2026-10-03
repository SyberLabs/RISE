/**
 * Today's poem, read aloud: each poem is rendered ONCE, as one performance,
 * by ElevenLabs at authoring time, then cut into the reader's line clips
 * (src/audio/poem-alignment.js). Readers get same-origin static audio; no key,
 * model or vendor ever reaches the browser or CI.
 *
 *   npm run poem:recite:plan                       # characters, cost, quota (no rendering)
 *   npm run poem:recite -- --list-voices           # the account's voices
 *   npm run poem:recite -- --audition --voices a,b,c [--poems workId:entryId,…]
 *
 * The key is read from ELEVENLABS_API_KEY in the environment only and never
 * printed. Every response is cached under .cache/poem-recitation/responses,
 * keyed by everything that shapes the audio, so no poem is paid for twice.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';
import { resolveJevReading } from '../src/app/jev-reading.js';
import { releaseArchiveTexts } from '../src/content/archive/index.js';
import { compileSession } from '../src/core/session-compiler.js';
import { todayPool } from '../src/core/today-poem.js';
import { todayDecision } from '../src/core/today-reading.js';
import { normalizeVoiceText } from '../src/audio/voice-pack-key.js';
import { checkClip, cutPoints, mapAlignment, sliceClips, spokenText } from '../src/audio/poem-alignment.js';

installContentPlaneFetch();

const API = 'https://api.elevenlabs.io';
const CACHE = join(process.cwd(), '.cache', 'poem-recitation');
const SAMPLE_RATE = 44100;
const DEFAULT_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1 };

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback = null) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : fallback;
};
const key = process.env.ELEVENLABS_API_KEY || '';

async function api(path, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'xi-api-key': key, 'content-type': 'application/json', ...init.headers }
    });
    if (response.ok) return response.json();
    const body = (await response.text()).slice(0, 300);
    if ([401, 402, 403, 422].includes(response.status)) {
      throw new Error(`ElevenLabs refused ${path.split('?')[0]} (${response.status}): ${body}`);
    }
    if (attempt >= 5 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`ElevenLabs ${path.split('?')[0]} failed (${response.status}): ${body}`);
    }
    const wait = Number(response.headers.get('retry-after')) * 1000 || (2 ** attempt) * 1000 + Math.random() * 500;
    console.warn(`  … ${response.status}, retrying in ${Math.round(wait / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

/** A pool poem as the reader gets it on a recited day: its text, and the exact atoms it is cut into. */
async function poemFor(item) {
  const work = releaseArchiveTexts().find(record => record.id === item.workId);
  const { entries } = await work.getDivisions();
  const entry = entries[item.entryId];
  const pick = { ...item, seed: 'recitation' };
  const input = await resolveJevReading(todayDecision(pick, { recited: true }), { entryId: item.entryId, label: item.label });
  const atoms = compileSession(input).atoms.map(atom => normalizeVoiceText(atom)).filter(Boolean);
  return { key: `${item.workId}:${item.entryId}`, label: item.label, text: spokenText(entry.content), atoms };
}

async function render(poem, { voiceId, modelId, settings, seed }) {
  const request = { text: poem.text, model_id: modelId, voice_settings: settings, seed };
  const id = createHash('sha256').update(JSON.stringify({ voiceId, format: `pcm_${SAMPLE_RATE}`, ...request })).digest('hex');
  const file = join(CACHE, 'responses', `${id}.json`);
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true };
  const response = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`, {
    method: 'POST',
    body: JSON.stringify(request)
  });
  mkdirSync(join(CACHE, 'responses'), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify({ audio_base64: response.audio_base64, alignment: response.alignment }));
  renameSync(`${file}.tmp`, file);
  return { ...response, cached: false };
}

function pcmFrom(base64) {
  const bytes = Buffer.from(base64, 'base64');
  const pcm = new Float32Array(bytes.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readInt16LE(i * 2) / 32768;
  return pcm;
}

function encodeM4a(pcm, outFile) {
  const s16 = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) s16.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  for (const encoder of ['aac_at', 'aac']) {
    const result = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0',
      '-c:a', encoder, '-b:a', '64k', '-movflags', '+faststart', outFile], { input: s16 });
    if (result.status === 0) return encoder;
  }
  throw new Error(`ffmpeg could not encode ${outFile}`);
}

/** Map, cut and check one rendered poem. */
function examine(poem, rendered) {
  const pcm = pcmFrom(rendered.audio_base64);
  const mapped = mapAlignment({ atoms: poem.atoms, alignment: rendered.alignment });
  if (!mapped.ok) return { pcm, error: mapped.reason };
  const cuts = cutPoints(mapped.atoms, pcm, SAMPLE_RATE);
  const clips = sliceClips(mapped.atoms, cuts, pcm, SAMPLE_RATE);
  const errors = [];
  const suspects = [];
  clips.forEach((clip, a) => {
    const verdict = checkClip(clip);
    if (verdict.error) errors.push(`line ${a + 1}: ${verdict.error}`);
    if (verdict.suspect) suspects.push(`line ${a + 1}: ${verdict.suspect}`);
  });
  const tailMs = pcm.length / SAMPLE_RATE * 1000 - mapped.atoms.at(-1).endMs;
  if (tailMs > 1500) suspects.push(`${Math.round(tailMs)} ms of sound after the last word`);
  return { pcm, clips, error: errors[0], suspects };
}

async function resolveModel() {
  const models = await api('/v1/models');
  const wanted = option('model');
  const usable = models.filter(model => model.can_do_text_to_speech);
  const model = wanted ? usable.find(m => m.model_id === wanted) : usable.find(m => /v4/iu.test(m.model_id)) ?? null;
  if (!model) {
    throw new Error(`No ${wanted ?? 'v4'} text-to-speech model on this account. Models: ${usable.map(m => m.model_id).join(', ')}`);
  }
  return model;
}

async function plan(poems) {
  const characters = poems.reduce((sum, poem) => sum + poem.text.length, 0);
  const pricePer1k = Number(option('price-per-1k', '0.08'));
  console.log(`Pool: ${poems.length} poems, ${poems.reduce((s, p) => s + p.atoms.length, 0)} line clips, ${characters.toLocaleString('en')} characters.`);
  console.log(`Estimated cost: $${(characters / 1000 * pricePer1k).toFixed(2)} at $${pricePer1k}/1K characters (pass --price-per-1k to change).`);
  console.log(`Longest poem: ${Math.max(...poems.map(p => p.text.length))} characters.`);
  if (!key) {
    console.log('No ELEVENLABS_API_KEY in the environment: nothing else to check.');
    return;
  }
  const model = await resolveModel();
  console.log(`Model: ${model.model_id} (${model.name}), up to ${model.maximum_text_length_per_request ?? '?'} characters per request.`);
  const subscription = await api('/v1/user/subscription');
  console.log(`Account: ${subscription.tier}, ${(subscription.character_limit - subscription.character_count).toLocaleString('en')} characters left this period.`);
}

async function listVoices() {
  const { voices } = await api('/v2/voices?page_size=100');
  for (const voice of voices) {
    const labels = Object.values(voice.labels || {}).join(', ');
    console.log(`${voice.voice_id}  ${voice.name}${labels ? `  (${labels})` : ''}`);
  }
}

function auditionPoems(poems) {
  const chosen = option('poems');
  if (chosen) return chosen.split(',').map(k => poems.find(p => p.key === k)).filter(Boolean);
  const spoon = poems.filter(p => p.key.startsWith('spoon-river')).sort((a, b) => a.text.length - b.text.length);
  const ballads = poems.filter(p => p.key.startsWith('lyrical-ballads')).sort((a, b) => a.text.length - b.text.length);
  return [spoon[0], spoon[Math.floor(spoon.length / 2)], ballads[Math.floor(ballads.length / 2)]];
}

async function audition(poems) {
  if (!key) throw new Error('Audition needs ELEVENLABS_API_KEY in the environment.');
  const voices = (option('voices') || '').split(',').filter(Boolean);
  if (!voices.length) throw new Error('Name the candidate voices: --voices id1,id2,id3 (see --list-voices).');
  const model = await resolveModel();
  const settings = { ...DEFAULT_SETTINGS };
  const seed = Number(option('seed', '1'));
  let billed = 0;
  for (const voiceId of voices) {
    for (const poem of auditionPoems(poems)) {
      const rendered = await render(poem, { voiceId, modelId: model.model_id, settings, seed });
      if (!rendered.cached) billed += poem.text.length;
      const result = examine(poem, rendered);
      const dir = join(CACHE, 'audition', voiceId);
      mkdirSync(dir, { recursive: true });
      const out = join(dir, `${poem.key.replace(':', '-')}.m4a`);
      encodeM4a(result.pcm, out);
      const verdict = result.error ? `REFUSED: ${result.error}` : `ok, ${result.clips.length} line clips`;
      console.log(`${voiceId}  ${poem.label}  ${verdict}${result.suspects?.length ? `  [listen: ${result.suspects.join('; ')}]` : ''}`);
      console.log(`  ${out}`);
    }
  }
  console.log(`Characters billed this run: ${billed.toLocaleString('en')} (cached renders cost nothing).`);
}

const poems = [];
for (const item of todayPool()) poems.push(await poemFor(item));

if (flag('list-voices')) await listVoices();
else if (flag('audition')) await audition(poems);
else await plan(poems);
