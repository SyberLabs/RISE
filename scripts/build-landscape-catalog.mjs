/**
 * Build the runtime Landscapes and Earth and sky catalog from the owner's pins, and re-verify it.
 *
 *   node scripts/build-landscape-catalog.mjs           # the pins and the reviewed sheet → the catalog
 *   node scripts/build-landscape-catalog.mjs --verify  # re-resolve every catalogued work at its source
 *
 * The controlled refresh boundary, as `build-science-catalog.mjs` is for Astronomy: runtime code never crawls a
 * museum. The verdicts come from `landscape-pins.js` (the human decision); each kept work's record comes from the
 * sheet the owner reviewed (`REVIEW.sheet`), its rights frozen at that harvest and stamped with its date. Nothing
 * reaches the catalog that the pins do not keep, and its credit is composed again here by `artwork-label.js`.
 *
 * `--verify` is the scheduled re-check (LIVE-IMAGERY.md, owner decision 2): every catalogued work is resolved again
 * through the harvest's own per-work resolvers (the Reader's adapters and feed readers), and any whose rights, owed
 * credit or image changed, or that disappeared or no longer loads, is reported. It writes nothing; it exits 1 when
 * anything changed, so a scheduled job can raise it. The refusal is the owner's to act on: drop the pin and rebuild.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANDSCAPE_COLLECTIONS, REVIEW } from '../src/content/landscapes/landscape-pins.js';
import { clevelandCandidate, composeLabel, esoCandidate, nasaCandidate, rijksCandidate } from './harvest-landscape-candidates.mjs';
import { getJson, sleep, verifyDelivery } from './lib/collection-feeds.mjs';

const ROOT = new URL('../', import.meta.url);
const OUT = fileURLToPath(new URL('src/sources/visual/landscapes-catalog.generated.json', ROOT));

/** One reviewed sheet work as a catalog work, its label composed again; null when it can no longer be shown. */
export function catalogWork(work, favourite) {
    const label = composeLabel({
        title: work.title, maker: work.maker, date: work.date, sourceName: work.sourceName, page: work.page,
        rights: work.rights, credit: work.fullCredit, creditRequired: work.licence === 'public-domain-credit'
    });
    if (!label.mayBeShown) return null;
    return {
        id: work.id,
        source: work.source,
        register: work.register,
        title: work.title,
        description: work.description || '',
        artist: work.maker || '',
        date: work.date || '',
        licence: label.licence,
        rights: work.rights,
        /** What the chip must show. Composed once, here, never at render. */
        requiredCredit: label.requiredCredit,
        fullCredit: label.fullCredit,
        creditElided: label.creditElided,
        image: work.image,
        width: work.imageWidth ?? null,
        height: work.imageHeight ?? null,
        thumb: work.thumb || work.image,
        sourceName: work.sourceName,
        sourceUrl: work.page,
        ...(favourite ? { favourite: true } : {})
    };
}

/** The catalog from a reviewed sheet and the pins; every kept work must be on the sheet. */
export function buildCatalog(sheet, collections = LANDSCAPE_COLLECTIONS) {
    const byId = new Map((sheet.works || []).map(work => [work.id, work]));
    const works = [];
    const refused = [];
    const index = {};
    for (const [id, collection] of Object.entries(collections)) {
        const favourites = new Set(collection.favourites);
        const kept = [];
        for (const pin of collection.kept) {
            const reviewed = byId.get(pin);
            if (!reviewed) { refused.push({ id: pin, why: 'not on the reviewed sheet' }); continue; }
            const work = catalogWork(reviewed, favourites.has(pin));
            if (!work) { refused.push({ id: pin, why: 'cannot be credited' }); continue; }
            works.push(work);
            kept.push(pin);
        }
        index[id] = { name: collection.name, works: kept, favourites: collection.favourites.filter(pin => kept.includes(pin)) };
    }
    const licences = {};
    for (const work of works) licences[work.licence] = (licences[work.licence] || 0) + 1;
    return {
        doc: {
            version: 1,
            generatedAt: new Date().toISOString(),
            /** FROZEN AT HARVEST, NOT LIVE: the date the sheet's rights were read. `--verify` re-reads them. */
            rightsVerifiedAt: sheet.rightsVerifiedAt,
            reviewed: { by: REVIEW.by, date: REVIEW.date },
            collections: index,
            licences,
            works
        },
        refused
    };
}

/** What changed between a catalogued work and its source today; empty when nothing did. */
export function changes(pinned, fresh, delivery) {
    if (!fresh?.work) return [`no longer shown: ${fresh?.why || 'unresolved'}`];
    const now = fresh.work;
    const found = [];
    if (now.licence !== pinned.licence) found.push(`licence ${pinned.licence} → ${now.licence}`);
    if (now.requiredCredit !== pinned.requiredCredit) found.push(`credit "${pinned.requiredCredit}" → "${now.requiredCredit}"`);
    if (now.image !== pinned.image) found.push(`image ${pinned.image} → ${now.image}`);
    if (delivery && !delivery.ok) found.push(`image does not load: ${delivery.why}`);
    return found;
}

/** One catalogued work resolved again at its source, by the harvest's own resolvers. */
async function recheck(work) {
    const bare = work.id.slice(work.id.indexOf(':') + 1);
    try {
        switch (work.source) {
            case 'cleveland': {
                const page = await getJson(`https://openaccess-api.clevelandart.org/api/artworks/${encodeURIComponent(bare)}`, 'Cleveland');
                return clevelandCandidate(page?.data, work.register);
            }
            case 'rijks': return rijksCandidate(bare);
            case 'eso': return esoCandidate(await getJson(`https://www.eso.org/public/images/${encodeURIComponent(bare)}/api/json/`, 'ESO'));
            case 'nasa': {
                const body = await getJson(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(bare)}&media_type=image`, 'NASA');
                const item = (body?.collection?.items || []).find(i => i?.data?.[0]?.nasa_id === bare);
                return item ? nasaCandidate(item) : { why: 'not found at NASA' };
            }
            default: return { why: `unknown source ${work.source}` };
        }
    } catch (error) {
        return { why: error.status === 404 ? 'gone from its source (404)' : String(error.message) };
    }
}

async function verify() {
    const catalog = JSON.parse(readFileSync(OUT, 'utf8'));
    let changed = 0;
    for (const work of catalog.works) {
        const fresh = await recheck(work);
        const delivery = fresh?.work ? await verifyDelivery(work.image) : null;
        const found = changes(work, fresh, delivery);
        if (found.length) {
            changed++;
            console.log(`CHANGED  ${work.id}  ${work.title}`);
            for (const line of found) console.log(`         ${line}`);
        }
        await sleep(500);
    }
    console.log(`\nverified ${catalog.works.length} works frozen ${catalog.rightsVerifiedAt}: `
        + `${catalog.works.length - changed} unchanged, ${changed} changed`);
    return changed;
}

function build() {
    const sheet = JSON.parse(readFileSync(fileURLToPath(new URL(REVIEW.sheet, ROOT)), 'utf8'));
    const { doc, refused } = buildCatalog(sheet);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    for (const [id, collection] of Object.entries(doc.collections)) {
        console.log(`${id.padEnd(14)} ${collection.works.length} works, favourites ${collection.favourites.join(', ')}`);
    }
    console.log(`licences       ${JSON.stringify(doc.licences)}`);
    for (const r of refused) console.log(`refused        ${r.id} — ${r.why}`);
    console.log(`\nwrote ${OUT}`);
    return refused.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const failed = process.argv.includes('--verify') ? await verify() : build();
    process.exitCode = failed ? 1 : 0;
}
