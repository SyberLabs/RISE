import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinuousField } from './continuous-field.js';

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
