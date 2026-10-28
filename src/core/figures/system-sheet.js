/**
 * The files a system figure is reviewed in: its animation, and a still of each state, drawn in the brand it was made
 * for. The goldens (fixtures/system-case-*.svg) and the contact sheet (`npm run figures:systems`) are both drawn here,
 * so what the sheet shows is what the tests hold.
 */
import { BRANDS } from './brands.js';
import { renderFigure } from './figure-kit.js';

const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A case's figures: the animation first, then one still per state, each with the golden's file name. */
export function caseFigures(name, { brand, spec }) {
  const { brand: colors } = BRANDS[brand];
  return [
    { file: `system-case-${name}.svg`, label: 'Animated', svg: renderFigure(spec, { brand: colors }) },
    ...spec.states.map((state, index) => ({ file: `system-case-${name}-${index + 1}.svg`, label: state, svg: renderFigure(spec, { brand: colors, state }) }))
  ];
}

/**
 * Every case's figures, and an index.html that shows them side by side: one row a case, its sources under its name.
 * The page needs nothing but a browser; the animations run in it.
 */
export function systemSheet(cases) {
  const files = new Map();
  const rows = Object.entries(cases).map(([name, entry]) => {
    const figures = caseFigures(name, entry);
    for (const { file, svg } of figures) files.set(file, `${svg}\n`);
    const cells = figures.map(({ file, label }) => `<figure><img src="${file}" alt="${escape(`${entry.spec.title ?? name}: ${label}`)}"><figcaption>${escape(label)}</figcaption></figure>`).join('');
    return `<section><h2>${escape(name)}</h2><p>${escape(entry.sources.join(', '))} · brand ${escape(entry.brand)}</p><div>${cells}</div></section>`;
  });
  files.set('index.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>System figures</title>
<style>body{margin:24px;background:#2a2a2a;color:#eee;font:16px system-ui,sans-serif}h2{margin:32px 0 4px;font-size:20px}p{margin:0 0 12px;color:#bbb}div{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:400px;max-width:100%}img{width:100%;display:block}figcaption{margin-top:6px;color:#ccc;font-size:14px}</style>
</head><body><h1>System figures</h1><p>The animation of each case, then a still of each of its states.</p>
${rows.join('\n')}
</body></html>
`);
  return files;
}
