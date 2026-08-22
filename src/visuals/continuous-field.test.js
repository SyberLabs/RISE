import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ContinuousField,
    containedArtworkBounds,
    needsAdaptiveImageWash,
    resolveGalleryLabelPlacement
} from './continuous-field.js';

/**
 * The Continuous Field presenter (CONTINUOUS-FIELD-SPEC §3). Pure of
 * the cortex: a fake pool, an instant decode, and an injected clock.
 */

function fakeClock() {
    let t = 0;
    const rafs = [];
    return {
        now: () => t,
        raf: (cb) => { rafs.push(cb); return rafs.length; },
        caf: () => {},
        // advance time and fire pending rafs once
        tick: (ms) => { t += ms; const pending = rafs.splice(0); for (const cb of pending) cb(t); },
        set: (ms) => { t = ms; }
    };
}

const pool = (...urls) => urls.map(url => ({ url, title: url }));

function mount(opts = {}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const clock = fakeClock();
    const field = new ContinuousField(host, {
        decode: async () => true,
        now: clock.now, raf: clock.raf, caf: clock.caf,
        dwellMs: 1000, crossfadeMs: 200,
        ...opts
    });
    return { field, host, clock };
}

describe('Gallery attribution geometry', () => {
    it('derives the centered visible artwork bounds used by object-fit contain', () => {
        expect(containedArtworkBounds(1200, 800, 600, 1200)).toEqual({
            left: 400,
            top: 0,
            right: 800,
            bottom: 800,
            width: 400,
            height: 800
        });
        expect(containedArtworkBounds(1200, 800, 1600, 800)).toEqual({
            left: 0,
            top: 100,
            right: 1200,
            bottom: 700,
            width: 1200,
            height: 600
        });
    });

    it('places a label at the lower-right edge wholly in the right matte beside a portrait', () => {
        const placement = resolveGalleryLabelPlacement({
            frameWidth: 1200,
            frameHeight: 800,
            naturalWidth: 600,
            naturalHeight: 1200,
            labelWidth: 260,
            labelHeight: 54,
            padding: 20,
            gap: 14
        });

        expect(placement.mode).toBe('outside-right');
        expect(placement.left).toBe(1200 - 20 - 260);
        expect(placement.top).toBe(800 - 20 - 54);
        expect(placement.left).toBeGreaterThanOrEqual(placement.artwork.right + 14);
    });

    it('places a label wholly in the lower matte beneath a panorama', () => {
        const placement = resolveGalleryLabelPlacement({
            frameWidth: 1200,
            frameHeight: 800,
            naturalWidth: 1800,
            naturalHeight: 720,
            labelWidth: 260,
            labelHeight: 54,
            padding: 20,
            gap: 14
        });

        expect(placement.mode).toBe('outside-bottom');
        expect(placement.left).toBe(1200 - 20 - 260);
        expect(placement.top).toBe(800 - 20 - 54);
        expect(placement.top).toBeGreaterThanOrEqual(placement.artwork.bottom + 14);
        expect(placement.top + 54).toBeLessThanOrEqual(780);
    });

    it('keeps the complete label padded inside when no matte can contain it', () => {
        const placement = resolveGalleryLabelPlacement({
            frameWidth: 1200,
            frameHeight: 800,
            naturalWidth: 1200,
            naturalHeight: 800,
            labelWidth: 260,
            labelHeight: 54,
            padding: 20,
            gap: 14
        });

        expect(placement.mode).toBe('inside');
        expect(placement.left + 260).toBe(placement.artwork.right - 20);
        expect(placement.top).toBeGreaterThanOrEqual(placement.artwork.top + 20);
        expect(placement.left + 260).toBeLessThanOrEqual(placement.artwork.right - 20);
        expect(placement.top + 54).toBeLessThanOrEqual(placement.artwork.bottom - 20);
    });
});

