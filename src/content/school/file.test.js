/**
 * The local file reader reads a hand-made artifact under
 * scripts/school-sources/: provenance above, the work below from the
 * heading the recipe names, `#` headings and blank-line paragraphs.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from './file.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const ORATIO = `# Oratio de hominis dignitate

Latin text. One block per paragraph, keeping the running sentence numbers.

- Source A: Latin Wikisource.

## § 1

1. Legi, Patres colendissimi, in Arabum monumentis. 2. Cui sententiae illud Mercurii adstipulatur: «Magnum, o Asclepi,
miraculum est homo».

## § 2

3. Horum dictorum rationem cogitanti mihi non satis illae multae rationes faciebant.
`;

describe('readFile', () => {
  it('reads from the named heading, units by heading, and strikes and counts the sentence numbers', () => {
    const read = readFile(ORATIO, parse, {
      extract: { from: '§ 1' }, units: 'headings', level: 2,
      strike: { pattern: '(?<=^|\\s)\\d+\\.\\s', kind: 'sentence numbers' }
    });
    expect(read.parts.map(part => [part.name, part.content])).toEqual([
      ['§ 1', 'Legi, Patres colendissimi, in Arabum monumentis. Cui sententiae illud Mercurii adstipulatur: «Magnum, o Asclepi, miraculum est homo».'],
      ['§ 2', 'Horum dictorum rationem cogitanti mihi non satis illae multae rationes faciebant.']
    ]);
    expect(read.dropped).toEqual({ 'sentence numbers': 3 });
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads the whole work as one unit, and refuses a start it cannot find', () => {
    const tablet = '# Provenance\n\nRe-keyed from the manuscript.\n\n## Tabula Smaragdina\n\nTis true without lying, certain & most true.\n';
    const read = readFile(tablet, parse, { extract: { from: 'Tabula Smaragdina' }, units: 'whole', name: 'The Emerald Tablet' });
    expect(read.parts[0]).toMatchObject({ name: 'The Emerald Tablet', content: 'Tabula Smaragdina\n\nTis true without lying, certain & most true.' });
    expect(() => readFile(tablet, parse, { extract: { from: 'Tabula' }, units: 'whole' })).toThrow(/Tabula/u);
  });
});
