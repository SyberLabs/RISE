/**
 * The absence check — does every pinned collection still resolve?
 *
 * WHY THIS EXISTS
 * ───────────────
 * Reverent degradation says a work that will not resolve is simply
 * absent: no broken frame, no placeholder, no substitute. That is right
 * for the reader and it stays. But it means a source can rot in total
 * silence, and it did — the retired `microscopy` category returned
 * nothing for its entire life because the Commons category never
 * existed, and nobody noticed for months.
 *
 * So: the doctrine holds for the reader, and this script is how it stops
 * being silent to the maintainer.
 *
 * Under curation-only (SOURCE-CURATION-SPEC) the signal is unambiguous
 * in a way it never was before. A SEARCHED category returning nothing
 * might just mean the tree changed today. A PINNED collection returning
 * nothing is definitionally a defect: someone chose those accessions,
 * and an institution has stopped serving them, changed an id, or
 * withdrawn a rights declaration.
 *
 * WHY IT IS NOT A UNIT TEST
 * ─────────────────────────
 * It issues real requests to four institutions. In the suite it would
 * fail CI whenever a museum has an outage, which trains people to ignore
 * it — the opposite of the point. The unit tests mock fetch and assert
 * the CONTRACT; this asserts the WORLD, and the world is allowed to be
 * briefly unavailable. Run it deliberately:
 *
 *     node scripts/probe-collections.mjs
 *     node scripts/probe-collections.mjs --json
 *
 * Exit codes: 0 = every collection resolves, 1 = at least one is empty
 * or degraded, 2 = the probe itself could not run.
 *
 * A NOTE ON FALSE ALARMS
 * ──────────────────────
 * The first version reported chapel-resurrection at 20/46 and it was
 * wrong. Probing 341 works in a tight loop tripped the Met's per-IP rate
 * limit, so the probe manufactured the very absence it was built to
 * detect — every one of the 26 missing works was a Met pin, and each
 * resolves fine when asked alone.
 *
 * The block is total while it holds (403 to every request, whatever the
 * object) and lifts after roughly 45 seconds. That combination is what
 * made it so convincing: the count was identical on every run, which
 * reads like a real defect rather than throttling.
 *
 * Two lessons are built into this script. Pace the requests so the limit
 * is not tripped. And distinguish CANNOT-ASK from IS-ABSENT — a
 * throttled probe has learned nothing about whether a work is there, and
 * must say so rather than report a shortfall. A check that cries wolf
 * teaches people to ignore it, which would leave us worse off than the
 * silence this script exists to break.
 */

import { ATRIUM_PINNED_COLLECTIONS } from '../src/content/atrium/imagery/collections.js';
import { CHAPEL_PINNED_COLLECTIONS } from '../src/content/chapel/imagery/collections.js';
import { resolveCollection } from '../src/content/atrium/imagery/service.js';

// A collection that resolves SOME works is not healthy just because it
// is non-empty: a Gospel pericope down to its last plate has lost the
// range the pericope engine needs to place the right image beside the
// right verse. Warn well before it reaches zero.
const DEGRADED_RATIO = 0.6;
const DEGRADED_FLOOR = 2;

const REGISTRIES = [
    ['atrium', ATRIUM_PINNED_COLLECTIONS],
    ['chapel', CHAPEL_PINNED_COLLECTIONS]
];

// Pacing, measured rather than guessed. The Met rate-limits by IP and
// answers 403 to EVERY request while the block holds — the same object
// id returns 200, then 403 during the block, then 200 again about 45
// seconds later. A retry must therefore outlast the window rather than
// merely follow it; a 5s backoff re-asks inside it and is refused
// identically, which is what made the shortfall look deterministic.
//
// With these pauses the whole probe resolves 341/341.
const PAUSE_MS = 1500;
const RETRIES = 2;
const RETRY_BACKOFF_MS = 60000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function resolveWithRetry(collection) {
    const pinned = (collection?.works || []).length;
    let best = [];
    let error = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        // Back off generously: the point of a retry is to ask AFTER the
        // window that refused us, not inside it.
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
