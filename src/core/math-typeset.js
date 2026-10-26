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
import { asSaid, fallbackMath, unitWords } from './math-reading.js';

export { hasMath, splitMath } from './math-text.js';

let katex = null;
let sre = null;
let loading = null;
/** A formula's speech, kept from the first time it is asked for: the voice and the speech governor must agree on it. */
const said = new Map();

/** Names in SRE's alphabets a listener would not say, wherever an alphabet lists them. */
const RENAMED = new Map([['nabla', 'del'], ['partial differential', 'partial']]);

/**
 * The English rules as SRE is handed them, with the names a listener would say: ℏ "h bar", lim "limit", ∇ "del",
 * ∂ "partial", and the operators a del takes (math-typeset.js engineSpeech) "dot" and "cross".
 */
function corrected(json) {
  const visit = node => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => { if (RENAMED.has(item)) node[index] = RENAMED.get(item); else visit(item); });
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (node.key === '210F') node.mappings = { default: { default: 'h bar' } };
    if (node.key === '2219') node.mappings = { default: { default: 'dot' } };
    if (node.key === '2A2F') node.mappings = { default: { default: 'cross' } };
    if (node.key === 'lim' && node.mappings?.clearspeak) node.mappings.clearspeak.default = 'limit';
    for (const value of Object.values(node)) visit(value);
  };
  const maps = JSON.parse(json);
  visit(maps);
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
  // Brackets as ClearSpeak's Auto says them, which asSaid (math-reading.js) rewords; Paren_Speak would lose |x| as
  // "the absolute value of x".
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
    const read = mathml
      // KaTeX marks upright letters `mathvariant="normal"`, which SRE would say aloud; the TeX annotation is not maths.
      .replace(/<annotation[\s\S]*?<\/annotation>/gu, '').replace(/ mathvariant="normal"/gu, '')
      // A del's dot and cross are a divergence and a curl, not times: the operators SRE names "dot" and "cross" (corrected).
      .replace(/(<mi>∇<\/mi>)<mo>⋅<\/mo>/gu, '$1<mo>∙</mo>').replace(/(<mi>∇<\/mi>)<mo>×<\/mo>/gu, '$1<mo>⨯</mo>')
      // A unit written as text is said in words (meters per second), not letter by letter.
      .replace(/<mtext>([^<]*)<\/mtext>/gu, (text, inner) => { const words = unitWords(inner); return words ? `<mtext>${words}</mtext>` : text; });
    const speech = sre.toSpeech(read);
    return typeof speech === 'string' && speech.trim() ? asSaid(speech) : null;
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
