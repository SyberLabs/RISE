/**
 * Say, in ordinary words, what a Jev plan (or a roll) will do, and what
 * RISE cannot do for a request, before anything plays.
 *
 * THE WORDS ARE A FUNCTION OF THE PLAN. Jev is a choice model, not a prose
 * generator, so nothing here comes from the model: every word is derived
 * from the exact values the Chamber will play. If the words and the reading
 * ever disagree, this file is wrong, and a test can say so.
 */

import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../content/modern-readings-manifest.json' with { type: 'json' };

const ENGINE_WORDS = Object.freeze({
  fractal: 'fractal light', apparitio: 'prismatic light', ostensoria: 'iridescent radial light',
  klee: 'line art', harmonograph: 'fine harmonic lines', turrell: 'soft atmospheric light'
});
const FACE_WORDS = Object.freeze({
  literary: 'Literary serif', display: 'Display serif', thick: 'Bold', jp: 'Japanese serif',
  mono: 'Monospaced', sans: 'Clean sans', book: 'Book serif'
});

/** Where in a work a reading opens, in words. */
export const SECTION_WORDS = Object.freeze({
  first: 'opening section', middle: 'middle section', last: 'final section',
  shortest: 'shortest section', longest: 'longest section'
});

const SHORT_PACE = Object.freeze({ 100: 'very slow', 150: 'slow', 200: 'steady', 250: 'brisk', 300: 'fast', 400: 'very fast', 500: 'fastest' });
const UNIT_WORDS = Object.freeze({ word: 'words', phrase: 'phrases', sentence: 'sentences', paragraph: 'paragraphs' });
const IMAGERY_WORDS = Object.freeze({
  off: 'no imagery', focals: 'a single quiet figure', genesis: 'growing line art', attractor: 'an attractor field'
});

/**
 * One line for a plan, in four parts: pace and unit, imagery, sound, type.
 * "slow phrases · soft atmospheric light · soft rain · literary serif".
 * Derived from the plan like every other word in this file.
 */
export function summarizeJevPlan(config) {
  const visual = config.visualConfig?.visualMode || config.visualMode;
  const engine = config.visualConfig?.interlocution?.procedural?.[0] || config.visualEngine;
  const imagery = config.projection === 'page' ? 'no motion'
    : visual === 'interlocution' ? ENGINE_WORDS[engine] || 'moving light'
      : IMAGERY_WORDS[visual] || 'no imagery';
  const sound = config.audio === 'silent' ? 'silence' : String(config.audio).replace(/-/gu, ' ');
  const size = config.presentation?.fontSize || config.fontSize;
  const face = (FACE_WORDS[config.chamberFace] || 'Serif').toLocaleLowerCase('en');
  return [
    `${SHORT_PACE[config.wpm] || 'steady'} ${UNIT_WORDS[config.chunkMode] || 'phrases'}`,
    imagery,
    sound,
    ['large', 'xlarge'].includes(size) ? `large ${face}` : face
  ];
}

/* ── What RISE cannot do, said before playback ─────────────────────────── */

const REFERENCES = Object.freeze([
  { pattern: /\btokyo\s+drift\b/u, name: 'Tokyo Drift', kind: 'film', reads: 'neon night colors, speed and energy' },
  { pattern: /\bfast\s+(?:and|&)\s+(?:the\s+)?furious\b/u, name: 'Fast & Furious', kind: 'film', reads: 'speed and energy' },
  { pattern: /\bneed\s+for\s+speed\b/u, name: 'Need for Speed', kind: 'game', reads: 'speed and neon color' },
  { pattern: /\binitial\s+d\b/u, name: 'Initial D', kind: 'series', reads: 'speed and night-road energy' },
  { pattern: /\bblade\s+runner\b/u, name: 'Blade Runner', kind: 'film', reads: 'neon night colors and atmosphere' },
  { pattern: /\bakira\b/u, name: 'Akira', kind: 'film', reads: 'neon color and speed' },
  { pattern: /\btron\b/u, name: 'Tron', kind: 'film', reads: 'electric neon lines' },
  { pattern: /\bcyberpunk\b/u, name: 'Cyberpunk', kind: 'style', reads: 'neon night colors' }
]);

/**
 * Read the reader's own words for things RISE cannot deliver. Deterministic
 * and local: it never guesses beyond what the words name.
 */
export function readJevRequest(intent) {
  const text = ` ${String(intent || '').normalize('NFKC').toLocaleLowerCase('en')} `;
  const reference = REFERENCES.find(item => item.pattern.test(text)) || null;
  const limits = [];
  if (reference && reference.kind !== 'style') {
    limits.push(`play the ${reference.name} soundtrack or show footage from it`);
  } else if (/\b(?:soundtrack|song|songs|music video|playlist|album|movie|film|trailer)\b/u.test(text)) {
    limits.push('play songs, soundtracks, or film clips');
  }
  if (/\b(?:car|cars|racing|race|drift|drifting|street race)\b/u.test(text)) {
    limits.push('show cars or racing');
  }
  const place = text.match(/\b(tokyo|japan|paris|london|new york|los angeles|seoul|hong kong)\b/u)?.[1];
  if (place) limits.push(`show real places such as ${place.replace(/\b\w/gu, c => c.toUpperCase())}`);
  return { reference, limits };
}


/** The released edition Jev (or a roll) may choose for a work, or null. */
export function jevReleasedEdition(workId) {
  const item = releaseInventory[workId];
  if (item) {
    return item.editionId?.startsWith('standard-ebooks:')
      && item.source?.url?.startsWith('https://standardebooks.org/ebooks/') ? item : null;
  }
  const original = modernManifest[workId];
  return original?.editionId === `rise-original:${workId}` ? original : null;
}

/** The works Jev or a roll may choose: released classics and RISE originals. */
export function jevReleasedWorkIds() {
  return [...Object.keys(releaseInventory), ...Object.keys(modernManifest)].filter(id => jevReleasedEdition(id));
}
