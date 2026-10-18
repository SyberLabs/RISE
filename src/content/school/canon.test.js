import { describe, expect, it } from 'vitest';
import { DEGREES, GATE, HOUSES } from './houses.js';
import { RISE_CURRENT_THEMES } from '../../core/rise-current.js';
import { SCHOOL_CANON } from './canon.js';
import { SCHOOL_PATHS } from './paths.js';
import { SCHOOL_WORKS } from './corpus.js';
import { CORE_WORKS, WITHHELD_WORKS } from '../archive/index.js';
import { LEGACY_REINGESTED_WORKS } from '../archive/legacy-catalog.js';
import { LITERATURE_WORKS } from '../archive/literature-catalog.js';
import DIVISION_INDEX from '../archive/division-index.json' with { type: 'json' };

describe('the houses', () => {
  it('are the seven planets in the Chaldean cycle clockwise from the top', () => {
    const byOrder = [...HOUSES].sort((a, b) => a.order - b.order).map(house => house.id);
    expect(byOrder).toEqual(['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars']);
    expect(HOUSES.map(house => house.order).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('each wear a theme a reading can carry', () => {
    for (const house of HOUSES) {
      expect(Object.hasOwn(RISE_CURRENT_THEMES, house.theme), `${house.id}: ${house.theme}`).toBe(true);
    }
    expect(Object.fromEntries(HOUSES.map(house => [house.id, house.theme]))).toEqual({
      sun: 'citrine', moon: 'silver', mercury: 'prism', venus: 'rose',
      mars: 'ember', jupiter: 'cobalt', saturn: 'amethyst'
    });
  });

  it('carry the plan\'s names, readings and glyphs', () => {
    const mercury = HOUSES.find(house => house.id === 'mercury');
    expect(mercury).toMatchObject({
      planet: 'Mercury', glyph: '☿', name: 'House of the Machine',
      reading: 'computation, technology, signal'
    });
    expect(HOUSES.map(house => house.glyph).join('')).toBe('☉☿☽♀♂♃♄');
    for (const house of HOUSES) {
      expect(house.name).toMatch(/^House of /u);
      expect(house.reading.length).toBeGreaterThan(0);
    }
  });

  it('are frozen, with the Gate at their centre and three degrees', () => {
    expect(Object.isFrozen(HOUSES)).toBe(true);
    expect(HOUSES.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(GATE)).toBe(true);
    expect(GATE).toMatchObject({ id: 'gate', name: 'The Gate' });
    expect(DEGREES.map(degree => degree.name)).toEqual(['Threshold', 'Core', 'Arcanum']);
    expect(DEGREES.map(degree => degree.n)).toEqual([1, 2, 3]);
  });
});

const HOUSE_IDS = new Set(HOUSES.map(house => house.id));
const ARCHIVE_IDS = new Set([
  ...[...CORE_WORKS, ...LEGACY_REINGESTED_WORKS, ...LITERATURE_WORKS].map(work => work.meta.id),
  ...Object.keys(WITHHELD_WORKS)
]);
const FIELDS = ['id', 'house', 'degree', 'title', 'author', 'date', 'edition', 'rights', 'why', 'work', 'bridges', 'note'];

describe('the canon', () => {
  it('holds the plan\'s 66 texts: the Gate and seven houses at their counts', () => {
    expect(SCHOOL_CANON).toHaveLength(66);
    const counts = {};
    for (const record of SCHOOL_CANON) counts[record.house] = (counts[record.house] || 0) + 1;
    expect(counts).toEqual({ gate: 1, sun: 8, mercury: 10, moon: 9, venus: 10, mars: 7, jupiter: 8, saturn: 13 });
  });

  it('keeps the plan\'s order: the Gate, then the houses as the plan lists them', () => {
    const houses = [...new Set(SCHOOL_CANON.map(record => record.house))];
    expect(houses).toEqual(['gate', 'sun', 'mercury', 'moon', 'venus', 'mars', 'jupiter', 'saturn']);
    expect(SCHOOL_CANON.map(record => record.id).slice(0, 3)).toEqual(['gate.oration', 'sun.fragments', 'sun.meditations']);
    expect(SCHOOL_CANON.at(-1).id).toBe('saturn.heroic-frenzies');
  });

  it('gives every record the one shape, frozen, with a unique house-prefixed id', () => {
    expect(Object.isFrozen(SCHOOL_CANON)).toBe(true);
    expect(new Set(SCHOOL_CANON.map(record => record.id)).size).toBe(66);
    for (const record of SCHOOL_CANON) {
      expect(Object.keys(record).sort(), record.id).toEqual([...FIELDS].sort());
      expect(Object.isFrozen(record), record.id).toBe(true);
      expect(record.id.startsWith(`${record.house}.`), record.id).toBe(true);
      expect(record.id).toMatch(/^[a-z]+\.[a-z0-9-]+$/u);
      for (const field of ['title', 'author', 'date', 'edition', 'why']) {
        expect(typeof record[field] === 'string' && record[field].length > 0, `${record.id}.${field}`).toBe(true);
      }
    }
  });

  it('places every record in a house that exists, at a degree its house allows', () => {
    for (const record of SCHOOL_CANON) {
      if (record.house === 'gate') {
        expect(record.degree, record.id).toBe(0);
        continue;
      }
      expect(HOUSE_IDS.has(record.house), record.id).toBe(true);
      expect([1, 2, 3], record.id).toContain(record.degree);
    }
  });

  it('opens every house with a threshold text', () => {
    for (const house of HOUSES) {
      expect(SCHOOL_CANON.some(record => record.house === house.id && record.degree === 1), house.id).toBe(true);
    }
  });

  it('marks rights from the edition column', () => {
    for (const record of SCHOOL_CANON) {
      expect(['us-pd', 'us-only', 'orig-only'], record.id).toContain(record.rights);
      if (/US only/u.test(record.edition)) expect(record.rights, record.id).toBe('us-only');
      // The Gate's plan edition reads "orig. only", but RISE now serves its own English translation.
      if (/orig\. only/u.test(record.edition) && record.id !== 'gate.oration') expect(record.rights, record.id).toBe('orig-only');
    }
    expect(SCHOOL_CANON.filter(record => record.rights === 'us-only').map(record => record.id)).toEqual([
      'mercury.machine-stops', 'mercury.rur', 'moon.psychological-types', 'mars.decline-of-the-west'
    ]);
    expect(SCHOOL_CANON.filter(record => record.rights === 'orig-only').map(record => record.id)).toEqual([
      'mercury.philosophie-der-technik', 'venus.futurist-manifesto', 'mars.muqaddimah', 'mars.new-science', 'jupiter.harmonices-mundi'
    ]);
  });

  it('points only at archive works that exist, served or withheld', () => {
    const pointed = SCHOOL_CANON.filter(record => record.work?.id);
    expect(Object.fromEntries(pointed.map(record => [record.id, record.work.id]))).toEqual({
      'sun.meditations': 'literary-meditations',
      'venus.divine-comedy': 'the-divine-comedy',
      'saturn.tao-te-ching': 'sacred-tao-te-ching'
    });
    for (const record of pointed) {
      expect(ARCHIVE_IDS.has(record.work.id), `${record.id} -> ${record.work.id}`).toBe(true);
      expect(Object.keys(record.work).sort(), record.id).toEqual(['entry', 'id']);
    }
  });

  it('marks exactly the School corpus works as corpus works', () => {
    const corpus = SCHOOL_CANON.filter(record => record.work?.corpus);
    expect(corpus.map(record => record.id).sort()).toEqual(SCHOOL_WORKS.map(work => work.id).sort());
    for (const record of corpus) {
      expect(record.work, record.id).toEqual({ corpus: true });
      expect(Object.isFrozen(record.work), record.id).toBe(true);
    }
  });

  it('pins an entry by its division label, and the served work carries that label', () => {
    const pinned = SCHOOL_CANON.filter(record => record.work?.entry);
    // Nature's 1844 stand-in left when the 1836 book entered the corpus; no record pins an entry now.
    expect(pinned.map(record => [record.id, record.work.entry])).toEqual([]);
    for (const record of pinned) {
      expect(DIVISION_INDEX[record.work.id]?.labels, record.id).toContain(record.work.entry);
    }
  });

  it('crosses houses only where the plan says, and never into its own', () => {
    for (const record of SCHOOL_CANON) {
      expect(Array.isArray(record.bridges) && Object.isFrozen(record.bridges), record.id).toBe(true);
      for (const bridge of record.bridges) {
        expect(HOUSE_IDS.has(bridge) && bridge !== record.house, `${record.id} -> ${bridge}`).toBe(true);
      }
    }
    expect(Object.fromEntries(SCHOOL_CANON.filter(record => record.bridges.length)
      .map(record => [record.id, record.bridges]))).toEqual({
      'sun.monadology': ['mercury'],
      'mercury.lovelace-notes': ['sun', 'moon'],
      'mercury.ninth-bridgewater': ['saturn'],
      'venus.spiritual-in-art': ['moon'],
      'jupiter.metamorphosis-of-plants': ['venus']
    });
  });

  it('notes the commission and the edition still to come', () => {
    expect(Object.fromEntries(SCHOOL_CANON.filter(record => record.note !== null)
      .map(record => [record.id, record.note]))).toEqual({
      'gate.oration': 'Read in RISE\'s English draft, with the Latin after it; the English awaits a reading against the Latin',
      'mercury.philosophie-der-technik': 'A selection: the Vorwort and chapters I to III (Der anthropologische Maassstab, Die Organprojection, Die ersten Werkzeuge); chapters IV to XIII, from Gliedmaassen und Maasse to Der Staat, are left out; ten places where the damaged scan lost lines are marked […], and 79 unsettled readings [?]',
      'moon.psychological-types': 'Chapter X, General Description of the Types, is read now; the rest of Baynes\'s translation follows after a proofing pass of the 1924 printing',
      'jupiter.harmonices-mundi': 'A selection from Book V in Frisch\'s edition (1864): the title page, the Prooemium, chapters III, VII and VIII, and chapter X, the Epilogus; chapters I, II, IV to VI and IX, the Appendix, Kepler\'s notes and the tables are left out, and the Greek quotations are marked [Greek]',
      'mars.muqaddimah': 'A selection from de Slane\'s volume I: the opening of Book I, the first preliminary discourse, and the second section as far as the chapter on esprit de corps and sovereignty; the rest of the Prolégomènes is left out',
      'saturn.sermons': 'Claud Field\'s seven sermons are read now; C. de B. Evans\'s 1924 volume follows after a proofing pass'
    });
  });

  it('transcribes the plan verbatim', () => {
    const byId = Object.fromEntries(SCHOOL_CANON.map(record => [record.id, record]));
    expect(byId['gate.oration']).toMatchObject({
      title: 'Oration on the Dignity of Man', author: 'Pico della Mirandola', date: '1486',
      edition: 'Latin, orig. only (verify a pre-1931 English)', degree: 0, rights: 'us-pd', work: { corpus: true },
      why: 'The Renaissance manifesto: the human as the being with no fixed place, who must shape itself'
    });
    expect(byId['mercury.lovelace-notes']).toMatchObject({
      title: 'Sketch of the Analytical Engine, with Notes', author: 'Menabrea and Ada Lovelace',
      date: '1843', edition: 'Original English', degree: 2, rights: 'us-pd',
      why: 'First vision of general-purpose computation beyond number'
    });
    expect(byId['mercury.rur']).toMatchObject({
      title: 'R.U.R.', author: 'Karel Čapek', edition: 'Paul Selver, 1923, US only', why: 'The word "robot" is born'
    });
    expect(byId['sun.nature']).toMatchObject({
      title: 'Nature', author: 'Emerson', date: '1836', edition: 'Original', degree: 1,
      work: { corpus: true }
    });
    expect(byId['saturn.interior-castle']).toMatchObject({ author: 'Teresa of Ávila', date: '1577', degree: 2 });
    expect(byId['venus.faust']).toMatchObject({ date: '1808, 1832', edition: 'Bayard Taylor, 1870', degree: 2 });
  });
});

describe('the paths', () => {
  const RECORD_IDS = new Set(SCHOOL_CANON.map(record => record.id));

  it('are the plan\'s five, four to eight steps long', () => {
    expect(Object.isFrozen(SCHOOL_PATHS)).toBe(true);
    expect(SCHOOL_PATHS.map(path => path.id)).toEqual(['ficino', 'ghosts', 'form', 'unsaid', 'seasons']);
    for (const path of SCHOOL_PATHS) {
      expect(Object.keys(path).sort(), path.id).toEqual(['id', 'name', 'question', 'steps']);
      expect(path.steps.length, path.id).toBeGreaterThanOrEqual(4);
      expect(path.steps.length, path.id).toBeLessThanOrEqual(8);
    }
  });

  it('step only on records the canon holds', () => {
    for (const path of SCHOOL_PATHS) {
      for (const step of path.steps) {
        expect(Object.keys(step).sort(), path.id).toEqual(['part', 'record']);
        expect(RECORD_IDS.has(step.record), `${path.id} -> ${step.record}`).toBe(true);
      }
    }
  });

  it('carry the plan\'s names, questions and parts', () => {
    const ficino = SCHOOL_PATHS[0];
    expect(ficino).toMatchObject({ name: 'The Ficino Path', question: 'how a renaissance happens' });
    expect(ficino.steps).toEqual([
      { record: 'gate.oration', part: null },
      { record: 'saturn.corpus-hermeticum', part: 'Poimandres' },
      { record: 'sun.enneads', part: 'I.6, On Beauty' },
      { record: 'mars.renaissance-in-italy', part: 'Part II' },
      { record: 'venus.spiritual-in-art', part: null }
    ]);
    expect(SCHOOL_PATHS.map(path => [path.name, path.question])).toEqual([
      ['The Ficino Path', 'how a renaissance happens'],
      ['Ghosts in the Machine', 'mind meets mechanism'],
      ['Form and Becoming', 'the generative path'],
      ['The Unsaid', 'the apophatic path'],
      ['The Seasons of Civilization', null]
    ]);
    const parts = SCHOOL_PATHS.flatMap(path => path.steps.filter(step => step.part).map(step => `${step.record}: ${step.part}`));
    expect(parts).toEqual([
      'saturn.corpus-hermeticum: Poimandres',
      'sun.enneads: I.6, On Beauty',
      'mars.renaissance-in-italy: Part II',
      'sun.monadology: the mill passage, section 17',
      'mars.peloponnesian-war: the Melian Dialogue',
      'mars.decline-of-the-west: vol. I'
    ]);
    expect(SCHOOL_PATHS.map(path => path.steps.length)).toEqual([5, 7, 6, 5, 6]);
  });
});
