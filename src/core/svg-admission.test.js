/**
 * The admission of a model-drawn SVG figure (svg-admission.js): the corpus.
 *
 * A figure is untrusted markup shown in the reader's page. Each refused case
 * here is one rule, with the line and column the model is told; each accepted
 * case is markup a model would reasonably write. The Worker and the card use
 * the same function, so this corpus holds both doors.
 */
import { describe, expect, it } from 'vitest';
import { admitSvg, SVG_ELEMENTS, SVG_FIGURE_BYTES } from './svg-admission.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const open = `<svg ${NS} viewBox="0 0 400 200">`;
const fig = body => `${open}${body}</svg>`;

/** The one diagnostic a refused case gives, or the test fails saying what it gave. */
function refusal(svg) {
  const verdict = admitSvg(svg);
  expect(verdict.ok, JSON.stringify(verdict)).toBe(false);
  return verdict.diagnostics[0];
}

const DIAGRAM = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- a right triangle, labelled -->',
  `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 300" role="img">`,
  '  <title>A right triangle</title>',
  '  <style><![CDATA[ .label { font: 16px sans-serif; fill: currentColor; } ]]></style>',
  '  <defs>',
  '    <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#4af"/><stop offset="1" stop-color="#a4f" stop-opacity="0.6"/></linearGradient>',
  '    <marker id="tip" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker>',
  '    <filter id="soft"><feGaussianBlur stdDeviation="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  '    <path id="side" d="M40,260 L340,260"/>',
  '  </defs>',
  '  <polygon points="40,260 340,260 340,60" fill="url(#g)" stroke="currentColor" filter="url(#soft)"/>',
  '  <line x1="40" y1="260" x2="340" y2="60" stroke="currentColor" marker-end="url(#tip)">',
  '    <animate attributeName="stroke-opacity" values="0;1" dur="1.5s" fill="freeze"/>',
  '  </line>',
  '  <use href="#side" stroke="currentColor"/>',
  '  <use xlink:href="#side" transform="translate(0,-4)" style="stroke: currentColor; opacity: .4"/>',
  '  <text class="label" x="190" y="285">a &amp; b &#x2192; c</text>',
  '  <text class="label" x="350" y="160"><tspan>b</tspan></text>',
  '  <g transform="rotate(-34 190 160)"><text class="label" x="190" y="150">c</text>',
  '    <animateTransform attributeName="transform" type="rotate" from="0 190 160" to="3 190 160" dur="4s" repeatCount="indefinite"/></g>',
  '</svg>'
].join('\n');

describe('a figure RISE admits', () => {
  it('a labelled diagram: defs, gradients, a marker, a filter, text, SMIL, <use href="#…"> and a <style> in currentColor', () => {
    expect(admitSvg(DIAGRAM)).toEqual({ ok: true });
  });

  it('the smallest figure: an <svg> with its namespace and a viewBox', () => {
    expect(admitSvg(fig(''))).toEqual({ ok: true });
  });

  it('whitespace and comments around the root', () => {
    expect(admitSvg(`\n  <!-- c -->\n${fig('<circle r="4"/>')}\n`)).toEqual({ ok: true });
  });

  it('clip paths, masks, patterns, symbols, a radial gradient and a path to follow', () => {
    const body = '<defs><clipPath id="c"><rect width="10" height="10"/></clipPath><mask id="m"><circle r="5" fill="white"/></mask>'
      + '<pattern id="p" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2"/></pattern>'
      + '<symbol id="s" viewBox="0 0 2 2"><ellipse cx="1" cy="1" rx="1" ry="0.5"/></symbol><radialGradient id="r"><stop offset="0"/></radialGradient>'
      + '<path id="track" d="M0,0 C10,10 20,10 30,0"/></defs>'
      + '<g clip-path="url(#c)" mask="url( #m )"><rect width="20" height="20" fill="url(\'#p\')"/></g><use href="#s" width="8" height="8"/>'
      + '<polyline points="0,0 5,5"/><text><textPath href="#track">along</textPath></text>'
      + '<circle r="2"><animateMotion dur="3s"><mpath href="#track"/></animateMotion><set attributeName="r" to="3" begin="1s"/></circle><desc>d</desc>';
    expect(admitSvg(fig(body))).toEqual({ ok: true });
  });

  it('every filter primitive but feImage', () => {
    const primitives = SVG_ELEMENTS.filter(name => name.startsWith('fe'));
    expect(primitives).not.toContain('feImage');
    expect(primitives).toContain('feTurbulence');
    expect(admitSvg(fig(`<filter id="f">${primitives.map(name => `<${name}/>`).join('')}</filter>`))).toEqual({ ok: true });
  });

  it('CDATA text and entities that spell nothing dangerous', () => {
    expect(admitSvg(fig('<text><![CDATA[x > y & z]]> &lt;3 &#169;</text>'))).toEqual({ ok: true });
  });
});

