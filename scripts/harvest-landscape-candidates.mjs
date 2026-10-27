/**
 * Harvest the candidate sheets for the owner's keep-or-cut review.
 *
 *   node scripts/harvest-landscape-candidates.mjs              # harvest, then probe every image
 *   node scripts/harvest-landscape-candidates.mjs --no-verify  # skip the image probe
 *
 * Two sets (docs/plans/LIVE-IMAGERY.md, owner decisions of 2026-10-26):
 *
 * - **Landscapes:** Cleveland's CC0 landscape paintings and photographs, and the
 *   Rijksmuseum's public-domain landscape photographs (its paintings are already
 *   pinned, 178 of them, in `museum-pins.js`).
 * - **Earth and sky:** ESO's night landscapes, the works cut from Astronomy, and
 *   NASA's Earth from orbit.
 *
 * CANDIDATES, NOT A SHELF. Nothing here reaches a reader: the owner reviews the
 * sheet by eye (`docs/assets/live/landscape-review.html`), and the kept works
 * enter `landscape-pins.js`. A work the owner has judged, kept or cut, is never
 * offered again. The sheet the owner reviewed on 2026-10-26 is kept as
 * `sheet-2026-10-26.json`, the frozen record the catalog is built from; this
 * script writes the next sheet. Rights are frozen at the date this ran.
 *
 * Every field from an API is untrusted: text is reduced to plain text and
 * bounded, a URL must be https on the source's own host and carry no
 * credential, a pixel size must be a bounded integer. A work is resolved by the
 * Reader's own adapter (`adapters/cleveland.js`, `adapters/rijks.js`) or feed
 * reader (`lib/collection-feeds.mjs`), and its credit is composed by
 * `artwork-label.js`, so the sheet shows what the Reader would show.
 *
 * The monthly re-check (`build-landscape-catalog.mjs --verify`) re-resolves
 * every pinned work through the same per-work resolvers exported here.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    artworkMayBeShown, displayedArtworkLabel, licenceClassOf, normalizeArtworkLabel, plainArtworkText
} from '../src/visuals/artwork-label.js';
import { resolveClevelandWork } from '../src/content/imagery/adapters/cleveland.js';
import { resolveRijksWork } from '../src/content/imagery/adapters/rijks.js';
import { MUSEUM_CATEGORY_PINS } from '../src/sources/visual/museum-pins.js';
import { ASTRONOMY } from '../src/content/science/imagery/science-pins.js';
import { LANDSCAPE_COLLECTIONS, REVIEW } from '../src/content/landscapes/landscape-pins.js';
import {
    CARRIES_SECRET, USER_AGENT, djangoplicityRow, getJson, interleave, nasaRow, resourceOf, sleep, verifyAll
} from './lib/collection-feeds.mjs';

const OUT = fileURLToPath(new URL('../src/content/landscapes/candidates.generated.json', import.meta.url));
const SCIENCE_CATALOG = fileURLToPath(new URL('../src/sources/visual/science-catalog.generated.json', import.meta.url));

/** The first sheet's size per source: a strong first look, not everything. */
export const BUDGET = Object.freeze({
    clevelandPainting: 100,
    clevelandPhotograph: 50,
    rijksPhotograph: 30,
    eso: Infinity,
    nasa: 40
});

/** A photograph held in a circle: big enough to fill it, not so long that the circle shows a sliver. */
export const MIN_LONG_EDGE = 1000;
export const MAX_ASPECT = 2;
/** No single maker fills a sheet. */
export const PER_MAKER = 6;

/** Each source's own hosts. Anything else is refused, however it got into the record. */
export const HOSTS = Object.freeze({
    cleveland: { image: ['openaccess-cdn.clevelandart.org'], page: ['clevelandart.org', 'www.clevelandart.org'] },
    rijks: { image: ['iiif.micr.io'], page: ['id.rijksmuseum.nl'] },
    eso: { image: ['cdn.eso.org', 'www.eso.org'], page: ['www.eso.org'] },
    nasa: { image: ['images-assets.nasa.gov'], page: ['images.nasa.gov'] }
});

const ID_PATTERN = Object.freeze({
    cleveland: /^cleveland:\d{1,9}$/,
    rijks: /^rijks:\d{1,12}$/,
    eso: /^eso:[A-Za-z0-9_-]{1,64}$/,
    nasa: /^nasa:[A-Za-z0-9_.-]{1,96}$/
});

