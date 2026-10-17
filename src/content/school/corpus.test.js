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
const SOURCE_URL = {
  'standard-ebooks': /^https:\/\/standardebooks\.org\/ebooks\//u,
  gutenberg: /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/u,
  wikisource: /^https:\/\/en\.wikisource\.org\/wiki\/\S+$/u,
  'sacred-texts': /^https:\/\/sacred-texts\.com\/[a-z0-9/]+\/index\.htm$/u,
  ccel: /^https:\/\/ccel\.org\/ccel\/[a-z0-9]+\/[a-z0-9]+$/u,
  'eebo-tcp': /^https:\/\/github\.com\/textcreationpartnership\/A\d{5}$/u,
  html: /^https:\/\/\S+$/u,
  file: /^scripts\/school-sources\/[a-z]+\.[a-z0-9-]+\/[\w.-]+$/u,
  'commons-plates': /^https:\/\/commons\.wikimedia\.org\/wiki\/\S+$/u
};
// A picture work's unit is the words beside its plate: the plate's title,
// its place in the book, and what Commons says of it. Three of Haeckel's
// hundred (Tafel 8, 42, 62) carry a one-line note and no organism list, so
// they cannot reach 200 characters honestly; the plate is the reading there.
const PICTURE_MIN_CHARS = 100;
const BARE_NUMERAL = /^(?:[IVXLCDM]+|\d+)\.?$/u;
const sha256 = text => createHash('sha256').update(text).digest('hex');

describe('the School corpus', () => {
  it('is frozen, and names each School record at most once', () => {
    expect(Object.isFrozen(SCHOOL_WORKS)).toBe(true);
    const ids = SCHOOL_WORKS.map(work => work.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(RECORD_IDS.has(id), id).toBe(true);
  });

  it('serves the texts of the three slices: Standard Ebooks; Project Gutenberg; Wikisource, CCEL, sacred-texts, EEBO-TCP, the Victorian Web and local files', () => {
    expect(SCHOOL_WORKS.map(work => [work.id, work.units])).toEqual([
      ['gate.oration', 47],
      ['sun.fragments', 21],
      ['sun.symposium-phaedrus-timaeus', 6],
      ['sun.zarathustra', 81],
      ['sun.monadology', 9],
      ['sun.ethics', 5],
      ['sun.enneads', 54],
      ['sun.nature', 9],
      ['mercury.new-atlantis', 1],
      ['mercury.lovelace-notes', 8],
      ['mercury.ninth-bridgewater', 17],
      ['mercury.laws-of-thought', 22],
      ['mercury.on-governors', 5],
      ['mercury.book-of-the-machines', 4],
      ['mercury.machine-stops', 3],
      ['mercury.rur', 4],
      ['mercury.increasing-human-energy', 16],
      ['mercury.philosophie-der-technik', 4],
      ['moon.life-after-death', 16],
      ['moon.stream-of-thought', 8],
      ['moon.varieties', 15],
      ['moon.cosmic-consciousness', 55],
      ['moon.interpretation-of-dreams', 7],
      ['moon.psychological-types', 26],
      ['moon.human-personality', 10],
      ['moon.matter-and-memory', 6],
      ['moon.tertium-organum', 24],
      ['venus.marriage-of-heaven-and-hell', 9],
      ['venus.hymns-to-the-night', 6],
      ['venus.defence-of-poetry', 1],
      ['venus.leaves-of-grass', 36],
      ['venus.spiritual-in-art', 9],
      ['venus.faust', 28],
      ['venus.biographia-literaria', 25],
      ['venus.aesthetic-education', 27],
      ['mars.the-prince', 27],
      ['mars.peloponnesian-war', 26],
      ['mars.renaissance-in-italy', 46],
      ['mars.golden-bough', 70],
      ['mars.muqaddimah', 19],
      ['mars.new-science', 6],
      ['mars.decline-of-the-west', 25],
      ['jupiter.nature-of-things', 6],
      ['jupiter.flatland', 22],
      ['jupiter.art-forms-in-nature', 100],
      ['jupiter.metamorphosis-of-plants', 19],
      ['jupiter.cosmos', 4],
      ['jupiter.growth-and-form', 18],
      ['jupiter.relativity', 37],
      ['saturn.zhuangzi', 33],
      ['saturn.bhagavad-gita', 18],
      ['saturn.emerald-tablet', 1],
      ['saturn.upanishads', 12],
      ['saturn.corpus-hermeticum', 18],
      ['saturn.masnavi', 6],
      ['saturn.cloud-of-unknowing', 76],
      ['saturn.interior-castle', 29],
      ['saturn.mystical-theology', 5],
      ['saturn.sermons', 7],
      ['saturn.occult-philosophy', 199],
      ['saturn.heroic-frenzies', 11]
    ]);
  });

  it('names the language of every work not read in English', () => {
    expect(Object.fromEntries(SCHOOL_WORKS.filter(work => 'language' in work).map(work => [work.id, work.language]))).toEqual({
      'gate.oration': 'la',
      'mercury.philosophie-der-technik': 'de',
      'mars.muqaddimah': 'fr',
      'mars.new-science': 'fr',
      'jupiter.art-forms-in-nature': 'de'
    });
  });

  for (const work of SCHOOL_WORKS) {
    describe(work.id, () => {
      it('states its edition, its source and its rights', () => {
        expect(work.edition.statement, work.id).toMatch(/\S/u);
        for (const source of work.source.artifacts ?? [work.source]) {
          expect(SOURCE_URL[source.kind], `${work.id}: ${source.kind}`).toBeDefined();
          expect(source.url).toMatch(SOURCE_URL[source.kind]);
          // Every source but a Standard Ebooks repository is named by the hash of the bytes the ingest read.
          if (source.kind === 'gutenberg') expect(source.artifact).toBe('html');
          if (source.kind !== 'standard-ebooks') expect(source.sha256, `${work.id}: ${source.kind}`).toMatch(/^[0-9a-f]{64}$/u);
        }
        expect(work.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(work.rights.us).toBe('pd');
        expect(work.rights.life70).toMatch(LIFE70);
        // A work not in English names its language; an English one names none.
        if ('language' in work) expect(work.language, work.id).toMatch(/^[a-z]{2}$/u);
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
        expect(meta.language).toBe(work.language);
        expect(meta.imagery).toBe(work.imagery);
      });

      it('names every unit uniquely and readably, and serves no distributor matter', async () => {
        const module = await import(`./works/${work.id}.js`);
        const sections = module[`${work.constName}_SECTIONS`];
        const names = sections.map(section => section.name);
        expect(new Set(names).size, 'duplicate unit names').toBe(names.length);
        for (const section of sections) {
          expect(Object.keys(section).every(key => ['name', 'content', 'verse'].includes(key)), section.name).toBe(true);
          expect(section.name, section.name).not.toMatch(BARE_NUMERAL);
          expect(section.content.length, section.name).toBeGreaterThanOrEqual(work.imagery ? PICTURE_MIN_CHARS : 200);
          expect(section.name, section.name).not.toMatch(DISTRIBUTOR_MATTER);
          expect(section.content, section.name).not.toMatch(DISTRIBUTOR_MATTER);
          if ('verse' in section) expect(section.verse).toBe(true);
        }
      });
    });
  }
});
