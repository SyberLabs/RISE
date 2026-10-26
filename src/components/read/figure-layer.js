/**
 * The image a figure is shown as, behind the reading (CC-009).
 *
 * DOM only, and only for SVG that has already been admitted
 * (src/core/svg-admission.js). The figure is an <img> of a blob: URL, never
 * markup in the page: an SVG image runs no script and fetches nothing by
 * platform rule, which is the second lock after admission. SMIL inside the
 * figure runs in reduced motion too; the image's document is its own.
 *
 * currentColor inside an image resolves in the image's document, not the
 * page's, so the theme's ink is written onto the figure's root as its
 * `color`, unless the figure sets its own. For the same reason the image
 * has neither the reading's colours nor its fonts: the theme's dark (its
 * background in a dark room) is given to the class `dark` (a hole, a
 * shadow, a body that gives no light), and the
 * reading's face is carried in as data for a figure that has text (an
 * image fetches nothing, and data is not fetched).
 */

const HEX = /^#[0-9a-f]{3,8}$/iu;
/** Up to the root <svg>: what admission lets come before it. */
const PROLOG = /^\s*(?:<\?xml[\s\S]*?\?>)?(?:\s*<!--[\s\S]*?-->)*\s*<svg\b/u;
const ROOT_ATTRIBUTES = /^(?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*/u;

/** The figure with the theme's ink as its root's colour, when the ink is a colour and the root sets none. */
export function inkFigure(svg, ink) {
  const head = PROLOG.exec(svg);
  if (!head || typeof ink !== 'string' || !HEX.test(ink)) return svg;
  const attributes = ROOT_ATTRIBUTES.exec(svg.slice(head[0].length))[0];
  if (/\scolor\s*=/u.test(attributes)) return svg;
  return `${head[0]} color="${ink}"${svg.slice(head[0].length)}`;
}

/**
 * The figure as it is drawn: inkFigure's colour, then a <style> first inside the root giving the class `dark` the
 * theme's dark and the figure's text the reading's face (`face`: embeddedFace's), each only when there is
 * one to give and the figure could use it, the face only when the figure names none of its own.
 */
export function paintFigure(svg, { ink = null, dark = null, face = null } = {}) {
  const inked = inkFigure(svg, ink);
  const rules = [
    typeof dark === 'string' && HEX.test(dark) ? `.dark{fill:${dark}}` : '',
    // A face the figure names is the model's choice, and a rule here would override it.
    face && /<text\b/u.test(svg) && !/font-family/u.test(svg) ? `${face.css}text{font-family:${face.family}}` : ''
  ].join('');
  const head = PROLOG.exec(inked);
  if (!rules || !head) return inked;
  const open = /^(?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*>/u.exec(inked.slice(head[0].length));
  if (!open) return inked;
  const at = head[0].length + open[0].length;
  return `${inked.slice(0, at)}<style>${rules}</style>${inked.slice(at)}`;
}

/** The reading's face, as each family's normal faces with their files as data, by the family stack asked for. */
const faces = new Map();
const FACE_NAME = '"RISE reading face"';

function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

/** The stack after its first family, which the image may have on the device; null when there is none. */
function fallbackFace(stack) {
  const rest = stack.split(',').slice(1).map(name => name.trim()).filter(Boolean);
  return rest.length ? { css: '', family: rest.join(', ') } : null;
}

async function loadFace(doc, stack) {
  const first = stack.split(',')[0].trim().replace(/^["']|["']$/gu, '');
  const found = [];
  for (const sheet of doc.styleSheets ?? []) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules ?? []) {
      if (rule.type !== 5) continue;
      const get = name => rule.style.getPropertyValue(name).trim();
      const weight = get('font-weight') || '400';
      const holds400 = weight === 'normal' || weight === '400' || /^\d+\s+\d+$/u.test(weight) && Number(weight.split(/\s+/u)[0]) <= 400 && Number(weight.split(/\s+/u)[1]) >= 400;
      if (get('font-family').replace(/^["']|["']$/gu, '') !== first || !['', 'normal'].includes(get('font-style')) || !holds400) continue;
      const url = /url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/u.exec(get('src'))?.[1];
      if (url) found.push({ url: new URL(url, sheet.href ?? doc.baseURI).href, range: get('unicode-range') });
    }
  }
  if (!found.length) return fallbackFace(stack);
  const css = await Promise.all(found.map(async ({ url, range }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return `@font-face{font-family:${FACE_NAME};src:url(data:font/woff2;base64,${base64(await response.arrayBuffer())}) format("woff2")${range ? `;unicode-range:${range}` : ''}}`;
  }));
  const rest = stack.split(',').slice(1).map(name => name.trim()).filter(Boolean);
  return { css: css.join(''), family: [FACE_NAME, ...rest].join(', ') };
}

/**
 * The reading's face for a figure: the page's own @font-face rules for the first family of `stack`, their files
 * fetched (the page has them already) and carried as data; when there are none or they cannot be had, the rest of
 * the stack, which the image may find on the device. Fetched once a stack.
 */
export function embeddedFace(doc, stack) {
  if (typeof stack !== 'string' || !stack.trim()) return Promise.resolve(null);
  if (!faces.has(stack)) faces.set(stack, loadFace(doc, stack).catch(() => fallbackFace(stack)));
  return faces.get(stack);
}

const SOLID = /^rgba?\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*1(?:\.0+)?)?\s*\)$/u;

/** A computed CSS colour (`rgb(…)`, or `rgba(…, 1)`) as hex, for inkFigure; null for anything else. */
export function hexOfColor(color) {
  const match = SOLID.exec(String(color ?? '').trim());
  if (!match) return null;
  return `#${match.slice(1, 4).map(part => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * `dark`: the theme's dark, for the class `dark`. `face`: a promise of embeddedFace's; a figure is drawn
 * once it has settled, so its text never changes face in front of the reader, and at once when there is none.
 */
export function mountFigureLayer({ field, insertBehindReading, svg, ink = null, dark = null, face = null, onError = () => {} }) {
  const img = document.createElement('img');
  img.className = 'chamber-figure';
  img.setAttribute('aria-hidden', 'true');
  img.setAttribute('alt', '');
  img.setAttribute('decoding', 'async');
  let url = null;
  const release = () => {
    if (url === null) return;
    URL.revokeObjectURL(url);
    url = null;
  };
  let done = false;
  img.addEventListener('load', release);
  img.addEventListener('error', () => {
    release();
    if (done) return;
    done = true;
    onError();
  });
  const draw = given => {
    if (done) return;
    url = URL.createObjectURL(new Blob([paintFigure(svg, { ink, dark, face: given })], { type: 'image/svg+xml' }));
    img.setAttribute('src', url);
  };
  if (face) Promise.resolve(face).then(draw, () => draw(null));
  else draw(null);
  insertBehindReading(field, img);
  return {
    node: img,
    destroy() {
      done = true;
      release();
      img.remove();
    }
  };
}
