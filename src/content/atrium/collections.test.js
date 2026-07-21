/**
 * Atrium-coupled collections: curated imagery is content, so it is
 * verified like content — every id must resolve against a real
 * provider category, and curation must never silently vanish or
 * escape the launch it belongs to.
 */
import { describe, expect, it } from 'vitest';
import {
  ATRIUM_RECORD_COLLECTIONS,
  applyRecordCollections,
  collectionsForRecord
} from './collections.js';
import { WIKIMEDIA_CATEGORIES } from '../../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';
import { ATRIUM_CATEGORIES } from './atrium-categories.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';
import { HISTORY_CORPUS } from './history.js';

const DOMAIN_CONFIG = Object.freeze({
  wpm: 140,
  soundscape: 'aurora',
  visualConfig: {
    visualMode: 'interlocution',
    interlocution: {
      sourceFamily: 'blend',
      procedural: ['harmonograph'],
      sourced: ['aic-oldmasters'],
      frequency: 0.15
    }
  }
});

describe('Atrium record collections', () => {
  it('every curated id resolves to a real provider category', () => {
    const valid = new Set([
      ...Object.keys(WIKIMEDIA_CATEGORIES),
      ...Object.keys(MUSEUM_CATEGORIES).map(id => `aic-${id}`),
      // Atrium-scoped subject categories (atr-*) are corpus content
      ...Object.keys(ATRIUM_CATEGORIES)
    ]);

    for (const [recordId, ids] of Object.entries(ATRIUM_RECORD_COLLECTIONS)) {
      expect(Array.isArray(ids) && ids.length > 0, `${recordId} has no ids`).toBe(true);
      for (const id of ids) {
        expect(valid.has(id), `${recordId} names unknown category '${id}'`).toBe(true);
      }
    }
  });

  it('every curated record id exists in the corpus', () => {
    const known = new Set([
      ...PHILOSOPHY_CORPUS.nodes.map(node => node.id),
      ...HISTORY_CORPUS.events.map(event => event.id)
    ]);
    const unknown = Object.keys(ATRIUM_RECORD_COLLECTIONS)
      .filter(recordId => !known.has(recordId));
    // Curation for a record that does not exist is dead content
    expect(unknown, `unknown record ids: ${unknown.join(', ')}`).toEqual([]);
  });

  it('replaces the domain default and marks the launch as curated', () => {
    // Aristotle is a DEPICTED subject with a pinned collection, so the
    // reviewed museum works replace the keyword categories entirely
    // (Rembrandt's Aristotle with a Bust of Homer, not four tag pools).
    const applied = applyRecordCollections(DOMAIN_CONFIG, 'ph-thinker-aristotle');
    expect(applied.visualConfig.interlocution.sourced)
      .toEqual(['atr-aristotle']);
    expect(applied.visualConfig.interlocution.atriumCollections)
      .toEqual(['atr-aristotle']);
    expect(applied.visualConfig.interlocution.sourceFamily).toBe('blend');
    // The domain's procedural signature and audio survive
    expect(applied.visualConfig.interlocution.procedural).toEqual(['harmonograph']);
    expect(applied.soundscape).toBe('aurora');
  });

  it('leaves an uncurated record on the domain default, untouched', () => {
    const applied = applyRecordCollections(DOMAIN_CONFIG, 'ph-record-with-no-curation');
    expect(applied).toBe(DOMAIN_CONFIG);
    expect(collectionsForRecord('ph-record-with-no-curation')).toBeNull();
  });

  it('returns a defensive copy — curation cannot be mutated by a caller', () => {
    const first = collectionsForRecord('ph-thinker-plato');
    first.push('astronomy');
    expect(collectionsForRecord('ph-thinker-plato')).not.toContain('astronomy');
  });
});
