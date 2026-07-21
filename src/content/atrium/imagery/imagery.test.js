import { describe, expect, it, vi, beforeEach } from 'vitest';
import { normalizeWork, isDisplayable, attributionLine, RIGHTS } from './works.js';
import { resolveMetWork, MET_SOURCE } from './adapters/met.js';
import { resolveCollection, IMAGERY_PROVIDER_ID, isKnownImagerySource } from './service.js';
import { SourceCache } from '../../../sources/cache.js';

// Resolved works are cached for 30 days, so tests must not inherit each
// other's entries — an id resolved in one case would otherwise satisfy
// the same id in the next and mask a real resolution failure.
beforeEach(() => {
  vi.spyOn(SourceCache, 'get').mockResolvedValue(null);
  vi.spyOn(SourceCache, 'set').mockResolvedValue(undefined);
});

const metRecord = (over = {}) => ({
  objectID: 436105,
  title: 'The Death of Socrates',
  artistDisplayName: 'Jacques Louis David',
  artistDisplayBio: 'French, Paris 1748–1825 Brussels',
  objectDate: '1787',
  medium: 'Oil on canvas',
  isPublicDomain: true,
  primaryImage: 'https://images.metmuseum.org/orig/DP-13139-001.jpg',
  primaryImageSmall: 'https://images.metmuseum.org/web-large/DP-13139-001.jpg',
  objectURL: 'https://www.metmuseum.org/art/collection/search/436105',
  ...over
});

const fetchStub = (record, ok = true) => vi.fn().mockResolvedValue({
  ok, json: async () => record
});

describe('Atrium work contract', () => {
  it('carries the full catalog record a citation needs', () => {
    const work = normalizeWork({
      id: 'met:436105', title: 'The Death of Socrates', artist: 'Jacques Louis David',
      date: '1787', rights: RIGHTS.CC0, imageUrl: 'https://x/img.jpg',
      sourceName: 'The Met', sourceUrl: 'https://x/436105'
    });
    expect(work).toMatchObject({ title: 'The Death of Socrates', rights: 'CC0' });
    expect(attributionLine(work))
      .toBe('The Death of Socrates · Jacques Louis David · 1787 · The Met');
  });

  it('refuses any work whose rights are not established', () => {
    // Absence of a stated restriction is not permission. This mirrors the
    // Atrium's text readiness gates and is not negotiable for the same
    // reason: the Atrium's value is that its material is defensible.
    const base = {
      id: 'met:1', title: 'X', imageUrl: 'https://x/i.jpg',
      sourceUrl: 'https://x/1', sourceName: 'Met'
    };
    expect(normalizeWork({ ...base, rights: RIGHTS.UNKNOWN })).toBeNull();
    expect(normalizeWork({ ...base, rights: RIGHTS.CC_BY })).toBeNull();
    expect(normalizeWork({ ...base })).toBeNull();
    expect(normalizeWork({ ...base, rights: RIGHTS.CC0 })).not.toBeNull();
    expect(normalizeWork({ ...base, rights: RIGHTS.PUBLIC_DOMAIN })).not.toBeNull();
  });

  it('refuses a work that cannot be cited or shown', () => {
    const ok = { id: 'met:1', rights: RIGHTS.CC0, imageUrl: 'https://x/i.jpg', sourceUrl: 'https://x/1' };
    expect(normalizeWork({ ...ok, sourceUrl: '' })).toBeNull();
    expect(normalizeWork({ ...ok, imageUrl: '' })).toBeNull();
    expect(normalizeWork(null)).toBeNull();
    expect(isDisplayable(null)).toBe(false);
  });

  it('strips markup out of institution-supplied prose', () => {
    const work = normalizeWork({
      id: 'met:1', title: '<b>Title</b>', artist: '<a href="#">Artist</a>',
      rights: RIGHTS.CC0, imageUrl: 'https://x/i.jpg', sourceUrl: 'https://x/1'
    });
    expect(work.title).toBe('Title');
    expect(work.artist).toBe('Artist');
  });
});

