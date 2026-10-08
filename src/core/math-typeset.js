/**
 * Maths in what is shown: `$…$` inline and `$$…$$` on its own, typeset with
 * KaTeX (docs/superpowers/specs/2026-10-08-creative-control-design.md §10).
 *
 * KaTeX and its fonts are RISE's own files, loaded only once a reading shows
 * maths (a Current with a `$` in a shown text), never on first load. Until
 * they have loaded, maths shows as the TeX it was written in, so a slow
 * network costs legibility for a moment and never a frame.
 *
 * `trust: false` and `throwOnError: false`: KaTeX emits no link, no script
 * and no error; a wrong formula shows as its source in red, which is the
 * model's to repair.
 *
 * Only the card imports this module. Finding the maths in a text is
 * math-text.js, which the Worker's validator reaches: wrangler bundles every
 * import below it, and KaTeX's stylesheet names font files it cannot load.
 */

export { hasMath, splitMath } from './math-text.js';

let katex = null;
let loading = null;

/** Fetch KaTeX (its code, its stylesheet, its fonts) once. Resolves when maths can be typeset. */
export function loadMath() {
  if (katex) return Promise.resolve(katex);
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([module]) => { katex = module.default ?? module; return katex; })
    .catch(error => { loading = null; throw error; });
  return loading;
}

/** Whether maths can be typeset now, without waiting. */
export function mathReady() {
  return katex !== null;
}

/**
 * A formula as HTML, typeset if KaTeX has loaded, else as its escaped source.
 * Safe to insert: KaTeX runs with trust off, and the fallback is escaped.
 */
export function renderMath(tex, { display = false } = {}) {
  const source = String(tex ?? '');
  if (!katex) return `<span class="atom-math is-source">${escape(source)}</span>`;
  try {
    return katex.renderToString(source, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', output: 'html' });
  } catch {
    return `<span class="atom-math is-source">${escape(source)}</span>`;
  }
}

function escape(value) {
  return value.replace(/[&<>"']/gu, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** For tests: forget the loaded KaTeX. */
export function resetMathForTests() {
  katex = null;
  loading = null;
}