// ── Validation: every API field is untrusted ─────────────────────────

/** Plain text, bounded. A non-string is no text at all. */
export const text = (value, max) => (typeof value === 'string' ? plainArtworkText(value, max) : '');

/** An https URL on one of `hosts`, with no credential in it; otherwise ''. */
export function checkedUrl(value, hosts) {
    if (typeof value !== 'string' || value.length > 2000) return '';
    let url;
    try { url = new URL(value); } catch { return ''; }
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (!hosts.includes(url.hostname)) return '';
    if (CARRIES_SECRET.test(url.search)) return '';
    return url.href;
}

/** A pixel count: an integer from 1 to 200,000, else null. APIs send numbers and strings both. */
export function pixels(value) {
    const n = typeof value === 'number' ? value : (typeof value === 'string' && /^\d{1,6}$/.test(value.trim()) ? Number(value) : NaN);
    return Number.isInteger(n) && n >= 1 && n <= 200000 ? n : null;
}

/**
 * The work's label, composed by the code that composes the chip. A museum work
 * reaches `normalizeArtworkLabel` as the museum provider shapes it (no
 * attribution, the rights it resolved); a science work as
 * `build-science-catalog.mjs` probes it (the feed's credit as attribution).
 */
export function composeLabel(work) {
    const probe = {
        name: work.title,
        data: {
            title: work.title, artist: work.maker, date: work.date,
            sourceName: work.sourceName, sourceUrl: work.page, rights: work.rights,
            ...(work.credit ? { attribution: work.credit } : {}),
            ...(work.creditRequired ? { creditRequired: true } : {})
        }
    };
    const label = normalizeArtworkLabel(probe);
    return {
        licence: licenceClassOf(probe),
        mayBeShown: Boolean(label) && artworkMayBeShown(label),
        chip: displayedArtworkLabel(label, true),
        requiredCredit: label?.creditRequired ? label.requiredText : '',
        fullCredit: label?.creditRequired ? label.fullCredit : '',
        creditElided: Boolean(label?.creditElided)
    };
}

/**
 * One raw row as a candidate, or the reason it is not one. `raw` carries the
 * source's fields; nothing from it reaches the output unchecked.
 */
export function candidate(raw, { set, source, register }) {
    const hosts = HOSTS[source];
    if (!hosts) return { why: `unknown source ${source}` };
    const id = typeof raw.id === 'string' && ID_PATTERN[source].test(raw.id) ? raw.id : '';
    if (!id) return { why: 'malformed id' };
    const work = {
        id, set, source, register,
        sourceName: text(raw.sourceName, 160),
        title: text(raw.title, 240),
        maker: text(raw.maker, 200),
        date: text(raw.date, 100),
        description: text(raw.description, 300),
        image: checkedUrl(raw.image, hosts.image),
        imageWidth: pixels(raw.imageWidth),
        imageHeight: pixels(raw.imageHeight),
        full: checkedUrl(raw.full, hosts.image),
        fullWidth: pixels(raw.fullWidth),
        fullHeight: pixels(raw.fullHeight),
        thumb: checkedUrl(raw.thumb, hosts.image),
        page: checkedUrl(raw.page, hosts.page),
        rights: text(raw.rights, 120),
        credit: text(raw.credit, 2000),
        creditRequired: raw.creditRequired === true,
        hint: text(raw.hint, 160)
    };
    if (!work.title) return { why: 'no title' };
    if (!work.image) return { why: 'image url refused' };
    if (!work.page) return { why: 'page url refused' };
    if (!work.thumb) work.thumb = work.image;
    if (!work.full) { work.full = work.image; work.fullWidth = work.imageWidth; work.fullHeight = work.imageHeight; }

    // The chip names the maker the Reader's adapter reads, which can be fewer than the record names.
    const chipWork = typeof raw.chipMaker === 'string' ? { ...work, maker: text(raw.chipMaker, 200) } : work;
    const { mayBeShown, ...label } = composeLabel(chipWork);
    if (!mayBeShown) return { why: `cannot be shown (${label.licence})` };
    delete work.credit;
    delete work.creditRequired;
    return { work: { ...work, ...label } };
}

// ── The sheet's screens ──────────────────────────────────────────────