describe('Met adapter', () => {
  it('resolves a pinned object into a complete work', async () => {
    const work = await resolveMetWork(436105, { fetchImpl: fetchStub(metRecord()) });
    expect(work).toMatchObject({
      id: 'met:436105',
      title: 'The Death of Socrates',
      artist: 'Jacques Louis David',
      date: '1787',
      rights: 'CC0',
      sourceName: 'The Metropolitan Museum of Art'
    });
    expect(work.sourceUrl).toContain('metmuseum.org');
  });

  it('withholds a work the Met does not mark public domain', async () => {
    const work = await resolveMetWork(1, {
      fetchImpl: fetchStub(metRecord({ isPublicDomain: false }))
    });
    expect(work).toBeNull();
  });

  it('yields nothing rather than throwing when the API fails', async () => {
    // A source that cannot be reached costs the collection one image;
    // it must never cost the reading its stability.
    expect(await resolveMetWork(1, { fetchImpl: fetchStub({}, false) })).toBeNull();
    expect(await resolveMetWork(1, {
      fetchImpl: vi.fn().mockRejectedValue(new Error('network'))
    })).toBeNull();
    expect(await resolveMetWork(1, {
      fetchImpl: fetchStub({ message: 'Not a valid object' })
    })).toBeNull();
    expect(await resolveMetWork(1, {
      fetchImpl: fetchStub(metRecord({ primaryImage: '', primaryImageSmall: '' }))
    })).toBeNull();
  });

  it('rejects non-numeric ids without issuing a request', async () => {
    const fetchImpl = vi.fn();
    expect(await resolveMetWork('../../etc/passwd', { fetchImpl })).toBeNull();
    expect(await resolveMetWork('', { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Imagery service', () => {
  it('resolves a collection in the curator\'s order', async () => {
    const fetchImpl = vi.fn(url => {
      const id = Number(String(url).split('/').pop());
      return Promise.resolve({ ok: true, json: async () => metRecord({ objectID: id, title: `Work ${id}` }) });
    });
    const works = await resolveCollection(
      { name: 'Socrates', works: [{ source: 'met', id: 1 }, { source: 'met', id: 2 }] },
      { fetchImpl }
    );
    expect(works.map(w => w.title)).toEqual(['Work 1', 'Work 2']);
  });

  it('skips unresolvable works — never substitutes', async () => {
    // Substitution is what produced the off-subject imagery this service
    // replaces. A thin collection is correct; a wrong image is not.
    const fetchImpl = vi.fn(url => {
      const id = Number(String(url).split('/').pop());
      if (id === 2) return Promise.resolve({ ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => metRecord({ objectID: id, title: `Work ${id}` }) });
    });
    const works = await resolveCollection(
      { name: 'X', works: [{ source: 'met', id: 1 }, { source: 'met', id: 2 }, { source: 'met', id: 3 }] },
      { fetchImpl }
    );
    expect(works.map(w => w.title)).toEqual(['Work 1', 'Work 3']);
  });

  it('ignores unknown sources and malformed collections', async () => {
    expect(isKnownImagerySource(MET_SOURCE)).toBe(true);
    expect(isKnownImagerySource('nope')).toBe(false);
    expect(await resolveCollection({ works: [{ source: 'nope', id: 1 }] })).toEqual([]);
    expect(await resolveCollection({})).toEqual([]);
    expect(await resolveCollection(null)).toEqual([]);
  });

  it('bounds how many requests one collection can issue', async () => {
    const fetchImpl = vi.fn(url => Promise.resolve({
      ok: true,
      json: async () => metRecord({ objectID: Number(String(url).split('/').pop()) })
    }));
    const works = Array.from({ length: 200 }, (_, i) => ({ source: 'met', id: i + 1 }));
    await resolveCollection({ works }, { fetchImpl });
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(40);
  });

  it('caches under its own namespace, never a Chamber provider id', () => {
    // Isolation: an Atrium launch must not warm or pollute Chamber caches
    expect(IMAGERY_PROVIDER_ID).toBe('atrium-imagery');
    expect(IMAGERY_PROVIDER_ID).not.toMatch(/^(wikimedia|museum-aic|generated)/);
  });
});

describe('Chamber isolation (spec §5)', () => {
  it('does not change the Chamber\'s browsable category vocabulary', async () => {
    // The service is additive. Importing it must not add, remove, or
    // rename a single category a Chamber reader can browse.
    const { WIKIMEDIA_CATEGORIES } = await import('../../../sources/visual/wikimedia.js');
    const { MUSEUM_CATEGORIES } = await import('../../../sources/visual/museum.js');
    const before = [
      ...Object.keys(WIKIMEDIA_CATEGORIES),
      ...Object.keys(MUSEUM_CATEGORIES)
    ].sort();

    await import('./service.js');
    await import('./adapters/met.js');

    const after = [
      ...Object.keys(WIKIMEDIA_CATEGORIES),
      ...Object.keys(MUSEUM_CATEGORIES)
    ].sort();
    expect(after).toEqual(before);
  });

  it('registers no resolver with the Chamber provider registry', async () => {
    // The Atrium's imagery must arrive only with the launch that curated
    // it — never as a browsable option in the Visual panel.
    const wikimedia = await import('../../../sources/visual/wikimedia.js');
    const resolved = wikimedia.resolveCategory?.('met:436105');
    expect(resolved == null || resolved === false).toBe(true);
  });
});
