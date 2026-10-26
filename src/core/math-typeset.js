/**
 * Maths seen and heard from one parse (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.4):
 * KaTeX typesets each formula, with its MathML beside it for a screen reader,
 * and the Speech Rule Engine (SRE) says that same MathML in ClearSpeak.
 *
 * KaTeX, its fonts, SRE and SRE's English rules are RISE's own files, loaded
 * only once a reading has maths, never on first load. SRE is handed its rules
 * through `custom`, so it fetches nothing from anywhere (left to itself, a
 * browser SRE fetches them from a CDN). Until the load settles, a formula shows and is said as
 * fallbackMath's plain reading, never as its source.
 *
 * `trust: false`: KaTeX emits no link and no script.
 *
 * Only a page that shows a reading imports this module. Finding the maths in
 * a text is math-text.js, which the Worker's validator reaches: wrangler
 * bundles every import below it, and KaTeX's stylesheet names font files it
 * cannot load.
 */

import { spokenWith } from './math-text.js';
import { fallbackMath } from './math-reading.js';

export { hasMath, splitMath } from './math-text.js';

let katex = null;
let sre = null;
let loading = null;
/** A formula's speech, kept from the first time it is asked for: the voice and the speech governor must agree on it. */
const said = new Map();

/** The English rules as SRE is handed them, with two names a listener would not say: ℏ and lim. */
function corrected(json) {
  const maps = JSON.parse(json);
  for (const entries of Object.values(maps)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry?.key === '210F') entry.mappings = { default: { default: 'h bar' } };
      if (entry?.key === 'lim' && entry.mappings?.clearspeak) entry.mappings.clearspeak.default = 'limit';
    }
  }
  return JSON.stringify(maps);
}

async function loadSpeech() {
  const [base, en] = await Promise.all([
    import('speech-rule-engine/lib/mathmaps/base.json?raw'),
    import('speech-rule-engine/lib/mathmaps/en.json?raw')
  ]);
  const rules = { base: base.default, en: corrected(en.default) };
  const custom = locale => (rules[locale] === undefined ? Promise.reject(new Error(`No rules for ${locale}`)) : Promise.resolve(rules[locale]));
  // SRE reads its feature vector once, as it is first evaluated, and loads its base rules through `custom` then.
  // Not `delay`: in 4.1.4 the first setupEngine after a delay only clears it and loads nothing.
  globalThis.SREfeature = { custom };
  const module = await import('speech-rule-engine');
  const engine = module.default ?? module;
  await engine.setupEngine({ locale: 'en', domain: 'clearspeak', style: 'TriangleSymbol_Delta', modality: 'speech', markup: 'none', custom });
  await engine.engineReady();
  return engine;
}

/** Fetch KaTeX (its code, its stylesheet, its fonts) and the speech engine, once. Resolves when maths can be typeset. */
export function loadMath() {
  if (katex) return Promise.resolve(katex);
  loading ??= Promise.all([
    Promise.all([import('katex'), import('katex/dist/katex.min.css')]),
    loadSpeech().catch(() => null)
  ]).then(([[module], engine]) => {
    katex = module.default ?? module;
    sre = engine;
    return katex;
  }).catch(error => { loading = null; throw error; });
  return loading;
}

/** Whether maths can be typeset now, without waiting. */
export function mathReady() {
  return katex !== null;
}

function escape(value) {
  return value.replace(/[&<>"']/gu, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const fallbackHtml = tex => `<span class="atom-math is-fallback">${escape(fallbackMath(tex).text)}</span>`;

function katexHtml(source, display) {
  return katex.renderToString(source, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
}

/**
 * A formula as HTML: KaTeX's once it has loaded, else the plain reading.
 * Safe to insert: KaTeX runs with trust off, and the plain reading is escaped.
 */
export function renderMath(tex, { display = false } = {}) {
  const source = String(tex ?? '');
  if (!katex) return fallbackHtml(source);
  try {
    return katexHtml(source, display);
  } catch {
    return fallbackHtml(source);
  }
}

/** SRE's ClearSpeak reading of KaTeX's MathML for a formula, or null. */
function engineSpeech(source, display) {
  if (!katex || !sre) return null;
  try {
    const mathml = /<math[\s\S]*<\/math>/u.exec(katexHtml(source, display))?.[0];
    if (!mathml) return null;
    // KaTeX marks upright letters `mathvariant="normal"`, which SRE would say aloud; the TeX annotation is not maths.
    const speech = sre.toSpeech(mathml.replace(/<annotation[\s\S]*?<\/annotation>/gu, '').replace(/ mathvariant="normal"/gu, ''));
    return typeof speech === 'string' && speech.trim() ? speech.replace(/\s+/gu, ' ').trim() : null;
  } catch {
    return null;
  }
}

/** A formula as it is said: ClearSpeak once the engine has loaded, else the plain reading; the same all session. */
export function speechOf(tex, { display = false } = {}) {
  const source = String(tex ?? '');
  const key = `${display ? '$$' : '$'}${source}`;
  if (!said.has(key)) said.set(key, engineSpeech(source, display) ?? fallbackMath(source).speech);
  return said.get(key);
}

/** A formula for the eye and the ear, from one parse. */
export function typeset(tex, { display = false } = {}) {
  return { html: renderMath(tex, { display }), speech: speechOf(tex, { display }) };
}

/** A passage as it is said, with where each written place falls in it (math-text.js spokenWith). */
export function speakable(text) {
  return spokenWith(text, (tex, display) => speechOf(tex, { display }));
}

/** For tests: forget the loaded typesetter and every formula's speech. */
export function resetMathForTests() {
  katex = null;
  sre = null;
  loading = null;
  said.clear();
}
