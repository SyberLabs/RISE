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
    // 80: sized above the largest curated collection (chapel-nativity,
    // 55) so review-approved pins never silently truncate, while a
    // malformed 200-work collection still cannot issue 200 requests.
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(80);
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

describe('Pinned collections', () => {
  it('every work names a known source and a numeric id', async () => {
    const { ATRIUM_PINNED_COLLECTIONS } = await import('./collections.js');
    for (const [id, collection] of Object.entries(ATRIUM_PINNED_COLLECTIONS)) {
      expect(id.startsWith('atr-'), `${id} not namespaced`).toBe(true);
      expect(collection.name, `${id} has no name`).toBeTruthy();
      expect(collection.works.length, `${id} is empty`).toBeGreaterThan(0);
      for (const work of collection.works) {
        expect(isKnownImagerySource(work.source), `${id}: ${work.source}`).toBe(true);
        expect(String(work.id)).toMatch(/^\d+$/);
      }
    }
  });

  it('gives each collection enough works to rotate without repeating', async () => {
    const { ATRIUM_PINNED_COLLECTIONS } = await import('./collections.js');
    for (const [id, collection] of Object.entries(ATRIUM_PINNED_COLLECTIONS)) {
      expect(collection.works.length, `${id} too thin to rotate`).toBeGreaterThanOrEqual(2);
      // A duplicate pin inside one collection wastes a rotation slot
      const ids = collection.works.map(w => `${w.source}:${w.id}`);
      expect(new Set(ids).size, `${id} has duplicate pins`).toBe(ids.length);
    }
  });

  it('does not leak into the Chamber\'s browsable collections', async () => {
    // Same contract the atr- categories hold: curated imagery arrives
    // only with the launch that chose it, never as a generic option.
    const { ATRIUM_PINNED_COLLECTIONS } = await import('./collections.js');
    const { WIKIMEDIA_CATEGORIES } = await import('../../../sources/visual/wikimedia.js');
    const { MUSEUM_CATEGORIES } = await import('../../../sources/visual/museum.js');
    for (const id of Object.keys(ATRIUM_PINNED_COLLECTIONS)) {
      expect(WIKIMEDIA_CATEGORIES[id]).toBeUndefined();
      expect(MUSEUM_CATEGORIES[id.replace(/^atr-/, '')]).toBeUndefined();
    }
  });
});

describe('Imagery assignments (three-way routing)', () => {
  it('routes every assigned record to a real corpus id', async () => {
    // The guard that caught four invented ids on the first pass.
    const { MECHANISM_RECORDS, LIBERATION_RECORDS, PINNED_RECORDS } =
      await import('./assignments.js');
    const { HISTORY_CORPUS } = await import('../history.js');
    const { PHILOSOPHY_CORPUS } = await import('../philosophy.js');
    const ids = new Set([
      ...HISTORY_CORPUS.events.map(e => e.id),
      ...PHILOSOPHY_CORPUS.nodes.map(n => n.id)
    ]);
    for (const table of [MECHANISM_RECORDS, LIBERATION_RECORDS, PINNED_RECORDS]) {
      for (const id of Object.keys(table)) {
        expect(ids.has(id), `unknown record: ${id}`).toBe(true);
      }
    }
  });

  it('names only mechanisms and relations the engines actually draw', async () => {
    const { MECHANISM_RECORDS, LIBERATION_RECORDS } = await import('./assignments.js');
    const { BLUEPRINT_MECHANISMS } = await import('../../../visuals/blueprint.js');
    const { FREEDOM_RELATIONS } = await import('../../../visuals/freedom.js');
    for (const { mechanism } of Object.values(MECHANISM_RECORDS)) {
      expect(BLUEPRINT_MECHANISMS, mechanism).toContain(mechanism);
    }
    for (const relation of Object.values(LIBERATION_RECORDS)) {
      expect(FREEDOM_RELATIONS, relation).toContain(relation);
    }
  });

  it('points pinned records at collections that exist', async () => {
    const { PINNED_RECORDS } = await import('./assignments.js');
    const { ATRIUM_PINNED_COLLECTIONS } = await import('./collections.js');
    for (const [record, ids] of Object.entries(PINNED_RECORDS)) {
      for (const id of ids) {
        expect(ATRIUM_PINNED_COLLECTIONS, `${record} -> ${id}`).toHaveProperty(id);
      }
    }
  });

  it('gives each class its own surface, and leaves the rest procedural', async () => {
    const { applyRecordCollections } = await import('../collections.js');
    const base = {
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
      }
    };
    const at = id => applyRecordCollections(base, id).visualConfig.interlocution;

    // MECHANISM: a drafting plate, no sourced imagery at all
    const watt = at('hist-watt-patent');
    expect(watt.procedural).toEqual(['blueprint']);
    expect(watt.sourced).toEqual([]);
    expect(watt.blueprintMechanism).toBe('beam-engine');

    // LIBERATION: the Freedom field, carrying its colonial relation
    const haiti = at('hist-haiti-independence');
    expect(haiti.procedural).toEqual(['freedom']);
    expect(haiti.freedomRelation).toBe('haiti-france');
    expect(haiti.sourced).toEqual([]);

    // DEPICTED: pinned works replace the keyword categories
    expect(at('ph-thinker-plato').sourced).toEqual(['atr-plato']);

    // CONCEPTUAL: untouched — procedural is the honest answer
    const unassigned = at('ph-tradition-milesian');
    expect(unassigned.procedural).toEqual(['klee']);
    expect(unassigned.freedomRelation).toBeUndefined();
    expect(unassigned.blueprintMechanism).toBeUndefined();
  });
});