/**
 * Titles that name a figure subject rather than a place. Sacred subjects stay
 * in the Chapel, never in a default pool (`museum-pins.js`). These cut the
 * sheet; the owner judges everything they let through.
 */
const SACRED_OR_PORTRAIT = /\b(portrait|portret|virgin|madonna|christ|saint|holy family|annunciation|nativity|adoration|crucifixion|flight into egypt)\b/i;
const PEOPLE = /\b(man|men|woman|women|girl|boy|lady|group|officers?|chiefs?|natives|amir|ameer|khan|sirdars|staff|cabulese|afredees|shepherdess(?:es)?|peasant|costume|crew|astronaut|commander|cupola|hangout|award|training|uses camera|middeck|flight deck|vrouw|meisje|militairen|bewoners)\b/i;
/** A photo album's cover is not its pictures; a painted album leaf is a picture, so "album" alone is not a cut. */
const NOT_A_LANDSCAPE = /fotoalbum|reisa(?:lb|bl)um|album met|photo(?:graph)? album|\b(still life|stilleven|interior|animation|visualization|infographic|chart|map of|diagram)\b/i;

/** Why a title is not a landscape, or '' when the screen lets it through. */
export function titleScreen(title) {
    if (SACRED_OR_PORTRAIT.test(title)) return 'figure subject (title)';
    if (NOT_A_LANDSCAPE.test(title)) return 'not a landscape (title)';
    if (PEOPLE.test(title) && !/\b(landscape|landschap|view|gezicht)\b/i.test(title)) return 'people, not a place (title)';
    return '';
}

/** Why a picture's shape will not hold a circle, or ''. Measured on the largest rendition the source states. */
export function shapeScreen(work) {
    const w = work.fullWidth || work.imageWidth, h = work.fullHeight || work.imageHeight;
    if (!w || !h) return 'size not stated';
    if (Math.max(w, h) < MIN_LONG_EDGE) return `long edge ${Math.max(w, h)} px, under ${MIN_LONG_EDGE}`;
    if (Math.max(w, h) / Math.min(w, h) > MAX_ASPECT) return `aspect ${(Math.max(w, h) / Math.min(w, h)).toFixed(1)}:1, over ${MAX_ASPECT}:1`;
    return '';
}

/** Keep at most `cap` per named maker, in order; the rest are named as cut. Unattributed works are many hands. */
function capPerMaker(works, cap, leftOut) {
    const seen = new Map();
    return works.filter((w) => {
        if (!w.maker) return true;
        const n = (seen.get(w.maker) || 0) + 1;
        seen.set(w.maker, n);
        if (n <= cap) return true;
        leftOut.push({ id: w.id, title: w.title, why: `more than ${cap} by ${w.maker}` });
        return false;
    });
}

// ── Sources ──────────────────────────────────────────────────────────

const CLEVELAND_SEARCH = 'https://openaccess-api.clevelandart.org/api/artworks/';
const CLEVELAND_FIELDS = 'id,title,creation_date,creators,images,url,share_license_status,type,technique,department';

/** Cleveland pins anywhere in the Reader, so the sheet proposes only new works. */
const pinnedIds = (source) => new Set(Object.values(MUSEUM_CATEGORY_PINS).flat()
    .filter(pin => pin.source === source).map(pin => `${source}:${pin.id}`));

/** A work the owner has already judged is never offered again: kept, it is shelved; cut, it stays cut. */
const VERDICTS = new Map(Object.values(LANDSCAPE_COLLECTIONS).flatMap(collection => [
    ...collection.kept.map(id => [id, 'kept']), ...collection.cut.map(id => [id, 'cut'])]));
export const reviewedWhy = (id) => (VERDICTS.has(id) ? `reviewed by the owner ${REVIEW.date} (${VERDICTS.get(id)})` : '');

/**
 * One Cleveland record through the Reader's own adapter, handed the record already in hand so no second request is
 * made; the adapter re-checks `share_license_status === 'CC0'` itself.
 */
