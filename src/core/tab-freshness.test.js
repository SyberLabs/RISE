import { describe, expect, it, vi } from 'vitest';
import {
    ASSUME_DEAD_AFTER_MS,
    STALE_AFTER_MS,
    isPagePainting,
    stalenessVerdict
} from './tab-freshness.js';

/**
 * The cost of being wrong is not symmetric. A reload that was needed
 * costs a second; a reload that was not costs the reader their place.
 */
describe('what to do about a tab that has come back', () => {
    it('leaves a page that is still painting alone', () => {
        expect(stalenessVerdict(STALE_AFTER_MS + 1, { alive: true, reading: false }))
            .toBe('keep');
    });

    it('reloads a page that stopped painting while it was away', () => {
        expect(stalenessVerdict(STALE_AFTER_MS + 1, { alive: false, reading: false }))
            .toBe('reload');
    });

    it('does not question a tab that was only away a moment', () => {
        // Switching apps to read a message is not staleness, and a page
        // that has not finished its first frame is not dead.
        expect(stalenessVerdict(STALE_AFTER_MS - 1, { alive: false, reading: false }))
            .toBe('keep');
    });

    it('trusts the clock alone once the absence is long enough', () => {
        // Overnight is the reported case. Nothing can be in progress, and
        // a tab that looks alive after six hidden hours on iOS often is
        // not - so this is the one place the probe does not get a vote.
        expect(stalenessVerdict(ASSUME_DEAD_AFTER_MS + 1, { alive: true, reading: false }))
            .toBe('reload');
    });

    it('never interrupts a reading that is still speaking', () => {
        // The proof of life that matters most, and the thing a reload
        // would most obviously ruin.
        expect(stalenessVerdict(ASSUME_DEAD_AFTER_MS + 1, { alive: true, reading: true }))
            .toBe('keep');
        expect(stalenessVerdict(STALE_AFTER_MS + 1, { alive: false, reading: true }))
            .toBe('keep');
    });

    it('does nothing when there was no absence to measure', () => {
        expect(stalenessVerdict(0, { alive: false, reading: false })).toBe('keep');
        expect(stalenessVerdict(-1, { alive: false, reading: false })).toBe('keep');
    });
});

describe('whether the page is still a page', () => {
    const routerWith = container => ({
        currentView: 'portal',
        views: new Map([['portal', { container }]])
    });

    it('is false when no frame arrives', async () => {
        vi.stubGlobal('requestAnimationFrame', () => {});
        const alive = await isPagePainting(routerWith({}), { probeMs: 10 });
        expect(alive).toBe(false);
        vi.unstubAllGlobals();
    });

    it('is false when the view on screen has been emptied', async () => {
        // A purged tab stops producing frames; a tab whose view was torn
        // down under it keeps animating an empty room. Both are grey.
        vi.stubGlobal('requestAnimationFrame', cb => { cb(); return 1; });
        const alive = await isPagePainting(
            routerWith({ hidden: false, childElementCount: 0 }), { probeMs: 10 });
        expect(alive).toBe(false);
        vi.unstubAllGlobals();
    });

    it('is true when a frame arrives and the view still holds its content', async () => {
        vi.stubGlobal('requestAnimationFrame', cb => { cb(); return 1; });
        const alive = await isPagePainting(
            routerWith({ hidden: false, childElementCount: 3 }), { probeMs: 10 });
        expect(alive).toBe(true);
        vi.unstubAllGlobals();
    });

    it('is false when the router has no view to point at', async () => {
        vi.stubGlobal('requestAnimationFrame', cb => { cb(); return 1; });
        const alive = await isPagePainting({ currentView: null, views: new Map() },
            { probeMs: 10 });
        expect(alive).toBe(false);
        vi.unstubAllGlobals();
    });
});