describe('Seam contracts (assignment -> compiler -> cortex config)', () => {
  // The two blockers found in review both lived BETWEEN modules, where
  // per-module tests could not see them: the config fields were dropped
  // on the way to the cortex, and the pinned provider lacked the one
  // method the hydration path calls. These test the chain itself.

  const cortexConfigFor = async recordId => {
    const { applyRecordCollections } = await import('../collections.js');
    const { normalizeVisualConfig } = await import('../../../core/session-compiler.js');
    const base = {
      visualConfig: {
        visualMode: 'interlocution',
        interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] }
      }
    };
    // What the handoff produces, through the compiler, as app.js reads it
    const applied = applyRecordCollections(base, recordId);
    const compiled = normalizeVisualConfig(applied.visualConfig);
    const il = compiled.interlocution;
    return {
      blueprintClimate: il.blueprintClimate ?? 'auto',
      blueprintMechanism: il.blueprintMechanism ?? null,
      freedomRelation: il.freedomRelation ?? null,
      procedural: il.procedural,
      sourced: il.sourced
    };
  };

  it('carries the authored mechanism all the way to the cortex config', async () => {
    const watt = await cortexConfigFor('hist-watt-patent');
    expect(watt.procedural).toEqual(['blueprint']);
    expect(watt.blueprintMechanism).toBe('beam-engine');
    expect(watt.blueprintClimate).toBe('cyanotype');
  });

  it('carries the authored colonial relation all the way to the cortex config', async () => {
    // The bug this catches was visible as Haiti drawing a Union Jack:
    // the relation was lost after the compiler, so Freedom fell back to
    // its britain/emancipation default.
    const haiti = await cortexConfigFor('hist-haiti-independence');
    expect(haiti.procedural).toEqual(['freedom']);
    expect(haiti.freedomRelation).toBe('haiti-france');

    const brazil = await cortexConfigFor('hist-brazil-independence');
    expect(brazil.freedomRelation).toBe('brazil-portugal');
  });

  it('exposes the provider method the hydration path actually calls', async () => {
    // getImagesInCategory alone is not enough: the cortex calls
    // getRandom, and its absence fails silently inside the hydration
    // guard — the museum work simply never enters the pool.
    const { getPinnedWorksProvider } = await import('./provider.js');
    const provider = getPinnedWorksProvider();
    expect(typeof provider.getRandom).toBe('function');
    expect(typeof provider.getImagesInCategory).toBe('function');

    const item = await provider.getRandom({ category: 'atr-plato' });
    // Offline in CI: null is acceptable, a malformed item is not
    if (item) {
      expect(item.data?.url, 'cortex requires image.data.url').toBeTruthy();
      expect(item.providerId).toBe('atrium-pinned');
      expect(item.metadata.sourceUrl).toBeTruthy();
    }
  });

  it('accounts for every curated record explicitly', async () => {
    // "No assignment" must never silently mean "use the old keyword
    // table" — that hides an incomplete migration behind a screen that
    // looks like it works.
    const { ATRIUM_RECORD_COLLECTIONS } = await import('../collections.js');
    const { imageryPlanFor } = await import('./assignments.js');
    const unplanned = Object.keys(ATRIUM_RECORD_COLLECTIONS)
      .filter(id => !imageryPlanFor(id));
    expect(unplanned, `unplanned records: ${unplanned.join(', ')}`).toEqual([]);
  });

  it('leaves conceptual readings with no sourced imagery at all', async () => {
    const eleatic = await cortexConfigFor('ph-school-eleatic');
    expect(eleatic.sourced).toEqual([]);
    const iamblichus = await cortexConfigFor('ph-tradition-iamblichean');
    expect(iamblichus.sourced).toEqual([]);
  });
});

