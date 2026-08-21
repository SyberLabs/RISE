#!/usr/bin/env node

/**
 * Build static Recitation assets locally.
 *
 * Kokoro runs here, under Node, never in a reader's browser. The output is a
 * same-origin audio directory plus the small manifest bundled by Vite.
 *
 * Examples:
 *   npm run build:voice-pack -- --input scripts/voice-packs/heart-beta.mjs
 *   npm run build:voice-pack -- --input session.json --voice af_heart --dry-run
 */

import { existsSync } from 'node:fs';
import {
    mkdir,
    readFile,
    rename,
    rm,
    writeFile
} from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { speechOnsets } from '../src/core/recitation.js';
import {
    DEFAULT_VOICE_ID,
    VOICE_PACK_SCHEMA,
    normalizeVoiceText,
    voiceAssetKey
} from '../src/audio/voice-pack-key.js';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'src/audio/voice-pack.manifest.json');
const PUBLIC_ROOT = resolve(ROOT, 'public');
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

function usage() {
    return `
Build a static RISE Recitation voice pack.

Required:
  --input <file>    JSON or ESM module containing strings, atoms, a session,
                    or { sessions: [...] }.

Options:
  --voice <id>      Kokoro voice id (default: input voiceId or af_heart)
  --dtype <dtype>   Kokoro dtype (default: q8)
  --limit <count>   Generate only the first N unique phrases
  --only <key>      Generate only one resolved asset key (for acoustic repair)
  --force           Regenerate assets already present in the manifest
  --dry-run         Resolve and count phrases without loading Kokoro
  --help            Show this help
`.trim();
}

function parseArgs(argv) {
    const args = {
        input: null,
        voice: null,
        dtype: 'q8',
        limit: Infinity,
        only: null,
        force: false,
        dryRun: false,
        help: false
    };
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--input') args.input = argv[++index];
        else if (token === '--voice') args.voice = argv[++index];
        else if (token === '--dtype') args.dtype = argv[++index];
        else if (token === '--limit') args.limit = Number(argv[++index]);
        else if (token === '--only') args.only = argv[++index];
        else if (token === '--force') args.force = true;
        else if (token === '--dry-run') args.dryRun = true;
        else if (token === '--help' || token === '-h') args.help = true;
        else throw new Error(`Unknown argument: ${token}`);
    }
    if (args.limit !== Infinity
        && (!Number.isFinite(args.limit) || args.limit <= 0)) {
        throw new Error('--limit must be a positive number');
    }
    return args;
}

async function loadInput(path) {
    const absolute = resolve(ROOT, path);
    if (!existsSync(absolute)) throw new Error(`Input does not exist: ${absolute}`);
    if (extname(absolute).toLowerCase() === '.json') {
        return JSON.parse(await readFile(absolute, 'utf8'));
    }
    const url = pathToFileURL(absolute);
    // The timestamp makes repeated authoring runs observe edited plan modules.
    url.searchParams.set('t', String(Date.now()));
    const module = await import(url.href);
    return module.default ?? module.voicePack ?? module;
}

function collectAtoms(value, result = [], seen = new Set()) {
    if (value == null || seen.has(value)) return result;
    if (typeof value === 'string') {
        result.push(value);
        return result;
    }
    if (typeof value !== 'object') return result;
    seen.add(value);

    if (Array.isArray(value)) {
        value.forEach(item => collectAtoms(item, result, seen));
        return result;
    }
    if (typeof value.content === 'string') {
        result.push(value.content);
        return result;
    }
    if (Array.isArray(value.atoms)) {
        collectAtoms(value.atoms, result, seen);
        return result;
    }
    if (value.session) collectAtoms(value.session, result, seen);
    if (Array.isArray(value.sessions)) collectAtoms(value.sessions, result, seen);
    if (Array.isArray(value.phrases)) collectAtoms(value.phrases, result, seen);
    return result;
}

function uniquePhrases(input, limit) {
    const byKey = new Map();
    for (const atom of collectAtoms(input)) {
        const text = normalizeVoiceText(atom);
        const key = voiceAssetKey(text);
        if (!key) continue;
        const prior = byKey.get(key);
        if (prior && prior.text !== text) {
            throw new Error(`Voice key collision between "${prior.text}" and "${text}"`);
        }
        const spokenText = normalizeVoiceText(input?.pronunciations?.[text]) || text;
        byKey.set(key, { text, spokenText });
        if (byKey.size >= limit) break;
    }
    return [...byKey].map(([key, phrase]) => ({ key, ...phrase }));
}

