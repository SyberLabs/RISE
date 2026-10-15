// @vitest-environment node
// Needs Playwright's Chromium: the full unit suite runs it (full-validation.yml installs the browser); the fast set
// the required CI check runs leaves it out (vitest.fast.config.js).
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openRenderCheck } from './render-check.mjs';
import { PUBLISHED } from '../../src/core/quality/fixtures/figures.js';
import { renderFigure } from '../../src/core/figures/figure-kit.js';
import { STUDY, boundSpecs } from '../../src/core/figures/fixtures/specs.js';

let hasChromium = false;
try {
  const { chromium } = await import('@playwright/test');
  hasChromium = existsSync(chromium.executablePath());
} catch {
  hasChromium = false;
}

const fig = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="currentColor" font-family="sans-serif" font-size="20">${body}</svg>`;

describe.skipIf(!hasChromium)('the rendered check', () => {
  let renderer;
  beforeAll(async () => { renderer = await openRenderCheck(); }, 60_000);
  afterAll(async () => { await renderer?.close(); });

  it('finds nothing wrong with a published figure, and says how long it took', async () => {
    const verdict = await renderer.check(PUBLISHED[13]);
    expect(verdict.problems).toEqual([]);
    expect(verdict.ms).toBeGreaterThan(0);
  }, 30_000);

  it('finds two labels drawn over each other, a label cut off at the edge, and one too small on a phone', async () => {
    const verdict = await renderer.check(fig([
      '<text x="20" y="100">Before the change</text>',
      '<text x="40" y="106">After the change</text>',
      '<text x="330" y="200">Overflowing</text>',
      '<text x="20" y="260" font-size="9">Fine print</text>'
    ].join('')));
    expect(verdict.problems.map(problem => problem.rule)).toEqual(['rendered-overlap', 'rendered-outside', 'rendered-too-small']);
    expect(verdict.problems[0].message).toBe('at 390 pixels wide, the text "After the change" is drawn over the text "Before the change"; move one clear of the other, or use fewer words');
    expect(verdict.problems[1].message).toBe('at 390 pixels wide, the text "Overflowing" is cut off at the right edge of the figure; move it inside, or use fewer words');
    expect(verdict.problems[2].message).toMatch(/^at 390 pixels wide, the text "Fine print" is drawn 8\.\d pixels tall; make it at least 12$/u);
  }, 30_000);

  it('measures a label drawn through <use>, where the static check cannot follow it', async () => {
    const verdict = await renderer.check(fig([
      '<defs><text id="label" x="20" y="100">Reused label</text></defs>',
      '<use href="#label"/>',
      '<use href="#label" x="10" y="4"/>',
      '<use href="#label" x="330" y="100"/>'
    ].join('')));
    expect(verdict.problems.map(problem => problem.rule)).toEqual(['rendered-overlap', 'rendered-outside']);
    expect(verdict.problems[0].message).toBe('at 390 pixels wide, the text "Reused label" is drawn over the text "Reused label"; move one clear of the other, or use fewer words');
  }, 30_000);

  it('runs no script and fetches nothing, whatever the figure says', async () => {
    const verdict = await renderer.check(fig('<image href="https://example.com/x.png" width="10" height="10"/><text x="20" y="100">Plain</text>'));
    expect(verdict.problems).toEqual([]);
    expect(renderer.requests()).toEqual([]);
  }, 30_000);

  it('finds nothing wrong with any figure the kit draws, at its bounds, as the reader’s fonts set it', async () => {
    for (const spec of [...Object.values(STUDY), ...boundSpecs()]) {
      for (const theme of ['cobalt', 'classic']) {
        const verdict = await renderer.check(renderFigure(spec, { theme }));
        expect({ spec, problems: verdict.problems }).toEqual({ spec, problems: [] });
      }
    }
  }, 120_000);
});
