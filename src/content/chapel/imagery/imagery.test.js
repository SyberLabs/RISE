import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHAPEL_PINNED_COLLECTIONS, hasChapelCollection } from './collections.js';
import { CHAPEL_ICONS, CHAPEL_ICON_DEFAULTS, findChapelIcon } from './icons.js';
import { getChapelWorksProvider } from './provider.js';
import { resolveAicWork } from '../../atrium/imagery/adapters/aic.js';
import { resolveRijksWork } from '../../atrium/imagery/adapters/rijks.js';
import { createChapelHandoff, chapelSensoryConfig } from '../handoff.js';

const KNOWN_SOURCES = new Set(['met', 'cleveland', 'aic', 'rijks']);

describe('Chapel pinned collections', () => {
  it('holds the four collections, every pin with a known source and a curation comment', () => {
    const ids = Object.keys(CHAPEL_PINNED_COLLECTIONS);
    expect(ids).toEqual([
      'chapel-crucifixion', 'chapel-passion', 'chapel-nativity', 'chapel-resurrection'
    ]);
    const source = readFileSync(resolve('src/content/chapel/imagery/collections.js'), 'utf8');
    for (const [collectionId, collection] of Object.entries(CHAPEL_PINNED_COLLECTIONS)) {
      expect(collection.works.length, collectionId).toBeGreaterThanOrEqual(10);
      for (const work of collection.works) {
        expect(KNOWN_SOURCES.has(work.source), `${collectionId}: ${work.source}`).toBe(true);
        // Every pin line carries its work's name — a silent upstream
        // change must be detectable without an API call
        const pinLine = new RegExp(`id: ${work.id} \\},  // \\S`);
        expect(pinLine.test(source), `${collectionId}: ${work.source}:${work.id} lacks curation comment`).toBe(true);
      }
    }
  });

  it('excludes the reviewed cuts: no Saint Andrew, no single-king fragments', () => {
    const allIds = Object.values(CHAPEL_PINNED_COLLECTIONS)
      .flatMap(collection => collection.works.map(work => `${work.source}:${work.id}`));
    // Caravaggio's Crucifixion of Saint Andrew (Cleveland)
    expect(allIds).not.toContain('cleveland:148758');
    // Balthasar / Caspar king panels (Rijksmuseum)
    expect(allIds).not.toContain('rijks:200109034');
    expect(allIds).not.toContain('rijks:200109035');
    // Nativity re-review (2026-07-22): vitrine objects and wrong
    // subjects — limestone fragments of a dismembered Adoration group,
    // a tabernacle house altar, a rock-crystal intaglio, an in-situ
    // apse fresco, an enamel plaque, a grey bronze relief, and the
    // family of Zebedee (not an Annunciation)
    for (const cut of [
      'met:471050', 'met:471051', 'met:471052', 'met:471053',
      'met:459249', 'met:461346', 'met:472381', 'met:192738',
      'aic:44741', 'rijks:20025804'
    ]) {
      expect(allIds).not.toContain(cut);
    }
  });

  it('stays within the service request bound', async () => {
    const service = readFileSync(resolve('src/content/atrium/imagery/service.js'), 'utf8');
    const bound = Number(/MAX_WORKS_PER_COLLECTION = (\d+)/.exec(service)?.[1]);
    for (const [id, collection] of Object.entries(CHAPEL_PINNED_COLLECTIONS)) {
      expect(collection.works.length, `${id} exceeds service bound — pins would silently truncate`)
        .toBeLessThanOrEqual(bound);
    }
  });
});

