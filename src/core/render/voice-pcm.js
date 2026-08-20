/**
 * Spoken PCM for the offline mixer.
 *
 * Live Chamber recitation fetches `/audio/recitation/{voiceId}/{key}.wav`
 * after a complete pack match. Export reuses that lookup: decode the same
 * WAV bytes, map phrase/word spans onto narrationRuns. Assigned voice
 * assets come from inventory bytes. Missing speech refuses — it does not
 * invent a bed or a sine.
 */

import { resolveVoicePackEntry, voicePackManifest } from '../../audio/voice-pack.js';
import { fail } from './errors.js';
import { decodeWav } from './wav.js';

function nodeModule(name) {
  const loader = globalThis.process?.getBuiltinModule;
  return typeof loader === 'function' ? loader(name) : null;
}

function asBytes(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function addBytes(map, key, value) {
  const bytes = asBytes(value);
  if (!key || !bytes) return;
  map.set(String(key), bytes);
}

/**
 * Gather assigned voice bytes without putting payloads on preflight assets.
 * `inventory.bytesById` / `inventory.voiceBytes` hold WAV payloads keyed by
 * asset id or recitation path. Asset records may also carry `.bytes` when
 * they never enter preflight validation.
 */
export function collectVoiceBytes(inventory = {}, extra = null) {
  const map = new Map();
  const bags = [extra, inventory.voiceBytes, inventory.bytesById];
  for (const bag of bags) {
    if (!bag) continue;
    if (bag instanceof Map) {
      for (const [key, value] of bag) addBytes(map, key, value);
    } else if (typeof bag === 'object') {
      for (const [key, value] of Object.entries(bag)) addBytes(map, key, value);
    }
  }
  for (const asset of inventory.assets || []) {
    if (asset?.bytes) addBytes(map, asset.assetId, asset.bytes);
  }
  return map;
}

export function readPublicRecitationAsset(assetPath) {
  const relative = String(assetPath || '').replace(/^\/+/, '');
  if (!relative.startsWith('audio/recitation/') || relative.includes('..')) return null;
  try {
    const fs = nodeModule('node:fs');
    const path = nodeModule('node:path');
    if (!fs || !path) return null;
    const file = path.resolve(process.cwd(), 'public', relative);
    if (!fs.existsSync(file)) return null;
    return new Uint8Array(fs.readFileSync(file));
  } catch {
    return null;
  }
}

function lookupBytes(key, bytesMap) {
  if (!key) return null;
  const variants = [key, String(key).replace(/^\/+/, ''), `/${String(key).replace(/^\/+/, '')}`];
  for (const variant of variants) {
    if (bytesMap.has(variant)) return bytesMap.get(variant);
  }
  return null;
}

function loadPackBytes(assetPath, bytesMap, readVoiceAsset) {
  const fromMap = lookupBytes(assetPath, bytesMap);
  if (fromMap) return fromMap;
  if (typeof readVoiceAsset === 'function') return asBytes(readVoiceAsset(assetPath));
  return readPublicRecitationAsset(assetPath);
}

function wordSpans(run) {
  const words = run.words || run.cue?.words;
  if (!Array.isArray(words) || !words.length) return null;
  const total = words.reduce((sum, word) => sum + Math.max(0, word.durationMs | 0), 0) || 1;
  const window = Math.max(1, run.toMs - run.fromMs);
  let cursor = run.fromMs;
  return words.map((word) => {
    const span = Math.max(1, Math.round((word.durationMs / total) * window));
    const fromMs = cursor;
    const toMs = Math.min(run.toMs, cursor + span);
    cursor = toMs;
    return { text: word.text, fromMs, toMs };
  });
}

function atomSpans(plan, run) {
  const overlapping = (plan.atoms || []).filter(atom =>
    atom.endMs > run.fromMs && atom.startMs < run.toMs);
  const owned = overlapping.filter(atom =>
    !run.cueId || atom.narrationCueId == null || atom.narrationCueId === run.cueId);
  return (owned.length ? owned : overlapping).map(atom => ({
    text: atom.text,
    fromMs: Math.max(atom.startMs, run.fromMs),
    toMs: Math.min(atom.endMs, run.toMs)
  })).filter(span => span.toMs > span.fromMs);
}

function packSpans(plan, run, voiceId, manifest) {
  const words = wordSpans(run);
  if (words && words.every(span => resolveVoicePackEntry(voiceId, span.text, manifest))) {
    return words;
  }
  const atoms = atomSpans(plan, run);
  if (atoms.length) return atoms;
  return words || [];
}

function missingSpeech(message, path, details) {
  fail('RENDER_AUDIO_MISSING', message, path, details);
}

/**
 * Resolve each spoken run to decoded clips placed on the narration window.
 */
export function resolveSpokenClips(plan, {
  inventory = {},
  voiceBytes = null,
  readVoiceAsset = null,
  manifest = voicePackManifest
} = {}) {
  const bytesMap = collectVoiceBytes(inventory, voiceBytes);
  const clips = [];
  for (const run of plan.narrationRuns || []) {
    if (run.cueKind !== 'narration:spoken' && run.cue?.kind !== 'spoken') continue;
    const voiceAssetId = run.voiceAssetId || run.cue?.voiceAssetId || null;
    const voiceId = run.voiceId || run.cue?.voiceId || null;
    const path = '$.narrationRuns';

    if (voiceAssetId) {
      const bytes = lookupBytes(voiceAssetId, bytesMap)
        || (typeof readVoiceAsset === 'function' ? asBytes(readVoiceAsset(voiceAssetId)) : null);
      if (!bytes) {
        missingSpeech(
          `Spoken cue is missing assigned audio for ${voiceAssetId}`,
          path,
          { voiceAssetId, cueId: run.cueId }
        );
      }
      let decoded;
      try {
        decoded = decodeWav(bytes);
      } catch (error) {
        missingSpeech(
          `Spoken asset ${voiceAssetId} is not decodable PCM`,
          path,
          { voiceAssetId, reason: String(error?.message || error) }
        );
      }
      clips.push({ fromMs: run.fromMs, toMs: run.toMs, ...decoded });
      continue;
    }

    if (!voiceId) {
      missingSpeech('A spoken cue needs voiceId or voiceAssetId', path, { cueId: run.cueId });
    }

    const spans = packSpans(plan, run, voiceId, manifest);
    if (!spans.length) {
      missingSpeech(
        `Voice pack ${voiceId} has no phrase spanning this spoken clip`,
        path,
        { voiceId, cueId: run.cueId }
      );
    }
    for (const span of spans) {
      const entry = resolveVoicePackEntry(voiceId, span.text, manifest);
      if (!entry) {
        missingSpeech(
          `Voice pack ${voiceId} has no recitation for "${String(span.text || '').trim()}"`,
          path,
          { voiceId, cueId: run.cueId, text: span.text }
        );
      }
      const bytes = loadPackBytes(entry.asset, bytesMap, readVoiceAsset);
      if (!bytes) {
        missingSpeech(
          `Missing recitation bytes for ${entry.asset}`,
          path,
          { voiceId, cueId: run.cueId, asset: entry.asset }
        );
      }
      let decoded;
      try {
        decoded = decodeWav(bytes);
      } catch (error) {
        missingSpeech(
          `Recitation asset ${entry.asset} is not decodable PCM`,
          path,
          { voiceId, asset: entry.asset, reason: String(error?.message || error) }
        );
      }
      clips.push({ fromMs: span.fromMs, toMs: span.toMs, ...decoded });
    }
  }
  return clips;
}

export function resampleAudio(clip, destRate, destChannels) {
  const srcRate = clip.sampleRate;
  const srcChannels = clip.channels;
  const src = clip.pcm;
  const srcFrames = Math.floor(src.length / srcChannels);
  let interleaved = src;
  if (srcChannels !== destChannels) {
    const converted = new Float32Array(srcFrames * destChannels);
    for (let i = 0; i < srcFrames; i += 1) {
      if (srcChannels === 1) {
        const sample = src[i];
        for (let ch = 0; ch < destChannels; ch += 1) converted[i * destChannels + ch] = sample;
      } else {
        let sum = 0;
        for (let ch = 0; ch < srcChannels; ch += 1) sum += src[i * srcChannels + ch];
        const mono = sum / srcChannels;
        if (destChannels === 1) converted[i] = mono;
        else {
          converted[i * destChannels] = src[i * srcChannels];
          converted[i * destChannels + 1] = srcChannels > 1 ? src[i * srcChannels + 1] : mono;
          for (let ch = 2; ch < destChannels; ch += 1) converted[i * destChannels + ch] = mono;
        }
      }
    }
    interleaved = converted;
  }
  if (srcRate === destRate || srcFrames === 0) {
    return {
      pcm: interleaved,
      sampleRate: destRate,
      channels: destChannels,
      frames: srcFrames
    };
  }
  const ratio = srcRate / destRate;
  const outFrames = Math.max(0, Math.round(srcFrames / ratio));
  const pcm = new Float32Array(outFrames * destChannels);
  for (let i = 0; i < outFrames; i += 1) {
    const x = i * ratio;
    const i0 = Math.min(srcFrames - 1, Math.floor(x));
    const i1 = Math.min(srcFrames - 1, i0 + 1);
    const t = x - i0;
    for (let ch = 0; ch < destChannels; ch += 1) {
      const a = interleaved[i0 * destChannels + ch];
      const b = interleaved[i1 * destChannels + ch];
      pcm[i * destChannels + ch] = a + (b - a) * t;
    }
  }
  return { pcm, sampleRate: destRate, channels: destChannels, frames: outFrames };
}

export function renderSpokenPcm(plan, options, {
  sampleRate,
  channels,
  fromMs,
  toMs,
  frames
}) {
  const spoken = new Float32Array(frames * channels);
  const clips = resolveSpokenClips(plan, options);
  for (const clip of clips) {
    const resampled = resampleAudio(clip, sampleRate, channels);
    const startFrame = Math.round(((clip.fromMs - fromMs) / 1000) * sampleRate);
    const windowFrames = Math.max(
      0,
      Math.round(((Math.min(clip.toMs, toMs) - clip.fromMs) / 1000) * sampleRate)
    );
    const copyFrames = Math.min(resampled.frames, windowFrames);
    for (let i = 0; i < copyFrames; i += 1) {
      const dest = startFrame + i;
      if (dest < 0 || dest >= frames) continue;
      for (let ch = 0; ch < channels; ch += 1) {
        spoken[dest * channels + ch] += resampled.pcm[i * channels + ch];
      }
    }
  }
  return spoken;
}