describe('Adaptive image wash geometry', () => {
    it('does not allocate a wash for an exact or near-exact viewport fit', () => {
        expect(needsAdaptiveImageWash({
            frameWidth: 1920,
            frameHeight: 1080,
            naturalWidth: 1920,
            naturalHeight: 1080
        })).toBe(false);
        expect(needsAdaptiveImageWash({
            frameWidth: 1920,
            frameHeight: 1080,
            naturalWidth: 1900,
            naturalHeight: 1080
        })).toBe(false);
    });

    it('allocates a wash when contain leaves a meaningful portrait matte', () => {
        expect(needsAdaptiveImageWash({
            frameWidth: 1920,
            frameHeight: 1080,
            naturalWidth: 800,
            naturalHeight: 1200
        })).toBe(true);
    });
});

describe('ContinuousField', () => {
    afterEach(() => { document.body.replaceChildren(); });

    it('mounts exactly two layers (the double buffer)', async () => {
        const works = pool('a.jpg', 'b.jpg', 'c.jpg');
        const { field, host } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        expect(host.querySelectorAll('.continuous-field-layer').length).toBe(2);
        field.stop();
    });

    it('reveals a first work by fading a layer to opacity 1', async () => {
        const works = pool('a.jpg', 'b.jpg');
        const { field, host } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        const shown = [...host.querySelectorAll('.continuous-field-layer')].some(l => l.style.opacity === '1');
        expect(shown).toBe(true);
        expect(field.currentUrl).toBeTruthy();
        field.stop();
    });

    it('awaits a generated work through the same decode-before-reveal path', async () => {
        const getNextWork = vi.fn().mockResolvedValue({
            url: 'data:image/webp;base64,procedural',
            title: 'Fractal Flame'
        });
        const decode = vi.fn().mockResolvedValue(true);
        const { field } = mount({
            getPool: () => [],
            getNextWork,
            hasWorks: () => true,
            decode
        });

        field.start();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(getNextWork).toHaveBeenCalledWith({
            currentUrl: null,
            poolKey: 'default'
        });
        expect(decode).toHaveBeenCalledWith('data:image/webp;base64,procedural');
        expect(field.currentUrl).toBe('data:image/webp;base64,procedural');
        field.stop();
    });

    it('rejects a generated work that finishes after the source identity changes', async () => {
        let resolveOld;
        const getNextWork = vi.fn()
            .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValue({ url: 'new-procedural.jpg' });
        const { field, clock } = mount({
            getPool: () => [],
            getNextWork,
            hasWorks: () => true
        });

        field.start();
        field.poolChanged();
        resolveOld({ url: 'old-procedural.jpg' });
        await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).not.toBe('old-procedural.jpg');

        clock.tick(1);
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBe('new-procedural.jpg');
        field.stop();
    });

    it('shows the complete artwork over an edge-to-edge adaptive backdrop', async () => {
        const { field, host } = mount({ getPool: () => pool('portrait.jpg') });
        host.getBoundingClientRect = () => ({ width: 1200, height: 800 });
        field.start();
        await Promise.resolve(); await Promise.resolve();

        const shown = [...host.querySelectorAll('.continuous-field-layer')]
            .find(layer => layer.style.opacity === '1');
        const artwork = shown?.querySelector('.continuous-field-artwork');
        const backdrop = shown?.querySelector('.continuous-field-backdrop');
        Object.defineProperties(artwork, {
            naturalWidth: { configurable: true, value: 600 },
            naturalHeight: { configurable: true, value: 1200 }
        });
        field._syncLayerWash(field._layers.find(layer => layer.root === shown));

        expect(artwork).not.toBeNull();
        expect(backdrop).not.toBeNull();
        expect(artwork.src).toContain('portrait.jpg');
        expect(backdrop.src).toContain('portrait.jpg');
        expect(artwork.style.objectFit).toBe('contain');
        expect(backdrop.style.objectFit).toBe('cover');
        expect(backdrop.hidden).toBe(false);
        field.stop();
    });

    it('never allocates a Gallery wash for a viewport-shaped procedural snapshot', () => {
        const { field, host } = mount();
        host.getBoundingClientRect = () => ({ width: 1200, height: 800 });
        field._ensureLayers();
        const layer = field._layers[0];
        layer.work = {
            url: 'data:image/webp;base64,procedural',
            sourceType: 'fractal'
        };
        Object.defineProperties(layer.artwork, {
            naturalWidth: { configurable: true, value: 1200 },
            naturalHeight: { configurable: true, value: 800 }
        });

        field._syncLayerWash(layer);

        expect(layer.root.dataset.imageWash).toBe('none');
        expect(layer.backdrop.hidden).toBe(true);
        expect(layer.backdrop.hasAttribute('src')).toBe(false);
        field.stop();
    });

    it('binds a title and artist to the same crossfade layer as its artwork', async () => {
        const work = {
            url: 'portrait.jpg',
            artworkLabel: {
                labelText: 'Wild Turkey · John James Audubon',
                requiredText: 'Wild Turkey · John James Audubon',
                creditRequired: false
            }
        };
        const { field, host } = mount({ getPool: () => [work] });
        field.start();
        await Promise.resolve(); await Promise.resolve();

        const shown = [...host.querySelectorAll('.continuous-field-layer')]
            .find(layer => layer.style.opacity === '1');
        expect(shown.querySelector('.continuous-field-artwork').src)
            .toContain('portrait.jpg');
        expect(shown.querySelector('.continuous-field-label').textContent)
            .toBe('Wild Turkey · John James Audubon');
        field.stop();
    });

    it('hides optional labels live but never hides a required credit', async () => {
        const optional = {
            url: 'optional.jpg',
            artworkLabel: {
                labelText: 'Optional · Artist',
                requiredText: 'Optional · Artist',
                creditRequired: false
            }
        };
        const { field, host } = mount({ getPool: () => [optional] });
        field.start();
        await Promise.resolve(); await Promise.resolve();

        field.setArtworkLabelsVisible(false);
        expect(host.querySelector('.continuous-field-label:not([hidden])')).toBeNull();
        field.stop();

        const required = {
            url: 'required.jpg',
            artworkLabel: {
                labelText: 'Required · Artist',
                requiredText: 'Required · Artist · CC BY 4.0',
                creditRequired: true
            }
        };
        const second = mount({
            getPool: () => [required],
            showArtworkLabels: false
        });
        second.field.start();
        await Promise.resolve(); await Promise.resolve();

        const label = second.host.querySelector('.continuous-field-label:not([hidden])');
        expect(label?.textContent).toBe('Required · Artist · CC BY 4.0');
        second.field.stop();
    });

    it('crossfades: the incoming rises while the outgoing falls — never both at 0', async () => {
        const works = pool('a.jpg', 'b.jpg', 'c.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        // advance one dwell to trigger a crossfade
        clock.tick(1000);
        await Promise.resolve(); await Promise.resolve();
        const layers = [...host.querySelectorAll('.continuous-field-layer')];
        // at least one layer is at full opacity — the field never passes
        // through black between works
        expect(layers.some(l => l.style.opacity === '1')).toBe(true);
        field.stop();
    });

    it('applies a live cadence without replacing the current work', async () => {
        const works = pool('a.jpg', 'b.jpg', 'c.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        const advance = vi.spyOn(field, '_advance');
        field.start();
        await Promise.resolve(); await Promise.resolve();
        const held = field.currentUrl;

        field.setCadence({ dwellMs: 2500, crossfadeMs: 450 });
        expect(field.currentUrl).toBe(held);
        expect(field.dwellMs).toBe(2500);
        expect(field.crossfadeMs).toBe(450);
        expect([...host.querySelectorAll('.continuous-field-layer')].every(layer =>
            layer.style.transition.includes('450ms'))).toBe(true);

        clock.tick(2499);
        expect(advance).toHaveBeenCalledTimes(1);
        clock.tick(1);
        expect(advance).toHaveBeenCalledTimes(2);
        field.stop();
    });

    it('pause holds the authored wall and resumes with the remaining dwell', async () => {
        const works = pool('a.jpg', 'b.jpg', 'c.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        const advance = vi.spyOn(field, '_advance');
        field.start();
        await Promise.resolve(); await Promise.resolve();
        const held = field.currentUrl;

        clock.tick(400);
        expect(field.pause()).toBe(true);
        expect(field.paused).toBe(true);
        clock.tick(5000);
        await Promise.resolve();
        expect(field.currentUrl).toBe(held);
        expect(host.querySelectorAll('.continuous-field-layer')).toHaveLength(2);
        expect(advance).toHaveBeenCalledTimes(1);

        expect(field.resume()).toBe(true);
        clock.tick(599);
        expect(advance).toHaveBeenCalledTimes(1);
        clock.tick(1);
        expect(advance).toHaveBeenCalledTimes(2);
        field.stop();
    });

    it('an async work completing during pause cannot replace the held wall', async () => {
        let resolveNext;
        const getNextWork = vi.fn()
            .mockResolvedValueOnce({ url: 'held.jpg' })
            .mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
        const { field, clock } = mount({ getNextWork, hasWorks: () => true });
        field.start();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBe('held.jpg');

        clock.tick(1000);
        field.pause();
        resolveNext({ url: 'late.jpg' });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBe('held.jpg');
        field.stop();
    });

    it('draws every work before repeating (ShuffleBag order)', async () => {
        const works = pool('a.jpg', 'b.jpg', 'c.jpg');
        const seen = [];
        const { field, clock } = mount({
            getPool: () => works,
            decode: async () => true
        });
        // capture each advanced url
        const origCross = field._crossfadeTo.bind(field);
        field._crossfadeTo = (url, first) => { seen.push(url); origCross(url, first); };
        field.start();
        await Promise.resolve(); await Promise.resolve();
        for (let i = 0; i < 2; i++) { clock.tick(1000); await Promise.resolve(); await Promise.resolve(); }
        expect(new Set(seen).size).toBe(3); // all three before any repeat
        field.stop();
    });

    it('a cold (empty) pool shows nothing, then reveals when works arrive', async () => {
        let works = [];
        const { field, host, clock } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBeNull();
        // works arrive; the next advance reveals one
        works = pool('a.jpg');
        clock.tick(1000);
        await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBe('a.jpg');
        field.stop();
    });

    it('reduced motion shows ONE still work with no advance clock', async () => {
        const works = pool('a.jpg', 'b.jpg');
        const { field, host, clock } = mount({ getPool: () => works, reducedMotion: true });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        const first = field.currentUrl;
        expect(first).toBeTruthy();
        // no clock: advancing time changes nothing
        clock.tick(10000);
        await Promise.resolve();
        expect(field.currentUrl).toBe(first);
        // the shown layer has no transition (a still image)
        const shown = [...host.querySelectorAll('.continuous-field-layer')].find(l => l.style.opacity === '1');
        expect(shown.style.transition).toBe('none');
        field.stop();
    });

    it('poolChanged crossfades to the new pool and discards stale decodes', async () => {
        let works = pool('old-a.jpg', 'old-b.jpg');
        let resolveDecode;
        const { field, clock } = mount({
            getPool: () => works,
            // a slow decode we can strand
            decode: () => new Promise(r => { resolveDecode = r; })
        });
        field.start();
        // the first advance is mid-decode; swap the pool underneath it
        works = pool('new-a.jpg');
        field.poolChanged();
        // now let the OLD decode resolve — it must be discarded (stale gen)
        resolveDecode?.(true);
        await Promise.resolve(); await Promise.resolve();
        // the old work must not have been shown; only the new pool's
        // decode (still pending) can win
        expect(field.currentUrl).not.toBe('old-a.jpg');
        field.stop();
    });

    it('a works-less pool change (stillness) fades the field to nothing', async () => {
        let works = pool('a.jpg', 'b.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBeTruthy();
        // the episode becomes works-less BY DESIGN (a still pericope)
        works = [];
        field.poolChanged({ stillness: true });
        expect(field.currentUrl).toBeNull();
        const anyVisible = [...host.querySelectorAll('.continuous-field-layer')].some(l => l.style.opacity === '1');
        expect(anyVisible).toBe(false);
        field.stop();
    });

    it('a cold pool change (warming, not stillness) HOLDS the current work', async () => {
        let works = pool('old.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve(); await Promise.resolve();
        const held = field.currentUrl;
        expect(held).toBe('old.jpg');
        // the new episode's pool is momentarily empty (still warming) — the
        // field must NOT fade to black; it holds the last work
        works = [];
        field.poolChanged({ stillness: false });
        expect(field.currentUrl).toBe(held);
        const stillShown = [...host.querySelectorAll('.continuous-field-layer')].some(l => l.style.opacity === '1');
        expect(stillShown).toBe(true);
        // when works arrive, the next tick reveals the new episode
        works = pool('new.jpg');
        clock.tick(1000);
        await Promise.resolve(); await Promise.resolve();
        expect(field.currentUrl).toBe('new.jpg');
        field.stop();
    });

    it('stop clears the layers and halts the clock', async () => {
        const works = pool('a.jpg');
        const { field, host, clock } = mount({ getPool: () => works });
        field.start();
        await Promise.resolve();
        field.stop();
        expect(host.querySelectorAll('.continuous-field-layer').length).toBe(0);
        expect(field.running).toBe(false);
    });
});

describe('Continuous Field projection mount', () => {
    it('one instance paints the same url onto both mounts after _crossfadeTo', async () => {
        const { field, host } = mount({ getPool: () => pool('a.jpg', 'b.jpg') });
        const projection = document.createElement('div');
        projection.className = 'chamber-fill-field';
        document.body.appendChild(projection);

        field.setProjectionHost(projection);
        field.start();
        await Promise.resolve();
        await Promise.resolve();

        expect(field.projectionHost).toBe(projection);
        expect(host.querySelectorAll('.continuous-field-layer').length).toBe(2);
        expect(projection.querySelectorAll('.continuous-field-layer').length).toBe(2);

        field._crossfadeTo({ url: 'https://example.test/next.jpg' }, false);
        field._currentUrl = 'https://example.test/next.jpg';

        const primarySrcs = [...host.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        const projectionSrcs = [...projection.querySelectorAll('.continuous-field-artwork')]
            .map(img => img.getAttribute('src'))
            .filter(Boolean)
            .sort();
        expect(projectionSrcs).toEqual(primarySrcs);
        expect(projectionSrcs.some(src => src.includes('next.jpg'))).toBe(true);
        expect(field.currentUrl).toBe('https://example.test/next.jpg');
        expect(projection.querySelector('.continuous-field-label')).toBeNull();
        field.stop();
        projection.remove();
    });

    it('setProjectionHost(null) tears the projection nodes and leaves the gallery host', async () => {
        const { field, host } = mount({ getPool: () => pool('a.jpg') });
        const projection = document.createElement('div');
        document.body.appendChild(projection);
        field.setProjectionHost(projection);
        field.start();
        await Promise.resolve();
        await Promise.resolve();
        expect(projection.querySelectorAll('.continuous-field-layer').length).toBe(2);

        field.setProjectionHost(null);
        expect(field.projectionHost).toBeNull();
        expect(projection.querySelectorAll('.continuous-field-layer').length).toBe(0);
        expect(host.querySelectorAll('.continuous-field-layer').length).toBe(2);
        expect(field.currentUrl).toBe('a.jpg');
        field.stop();
        projection.remove();
    });
});