export async function clevelandCandidate(record, register) {
    if (!record || typeof record !== 'object') return { why: 'no record' };
    const resolved = await resolveClevelandWork(record.id, {
        fetchImpl: async () => ({ ok: true, json: async () => ({ data: record }) })
    });
    if (!resolved) return { why: 'not CC0 or no image (adapter)' };
    const images = record.images || {};
    return candidate({
        id: resolved.id, sourceName: resolved.sourceName, title: resolved.title, maker: resolved.artist,
        date: resolved.date, image: resolved.imageUrl,
        imageWidth: images.web?.width, imageHeight: images.web?.height,
        full: resolved.fullImageUrl, fullWidth: images.print?.width, fullHeight: images.print?.height,
        thumb: resolved.imageUrl, page: resolved.sourceUrl, rights: resolved.rights,
        hint: text(record.department, 80)
    }, { set: 'landscapes', source: 'cleveland', register });
}

/**
 * Cleveland's keyless search, `cc0=1`, then each record through the Reader's own
 * adapter, handed the record the search already returned so no second request
 * is made. The adapter re-checks `share_license_status === 'CC0'` itself.
 */
async function cleveland(type, { register, budget }, leftOut) {
    const records = [];
    for (let skip = 0; ; skip += 100) {
        const url = `${CLEVELAND_SEARCH}?q=landscape&type=${type}&cc0=1&has_image=1&limit=100&skip=${skip}&fields=${CLEVELAND_FIELDS}`;
        const page = await getJson(url, `Cleveland ${type}`);
        const data = Array.isArray(page?.data) ? page.data : [];
        records.push(...data);
        if (data.length < 100 || records.length >= 2000) break;
        await sleep(1000);
    }
    const pinned = pinnedIds('cleveland');
    const byDepartment = new Map();
    for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const result = await clevelandCandidate(record, register);
        if (!result.work) { leftOut.push({ id: `cleveland:${text(String(record.id), 20)}`, title: text(record.title, 120), why: result.why }); continue; }
        const work = result.work;
        const why = reviewedWhy(work.id) || (pinned.has(work.id) ? 'already pinned in the Reader' : (titleScreen(work.title) || shapeScreen(work)));
        if (why) { leftOut.push({ id: work.id, title: work.title, why }); continue; }
        const department = work.hint || '';
        if (!byDepartment.has(department)) byDepartment.set(department, []);
        byDepartment.get(department).push(work);
    }
    const kept = capPerMaker(interleave([...byDepartment.values()]), PER_MAKER, leftOut);
    return cut(kept, budget, leftOut);
}

/** The first `budget`, the rest named as not shown: a cut must never read as a yield. */
function cut(works, budget, leftOut) {
    for (const w of works.slice(budget)) leftOut.push({ id: w.id, title: w.title, why: 'not shown: first sheet budget' });
    return works.slice(0, budget);
}

/** A fetch for the Rijksmuseum adapter that names itself and waits its turn. */
const politeFetch = async (url, init = {}) => {
    await sleep(400);
    return fetch(url, { ...init, headers: { ...(init.headers || {}), 'User-Agent': USER_AGENT } });
};

/** The production's named makers, from the parts of a Linked Art object; anonymous hands are not names. */
export function rijksMakers(object) {
    const parts = Array.isArray(object?.produced_by?.part) ? object.produced_by.part : [];
    const names = [];
    for (const actor of parts.flatMap(part => (Array.isArray(part?.carried_out_by) ? part.carried_out_by : []))) {
        const notes = [actor?.notation].flat().filter(n => n && typeof n['@value'] === 'string');
        const name = (notes.find(n => n['@language'] === 'en') || notes[0])?.['@value'] || '';
        if (name && !/^(anonymous|anoniem)$/i.test(name) && !names.includes(name)) names.push(name);
    }
    return names.slice(0, 4).join(', ');
}

/**
 * The rights of the IMAGE, from the VisualItem's own `subject_to`. The VisualItem also carries its metadata record's
 * licence (`subject_of[].subject_to`, CC0 for every object), so a match anywhere in it passes an In Copyright
 * photograph: measured 2026-10-26 on 200114544, "Kaapverdische eilanden, 1981" (image InC, metadata CC0).
 */
export function rijksImageRights(visual) {
    const rights = Array.isArray(visual?.subject_to) ? visual.subject_to : [];
    return rights.flatMap(r => (Array.isArray(r?.classified_as) ? r.classified_as : []))
        .map(c => c?.id).filter(id => typeof id === 'string');
}

const PUBLIC_DOMAIN_IMAGE = /^https:\/\/creativecommons\.org\/publicdomain\/(mark|zero)\/1\.0\/?$/;

