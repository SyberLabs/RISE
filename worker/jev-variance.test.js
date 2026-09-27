import { describe, expect, it } from 'vitest';
import { buildJevVarianceHints, VARIATION_COUNT } from './jev-variance.mjs';

const books = [
  { work_id: 'ulysses', title: 'Ulysses', author: 'James Joyce' },
  { work_id: 'middlemarch', title: 'Middlemarch', author: 'George Eliot' },
  { work_id: 'literary-walden', title: 'Walden', author: 'Henry David Thoreau' }
];

describe('Jev variance hints', () => {
  it('rotates every admitted reading and creative direction across persisted turns', () => {
    const hints = Array.from({ length: 21 }, (_, index) =>
      buildJevVarianceHints({ books, intent: 'Surprise me', turn: index }));
    expect(VARIATION_COUNT).toBe(8);
    expect(new Set(hints.map(hint => hint.variation.focusWorkId))).toEqual(new Set(books.map(book => book.work_id)));
    expect(new Set(hints.map(hint => hint.variation.directionIndex)).size).toBe(8);
    expect(new Set(hints.map(hint => hint.configHint)).size).toBe(8);
    expect(new Set(hints.map(hint => hint.configHint.match(/pace=(\d+)/u)?.[1])).size).toBeGreaterThan(1);
    expect(new Set(hints.map(hint => hint.configHint.match(/audio=([\w-]+)/u)?.[1])).size).toBeGreaterThan(1);
    expect(new Set(hints.map(hint => hint.configHint.match(/chamberFace=(\w+)/u)?.[1])).size).toBeGreaterThan(1);
    expect(new Set(hints.map(hint => hint.variation.sectionHint)))
      .toEqual(new Set(['first', 'middle', 'last', 'shortest', 'longest']));
  });

  it('keeps the same hint for the same turn and does not mutate the catalog', () => {
    const original = structuredClone(books);
    expect(buildJevVarianceHints({ books, intent: 'Surprise me', turn: 4 }))
      .toEqual(buildJevVarianceHints({ books: [...books].reverse(), intent: 'Surprise me', turn: 4 }));
    expect(books).toEqual(original);
  });

  it('offers disjoint catalog cohorts on adjacent open-ended turns', () => {
    const first = buildJevVarianceHints({ books, intent: 'Surprise me', turn: 0 });
    const second = buildJevVarianceHints({ books, intent: 'Surprise me', turn: 1 });
    const ids = hint => hint.eligibleBooks.map(book => book.work_id);
    expect(ids(first)).toHaveLength(2);
    expect(ids(second)).toHaveLength(1);
    expect(ids(first).filter(id => ids(second).includes(id))).toEqual([]);
    expect(new Set([...ids(first), ...ids(second)])).toEqual(new Set(books.map(book => book.work_id)));
  });

  it('offers the full catalog when a title, author, or detailed intent is given', () => {
    for (const intent of ['Read ULYSSES please', 'Something by George Eliot', 'Nature and quiet',
      'I want a novel about the consequences of marriage',
      'I would like a deep and reflective novel with many interwoven lives']) {
      expect(buildJevVarianceHints({ books, intent, turn: 1 }).eligibleBooks).toHaveLength(books.length);
    }
  });

  it('subordinates variety to explicit reader preferences and offered options', () => {
    const hint = buildJevVarianceHints({ books, intent: 'Surprise me', turn: 0 });
    expect(hint.bookHint).toContain('reader\'s intent always take priority');
    expect(hint.configHint).toContain('Explicit reader preferences always take priority');
    expect(hint.configHint).toContain('select only offered values');
    const specific = buildJevVarianceHints({ books, intent: 'I want large text, silence, and a slow pace', turn: 3 });
    expect(specific.configHint).not.toContain('visualStyle=');
  });
});
