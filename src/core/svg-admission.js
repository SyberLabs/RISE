/**
 * Admission of a figure: an SVG document a model wrote, before anyone draws
 * it (CC-009; docs/specs/RISE-SDK.md §3.9).
 *
 * The same pure function runs in the Worker, which refuses the whole tool
 * call, and in the card, which never trusts the Worker's absence and falls
 * back instead of drawing. It reads the text with a small tokenizer, not a
 * DOM: it must run in the Worker, and the card must not parse untrusted
 * markup into its own document to judge it.
 *
 * It is the first of two locks. The card draws an admitted figure only as an
 * <img> of a blob: URL, and an SVG image runs no script and fetches nothing
 * by platform rule. Admission is still closed by default: an element is drawn
 * only if it is on the list below, an href only if it points inside the
 * figure, and a value or a stylesheet that names anything outside it is
 * refused. Entities are decoded before a value is judged, and CSS escapes
 * are refused outright, so a spelling cannot hide a rule's word.
 */
import { EXPERIENCE_PROGRAM_LIMITS } from './experience-program.js';

export const SVG_FIGURE_BYTES = EXPERIENCE_PROGRAM_LIMITS.maxSceneSvgBytes;

/** The elements a figure may use, and nothing else; feImage, which fetches, is not one. */
export const SVG_ELEMENTS = Object.freeze([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'marker', 'symbol', 'use',
  'title', 'desc', 'animate', 'animateTransform', 'animateMotion', 'set', 'mpath', 'style', 'filter',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence'
]);

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const MAX_DIAGNOSTICS = 10;
const ELEMENTS = new Set(SVG_ELEMENTS);
/** What a value or a stylesheet may not contain, judged decoded, lower-cased and without whitespace. */
const OUTSIDE = ['javascript:', 'data:', 'http:', 'https:', '//'];
const CSS_BANNED = ['@import', 'expression(', 'behavior', '-moz-binding'];
const URL_NOT_INSIDE = /url\((?!['"]?#)/u;
const NAME = /[A-Za-z_:][-A-Za-z0-9_.:]*/uy;
const SPACE = /\s*/uy;
const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

const utf8Bytes = text => new TextEncoder().encode(text).length;

/** A value as the XML parser hands it on: character and the five named references decoded. */
function decode(value) {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|amp|quot|apos));/giu, (whole, hex, dec, named) => {
    if (named) return NAMED[named.toLowerCase()] ?? whole;
    const code = hex ? parseInt(hex, 16) : Number(dec);
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

const compact = text => text.replace(/[\s\u0000-\u001f]+/gu, '').toLowerCase();

/**
 * @param {unknown} svg the figure's text
 * @returns {{ok: true} | {ok: false, diagnostics: Array<{line: number|null, column: number|null, message: string}>}}
 */
export function admitSvg(svg) {
  if (typeof svg !== 'string' || utf8Bytes(svg) > SVG_FIGURE_BYTES) {
    return { ok: false, diagnostics: [{ line: null, column: null, message: `the figure is an SVG document of at most ${SVG_FIGURE_BYTES.toLocaleString('en-US')} bytes` }] };
  }
  const diagnostics = [];
  const where = offset => {
    const before = svg.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
  };
  const refuse = (offset, message) => {
    if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push({ ...where(offset), message });
  };

  /** One stylesheet's text, from a style attribute or a <style>; `offset` is where it begins. */
  const judgeCss = (css, offset) => {
    const lower = css.toLowerCase();
    const at = token => { const index = lower.indexOf(token); return index < 0 ? offset : offset + index; };
    if (css.includes('\\')) return refuse(at('\\'), 'the CSS of a figure may not use escapes (\\)');
    const flat = compact(decode(css).replace(/\/\*[\s\S]*?\*\//gu, ''));
    const banned = CSS_BANNED.find(token => flat.includes(token));
    if (banned) return refuse(at(banned), `the CSS of a figure may not use ${banned}`);
    const outside = OUTSIDE.find(token => flat.includes(token));
    if (outside) return refuse(at(outside), `the CSS of a figure may not name an outside resource (${outside})`);
    if (URL_NOT_INSIDE.test(flat)) return refuse(at('url('), 'the CSS of a figure may use url() only for "#id" inside the figure');
    return undefined;
  };

  const judgeAttribute = (name, raw, offset) => {
    const value = decode(raw);
    if (/^on/iu.test(name)) return refuse(offset, `the attribute ${name} is not allowed in a figure: no event handlers`);
    if (name === 'externalResourcesRequired') return refuse(offset, 'externalResourcesRequired is not allowed in a figure');
    if (name === 'xmlns') {
      return value === SVG_NS ? undefined : refuse(offset, `xmlns may only be the SVG namespace, ${SVG_NS}`);
    }
    if (name.startsWith('xmlns:')) {
      return name === 'xmlns:xlink' && value === XLINK_NS ? undefined : refuse(offset, 'a figure declares only the SVG namespace, and XLink as xmlns:xlink');
    }
    if (name === 'href' || name === 'xlink:href') {
      return value.startsWith('#') ? undefined : refuse(offset, `${name} may only point inside the figure, at "#id"`);
    }
    if (name === 'attributeName' && /^(?:(?:xlink:)?href|on)/iu.test(value.trim())) {
      return refuse(offset, 'an animation may not change href or an event handler');
    }
    if (name === 'style') return judgeCss(raw, offset + name.length + 2);
    const flat = compact(value);
    const outside = OUTSIDE.find(token => flat.includes(token));
    if (outside) return refuse(offset, `the value of ${name} may not name an outside resource (${outside})`);
    if (URL_NOT_INSIDE.test(flat)) return refuse(offset, `the value of ${name} may use url() only for "#id" inside the figure`);
    return undefined;
  };

  const malformed = (offset, what) => refuse(offset, `the figure is not well-formed: ${what}`);
  const skipSpace = from => { SPACE.lastIndex = from; SPACE.exec(svg); return SPACE.lastIndex; };

  let i = skipSpace(0);
  if (/^<\?xml[\s?]/u.test(svg.slice(i, i + 6))) {
    const end = svg.indexOf('?>', i);
    if (end < 0) return { ok: false, diagnostics: [{ ...where(i), message: 'the figure is not well-formed: the xml declaration is not closed' }] };
    i = end + 2;
  }
  let root = false;
  while (i < svg.length) {
    const lt = svg.indexOf('<', i);
    const text = svg.slice(i, lt < 0 ? svg.length : lt);
    if (!root && text.trim()) refuse(i + text.search(/\S/u), 'an SVG figure begins with <svg');
    if (lt < 0) break;
    if (svg.startsWith('<!--', lt)) {
      const end = svg.indexOf('-->', lt + 4);
      if (end < 0) { malformed(lt, 'a comment is not closed'); break; }
      i = end + 3;
      continue;
    }
    if (svg.startsWith('<![CDATA[', lt)) {
      const end = svg.indexOf(']]>', lt + 9);
      if (end < 0) { malformed(lt, 'a CDATA section is not closed'); break; }
      if (svg.slice(lt + 9, end).includes('<')) refuse(lt, 'CDATA in a figure may not contain <');
      i = end + 3;
      continue;
    }
    if (svg.startsWith('<!', lt)) {
      // A declaration's own syntax is not read: nothing after it can be judged safely.
      const head = svg.slice(lt, lt + 9).toUpperCase();
      refuse(lt, head === '<!DOCTYPE' ? 'a DOCTYPE is not allowed in a figure'
        : head.startsWith('<!ENTITY') ? 'an <!ENTITY> declaration is not allowed in a figure'
          : 'a <! declaration is not allowed in a figure');
      break;
    }
    if (svg.startsWith('<?', lt)) {
      refuse(lt, 'a processing instruction is not allowed in a figure; only <?xml …?> at the start');
      const end = svg.indexOf('?>', lt);
      if (end < 0) break;
      i = end + 2;
      continue;
    }
    const closing = svg.startsWith('</', lt);
    NAME.lastIndex = lt + (closing ? 2 : 1);
    const name = NAME.exec(svg)?.[0];
    if (!name) { malformed(lt, '"<" begins a tag, and a tag a name'); break; }
    let at = skipSpace(lt + (closing ? 2 : 1) + name.length);
    if (closing) {
      if (svg[at] !== '>') { malformed(lt, 'a tag is not closed'); break; }
      i = at + 1;
      continue;
    }
    if (!ELEMENTS.has(name)) refuse(lt, `<${name}> is not an element a figure may use`);
    const attributes = new Map();
    let broken = false;
    while (at < svg.length && svg[at] !== '>' && !svg.startsWith('/>', at)) {
      NAME.lastIndex = at;
      const attribute = NAME.exec(svg)?.[0];
      if (!attribute) { malformed(at, 'an attribute has a name'); broken = true; break; }
      const valueAt = skipSpace(skipSpace(at + attribute.length) + 1);
      const quote = svg[valueAt];
      if (svg[skipSpace(at + attribute.length)] !== '=' || (quote !== '"' && quote !== "'")) { malformed(at, 'an attribute value is quoted'); broken = true; break; }
      const end = svg.indexOf(quote, valueAt + 1);
      if (end < 0) { malformed(at, 'an attribute value is not closed'); broken = true; break; }
      attributes.set(attribute, svg.slice(valueAt + 1, end));
      judgeAttribute(attribute, svg.slice(valueAt + 1, end), at);
      at = skipSpace(end + 1);
    }
    if (broken) break;
    if (at >= svg.length) { malformed(lt, 'a tag is not closed'); break; }
    if (!root) {
      root = true;
      if (name === 'svg') {
        if (!attributes.has('viewBox')) refuse(lt, 'the root <svg> needs a viewBox attribute');
        if (attributes.get('xmlns') !== SVG_NS) refuse(lt, `the root <svg> needs xmlns="${SVG_NS}"`);
      } else if (!diagnostics.length) refuse(lt, 'an SVG figure begins with <svg');
    }
    const selfClosing = svg[at] === '/';
    i = at + (selfClosing ? 2 : 1);
    if (name === 'style' && !selfClosing) {
      const end = svg.indexOf('</style', i);
      if (end < 0) { malformed(lt, 'a <style> is not closed'); break; }
      const css = svg.slice(i, end);
      if (css.replace(/<!\[CDATA\[|\]\]>/gu, '').includes('<')) refuse(lt, 'a <style> holds only CSS');
      else judgeCss(css, i);
      i = end;
    }
  }
  if (!/<\/svg\s*>\s*$/u.test(svg)) {
    const last = svg.trimEnd().length - 1;
    refuse(Math.max(0, last), 'an SVG figure ends with </svg>');
  }
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true };
}
