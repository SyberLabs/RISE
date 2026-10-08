/**
 * The released canon, read aloud: every division of every released work is
 * rendered ONCE by ElevenLabs at authoring time, in groups of atoms that fit
 * one request, then cut into the reader's phrase clips exactly as today's
 * poem is (scripts/build-poem-recitation.mjs, src/audio/poem-alignment.js).
 * The clips never ship in the bundle: they are served to Plus readers from
 * private storage through the Worker (MasterMind RFC 0001, section 2).
 *
 *   npm run canon:recite                                   # plan: works, divisions, atoms, requests, characters, cost
 *   npm run canon:recite -- --dry-run [--works a,b]        # synthetic timing through the mapper and cutter; no vendor call
 *   npm run canon:recite -- --render --voice <id> --slug el_<name> --works a,b,c [--entry n] [--max-chars n]
 *
 * --render writes .cache/canon/<slug>/<workId>/<entryId>/pack.json and one
 * <sha16>.m4a per atom, with asset paths under /api/plus/audio/<slug>/<workId>/<entryId>/.
 * The pack carries the work's sourceRevision; a division whose pack already
 * carries the current revision is skipped. Uploading the directory to R2 is a
 * separate step (WP-RISE-PLUS-04).
 *
 * The key is read from ELEVENLABS_API_KEY in the environment only and never
 * printed. Every response is cached under .cache/canon/responses, keyed by
 * everything that shapes the audio, so no group is paid for twice.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';
import { resolveJevReading } from '../src/app/jev-reading.js';
import { releaseArchiveTexts } from '../src/content/archive/index.js';
import { jevReleasedEdition } from '../src/core/jev-describe.js';
import { compileSession } from '../src/core/session-compiler.js';
import { todayDecision } from '../src/core/today-reading.js';
import { VOICE_PACK_SCHEMA, normalizeVoiceText, voiceAssetKey } from '../src/audio/voice-pack-key.js';
import { checkClip, cutPoints, groupAtoms, mapAlignment, sliceClips } from '../src/audio/poem-alignment.js';

installContentPlaneFetch();

const API = 'https://api.elevenlabs.io';
const CACHE = join(process.cwd(), '.cache', 'canon');
const SAMPLE_RATE = 44100;
const DEFAULT_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1 };
const DEFAULT_MAX_CHARS = 40_000; // Flash v2.5; the account's model answers for itself when a key is present
const DEFAULT_PRICE_PER_1K = 0.04;

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

/** Every released work's divisions as the reader gets them: the exact atoms each is cut into. */
async function* divisionsOf(workIds) {
  for (const work of releaseArchiveTexts()) {
    if (workIds && !workIds.includes(work.id)) continue;
    const released = jevReleasedEdition(work.id);
    if (!released) continue;
    const { entries } = await work.getDivisions();
    const only = option('entry');
    for (const entry of entries) {
      if (only !== null && String(entry.id) !== only) continue;
      const decision = todayDecision({ seed: 'canon', workId: work.id });
      const input = await resolveJevReading(decision, { entryId: entry.id, label: entry.label });
      const atoms = compileSession(input).atoms.map(atom => normalizeVoiceText(atom)).filter(Boolean);
      yield { workId: work.id, entryId: Number(entry.id), label: entry.label, sourceRevision: released.sourceRevision, atoms };
    }
  }
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

/** Map, cut and check one rendered group of atoms. */
function examine(atoms, rendered, sampleRate = SAMPLE_RATE) {
  const pcm = pcmFrom(rendered.audio_base64);
  const mapped = mapAlignment({ atoms, alignment: rendered.alignment });
  if (!mapped.ok) return { error: mapped.reason };
  const cuts = cutPoints(mapped.atoms, pcm, sampleRate);
  const clips = sliceClips(mapped.atoms, cuts, pcm, sampleRate);
  const errors = [];
  const suspects = [];
  clips.forEach((clip, a) => {
    const verdict = checkClip(clip);
    if (verdict.error) errors.push(`atom ${a + 1} “${clip.text.slice(0, 40)}”: ${verdict.error}`);
    if (verdict.suspect) suspects.push(`atom ${a + 1}: ${verdict.suspect}`);
  });
  return { clips, error: errors[0], suspects };
}

const DRY_SAMPLE_RATE = 8000;

/**
 * A vendor-shaped response with no vendor: a reading pace of 16 characters a
 * second, a short pause after each atom, and a quiet tone for sound at a low
 * sample rate, so the mapper, the cutter and the clip checks run over the
 * real atoms of the real canon in minutes.
 */
function synthesize(atoms) {
  const characters = [];
  const starts = [];
  const ends = [];
  let t = 0.1;
  atoms.forEach((atom, a) => {
    for (const ch of a ? ` ${atom}` : atom) {
      characters.push(ch);
      starts.push(t);
      t += ch === ' ' ? 0.05 : 1 / 16;
      ends.push(t);
    }
    t += 0.25;
  });
  const samples = Math.round((t + 0.5) * DRY_SAMPLE_RATE);
  const pcm = new Float32Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = (Math.sin(i * 0.37) + Math.sin(i * 0.011)) * 0.15;
  const s16 = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) s16.writeInt16LE(Math.round(pcm[i] * 32767), i * 2);
  return { audio_base64: s16.toString('base64'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } };
}