describe('a figure RISE refuses, by rule, where', () => {
  it('anything that is not a string, or over the size', () => {
    expect(refusal(42).message).toMatch(/SVG document/u);
    const big = fig(`<desc>${'x'.repeat(SVG_FIGURE_BYTES)}</desc>`);
    expect(refusal(big)).toMatchObject({ line: null, column: null });
    expect(refusal(big).message).toContain('32,768 bytes');
  });

  it('a document that does not begin with <svg', () => {
    expect(refusal('<g/>')).toEqual({ line: 1, column: 1, message: 'an SVG figure begins with <svg' });
    expect(refusal('hello <svg/>')).toMatchObject({ line: 1, column: 1, message: 'an SVG figure begins with <svg' });
  });

  it('a root with no viewBox', () => {
    expect(refusal(`<svg ${NS} width="10"></svg>`)).toEqual({ line: 1, column: 1, message: 'the root <svg> needs a viewBox attribute' });
  });

  it('a root with no SVG namespace, which no browser would draw', () => {
    expect(refusal('<svg viewBox="0 0 1 1"></svg>').message).toBe('the root <svg> needs xmlns="http://www.w3.org/2000/svg"');
  });

  it('a document that does not end with </svg>', () => {
    expect(refusal(`${fig('')}\ntrailing`)).toMatchObject({ line: 2, message: 'an SVG figure ends with </svg>' });
  });

  it('a DOCTYPE, and an entity declared in one', () => {
    expect(refusal(`<!DOCTYPE svg [ <!ENTITY a "b"> ]>\n${fig('')}`)).toEqual({ line: 1, column: 1, message: 'a DOCTYPE is not allowed in a figure' });
    expect(refusal(`${open}\n  <!ENTITY a "b">\n</svg>`)).toEqual({ line: 2, column: 3, message: 'an <!ENTITY> declaration is not allowed in a figure' });
  });

  it('a processing instruction other than the xml declaration', () => {
    expect(refusal(`<?xml-stylesheet href="x.css"?>${fig('')}`)).toEqual({ line: 1, column: 1, message: 'a processing instruction is not allowed in a figure; only <?xml …?> at the start' });
  });

  it('CDATA that holds markup', () => {
    expect(refusal(`${open}\n<text><![CDATA[<b>]]></text></svg>`)).toEqual({ line: 2, column: 7, message: 'CDATA in a figure may not contain <' });
  });

  it('<script>, by name, where it opens', () => {
    expect(refusal(`${open}\n  <script>alert(1)</script>\n</svg>`)).toEqual({ line: 2, column: 3, message: '<script> is not an element a figure may use' });
  });

  it('<foreignObject>, <image>, <a>, <iframe>, <object>, <embed>, <video>, <audio>, <feImage>, and anything unknown', () => {
    for (const name of ['foreignObject', 'image', 'a', 'iframe', 'object', 'embed', 'video', 'audio', 'feImage', 'blink', 'svg:script', 'SCRIPT', 'metadata']) {
      expect(refusal(fig(`<${name}/>`)), name).toEqual({ line: 1, column: open.length + 1, message: `<${name}> is not an element a figure may use` });
    }
  });

  it('an event handler, in any case', () => {
    expect(refusal(`<svg ${NS} viewBox="0 0 1 1"\n     onload="alert(1)"></svg>`)).toEqual({ line: 2, column: 6, message: 'the attribute onload is not allowed in a figure: no event handlers' });
    expect(refusal(fig('<rect ONCLICK="x"/>')).message).toContain('ONCLICK');
  });

  it('an href that leaves the figure', () => {
    for (const href of ['http://evil.example/x.svg#a', 'x.svg#a', 'javascript:alert(1)', ' #a']) {
      expect(refusal(fig(`<use href="${href}"/>`)), href).toEqual({ line: 1, column: open.length + 6, message: 'href may only point inside the figure, at "#id"' });
    }
    expect(refusal(fig('<use xlink:href="data:image/svg+xml,x"/>')).message).toBe('xlink:href may only point inside the figure, at "#id"');
  });

  it('a value naming an outside resource, however it is spelled', () => {
    expect(refusal(fig('<rect fill="url(http://evil.example/p.svg#a)"/>')).message).toBe('the value of fill may not name an outside resource (http:)');
    expect(refusal(fig('<animate attributeName="x" values="jav&#x61;script:1"/>')).message).toBe('the value of values may not name an outside resource (javascript:)');
    expect(refusal(fig('<rect class="a//b"/>')).message).toBe('the value of class may not name an outside resource (//)');
    expect(refusal(fig('<rect fill="url(p.svg)"/>')).message).toBe('the value of fill may use url() only for "#id" inside the figure');
  });

  it('an animation that would rewrite an href or an event handler', () => {
    expect(refusal(fig('<set attributeName="href" to="#b"/>')).message).toBe('an animation may not change href or an event handler');
    expect(refusal(fig('<animate attributeName="onbegin"/>')).message).toBe('an animation may not change href or an event handler');
  });

  it('a style attribute that fetches', () => {
    expect(refusal(fig('<rect style="fill: url(p.png)"/>')).message).toBe('the CSS of a figure may use url() only for "#id" inside the figure');
  });

  it('@import, expression(, behavior, -moz-binding and CSS escapes in a <style>, with the line of the rule', () => {
    const style = css => refusal(`${open}\n<style>\n  ${css}\n</style></svg>`);
    expect(style('@import url(#x);')).toEqual({ line: 3, column: 3, message: 'the CSS of a figure may not use @import' });
    expect(style('rect { width: expression(1) }').message).toBe('the CSS of a figure may not use expression(');
    expect(style('rect { behavior: x }').message).toBe('the CSS of a figure may not use behavior');
    expect(style('rect { -moz-binding: x }').message).toBe('the CSS of a figure may not use -moz-binding');
    expect(style('rect { fill: u\\72l(x) }').message).toBe('the CSS of a figure may not use escapes (\\)');
    expect(style('rect { fill: url(x.png) }').message).toBe('the CSS of a figure may use url() only for "#id" inside the figure');
    expect(style('rect { fill: url(data:x) }').message).toBe('the CSS of a figure may not name an outside resource (data:)');
  });

  it('markup inside a <style>', () => {
    expect(refusal(fig('<style><b/></style>')).message).toBe('a <style> holds only CSS');
  });

  it('externalResourcesRequired', () => {
    expect(refusal(fig('<g externalResourcesRequired="true"/>')).message).toBe('externalResourcesRequired is not allowed in a figure');
  });

  it('a namespace other than SVG and XLink, which could rename an element', () => {
    expect(refusal(`<svg ${NS} xmlns:h="http://www.w3.org/1999/xhtml" viewBox="0 0 1 1"></svg>`).message).toBe('a figure declares only the SVG namespace, and XLink as xmlns:xlink');
    expect(refusal(fig('<g xmlns="http://www.w3.org/1999/xhtml"/>')).message).toBe('xmlns may only be the SVG namespace, http://www.w3.org/2000/svg');
  });

  it('markup that is not well-formed enough to read', () => {
    expect(refusal(fig('<rect width=10/>')).message).toBe('the figure is not well-formed: an attribute value is quoted');
    expect(refusal(`${open}<rect`).message).toBe('the figure is not well-formed: a tag is not closed');
    expect(refusal(`${open}<!-- open`).message).toBe('the figure is not well-formed: a comment is not closed');
  });

  it('says at most ten things at once', () => {
    const verdict = admitSvg(fig('<script/>'.repeat(15)));
    expect(verdict.ok).toBe(false);
    expect(verdict.diagnostics).toHaveLength(10);
  });
});
