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
 * `color`, unless the figure sets its own.
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

const SOLID = /^rgba?\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*1(?:\.0+)?)?\s*\)$/u;

/** A computed CSS colour (`rgb(…)`, or `rgba(…, 1)`) as hex, for inkFigure; null for anything else. */
export function hexOfColor(color) {
  const match = SOLID.exec(String(color ?? '').trim());
  if (!match) return null;
  return `#${match.slice(1, 4).map(part => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('')}`;
}

export function mountFigureLayer({ field, insertBehindReading, svg, ink = null, onError = () => {} }) {
  const img = document.createElement('img');
  img.className = 'chamber-figure';
  img.setAttribute('aria-hidden', 'true');
  img.setAttribute('alt', '');
  img.setAttribute('decoding', 'async');
  let url = URL.createObjectURL(new Blob([inkFigure(svg, ink)], { type: 'image/svg+xml' }));
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
  img.setAttribute('src', url);
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
