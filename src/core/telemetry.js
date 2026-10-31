/**
 * The reader's anonymous event counts (telemetry.v1): one beacon to RISE's own server, POST /api/count, carrying an
 * event and the fields telemetry/events.json gives it. worker/count.mjs works out the browser and the device, fits the
 * numbers and drops anything else. A count goes only from rise.syberlabs.io itself, never from a frame (RISE inside
 * ChatGPT or Claude, an embed), and so never from a preview, a local run or a test. Nothing is kept: no storage, no
 * cookie and no queue, so a beacon the browser does not take is gone. It never throws.
 */
const SITE = 'rise.syberlabs.io';

export function count(event, fields) {
    try {
        if (globalThis.location?.hostname !== SITE || globalThis.top !== globalThis) return;
        const body = JSON.stringify({ v: 1, e: event, f: fields });
        globalThis.navigator?.sendBeacon?.('/api/count', new Blob([body], { type: 'application/json' }));
    } catch {
        // Nothing: a count is never worth a reading.
    }
}