describe('Chapel icons', () => {
  it('pins the three approved icons with stated rights bases and attribution', () => {
    expect(Object.keys(CHAPEL_ICONS)).toEqual([
      'icon-pantocrator-sinai', 'icon-pantocrator-russian', 'icon-good-shepherd', 'icon-salus-populi-romani'
    ]);
    for (const [id, icon] of Object.entries(CHAPEL_ICONS)) {
      expect(icon.rights, id).toBe('PUBLIC_DOMAIN');
      expect(icon.rightsBasis, id).toMatch(/verified 2026/);
      expect(icon.attribution, id).toBeTruthy();
      expect(icon.image, id).toMatch(/^https:\/\//);
      expect(icon.sourceUrl, id).toMatch(/^https:\/\//);
    }
    expect(CHAPEL_ICON_DEFAULTS.pantocrator).toBe('icon-pantocrator-sinai');
    expect(CHAPEL_ICON_DEFAULTS.marian).toBe('icon-salus-populi-romani');
    expect(findChapelIcon('icon-of-nowhere')).toBeNull();
  });
});

describe('Chapel provider scoping', () => {
  it('serves chapel collections and nothing else — atr- ids resolve to nothing here', async () => {
    const provider = getChapelWorksProvider();
    expect(provider.id).toBe('chapel-pinned');
    expect(hasChapelCollection('chapel-crucifixion')).toBe(true);
    expect(hasChapelCollection('atr-plato')).toBe(false);
    // An Atrium id through the chapel provider yields nothing
    const images = await provider.getImagesInCategory('atr-plato', 5);
    expect(images).toEqual([]);
  });

  it('cortex routes chapel-* to the chapel provider with NO fallback (stillness on absence)', () => {
    const cortex = readFileSync(resolve('src/visuals/visual-cortex.js'), 'utf8');
    const branch = cortex.slice(
      cortex.indexOf("categoryId.startsWith('chapel-')"),
      cortex.indexOf("categoryId.startsWith('atr-')")
    );
    expect(branch).toContain('getChapelWorksProvider');
    // Reverent degradation: the branch ends in null, and never touches
    // the Wikimedia provider
    expect(branch).toMatch(/return null;/);
    expect(branch).not.toContain('_getWikimediaProvider');
  });

  it('never appears in the browsable panel: chapel ids are chip labels only', () => {
    const panel = readFileSync(resolve('src/components/VisualInterlocutionPanel.js'), 'utf8');
    // The chapel case exists for the "From this reading" chips…
    expect(panel).toContain("id.startsWith('chapel-')");
    // …and no chapel-* id is offered as a selectable collection option
    expect(panel).not.toMatch(/data-(category|collection)="chapel-/);
  });
});

describe('AIC adapter', () => {
  const record = {
    data: {
      id: 80084, title: 'The Crucifixion',
      artist_display: 'Francisco de Zurbarán (Spanish, 1598–1664)\nSeville',
      date_display: '1627', medium_display: 'Oil on canvas',
      is_public_domain: true, image_id: 'abc-123'
    }
  };

  it('resolves a pinned id to a normalized CC0 work with IIIF urls', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => record }));
    const work = await resolveAicWork(80084, { fetchImpl });
    expect(work).toMatchObject({
      id: 'aic:80084',
      title: 'The Crucifixion',
      artist: 'Francisco de Zurbarán (Spanish, 1598–1664)',
      rights: 'CC0'
    });
    expect(work.imageUrl).toContain('/iiif/2/abc-123/full/843,/');
  });

  it('yields null — never a work — when rights are absent or the image is missing', async () => {
    const noRights = { data: { ...record.data, is_public_domain: false } };
    const fetchNoRights = vi.fn(async () => ({ ok: true, json: async () => noRights }));
    const work = await resolveAicWork(80084, { fetchImpl: fetchNoRights });
    // UNKNOWN rights fail normalizeWork's displayable gate
    expect(work === null || work.rights === 'UNKNOWN').toBe(true);

    const noImage = { data: { ...record.data, image_id: null } };
    const fetchNoImage = vi.fn(async () => ({ ok: true, json: async () => noImage }));
    expect(await resolveAicWork(80084, { fetchImpl: fetchNoImage })).toBeNull();
    expect(await resolveAicWork('not-a-number', { fetchImpl: vi.fn() })).toBeNull();
  });
});