async function resolveModel() {
  const models = await api('/v1/models');
  const wanted = option('model', 'eleven_flash_v2_5');
  const model = models.filter(m => m.can_do_text_to_speech).find(m => m.model_id === wanted);
  if (!model) throw new Error(`No ${wanted} text-to-speech model on this account.`);
  return model;
}

async function render(group, context, { voiceId, modelId, settings }) {
  const request = { text: group.text, model_id: modelId, voice_settings: settings, ...context };
  const id = createHash('sha256').update(JSON.stringify({ voiceId, format: `pcm_${SAMPLE_RATE}`, ...request })).digest('hex');
  const file = join(CACHE, 'responses', `${id}.json`);
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true };
  const response = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`, {
    method: 'POST',
    body: JSON.stringify(request)
  });
  mkdirSync(join(CACHE, 'responses'), { recursive: true });
  // The raw alignment names the characters sent; normalized_alignment names what the voice said instead and would fail the letter check.
  writeFileSync(`${file}.tmp`, JSON.stringify({ audio_base64: response.audio_base64, alignment: response.alignment }));
  renameSync(`${file}.tmp`, file);
  return { ...response, cached: false };
}

const sha16 = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

function writeClip(samples, dir) {
  const tmp = join(dir, '.encoding.m4a');
  const encoder = encodeM4a(samples, tmp);
  const bytes = readFileSync(tmp);
  const file = `${sha16(bytes)}.m4a`;
  renameSync(tmp, join(dir, file));
  return { file, encoder };
}

const workIds = option('works')?.split(',').filter(Boolean) ?? null;
const maxChars = Number(option('max-chars', DEFAULT_MAX_CHARS));

async function plan() {
  const pricePer1k = Number(option('price-per-1k', DEFAULT_PRICE_PER_1K));
  const works = new Map();
  let divisions = 0;
  let atoms = 0;
  let requests = 0;
  let characters = 0;
  let longest = 0;
  for await (const division of divisionsOf(workIds)) {
    const work = works.get(division.workId) ?? { divisions: 0, characters: 0 };
    works.set(division.workId, work);
    work.divisions++;
    divisions++;
    atoms += division.atoms.length;
    const groups = groupAtoms(division.atoms, maxChars);
    requests += groups.length;
    for (const group of groups) {
      characters += group.text.length;
      work.characters += group.text.length;
      longest = Math.max(longest, group.text.length);
    }
  }
  for (const [id, work] of works) console.log(`  ${id}: ${work.divisions} divisions, ${work.characters.toLocaleString('en')} characters`);
  console.log(`Canon: ${works.size} works, ${divisions} divisions, ${atoms.toLocaleString('en')} atoms (one clip each).`);
  console.log(`Requests: ${requests.toLocaleString('en')} at up to ${maxChars.toLocaleString('en')} characters; longest ${longest.toLocaleString('en')}.`);
  console.log(`Characters: ${characters.toLocaleString('en')}. Estimated cost: $${(characters / 1000 * pricePer1k).toFixed(2)} at $${pricePer1k}/1K (pass --price-per-1k to change).`);
  if (!key) return console.log('No ELEVENLABS_API_KEY in the environment: nothing else to check.');
  const model = await resolveModel();
  console.log(`Model: ${model.model_id}, up to ${model.maximum_text_length_per_request ?? '?'} characters per request.`);
  const subscription = await api('/v1/user/subscription');
  console.log(`Account: ${subscription.tier}, ${(subscription.character_limit - subscription.character_count).toLocaleString('en')} credits left this period.`);
}

async function dryRun() {
  let divisions = 0;
  let clips = 0;
  const refused = [];
  const suspects = new Map();
  for await (const division of divisionsOf(workIds)) {
    divisions++;
    for (const group of groupAtoms(division.atoms, maxChars)) {
      const atoms = division.atoms.slice(group.from, group.to);
      const result = examine(atoms, synthesize(atoms), DRY_SAMPLE_RATE);
      if (result.error) {
        refused.push(`${division.workId}:${division.entryId} ${division.label}: ${result.error}`);
        continue;
      }
      clips += result.clips.length;
      for (const note of result.suspects) suspects.set(note.replace(/^atom \d+: /u, '').replace(/\(.*\)/u, ''), (suspects.get(note.replace(/^atom \d+: /u, '').replace(/\(.*\)/u, '')) ?? 0) + 1);
    }
  }
  console.log(`Dry run: ${divisions} divisions, ${clips.toLocaleString('en')} clips cut and checked on synthetic timing.`);
  if (refused.length) console.log(`\nRefused (${refused.length}):\n  ${refused.join('\n  ')}`);
  else console.log('Refused: none.');
  if (suspects.size) console.log(`\nSuspect notes (synthetic pace, informational): ${[...suspects].map(([k, n]) => `${k} ×${n}`).join('; ')}`);
}

async function renderCanon() {
  if (!key) throw new Error('Rendering needs ELEVENLABS_API_KEY in the environment.');
  if (!workIds) throw new Error('Name the works to render: --works a,b,c (the plan lists ids).');
  const voiceId = option('voice');
  if (!voiceId) throw new Error('Name the ElevenLabs voice: --voice <voice_id>.');
  const slug = option('slug');
  if (!/^el_[a-z0-9_]+$/u.test(slug || '')) throw new Error('Name the voice for RISE: --slug el_<lowercase name>.');
  const model = await resolveModel();
  const cap = Math.min(maxChars, model.maximum_text_length_per_request ?? maxChars);
  const settings = { ...DEFAULT_SETTINGS };
  let billed = 0;
  let rendered = 0;
  let skipped = 0;
  const refused = [];
  const suspect = [];
  for await (const division of divisionsOf(workIds)) {
    const dir = join(CACHE, slug, division.workId, String(division.entryId));
    const packFile = join(dir, 'pack.json');
    if (existsSync(packFile) && JSON.parse(readFileSync(packFile, 'utf8')).poem?.sourceRevision === division.sourceRevision) {
      skipped++;
      continue;
    }
    mkdirSync(dir, { recursive: true });
    const groups = groupAtoms(division.atoms, cap);
    const entries = {};
    let failed = null;
    let count = 0;
    for (let g = 0; g < groups.length && !failed; g++) {
      const atoms = division.atoms.slice(groups[g].from, groups[g].to);
      const context = {
        ...(g > 0 ? { previous_text: groups[g - 1].text.slice(-500) } : {}),
        ...(g + 1 < groups.length ? { next_text: groups[g + 1].text.slice(0, 500) } : {})
      };
      const response = await render(groups[g], context, { voiceId, modelId: model.model_id, settings });
      if (!response.cached) billed += groups[g].text.length;
      const result = examine(atoms, response);
      if (result.error) {
        failed = `group ${g + 1} of ${groups.length}: ${result.error}`;
        break;
      }
      if (result.suspects.length) suspect.push(`${division.workId}:${division.entryId} group ${g + 1}: ${result.suspects.slice(0, 3).join('; ')}`);
      for (const clip of result.clips) {
        const entryKey = voiceAssetKey(clip.text);
        if (entries[entryKey]) continue; // a repeated phrase keeps its first take
        const { file } = writeClip(clip.samples, dir);
        entries[entryKey] = {
          text: clip.text,
          asset: `/api/plus/audio/${slug}/${division.workId}/${division.entryId}/${file}`,
          mimeType: 'audio/mp4',
          sampleRate: SAMPLE_RATE,
          durationMs: clip.durationMs,
          onsetsMs: clip.onsetsMs,
          peak: clip.peak
        };
        count++;
      }
    }
    if (failed) {
      refused.push(`${division.workId}:${division.entryId} ${division.label}: ${failed}`);
      continue;
    }
    const pack = {
      schema: VOICE_PACK_SCHEMA,
      poem: { workId: division.workId, entryId: division.entryId, sourceRevision: division.sourceRevision },
      voices: { [slug]: { label: option('label', slug), model: `elevenlabs/${model.model_id}`, format: 'm4a', entries } }
    };
    writeFileSync(packFile, JSON.stringify(pack));
    rendered++;
    console.log(`  ✓ ${division.workId}:${division.entryId} ${division.label}: ${count} clips in ${groups.length} request${groups.length === 1 ? '' : 's'}`);
  }
  console.log(`\nRendered ${rendered} divisions, skipped ${skipped} already at the current revision. Characters billed this run: ${billed.toLocaleString('en')}.`);
  if (refused.length) console.log(`\nRefused (read silently until re-taken):\n  ${refused.join('\n  ')}`);
  if (suspect.length) console.log(`\nListen to these:\n  ${suspect.join('\n  ')}`);
}

if (flag('render')) await renderCanon();
else if (flag('dry-run')) await dryRun();
else await plan();
