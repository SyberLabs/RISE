/**
 * The School corpus is served under its own rule, beside the Archive's, so
 * every promise that rule makes is asserted here against the committed
 * payloads: the bytes are the bytes the checksum names, every unit has a
 * name a reader can read, and nothing a distributor wrote is served.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DISTRIBUTOR_MATTER } from '../archive/divisions.js';
import { SCHOOL_CANON } from './canon.js';
import { SCHOOL_WORKS } from './corpus.js';

const RECORD_IDS = new Set(SCHOOL_CANON.map(record => record.id));
const LIFE70 = /^(?:pd|unknown|until:\d{4})$/u;
const BARE_NUMERAL = /^(?:[IVXLCDM]+|\d+)\.?$/u;
const sha256 = text => createHash('sha256').update(text).digest('hex');

describe('the School corpus', () => {
  it('is frozen, and names each School record at most once', () => {
    expect(Object.isFrozen(SCHOOL_WORKS)).toBe(true);
    const ids = SCHOOL_WORKS.map(work => work.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(RECORD_IDS.has(id), id).toBe(true);
  });

  for (const work of SCHOOL_WORKS) {
    describe(work.id, () => {
      it('states its edition, its source and its rights', () => {
        expect(work.edition.statement, work.id).toMatch(/\S/u);
        expect(work.source.kind).toBe('standard-ebooks');
        expect(work.source.url).toMatch(/^https:\/\/standardebooks\.org\/ebooks\//u);
        expect(work.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(work.rights.us).toBe('pd');
        expect(work.rights.life70).toMatch(LIFE70);
      });

      it('is the payload its checksum names, and its META agrees', async () => {
        const module = await import(`./works/${work.id}.js`);
        const sections = module[`${work.constName}_SECTIONS`];
        const meta = module[`${work.constName}_META`];
        expect(Array.isArray(sections) && sections.length > 0).toBe(true);
        expect(work.checksum).toBe(`sha256:${sha256(JSON.stringify(sections))}`);
        expect(work.units).toBe(sections.length);
        expect(meta.id).toBe(work.id);
        expect(meta.structure).toBe('declared');
        expect(meta.edition).toEqual(work.edition);
        expect(meta.source).toMatchObject(work.source);
        expect(meta.rights).toEqual(work.rights);
      });

      it('names every unit uniquely and readably, and serves no distributor matter', async () => {
        const module = await import(`./works/${work.id}.js`);
        const sections = module[`${work.constName}_SECTIONS`];
        const names = sections.map(section => section.name);
        expect(new Set(names).size, 'duplicate unit names').toBe(names.length);
        for (const section of sections) {
          expect(Object.keys(section).every(key => ['name', 'content', 'verse'].includes(key)), section.name).toBe(true);
          expect(section.name, section.name).not.toMatch(BARE_NUMERAL);
          expect(section.content.length, section.name).toBeGreaterThanOrEqual(200);
          expect(section.name, section.name).not.toMatch(DISTRIBUTOR_MATTER);
          expect(section.content, section.name).not.toMatch(DISTRIBUTOR_MATTER);
          if ('verse' in section) expect(section.verse).toBe(true);
        }
      });
    });
  }
});