describe('Rijksmuseum adapter', () => {
  const OBJECT = {
    id: 'https://id.rijksmuseum.nl/200107790',
    identified_by: [
      { type: 'Name', content: 'The Crucifixion' },
      { type: 'Name', content: 'De kruisiging' },
      { type: 'Identifier', content: 'SK-A-4008' }
    ],
    produced_by: {
      carried_out_by: [{ _label: 'Anonymous, Northern Netherlands' }],
      timespan: { _label: 'c. 1440' }
    },
    made_of: [{ _label: 'panel' }],
    shows: [{ id: 'https://id.rijksmuseum.nl/202107790' }]
  };
  const VISUAL_PD = {
    subject_to: [{ classified_as: [{ id: 'https://creativecommons.org/publicdomain/mark/1.0/' }] }],
    digitally_shown_by: [{ id: 'https://id.rijksmuseum.nl/500558' }]
  };
  const DIGITAL = {
    access_point: [{ id: 'https://iiif.micr.io/whnXa/full/max/0/default.jpg' }]
  };

  function fetchFor(map) {
    return vi.fn(async url => {
      const body = map[url];
      if (!body) return { ok: false, json: async () => null };
      return { ok: true, json: async () => body };
    });
  }

  it('walks object → VisualItem → DigitalObject and honors the stated PD mark', async () => {
    const fetchImpl = fetchFor({
      'https://id.rijksmuseum.nl/200107790': OBJECT,
      'https://id.rijksmuseum.nl/202107790': VISUAL_PD,
      'https://id.rijksmuseum.nl/500558': DIGITAL
    });
    const work = await resolveRijksWork(200107790, { fetchImpl });
    expect(work).toMatchObject({
      id: 'rijks:200107790',
      title: 'The Crucifixion',
      rights: 'CC0',
      sourceName: 'Rijksmuseum · SK-A-4008'
    });
    expect(work.imageUrl).toContain('iiif.micr.io/whnXa/full/843,/');
    expect(work.fullImageUrl).toContain('/full/max/');
  });

  it('refuses when the VisualItem carries no PD/CC0 statement — silence is not permission', async () => {
    const visualNoLicense = { ...VISUAL_PD, subject_to: [] };
    const fetchImpl = fetchFor({
      'https://id.rijksmuseum.nl/200107790': OBJECT,
      'https://id.rijksmuseum.nl/202107790': visualNoLicense,
      'https://id.rijksmuseum.nl/500558': DIGITAL
    });
    expect(await resolveRijksWork(200107790, { fetchImpl })).toBeNull();
  });

  it('refuses off-domain hops and non-IIIF access points', async () => {
    const hijacked = { ...OBJECT, shows: [{ id: 'https://evil.example/visual' }] };
    const fetchImpl = fetchFor({ 'https://id.rijksmuseum.nl/200107790': hijacked });
    expect(await resolveRijksWork(200107790, { fetchImpl })).toBeNull();

    const badAccess = { access_point: [{ id: 'https://evil.example/img.jpg' }] };
    const fetchImpl2 = fetchFor({
      'https://id.rijksmuseum.nl/200107790': OBJECT,
      'https://id.rijksmuseum.nl/202107790': VISUAL_PD,
      'https://id.rijksmuseum.nl/500558': badAccess
    });
    expect(await resolveRijksWork(200107790, { fetchImpl: fetchImpl2 })).toBeNull();
  });
});

