import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admitSvg } from '../svg-admission.js';
import { JEV_PALETTES } from '../jev-palette.js';
import { ROOM, svgLayoutProblems } from '../quality/svg-layout.js';
import { BRANDS } from './brands.js';
import { figureProblems, renderFigure } from './figure-kit.js';
import { STUDY } from './fixtures/specs.js';
import { SYSTEM_CASES } from './fixtures/systems.js';
import { caseFigures, systemSheet } from './system-sheet.js';

const golden = name => readFileSync(resolve(process.cwd(), 'src/core/figures/fixtures', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
const clean = (svg, ground) => {
  const { problems, notes } = svgLayoutProblems(svg, { ground });
  return { problems, notes };
};

describe('the system cases', () => {
  for (const [name, entry] of Object.entries(SYSTEM_CASES)) {
    describe(name, () => {
      it('is a spec the kit draws, from the pull requests it names, in a reviewed brand', () => {
        expect(figureProblems(entry.spec)).toEqual([]);
        expect(entry.sources.length).toBeGreaterThan(0);
        for (const source of entry.sources) expect(source).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
        expect(Object.keys(BRANDS)).toContain(entry.brand);
      });

      it('draws its animation and each state’s still exactly as the goldens', () => {
        const figures = caseFigures(name, entry);
        expect(figures).toHaveLength(1 + entry.spec.states.length);
        for (const { file, svg } of figures) expect(svg, file).toBe(golden(file));
      });

      it('is admitted and layout-clean in its brand, on its ground and on white, and in every theme', () => {
        for (const { file, svg } of caseFigures(name, entry)) {
          expect(admitSvg(svg), file).toEqual({ ok: true });
          for (const ground of [BRANDS[entry.brand].brand.ground, ROOM.ground]) expect(clean(svg, ground), file).toEqual({ problems: [], notes: [] });
        }
        for (const theme of Object.keys(JEV_PALETTES)) {
          const svg = renderFigure(entry.spec, { theme });
          expect(admitSvg(svg)).toEqual({ ok: true });
          expect(clean(svg, JEV_PALETTES[theme].background), theme).toEqual({ problems: [], notes: [] });
        }
      });
    });
  }
});

describe('a still of one state', () => {
  const [first, last] = [STUDY.system.states[0], STUDY.system.states.at(-1)];

  it('steps through no states, and draws dashed what that state does without', () => {
    const svg = renderFigure(STUDY.system, { theme: 'cobalt', state: first });
    // Dots still run along the state's paths where SMIL runs; nothing steps between states.
    expect(svg).not.toMatch(/<animate |<set /);
    expect(svg.match(/<animateMotion /g)).toHaveLength(STUDY.system.links.length);
    // The first state lacks OpenRouter, Kev and their two links, and keeps our model and its link.
    expect(svg.match(/<g stroke-dasharray="6 6">/g)).toHaveLength(4);
  });

  it('of the last state is the still the animation shows where SMIL does not run', () => {
    const strip = svg => svg.replace(/<animate[^>]*\/>|<animateMotion[^>]*\/>/g, '').replace(/<(animate|animateMotion)\b[^>]*>.*?<\/\1>/g, '');
    expect(strip(renderFigure(STUDY.system, { theme: 'cobalt', state: last }))).toBe(strip(renderFigure(STUDY.system, { theme: 'cobalt' })));
  });

  it('is refused for a state the system lacks, and for any other kind', () => {
    expect(() => renderFigure(STUDY.system, { theme: 'cobalt', state: 'Nobody’s' })).toThrow(/no state "Nobody’s"/);
    expect(() => renderFigure(STUDY.list, { theme: 'cobalt', state: first })).toThrow(/draws a state only of a system/);
  });
});

describe('the contact sheet', () => {
  it('holds every case’s figures, and a page that shows each of them', () => {
    const files = systemSheet(SYSTEM_CASES);
    const page = files.get('index.html');
    const figures = [...files.keys()].filter(file => file.endsWith('.svg'));
    expect(figures).toHaveLength(Object.values(SYSTEM_CASES).reduce((sum, { spec }) => sum + 1 + spec.states.length, 0));
    for (const file of figures) expect(page).toContain(`<img src="${file}"`);
    for (const { sources } of Object.values(SYSTEM_CASES)) for (const source of sources) expect(page).toContain(source);
  });
});
