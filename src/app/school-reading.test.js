import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../content/library.js', async importOriginal => {
  const divided = (id, title, labels) => ({
    id,
    workId: id,
    title,
    editionId: `${id}-edition`,
    sourceRevision: 'rev-1',
    defaultWpm: 200,
    defaultCurve: 'flat',
    getDivisions: async () => ({
      divided: true,
      noun: 'Book',
      entries: labels.map((label, index) => ({ id: index, label, content: `${label} text`, verse: index === 1 }))
    })
  });
  const texts = [
    divided('literary-meditations', 'Meditations', ['Book I', 'Book II']),
    {
      id: 'sacred-tao-te-ching',
      title: 'Tao Te Ching',
      defaultWpm: 180,
      defaultCurve: 'flat',
      getDivisions: async () => ({ divided: false, entries: [] }),
      getSequences: async () => [{ content: 'The way' }, { content: 'that can be named' }]
    }
  ];
  return { ...await importOriginal(), getTextById: id => texts.find(text => text.id === id) };
});

vi.mock('../core/content-store.js', () => ({
  loadSchoolSections: vi.fn(async id => {
    if (id !== 'sun.zarathustra') throw new Error(`no ${id}`);
    return [
      { name: 'Part I · Zarathustra’s Prologue', content: 'When Zarathustra was thirty years old.' },
      { name: 'Part I · Chapter I: The Three Metamorphoses', content: 'Three metamorphoses of the spirit.', verse: true }
    ];
  })
}));

import { SCHOOL_ORIGIN, recordSchoolReading, schoolReading } from './school-reading.js';
import { jevColors } from '../core/jev-palette.js';
import { clearProgress, readProgress } from '../core/school-progress.js';

afterEach(() => clearProgress());

describe('a reading opened from the Mystery School', () => {
  it('opens a divided work at its first division, as the Library opens a division', async () => {
    const reading = await schoolReading('sun.meditations', null);
    expect(reading.text).toBe('Book I text');
    expect(reading.source).toBe('Meditations · Book I');
    expect(reading.origin).toBe(SCHOOL_ORIGIN);
    expect(SCHOOL_ORIGIN).toEqual({ view: 'school', icon: '☉', name: 'Mystery School' });
    expect(reading.config).toEqual({
      wpm: 200,
      curve: 'flat',
      verseLines: false,
      continuation: {
        kind: 'library-division',
        workId: 'literary-meditations',
        editionId: 'literary-meditations-edition',
        sourceRevision: 'rev-1',
        entryId: '0',
        entryIndex: 0,
        entryCount: 2,
        noun: 'book'
      },
      provenance: {
        kind: 'school',
        recordId: 'sun.meditations',
        workId: 'literary-meditations',
        editionId: 'literary-meditations-edition',
        sourceRevision: 'rev-1',
        entryId: '0'
      },
      presentation: {
        colorTheme: 'citrine',
        textColor: 'citrine',
        backgroundColor: 'citrine',
        colors: jevColors('citrine', 'citrine', 'citrine')
      }
    });
  });

  it('opens the division the Lectern names', async () => {
    const reading = await schoolReading('sun.meditations', 1);
    expect(reading.source).toBe('Meditations · Book II');
    expect(reading.config.verseLines).toBe(true);
    expect(reading.config.provenance.entryId).toBe('1');
    expect(reading.config.continuation.entryIndex).toBe(1);
  });

  it('reads an undivided work whole', async () => {
    const reading = await schoolReading('saturn.tao-te-ching', null);
    expect(reading.text).toBe('The way\n\nthat can be named');
    expect(reading.source).toBe('Tao Te Ching');
    expect(reading.config.continuation).toBeUndefined();
    expect(reading.config.provenance).toEqual({
      kind: 'school',
      recordId: 'saturn.tao-te-ching',
      workId: 'sacred-tao-te-ching',
      editionId: null,
      sourceRevision: null,
      entryId: null
    });
    expect(reading.config.presentation.colorTheme).toBe('amethyst');
  });

  it('opens a School corpus text at the unit the Lectern names, by its declared name', async () => {
    const reading = await schoolReading('sun.zarathustra', 1);
    expect(reading).toEqual({
      text: 'Three metamorphoses of the spirit.',
      source: 'Thus Spoke Zarathustra · Part I · Chapter I: The Three Metamorphoses',
      origin: SCHOOL_ORIGIN,
      config: {
        wpm: 200,
        curve: 'flat',
        verseLines: true,
        provenance: { kind: 'school', recordId: 'sun.zarathustra', corpus: true, entryId: '1' },
        presentation: {
          colorTheme: 'citrine',
          textColor: 'citrine',
          backgroundColor: 'citrine',
          colors: jevColors('citrine', 'citrine', 'citrine')
        }
      }
    });
    expect((await schoolReading('sun.zarathustra', null)).source).toBe('Thus Spoke Zarathustra · Part I · Zarathustra’s Prologue');
  });

  it('opens nothing for a text RISE does not carry', async () => {
    expect(await schoolReading('jupiter.harmonices-mundi', null)).toBeNull();
    expect(await schoolReading('sun.nothing', null)).toBeNull();
  });
});

describe('a finished school reading', () => {
  it('marks the division it read, following the reading on to later divisions', () => {
    recordSchoolReading({
      provenance: { kind: 'school', recordId: 'sun.meditations', workId: 'literary-meditations', entryId: '0' },
      continuation: { kind: 'library-division', workId: 'literary-meditations', entryId: '3' }
    });
    expect(readProgress().read['sun.meditations'].entries).toEqual(['3']);
  });

  it('marks an undivided work whole', () => {
    recordSchoolReading({ provenance: { kind: 'school', recordId: 'saturn.tao-te-ching', entryId: null } });
    expect(readProgress().read['saturn.tao-te-ching'].whole).toBe(true);
  });

  it('marks the unit of a School corpus text it read', () => {
    recordSchoolReading({ provenance: { kind: 'school', recordId: 'sun.zarathustra', corpus: true, entryId: '1' } });
    expect(readProgress().read['sun.zarathustra'].entries).toEqual(['1']);
  });

  it('marks nothing for a reading from anywhere else', () => {
    recordSchoolReading({ provenance: { kind: 'library-work', workId: 'literary-meditations' } });
    recordSchoolReading({});
    expect(readProgress().read).toEqual({});
  });
});
