/**
 * Narration lane — spoken clips that cannot become beds or swells.
 *
 * See docs/vision/NARRATION-LANE-SPEC.md. Recitation is Chamber presentation;
 * this module is the score: voice identity, word/span timing, pronunciation
 * review, and authored bed ducking.
 */

import { looksLikeUri } from './render/hash.js';

export const NARRATION_LANE_SCHEMA = 'rise.narration-lane.v1';
export const PROGRAM_NARRATION_KINDS = Object.freeze(['spoken']);
export const NARRATION_DUCK_TARGETS = Object.freeze(['bed']);

export const NARRATION_LIMITS = Object.freeze({
  maxIdLength: 160,
  maxWords: 512,
  maxPronunciations: 64,
  maxWordText: 80,
  maxSpokenForm: 120,
  maxDuckMs: 10_000,
  minDurationMs: 1,
  maxDurationMs: 60_000
});

export const DEFAULT_NARRATION_DUCK = Object.freeze({
  target: 'bed',
  floor: 0.18,
  downMs: 150,
  upMs: 600
});

export class NarrationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'NarrationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new NarrationError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('NARRATION_OBJECT', 'Expected an object', path);
  }
  return value;
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('NARRATION_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > NARRATION_LIMITS.maxIdLength) {
    fail('NARRATION_ID', `Ids may not exceed ${NARRATION_LIMITS.maxIdLength} characters`, path);
  }
  if (looksLikeUri(value) || /^(soundscape|swell|tone):/i.test(value)) {
    fail('NARRATION_NOT_VOICE',
      'A spoken clip names a voice, not a URI, soundscape, swell, or tone', path, { value });
  }
  return value;
}

function boundedText(value, path, max) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('NARRATION_TEXT', 'Expected a non-empty string', path);
  }
  const text = value.trim();
  if (text.length > max) {
    fail('NARRATION_TEXT', `Text may not exceed ${max} characters`, path);
  }
  return text;
}

function integerRange(value, min, max, path) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('NARRATION_INTEGER', `Expected an integer in [${min}, ${max}]`, path);
  }
  return value;
}

export function isVoiceIdentity(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return false;
  if (looksLikeUri(value)) return false;
  if (/^(soundscape|swell|tone):/i.test(value)) return false;
  return true;
}

export function validateNarrationDuck(value, path = '$.duck') {
  if (value == null) return null;
  const source = record(value, path);
  const allowed = new Set(['target', 'floor', 'downMs', 'upMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      fail('NARRATION_UNKNOWN_FIELD', `Unknown duck field: ${key}`, `${path}.${key}`);
    }
  }
  if (source.target !== 'bed') {
    fail('NARRATION_DUCK_TARGET',
      'Narration may duck the bed only; it cannot take swell or atmosphere authority',
      `${path}.target`, { target: source.target });
  }
  const floor = source.floor == null ? DEFAULT_NARRATION_DUCK.floor : source.floor;
  if (typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0 || floor > 1) {
    fail('NARRATION_DUCK_FLOOR', 'duck.floor must be a finite number in [0, 1]', `${path}.floor`);
  }
  return Object.freeze({
    target: 'bed',
    floor,
    downMs: source.downMs == null
      ? DEFAULT_NARRATION_DUCK.downMs
      : integerRange(source.downMs, 0, NARRATION_LIMITS.maxDuckMs, `${path}.downMs`),
    upMs: source.upMs == null
      ? DEFAULT_NARRATION_DUCK.upMs
      : integerRange(source.upMs, 0, NARRATION_LIMITS.maxDuckMs, `${path}.upMs`)
  });
}

export function validateNarrationWords(value, path = '$.words') {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > NARRATION_LIMITS.maxWords) {
    fail('NARRATION_WORDS', `words accepts at most ${NARRATION_LIMITS.maxWords} entries`, path);
  }
  if (!value.length) return null;
  return Object.freeze(value.map((item, index) => {
    const word = record(item, `${path}[${index}]`);
    const allowed = new Set(['text', 'fromCharacter', 'toCharacter', 'durationMs']);
    for (const key of Object.keys(word)) {
      if (!allowed.has(key)) {
        fail('NARRATION_UNKNOWN_FIELD', `Unknown word field: ${key}`, `${path}[${index}].${key}`);
      }
    }
    const fromCharacter = integerRange(word.fromCharacter, 0, Number.MAX_SAFE_INTEGER,
      `${path}[${index}].fromCharacter`);
    const toCharacter = integerRange(word.toCharacter, 0, Number.MAX_SAFE_INTEGER,
      `${path}[${index}].toCharacter`);
    if (toCharacter <= fromCharacter) {
      fail('NARRATION_WORDS', 'Word spans must be half-open and ordered', `${path}[${index}]`);
    }
    return Object.freeze({
      text: boundedText(word.text, `${path}[${index}].text`, NARRATION_LIMITS.maxWordText),
      fromCharacter,
      toCharacter,
      durationMs: integerRange(word.durationMs, NARRATION_LIMITS.minDurationMs,
        NARRATION_LIMITS.maxDurationMs, `${path}[${index}].durationMs`)
    });
  }));
}