export const rijksImageIsPublicDomain = (visual) => {
    const rights = rijksImageRights(visual);
    return rights.length > 0 && rights.every(id => PUBLIC_DOMAIN_IMAGE.test(id));
};

/** The production's date as the record words it ("1903 - 1907"). */
export function rijksDate(object) {
    const names = object?.produced_by?.timespan?.identified_by;
    return (Array.isArray(names) ? names : []).map(n => n?.content).find(c => typeof c === 'string') || '';
}

/**
 * The Rijksmuseum's key-free search (MUSEUM-ATLAS §2), photographs described
 * as landscapes, each resolved by the Reader's adapter: three hops, the licence
 * read at the VisualItem. One more request reads the image's pixel size.
 */
async function rijksPhotographs({ budget }, leftOut) {
    let url = 'https://data.rijksmuseum.nl/search/collection?type=photograph&description=landschap&imageAvailable=true';
    const refs = [];
    for (let pages = 0; url && pages < 5; pages++) {
        const page = await getJson(url, 'Rijksmuseum search', { headers: { Accept: 'application/json' } });
        refs.push(...(Array.isArray(page?.orderedItems) ? page.orderedItems : [])
            .map(item => /^https:\/\/id\.rijksmuseum\.nl\/(\d{1,12})$/.exec(String(item?.id || ''))?.[1])
            .filter(Boolean));
        const next = checkedUrl(page?.next?.id, ['data.rijksmuseum.nl']);
        url = next.startsWith('https://data.rijksmuseum.nl/search/collection?') ? next : '';
        await sleep(1000);
    }
    const pinned = pinnedIds('rijks');
    const kept = [];
    for (const lodId of refs) {
        if (kept.length >= budget * 2) break;
        const id = `rijks:${lodId}`;
        const known = reviewedWhy(id) || (pinned.has(id) ? 'already pinned in the Reader' : '');
        if (known) { leftOut.push({ id, title: '', why: known }); continue; }
        const result = await rijksCandidate(lodId);
        if (!result.work) { leftOut.push({ id, title: result.title || '', why: result.why }); continue; }
        const why = titleScreen(result.work.title) || shapeScreen(result.work);
        if (why) { leftOut.push({ id, title: result.work.title, why }); continue; }
        kept.push(result.work);
    }
    return cut(capPerMaker(kept, PER_MAKER, leftOut), budget, leftOut);
}

/**
 * One Rijksmuseum work through the Reader's adapter (three hops), the image's own rights read from the VisualItem it
 * fetched, and one more request for the image's pixel size.
 */
export async function rijksCandidate(lodId) {
    if (!/^\d{1,12}$/.test(String(lodId))) return { why: 'malformed id' };
    // Copies of the object and the VisualItem the adapter reads: the sheet's date and makers, and the image's own rights.
    let object = null, visual = null;
    const fetchImpl = async (url, init) => {
        const res = await politeFetch(url, init);
        if (res.ok && url === `https://id.rijksmuseum.nl/${lodId}`) object = await res.clone().json().catch(() => null);
        else if (res.ok && object && url === object.shows?.[0]?.id) visual = await res.clone().json().catch(() => null);
        return res;
    };
    const resolved = await resolveRijksWork(lodId, { fetchImpl, timeoutMs: 30000 });
    if (!resolved) return { why: 'not public domain or unresolvable (adapter)' };
    if (!rijksImageIsPublicDomain(visual)) {
        return { title: resolved.title, why: `image rights ${rijksImageRights(visual).join(', ') || 'unstated'}, not public domain` };
    }
    let info = null;
    try {
        const res = await politeFetch(resolved.fullImageUrl.replace(/\/full\/max\/0\/default\.jpg$/, '/info.json'));
        info = res.ok ? await res.json() : null;
    } catch { info = null; }
    const fullWidth = pixels(info?.width), fullHeight = pixels(info?.height);
    const shownWidth = fullWidth ? Math.min(843, fullWidth) : null;
    const result = candidate({
        id: resolved.id, sourceName: resolved.sourceName, title: resolved.title,
        maker: resolved.artist || rijksMakers(object), chipMaker: resolved.artist,
        date: resolved.date || rijksDate(object), image: resolved.imageUrl,
        imageWidth: shownWidth, imageHeight: shownWidth && fullHeight ? Math.round(fullHeight * shownWidth / fullWidth) : null,
        full: resolved.fullImageUrl, fullWidth, fullHeight,
        thumb: resolved.imageUrl.replace('/full/843,/', '/full/400,/'),
        page: resolved.sourceUrl, rights: resolved.rights
    }, { set: 'landscapes', source: 'rijks', register: 'photograph' });
    return result.work ? result : { title: resolved.title, why: result.why };
}