describe('App forwards the Atrium-exclusive fields to the cortex', () => {
  it('passes blueprint and freedom config in updateConfig', async () => {
    // The compiler preserves these fields, but app.js builds the cortex
    // config by naming keys explicitly — so a field can survive the
    // whole pipeline and still be dropped on the last hop. That is the
    // bug that made Haiti draw a Union Jack, and no amount of module
    // testing sees it. Assert on the wiring itself.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve('src/app.js'), 'utf8');
    // Anchor on the interlocution config block, not the first
    // updateConfig call (several disable the cortex outright).
    const anchor = source.indexOf('harmonographClimate: interlocution');
    expect(anchor, 'interlocution cortex config not found').toBeGreaterThan(0);
    const block = source.slice(anchor - 2000, anchor + 2000);
    for (const field of ['blueprintClimate', 'blueprintMechanism', 'freedomRelation']) {
      expect(block, `app.js must forward ${field} to the cortex`).toContain(field);
    }
  });
});

describe('Deployment policy allows what the adapters call', () => {
  it('lists every museum API host in the CSP connect-src', async () => {
    // A host missing from connect-src is blocked by the browser, the
    // adapter catches the fetch error and returns null, and the imagery
    // silently never appears — the same invisible failure mode as the
    // missing getRandom. The policy and the adapters must be checked
    // against each other, not maintained in parallel by memory.
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const toml = readFileSync(resolve('netlify.toml'), 'utf8');
    const connectSrc = /connect-src([^;]*)/.exec(toml)?.[1] ?? '';

    // EVERY adapter in the directory, so a newly added adapter is
    // covered the moment it exists rather than when someone remembers
    // to list it here.
    const dir = resolve('src/content/atrium/imagery/adapters');
    const adapters = readdirSync(dir).filter(name => name.endsWith('.js') && !name.endsWith('.test.js'));
    expect(adapters.length).toBeGreaterThanOrEqual(4);
    for (const name of adapters) {
      const source = readFileSync(resolve(dir, name), 'utf8');
      // Fetch targets are the const endpoint/base declarations, not
      // documentation links in comments
      for (const [, host] of source.matchAll(/^const [A-Z_]+ = 'https:\/\/([a-z0-9.-]+)/gim)) {
        // Image hosts are covered by img-src https:; only JSON APIs
        // need connect-src. IIIF *image* bases are excluded.
        if (/^www\.artic\.edu$|^iiif\./.test(host)) continue;
        expect(connectSrc, `${name} calls ${host}, absent from connect-src`)
          .toContain(host);
      }
    }
  });
});

describe('Museum requests are bounded', () => {
  it('abandons a stalled museum API instead of holding the reading', async () => {
    // The cortex waits on external preload before a reading begins, so
    // an API that STALLS rather than failing would hold the preparation
    // screen open. A stall is not an error, so nothing else catches it.
    vi.useFakeTimers();
    const { resolveMetWork } = await import('./adapters/met.js');

    let rejectedWith = null;
    const fetchImpl = (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        rejectedWith = init.signal.reason;
        reject(init.signal.reason);
      });
    });

    const pending = resolveMetWork(436105, { fetchImpl, timeoutMs: 8000 });
    await vi.advanceTimersByTimeAsync(8100);
    expect(await pending).toBeNull();
    expect(String(rejectedWith?.message || '')).toMatch(/timed out/i);
    vi.useRealTimers();
  });

  it('forwards the caller\'s budget from provider to adapter', async () => {
    const { getPinnedWorksProvider } = await import('./provider.js');
    const provider = getPinnedWorksProvider();
    const seen = [];
    const original = provider.getImagesInCategory.bind(provider);
    provider.getImagesInCategory = async (id, limit, options) => {
      seen.push(options?.timeoutMs);
      return [];
    };
    await provider.getRandom({ category: 'atr-plato', timeoutMs: 1234 });
    provider.getImagesInCategory = original;
    expect(seen[0]).toBe(1234);
  });
});