export function validateNarrationPronunciations(value, path = '$.pronunciations') {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > NARRATION_LIMITS.maxPronunciations) {
    fail('NARRATION_PRONUNCIATION',
      `pronunciations accepts at most ${NARRATION_LIMITS.maxPronunciations} entries`, path);
  }
  if (!value.length) return null;
  return Object.freeze(value.map((item, index) => {
    const row = record(item, `${path}[${index}]`);
    const allowed = new Set(['source', 'spoken']);
    for (const key of Object.keys(row)) {
      if (!allowed.has(key)) {
        fail('NARRATION_UNKNOWN_FIELD', `Unknown pronunciation field: ${key}`,
          `${path}[${index}].${key}`);
      }
    }
    return Object.freeze({
      source: boundedText(row.source, `${path}[${index}].source`, NARRATION_LIMITS.maxSpokenForm),
      spoken: boundedText(row.spoken, `${path}[${index}].spoken`, NARRATION_LIMITS.maxSpokenForm)
    });
  }));
}

/**
 * Structural cue check. Source-text proofs (pronunciation occurs in span,
 * words stay inside the clip) run in the score lane, which has the source.
 */
export function validateNarrationCue(value, path = '$.cue') {
  const source = record(value, path);
  if (source.kind !== 'spoken') {
    fail('NARRATION_KIND', 'A narration track accepts only spoken cues', `${path}.kind`, {
      kind: source.kind
    });
  }
  const allowed = new Set([
    'kind', 'voiceId', 'voiceAssetId', 'duck', 'words', 'pronunciations'
  ]);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      fail('NARRATION_UNKNOWN_FIELD', `Unknown spoken field: ${key}`, `${path}.${key}`);
    }
  }
  const cue = { kind: 'spoken' };
  if (source.voiceId != null) cue.voiceId = exactId(source.voiceId, `${path}.voiceId`);
  if (source.voiceAssetId != null) {
    cue.voiceAssetId = exactId(source.voiceAssetId, `${path}.voiceAssetId`);
  }
  if (!cue.voiceId && !cue.voiceAssetId) {
    fail('NARRATION_VOICE', 'A spoken cue needs voiceId or voiceAssetId', path);
  }
  const duck = validateNarrationDuck(source.duck, `${path}.duck`);
  if (duck) cue.duck = duck;
  const words = validateNarrationWords(source.words, `${path}.words`);
  if (words) cue.words = words;
  const pronunciations = validateNarrationPronunciations(
    source.pronunciations, `${path}.pronunciations`);
  if (pronunciations) cue.pronunciations = pronunciations;
  return Object.freeze(cue);
}

export function assertPronunciationsInSource(pronunciations, text, path = '$.pronunciations') {
  const body = typeof text === 'string' ? text : '';
  for (const [index, row] of (pronunciations || []).entries()) {
    if (!body.includes(row.source)) {
      fail('NARRATION_PRONUNCIATION',
        `Pronunciation source "${row.source}" does not occur in the spanned text`,
        `${path}[${index}].source`);
    }
  }
  return body;
}

export function assertWordsInsideSpan(words, fromCharacter, toCharacter, text, path = '$.words') {
  for (const [index, word] of (words || []).entries()) {
    if (word.fromCharacter < fromCharacter || word.toCharacter > toCharacter) {
      fail('NARRATION_WORDS', 'Word timings must stay inside the spoken source span',
        `${path}[${index}]`);
    }
    const slice = String(text || '').slice(word.fromCharacter, word.toCharacter);
    if (slice !== word.text && slice.trim() !== word.text) {
      fail('NARRATION_WORDS', 'Word text must match the source span; narration does not rewrite',
        `${path}[${index}].text`, { expected: slice, actual: word.text });
    }
  }
}

export function spokenCaptionText(sourceText, _pronunciations) {
  return String(sourceText || '');
}

export function duckGainAt(run, ms) {
  if (!run?.duck || run.duck.target !== 'bed') return 1;
  const floor = run.duck.floor;
  const down = Math.max(0, run.duck.downMs | 0);
  const up = Math.max(0, run.duck.upMs | 0);
  const into = ms - run.fromMs;
  const out = run.toMs - ms;
  if (into < 0 || out <= 0) return 1;
  let gain = floor;
  if (down > 0 && into < down) {
    const t = into / down;
    gain = 1 - (1 - floor) * t;
  } else if (up > 0 && out < up) {
    const t = out / up;
    gain = 1 - (1 - floor) * t;
  }
  return Math.max(0, Math.min(1, gain));
}