/**
 * ESO's feed, the works Astronomy did not keep whose AVM branch is A (solar
 * system) or E (sky phenomena): the observatory nights the first review cut
 * because they are landscapes (SOURCE-EXPANSION-SPEC §3a). All of them, with
 * no shape screen: this is the set the owner asked to see again.
 */
async function eso(leftOut) {
    const rows = await getJson('https://www.eso.org/public/images/json/', 'ESO');
    const list = Array.isArray(rows) ? rows : (rows?.collection || []);
    const astronomy = new Set(ASTRONOMY.sources.flatMap(rule => rule.include || []));
    const out = [];
    for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const mapped = esoRow(row);
        if (astronomy.has(mapped.id)) continue;
        const known = reviewedWhy(mapped.id);
        if (known) { leftOut.push({ id: mapped.id, title: text(mapped.title, 120), why: known }); continue; }
        if (!mapped.subject.branches.some(b => b === 'A' || b === 'E')) {
            leftOut.push({ id: mapped.id, title: text(mapped.title, 120), why: `AVM ${mapped.subject.label || 'none'}: not a night landscape` });
            continue;
        }
        const result = esoCandidate(row);
        if (!result.work) { leftOut.push({ id: mapped.id, title: text(mapped.title, 120), why: result.why }); continue; }
        out.push(result.work);
    }
    return out;
}

const esoRow = (row) => djangoplicityRow(row, { id: 'eso', sourceName: 'ESO', sourceBase: 'https://www.eso.org/public/images/' });

/** One ESO feed row (or the row `/public/images/<id>/api/json/` answers) as a candidate. */
export function esoCandidate(row) {
    if (!row || typeof row !== 'object') return { why: 'no record' };
    const mapped = esoRow(row);
    const small = resourceOf(row, 'Small', 'Large');
    const large = resourceOf(row, 'Large');
    return candidate({
        id: mapped.id, sourceName: mapped.sourceName, title: mapped.title, maker: mapped.artist,
        date: mapped.date, description: mapped.description,
        image: mapped.image, imageWidth: small?.Dimensions?.[0], imageHeight: small?.Dimensions?.[1],
        full: large?.URL, fullWidth: large?.Dimensions?.[0], fullHeight: large?.Dimensions?.[1],
        thumb: mapped.thumb, page: mapped.page, rights: mapped.rights, credit: mapped.credit,
        hint: `AVM ${mapped.subject.label}`
    }, { set: 'earth-and-sky', source: 'eso', register: 'photograph' });
}

/** NASA's Earth from orbit: several keyless searches, interleaved so no one query fills the sheet. */
const NASA_QUERIES = ['earth limb', 'earth observation', 'aurora from space station', 'earthrise', 'blue marble', 'earth at night from space'];