describe('The Doré cycle', () => {
  it('pins 158 plates, every one with a book, a stated-PD Commons file, and a SHA-1', async () => {
    const { DORE_PLATES, DORE_BOOKS } = await import('./dore.js');
    expect(DORE_PLATES.length).toBe(158);
    expect(DORE_BOOKS.length).toBeGreaterThanOrEqual(20);
    for (const plate of DORE_PLATES) {
      expect(plate.book, plate.plate).toBeTruthy();
      expect(plate.image).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(plate.sha1).toMatch(/^[a-f0-9]{40}$/);
      expect(plate.file).toMatch(/^File:/);
    }
    // The cycle walks the canon in order: Genesis opens it, the
    // Machabees close it
    expect(DORE_PLATES[0]).toMatchObject({ plate: '001', book: 'genesis' });
    expect(DORE_PLATES[DORE_PLATES.length - 1].book).toBe('machabees-1');
  });

  it('a Doré book serves ONLY its own plates', async () => {
    const { dorePlatesForBook } = await import('./dore.js');
    const judges = dorePlatesForBook('judges');
    expect(judges.length).toBe(15);
    expect(judges.every(plate => plate.book === 'judges')).toBe(true);
    expect(judges.some(plate => /samson/i.test(plate.title))).toBe(true);
    expect(dorePlatesForBook('matthew')).toEqual([]);
  });

  it('the provider serves dore: categories instantly, isolated, no fallback', async () => {
    const { getDoreCycleProvider, hasDoreBook } = await import('./dore-provider.js');
    expect(hasDoreBook('dore:josue')).toBe(true);
    expect(hasDoreBook('dore:matthew')).toBe(false);

    const provider = getDoreCycleProvider();
    const item = await provider.getRandom({ category: 'dore:jonas' });
    expect(item).not.toBeNull();
    expect(item.data.attribution).toContain('Gustave Doré');
    expect(item.metadata.license).toBe('PUBLIC_DOMAIN');
    expect(await provider.getRandom({ category: 'dore:romans' })).toBeNull();

    // cortex routes dore: with the same reverent no-fallback contract
    const cortex = readFileSync(resolve('src/visuals/visual-cortex.js'), 'utf8');
    const branch = cortex.slice(
      cortex.indexOf("categoryId.startsWith('dore:')"),
      cortex.indexOf("categoryId.startsWith('atr-')")
    );
    expect(branch).toContain('getDoreCycleProvider');
    expect(branch).toMatch(/return null;/);
    expect(branch).not.toContain('_getWikimediaProvider');
  });

  it('CYCLE-classified books launch with their own Doré category', () => {
    expect(chapelSensoryConfig('josue').visualConfig.interlocution.sourced).toEqual(['dore:josue']);
    expect(chapelSensoryConfig('judges').visualConfig.interlocution.sourced).toEqual(['dore:judges']);
    expect(chapelSensoryConfig('machabees-2').visualConfig.interlocution.sourced).toEqual(['dore:machabees-1']);
    // Wisdom stays in stillness — CONCEPTUAL, not cycle
    expect(chapelSensoryConfig('proverbs').visualConfig.visualMode).toBe('off');
    expect(chapelSensoryConfig('psalms').visualConfig.visualMode).toBe('off');
  });
});

