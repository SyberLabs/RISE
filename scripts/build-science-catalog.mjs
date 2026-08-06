/**
 * Build the runtime science imagery catalog from a reviewed harvest.
 *
 *   node scripts/harvest-science.mjs --out science.json
 *   node scripts/build-science-catalog.mjs science.json
 *
 * Runtime code deliberately does not crawl remote catalogs. This script
 * is the controlled refresh boundary, exactly as
 * `build-audubon-catalog.mjs` is for the plates — and the science sources
 * need that boundary more than Audubon does, because their rights CANNOT
 * be re-verified at render. Cleveland and Rijksmuseum re-check each
 * object's licence live; api.si.edu is not in `connect-src` and needs a
 * key, so a
 * science work's rights are true as of the date this ran and are stamped
 * with it (SOURCE-EXPANSION-SPEC §3a).
 *
 * The verdicts come from `science-pins.js` — the human decision — and
 * this produces its result. Nothing is inferred here that a reviewer did
 * not decide there.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASTRONOMY, ESO_SHORTLIST, RETIRED } from '../src/content/science/imagery/science-pins.js';
import { artworkMayBeShown, licenceClassOf, normalizeArtworkLabel }
    from '../src/visuals/artwork-label.js';

const OUT = fileURLToPath(new URL('../src/sources/visual/science-catalog.generated.json', import.meta.url));

const inPath = process.argv[2];
if (!inPath) {
    console.error('usage: build-science-catalog.mjs <harvest.json>');
    process.exit(1);
}
const harvest = JSON.parse(readFileSync(resolve(inPath), 'utf8'));
const candidates = harvest.works || [];

/** Which harvested works a category's verdict selects. */
function select(category) {
    const excluded = new Set(category.exclude || []);
    const out = [];
    for (const rule of category.sources) {
        const prefix = `${rule.source}:`;
        for (const work of candidates) {
            if (!work.id.startsWith(prefix)) continue;
            if (excluded.has(work.id)) continue;
            if (!rule.all && !(rule.include || []).includes(work.id)) continue;
            out.push(work);
        }
    }
    return out;
}

const kept = select(ASTRONOMY);

// THE PRESENTER'S OWN CHECK, AT THE LAST GATE TOO. The harvest ran this
// and the harvest could be stale — a reviewed selection is written once
// and read for months, so the catalog re-earns the right to show every
// work rather than inheriting it.
const works = [];
const refused = [];
for (const w of kept) {
    const probe = {
        name: w.title,
        data: {
            title: w.title, artist: w.artist, sourceName: w.sourceName,
            sourceUrl: w.page || w.sourceUrl, rights: w.rights,
            attribution: w.credit,
            ...(w.licence === 'public-domain-credit' ? { creditRequired: true } : {})
        }
    };
    const label = normalizeArtworkLabel(probe);
    if (!artworkMayBeShown(label)) { refused.push({ id: w.id, why: 'cannot be credited' }); continue; }
    if (!w.delivery?.ok) { refused.push({ id: w.id, why: `delivery ${w.delivery?.why || 'unverified'}` }); continue; }

    works.push({
        id: w.id,
        title: w.title,
        description: w.description || '',
        artist: w.artist || '',
        date: w.date || '',
        licence: licenceClassOf(probe),
        rights: w.rights,
        /** What the chip must show. Composed once, here, never at render. */
        requiredCredit: label?.requiredText || '',
        /** The whole provider credit, for the Curia — §3(a)(3)'s "where practical". */
        fullCredit: label?.fullCredit || '',
        creditElided: Boolean(label?.creditElided),
        image: w.image,
        thumb: w.thumb || w.image,
        sourceName: w.sourceName,
        sourceUrl: w.page || w.sourceUrl
    });
}

const byLicence = {};
for (const w of works) byLicence[w.licence] = (byLicence[w.licence] || 0) + 1;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    /**
     * FROZEN, NOT LIVE. Named so nothing downstream mistakes this for a
     * rights check it can rely on being current.
     */
    rightsVerifiedAt: new Date().toISOString().slice(0, 10),
    collections: { astronomy: { name: ASTRONOMY.name, works: works.map(w => w.id) } },
    licences: byLicence,
    shortlisted: { eso: ESO_SHORTLIST },
    retired: RETIRED,
    works
}, null, 2) + '\n', 'utf8');

console.log(`astronomy   ${works.length} works  ${JSON.stringify(byLicence)}`);
if (refused.length) {
    console.log(`refused     ${refused.length}`);
    for (const r of refused) console.log(`  ${r.id} — ${r.why}`);
}
console.log(`shortlisted ${ESO_SHORTLIST.length} ESO, pending a second review`);
console.log(`retired     ${RETIRED.reduce((n, r) => n + r.reviewed, 0)} across ${RETIRED.length} ledger entries`);
console.log(`\nwrote ${OUT}`);