async function nasa({ budget }, leftOut) {
    const astronomy = new Set((JSON.parse(readFileSync(SCIENCE_CATALOG, 'utf8')).works || []).map(w => w.id));
    const groups = [];
    for (const query of NASA_QUERIES) {
        const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=100`;
        const body = await getJson(url, `NASA (${query})`);
        groups.push(Array.isArray(body?.collection?.items) ? body.collection.items : []);
        await sleep(1000);
    }
    const seen = new Set();
    const out = [];
    for (const item of interleave(groups)) {
        if (!item || typeof item !== 'object') continue;
        const row = nasaRow(item);
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const known = reviewedWhy(row.id) || (astronomy.has(row.id) ? 'already in Astronomy' : '');
        if (known) { leftOut.push({ id: row.id, title: text(row.title, 120), why: known }); continue; }
        const screen = titleScreen(String(row.title || ''));
        if (screen) { leftOut.push({ id: row.id, title: text(row.title, 120), why: screen }); continue; }
        const result = nasaCandidate(item);
        if (!result.work) { leftOut.push({ id: row.id, title: text(row.title, 120), why: result.why }); continue; }
        const why = shapeScreen(result.work);
        if (why) { leftOut.push({ id: row.id, title: result.work.title, why }); continue; }
        out.push(result.work);
    }
    return cut(out, budget, leftOut);
}

/** One NASA search item as a candidate; prose naming third-party rights withholds it. */
export function nasaCandidate(item) {
    if (!item || typeof item !== 'object') return { why: 'no record' };
    const row = nasaRow(item);
    if (row.thirdPartyRisk) return { why: 'third-party rights named in its prose' };
    const linkOf = (href) => (item.links || []).find(l => l?.href === href) || {};
    const shown = linkOf(row.image);
    const largest = (item.links || []).filter(l => pixels(l?.width) && pixels(l?.height))
        .sort((a, b) => b.width - a.width)[0] || shown;
    return candidate({
        id: row.id, sourceName: row.sourceName, title: row.title, maker: row.artist, date: row.date,
        description: row.description, image: row.image, imageWidth: shown.width, imageHeight: shown.height,
        full: largest.href, fullWidth: largest.width, fullHeight: largest.height,
        thumb: row.thumb, page: row.page, rights: row.rights, credit: row.credit, creditRequired: row.creditRequired
    }, { set: 'earth-and-sky', source: 'nasa', register: 'photograph' });
}

/** One source's candidates, by name. */
export async function harvestSource(name, leftOut) {
    switch (name) {
        case 'cleveland-paintings': return cleveland('Painting', { register: 'painting', budget: BUDGET.clevelandPainting }, leftOut);
        case 'cleveland-photographs': return cleveland('Photograph', { register: 'photograph', budget: BUDGET.clevelandPhotograph }, leftOut);
        case 'rijks-photographs': return rijksPhotographs({ budget: BUDGET.rijksPhotograph }, leftOut);
        case 'eso': return eso(leftOut);
        case 'nasa': return nasa({ budget: BUDGET.nasa }, leftOut);
        default: throw new Error(`unknown source ${name}`);
    }
}

const SOURCES = ['cleveland-paintings', 'cleveland-photographs', 'rijks-photographs', 'eso', 'nasa'];

async function main(args) {
    const verify = !args.includes('--no-verify');
    const works = [];
    const leftOut = [];
    const report = [];
    for (const name of SOURCES) {
        const before = leftOut.length;
        const kept = await harvestSource(name, leftOut);
        const dropped = leftOut.slice(before);
        if (verify) {
            await verifyAll(kept);
            for (const w of kept.filter(w => !w.delivery?.ok)) {
                dropped.push({ id: w.id, title: w.title, why: `unreachable: ${w.delivery?.why}` });
                leftOut.push(dropped.at(-1));
            }
        }
        const live = verify ? kept.filter(w => w.delivery?.ok) : kept;
        for (const w of live) delete w.delivery;
        works.push(...live);
        const reasons = {};
        for (const d of dropped) {
            const key = d.why.replace(/\d[\d.]*/g, 'N');
            reasons[key] = (reasons[key] || 0) + 1;
        }
        report.push({ source: name, kept: live.length, leftOut: dropped.length, reasons });
        console.log(`${name.padEnd(22)} kept ${String(live.length).padStart(4)}   left out ${String(dropped.length).padStart(4)}`);
        for (const [why, n] of Object.entries(reasons)) console.log(`${''.padEnd(26)}${String(n).padStart(4)} × ${why}`);
    }

    const count = (key) => {
        const out = {};
        for (const w of works) out[w[key]] = (out[w[key]] || 0) + 1;
        return out;
    };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        /** Frozen at harvest, re-checked monthly (LIVE-IMAGERY.md, owner decision 2). */
        rightsVerifiedAt: new Date().toISOString().slice(0, 10),
        status: 'CANDIDATES for the owner\'s review by eye. Not pinned, not wired into any room.',
        sets: {
            landscapes: { name: 'Landscapes', works: works.filter(w => w.set === 'landscapes').length },
            'earth-and-sky': { name: 'Earth and sky', works: works.filter(w => w.set === 'earth-and-sky').length }
        },
        licences: count('licence'),
        report,
        leftOut,
        works
    }, null, 2) + '\n', 'utf8');
    console.log(`\nlicences ${JSON.stringify(count('licence'))}`);
    console.log(`sets     ${JSON.stringify(count('set'))}`);
    console.log(`wrote ${OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main(process.argv.slice(2));
}
