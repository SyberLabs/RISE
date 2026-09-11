/**
 * A tab that was away too long may not have survived it.
 *
 * iOS Safari reclaims memory from backgrounded tabs. The page keeps its
 * place in the tab strip and its background colour, but what made it a
 * page is gone — so a reader who opens RISE the next morning is looking
 * at the slate the app paints on and nothing else. Nothing in here can
 * prevent that; the browser is entitled to do it, and by the time we
 * could notice, the damage is done.
 *
 * What we can do is the thing a reader does by reflex, and do it before
 * they have to: come back, see the page is stale, reload it.
 *
 * IT ASKS BEFORE IT ACTS, because the cost of being wrong is not
 * symmetric. A reload that was needed costs a second. A reload that was
 * not costs the reader their place. So a long absence only prompts the
 * question — the answer comes from whether the page is still painting
 * and still has its view in it. Only a very long absence, where nothing
 * can be in progress anyway, reloads on the strength of the clock.
 */

/** Hidden at least this long, and the page is asked to prove it is alive. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Hidden this long and the clock alone is enough. Overnight is the
 * reported case, and no reading is mid-phrase after six hours.
 */
export const ASSUME_DEAD_AFTER_MS = 6 * 60 * 60 * 1000;

/** How long a live page may take to produce one frame. */
export const PAINT_PROBE_MS = 1200;

const HIDDEN_AT = 'rise_tab_hidden_at';

/**
 * What to do about a tab that has just come back.
 *
 * Pure, so the thresholds can be tested without a browser or a clock.
 *
 * @param {number} hiddenMs how long the tab was away
 * @param {{alive: boolean, reading: boolean}} state
 * @returns {'keep'|'reload'}
 */
export function stalenessVerdict(hiddenMs, { alive, reading }) {
    // A reading that is still speaking is the proof of life that matters
    // most, and the thing a reload would most obviously ruin.
    if (reading) return 'keep';
    if (!(hiddenMs > 0)) return 'keep';
    if (hiddenMs >= ASSUME_DEAD_AFTER_MS) return 'reload';
    if (hiddenMs < STALE_AFTER_MS) return 'keep';
    return alive ? 'keep' : 'reload';
}

/**
 * Whether the page is still a page.
 *
 * Two questions, because they fail differently. A purged tab stops
 * producing frames at all; a tab whose view was torn down under it keeps
 * animating an empty room. Either one is the grey screen.
 */
export async function isPagePainting(router, { probeMs = PAINT_PROBE_MS } = {}) {
    if (typeof requestAnimationFrame !== 'function') return true;

    const framed = await new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timer = setTimeout(() => settle(false), probeMs);
        requestAnimationFrame(() => {
            clearTimeout(timer);
            settle(true);
        });
    });
    if (!framed) return false;

    const view = router?.views?.get?.(router?.currentView);
    const container = view?.container;
    if (!container) return false;
    if (container.hidden) return false;
    return container.childElementCount > 0;
}

/**
 * Remember when the tab went away, and check on it when it returns.
 *
 * @param {object} deps
 * @param {object} deps.router          read to find the view on screen
 * @param {() => boolean} deps.isReading true while a reading is speaking
 * @param {() => void} deps.reload      how to start over
 * @param {AbortSignal} [deps.signal]   removes the listeners
 */
export function watchTabFreshness({ router, isReading, reload, signal }) {
    if (typeof document === 'undefined') return;

    const mark = () => {
        try {
            sessionStorage.setItem(HIDDEN_AT, String(Date.now()));
        } catch (e) { /* private mode: the tab simply never looks stale */ }
    };

    const readMark = () => {
        try {
            const raw = sessionStorage.getItem(HIDDEN_AT);
            sessionStorage.removeItem(HIDDEN_AT);
            const at = Number(raw);
            return Number.isFinite(at) && at > 0 ? Date.now() - at : 0;
        } catch (e) {
            return 0;
        }
    };

    const check = async () => {
        const hiddenMs = readMark();
        if (!(hiddenMs > 0)) return;

        // Ask the cheap question first: a reading in progress settles it
        // without spending a frame on the probe.
        if (isReading?.()) return;
        if (stalenessVerdict(hiddenMs, { alive: true, reading: false }) === 'reload') {
            reload();
            return;
        }
        if (hiddenMs < STALE_AFTER_MS) return;

        const alive = await isPagePainting(router);
        if (stalenessVerdict(hiddenMs, { alive, reading: isReading?.() === true }) === 'reload') {
            reload();
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') mark();
        else void check();
    }, { signal });

    // A page restored from the back/forward cache never fires
    // visibilitychange, and is exactly the case this exists for.
    window.addEventListener('pageshow', event => {
        if (event.persisted) void check();
    }, { signal });

    // Safari can tear a tab down without ever telling the page it was
    // hidden. Marking on the way out means there is still a timestamp to
    // read if it comes back.
    window.addEventListener('pagehide', mark, { signal });
}
