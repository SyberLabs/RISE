/**
 * Absence check — does every pinned collection still resolve?
 *
 * Reverent degradation leaves unresolved works absent for the reader.
 * This script is how that silence is audible to a maintainer.
 *
 * Under curation-only (SOURCE-CURATION-SPEC), an empty PINNED collection
 * is a defect: accessions were chosen deliberately. (A searched category
 * returning nothing may only mean the tree changed.)
 *
 * Not a unit test: it hits live institutions. An outage would fail CI
 * and train people to ignore it. Unit tests mock fetch and assert the
 * contract; this asserts the world. Run deliberately:
 *
 *     node scripts/probe-collections.mjs
 *     node scripts/probe-collections.mjs --json
 *
 * Exit codes: 0 = every collection resolves, 1 = at least one empty or
 * degraded, 2 = the probe itself could not run.
 *
 * Pace requests and distinguish cannot-ask (throttled) from is-absent:
 * a rate-limited probe has learned nothing about presence and must not
 * report a shortfall.
 */

import { ATRIUM_PINNED_COLLECTIONS } from '../src/content/atrium/imagery/collections.js';
import { CHAPEL_PINNED_COLLECTIONS } from '../src/content/chapel/imagery/collections.js';
import { resolveCollection } from '../src/content/atrium/imagery/service.js';

// A non-empty collection can still be degraded: warn well before zero
// when resolved count falls below DEGRADED_RATIO of pins (and below floor).
const DEGRADED_RATIO = 0.6;
const DEGRADED_FLOOR = 2;

const REGISTRIES = [
    ['atrium', ATRIUM_PINNED_COLLECTIONS],
    ['chapel', CHAPEL_PINNED_COLLECTIONS]
];

// Pace for institution rate limits (e.g. Met IP blocks with 403 until
// the window lifts). Retries must outlast the block, not re-ask inside it.
const PAUSE_MS = 1500;
const RETRIES = 2;
const RETRY_BACKOFF_MS = 60000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function resolveWithRetry(collection) {
    const pinned = (collection?.works || []).length;
    let best = [];
    let error = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        // Back off so a retry asks after a rate-limit window, not inside it.
        if (attempt) await sleep(RETRY_BACKOFF_MS * attempt);
        try {
            const works = await resolveCollection(collection, {});
            if (works.length > best.length) best = works;
            if (best.length === pinned) return { works: best, error: null };
            error = null;
        } catch (e) {
            error = e?.message || String(e);
        }
    }
    return { works: best, error };
}

const json = process.argv.includes('--json');
const log = (...a) => { if (!json) console.log(...a); };

async function probe() {
    const rows = [];

    for (const [registry, collections] of REGISTRIES) {
        for (const [id, collection] of Object.entries(collections)) {
            const pinned = (collection?.works || []).length;
            const { works, error } = await resolveWithRetry(collection);
            const resolved = works.length;
            await sleep(PAUSE_MS);

            const ratio = pinned ? resolved / pinned : 0;
            // A shortfall that is entirely one institution's pins is far
            // more likely to be that institution refusing US than a
            // curator's chosen works vanishing all at once. Say so
            // rather than calling it absence.
            const missingSources = new Set(
                (collection?.works || [])
                    .filter(w => !works.some(r => String(r.id) === `${w.source}:${w.id}`))
                    .map(w => w.source)
            );
            const oneSourceDown = missingSources.size === 1 && resolved > 0;
            const status = error ? 'ERROR'
                : resolved === 0 ? 'EMPTY'
                    : oneSourceDown && ratio < DEGRADED_RATIO ? 'THROTTLED?'
                        : (resolved < DEGRADED_FLOOR || ratio < DEGRADED_RATIO) ? 'DEGRADED'
                            : 'ok';

            const downSource = oneSourceDown ? [...missingSources][0] : null;
            rows.push({ registry, id, name: collection?.name || id, pinned, resolved, ratio, status, error, downSource });

            const mark = { ok: '  ', 'THROTTLED?': '~ ', DEGRADED: '! ', EMPTY: 'XX', ERROR: 'XX' }[status];
            log(`${mark} ${registry.padEnd(7)} ${id.padEnd(30)} ${String(resolved).padStart(3)}/${String(pinned).padEnd(3)} ${status === 'ok' ? '' : status}${downSource ? ` (all missing are ${downSource})` : ''}${error ? ' — ' + error : ''}`);
        }
    }

    return rows;
}

let rows;
try {
    rows = await probe();
} catch (e) {
    console.error('probe could not run:', e?.message || e);
    process.exit(2);
}

const broken = rows.filter(r => r.status === 'EMPTY' || r.status === 'ERROR');
const degraded = rows.filter(r => r.status === 'DEGRADED');
// Not a defect and not a pass: we could not ask. Reported, never counted
// as absence, and never a reason to fail.
const throttled = rows.filter(r => r.status === 'THROTTLED?');

if (json) {
    console.log(JSON.stringify({
        checked: rows.length,
        pinned: rows.reduce((s, r) => s + r.pinned, 0),
        resolved: rows.reduce((s, r) => s + r.resolved, 0),
        broken: broken.map(r => r.id),
        degraded: degraded.map(r => r.id),
        throttled: throttled.map(r => r.id),
        rows
    }, null, 2));
} else {
    const pinned = rows.reduce((s, r) => s + r.pinned, 0);
    const resolved = rows.reduce((s, r) => s + r.resolved, 0);
    log(`\n${rows.length} collections · ${resolved}/${pinned} works resolve`);
    if (broken.length) log(`\nBROKEN (a chosen work no longer resolves — this is a defect):\n  ${broken.map(r => `${r.id} ${r.resolved}/${r.pinned}`).join('\n  ')}`);
    if (degraded.length) log(`\nDEGRADED (thinning; still shows imagery, but losing range):\n  ${degraded.map(r => `${r.id} ${r.resolved}/${r.pinned}`).join('\n  ')}`);
    if (!broken.length && !degraded.length) log('\nEvery pinned collection resolves.');
}

process.exit(broken.length || degraded.length ? 1 : 0);
