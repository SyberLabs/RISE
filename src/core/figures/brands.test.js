import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRANDS } from './brands.js';
import { FIGURE_KINDS, brandProblems, renderFigure } from './figure-kit.js';
import { STUDY } from './fixtures/specs.js';

const golden = name => readFileSync(resolve(process.cwd(), 'src/core/figures/fixtures', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();

describe('the reviewed brands', () => {
  for (const [id, { confirmed, brand }] of Object.entries(BRANDS)) {
    it(`admits ${id}, and says whether the company has confirmed it`, () => {
      expect(brandProblems(brand)).toEqual([]);
      expect(typeof confirmed).toBe('boolean');
    });

    for (const kind of FIGURE_KINDS) {
      it(`draws the study's ${kind} in ${id} exactly as the golden`, () => {
        expect(renderFigure(STUDY[kind], { brand })).toBe(golden(`${kind}-${id}.svg`));
      });
    }
  }

  it('holds GitHits provisional until GitHits confirms its colors', () => {
    expect(BRANDS.githits.confirmed).toBe(false);
  });

  it('holds OpenStatus provisional until OpenStatus confirms its colors', () => {
    expect(BRANDS.openstatus.confirmed).toBe(false);
  });
});