describe('Chapel handoff imagery (seam)', () => {
  it('Gospels carry the Passion behind-stream at museum presence; other books stay still', async () => {
    const john = chapelSensoryConfig('john');
    expect(john.visualConfig.visualMode).toBe('interlocution');
    expect(john.visualConfig.interlocution.sourced).toEqual(['chapel-passion', 'chapel-crucifixion']);
    expect(john.visualConfig.interlocution.procedural).toEqual([]);
    // Spec §5: long presence ≥1400ms — museum stillness, not flashing
    expect(john.visualConfig.interlocution.duration).toBeGreaterThanOrEqual(1400);

    expect(chapelSensoryConfig('psalms').visualConfig.visualMode).toBe('off');
    // Genesis carries the Doré cycle until chapel-patriarchs lands
    expect(chapelSensoryConfig('genesis').visualConfig.interlocution.sourced)
      .toEqual(['dore:genesis']);
    expect(chapelSensoryConfig('apocalypse').visualConfig.interlocution.sourced)
      .toEqual(['chapel-resurrection']);
  });

  it('a launched Gospel chapter carries the collections through the real handoff', async () => {
    const handoff = await createChapelHandoff('john', { chapter: 19 });
    expect(handoff.config.visualConfig.interlocution.sourced)
      .toEqual(['chapel-passion', 'chapel-crucifixion']);
    // The "From this reading" pills are driven by atriumCollections,
    // exactly as Atrium launches drive them
    expect(handoff.config.visualConfig.interlocution.atriumCollections)
      .toEqual(['chapel-passion', 'chapel-crucifixion']);
  });

  it('the infancy and Baptism chapters carry the Nativity; Resurrection chapters the Resurrection', async () => {
    // Luke 1 — the Annunciation
    expect(chapelSensoryConfig('luke', null, 1).visualConfig.interlocution.sourced)
      .toEqual(['chapel-nativity']);
    // Matthew 3 — the Baptism of Christ
    expect(chapelSensoryConfig('matthew', null, 3).visualConfig.interlocution.sourced)
      .toEqual(['chapel-nativity']);
    // John 20 — the empty tomb
    expect(chapelSensoryConfig('john', null, 20).visualConfig.interlocution.sourced)
      .toEqual(['chapel-resurrection']);
    // A mid-Gospel chapter keeps the book default
    expect(chapelSensoryConfig('luke', null, 15).visualConfig.interlocution.sourced)
      .toEqual(['chapel-passion', 'chapel-crucifixion']);
    // Whole-book launches keep the book default too
    expect(chapelSensoryConfig('luke', null, null).visualConfig.interlocution.sourced)
      .toEqual(['chapel-passion', 'chapel-crucifixion']);
    // and it flows through the real handoff
    const luke1 = await createChapelHandoff('luke', { chapter: 1 });
    expect(luke1.config.visualConfig.interlocution.atriumCollections).toEqual(['chapel-nativity']);
  });

  it('a chosen icon becomes the focal MODE, winning over the book collections', async () => {
    const withIcon = await createChapelHandoff('john', { chapter: 3, iconId: 'icon-pantocrator-sinai' });
    expect(withIcon.config.visualConfig).toEqual({
      visualMode: 'focals',
      focals: { type: 'icon', iconId: 'icon-pantocrator-sinai' }
    });

    // An unpinned icon id is ignored — pinned, never improvised
    const bogus = await createChapelHandoff('john', { chapter: 3, iconId: 'icon-of-nowhere' });
    expect(bogus.config.visualConfig.visualMode).toBe('interlocution');

    // Psalms with the Marian icon: focal mode there too
    const marian = await createChapelHandoff('psalms', { chapter: 23, iconId: 'icon-salus-populi-romani' });
    expect(marian.config.visualConfig.focals.iconId).toBe('icon-salus-populi-romani');
  });

  it('icon focal renders without motion on the image: breath lives on the frame only', () => {
    const css = readFileSync(resolve('src/components/Chamber.css'), 'utf8');
    const frameRule = css.slice(css.indexOf('.focal-icon-frame'), css.indexOf('.focal-icon-image'));
    expect(frameRule).toContain('animation: focal-icon-breath');
    const imageRule = css.slice(css.indexOf('.focal-icon-image'), css.indexOf('@keyframes focal-icon-breath'));
    expect(imageRule).not.toContain('animation');
    // and reduced-motion stills the frame too
    const reduced = css.slice(css.indexOf('@keyframes focal-icon-breath'));
    expect(reduced).toMatch(/prefers-reduced-motion[\s\S]*focal-icon-frame[\s\S]*animation:\s*none/);

    const chamber = readFileSync(resolve('src/components/Chamber.js'), 'utf8');
    expect(chamber).toContain("focals.type === 'icon'");
    expect(chamber).toContain('initializeIconFocal');
  });
});