function analyze(samples) {
    let peak = 0;
    let energy = 0;
    for (let index = 0; index < samples.length; index++) {
        const value = samples[index];
        if (!Number.isFinite(value)) {
            throw new Error(`non-finite sample at ${index}`);
        }
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
    }
    const rms = Math.sqrt(energy / Math.max(1, samples.length));
    if (samples.length === 0 || peak < 0.0001 || rms < 0.00001) {
        throw new Error(`silent or near-silent output (peak ${peak}, RMS ${rms})`);
    }
    if (peak > 1.25) {
        throw new Error(`peak ${peak} exceeds the safe playback range`);
    }
    return { peak, rms };
}

async function atomicWrite(path, bytes) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.partial`;
    await writeFile(temporary, bytes);
    try {
        await rename(temporary, path);
    } catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}

async function readManifest() {
    const parsed = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    if (parsed.schema !== VOICE_PACK_SCHEMA) {
        throw new Error(`Unsupported voice manifest schema: ${parsed.schema}`);
    }
    parsed.voices ||= {};
    return parsed;
}

async function persistManifest(manifest) {
    manifest.generatedAt = new Date().toISOString();
    manifest.voices = sortObject(manifest.voices);
    await atomicWrite(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

function sortObject(value) {
    return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    );
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(usage());
        return;
    }
    if (!args.input) throw new Error('--input is required');

    const input = await loadInput(args.input);
    const voiceId = args.voice || input?.voiceId || DEFAULT_VOICE_ID;
    let phrases = uniquePhrases(input, args.limit);
    if (args.only) {
        phrases = phrases.filter(({ key }) => key === args.only);
        if (phrases.length === 0) {
            throw new Error(`--only did not match a resolved phrase key: ${args.only}`);
        }
    }
    if (phrases.length === 0) throw new Error('Input contains no speakable phrases');

    console.log(
        `[voice-pack] ${phrases.length} unique phrase(s), voice ${voiceId}, `
        + `source ${basename(args.input)}`
    );
    if (args.dryRun) return;

    const manifest = await readManifest();
    const pack = manifest.voices[voiceId] ||= {
        label: input?.label || voiceId,
        model: MODEL_ID,
        dtype: args.dtype,
        format: 'wav',
        entries: {}
    };
    pack.entries ||= {};
    pack.model = MODEL_ID;
    pack.dtype = args.dtype;
    pack.format = 'wav';
    pack.source = basename(args.input);
    if (Array.isArray(input?.sourceRevisions)) {
        pack.sourceRevisions = input.sourceRevisions.map(item => ({ ...item }));
    }
    manifest.model = MODEL_ID;

    // Dynamic import keeps ordinary scripts and production builds free of the
    // authoring runtime. kokoro-js remains a devDependency for this command.
    const { KokoroTTS } = await import('kokoro-js');
    console.log(`[voice-pack] Loading ${MODEL_ID} (${args.dtype}/CPU)...`);
    const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: args.dtype,
        device: 'cpu'
    });

    let generated = 0;
    let retained = 0;
    for (let index = 0; index < phrases.length; index++) {
        const { key, text, spokenText } = phrases[index];
        const prior = pack.entries[key];
        const output = resolve(PUBLIC_ROOT, 'audio', 'recitation', voiceId, `${key}.wav`);
        const priorSpokenText = prior?.spokenText || prior?.text;
        if (!args.force && prior?.text === text && priorSpokenText === spokenText
            && existsSync(output)) {
            retained++;
            console.log(`[voice-pack] ${index + 1}/${phrases.length} retained ${text}`);
            continue;
        }

        console.log(`[voice-pack] ${index + 1}/${phrases.length} generating ${text}`);
        const audio = await tts.generate(spokenText, { voice: voiceId });
        const samples = audio.audio;
        const sampleRate = audio.sampling_rate;
        const signal = analyze(samples);
        const wav = Buffer.from(audio.toWav());
        await atomicWrite(output, wav);

        pack.entries[key] = {
            text,
            ...(spokenText !== text ? { spokenText } : {}),
            asset: `/audio/recitation/${voiceId}/${key}.wav`,
            mimeType: 'audio/wav',
            sampleRate,
            durationMs: Math.round((samples.length / sampleRate) * 1000),
            onsetsMs: speechOnsets(samples, sampleRate),
            peak: Number(signal.peak.toFixed(6))
        };
        generated++;
        // A full Keystone pack is hundreds of phrases. Persist each completed
        // asset so interruption resumes from proven work instead of leaving a
        // directory of unindexed WAV files that must all be synthesized again.
        pack.entries = sortObject(pack.entries);
        await persistManifest(manifest);
    }

    pack.entries = sortObject(pack.entries);
    await persistManifest(manifest);
    console.log(
        `[voice-pack] Complete: ${generated} generated, ${retained} retained; `
        + `${Object.keys(pack.entries).length} total manifest entries`
    );
}

main().catch(error => {
    console.error(`[voice-pack] ${error?.stack || error}`);
    process.exitCode = 1;
});
