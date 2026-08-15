/**
 * Ostensoria (Iris Plates) — same seed, same plate. Drawing math is
 * the HTML engine; these tests only pin the Chamber adapter's seed.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Ostensoria } from './ostensoria.js';
import { VOID_FRACTION_LIMIT } from './ostensoria-coverage.js';

describe('Ostensoria engine', () => {
    it('generates deterministically for a fixed seed', () => {
        const a = new Ostensoria();
        const b = new Ostensoria();
        a.generate(null, 'LUX-1234');
        b.generate(null, 'LUX-1234');
        expect(a.cur.coeff).toEqual(b.cur.coeff);
        expect(a.cur.family).toBe(b.cur.family);
        expect(a.cur.kind).toBe(b.cur.kind);
        expect(a.cur.order).toBe(b.cur.order);
        expect(a.cur.mirror).toBe(b.cur.mirror);
        expect(a.cur.phase).toBe(b.cur.phase);
        expect(a.cur.palette).toBe(b.cur.palette);
        expect(a.look.palette).toBe(b.look.palette);
        expect(['reliquary', 'ice']).toContain(a.look.palette);
        expect(a.cur.quality).toBeGreaterThanOrEqual(2);
        expect(a.coverage.sparse).toBe(false);
        expect(a.coverage.voidFraction).toBeLessThan(VOID_FRACTION_LIMIT);
    }, 30_000);

    it('a different seed yields a different plate', () => {
        const a = new Ostensoria();
        const b = new Ostensoria();
        a.generate(null, 'LUX-1234');
        b.generate(null, 'NOX-5678');
        expect(a.cur.coeff).not.toEqual(b.cur.coeff);
    }, 30_000);

    it('seed picks Reliquary or Ice, and an explicit palette is a veto', () => {
        const seen = new Set();
        for (const seed of [
            'LUX-1234', 'NOX-5678', 'ROSA-1111', 'SOL-9999',
            'AVE-2222', 'REX-3333', 'VIA-4444', 'ARCA-5555'
        ]) {
            const engine = new Ostensoria();
            engine.generate(null, seed);
            expect(['reliquary', 'ice']).toContain(engine.look.palette);
            expect(engine.look.sat).toBe(0.85);
            seen.add(engine.look.palette);
        }
        expect(seen.has('reliquary')).toBe(true);
        expect(seen.has('ice')).toBe(true);

        const veto = new Ostensoria();
        veto.generate(null, 'LUX-1234', { palette: 'ember' });
        expect(veto.look.palette).toBe('ember');
        expect(veto.look.bands).toBe(1.5);

        const verdant = new Ostensoria();
        verdant.generate(null, 'LUX-1234', { palette: 'verdant' });
        expect(verdant.look.palette).toBe('verdant');
        expect(verdant.look.bands).toBe(1.3);
        expect(verdant.look.sat).toBe(0.90);
    }, 30_000);

    it('is silent without a 2d context or before generate', () => {
        const engine = new Ostensoria();
        expect(engine.render({ getContext: () => ({}) })).toBe(false);
        expect(engine.render(null)).toBe(false);
    });
});

function denseField(engine) {
    engine.fieldDev = new Float32Array(100);
    engine.fMax = 1;
    for (let i = 0; i < 20; i++) engine.fieldDev[i] = 1;
}

function emptyField(engine) {
    engine.fieldDev = new Float32Array(100);
    engine.fMax = 1;
}

describe('Ostensoria sparse retry', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('discards a ≥95% void bake and retries the pinned seed as :v1', () => {
        const calls = [];
        const engine = new Ostensoria();
        engine._bake = function (_signal, seed) {
            calls.push(seed);
            this.cur = { seed: seed ?? 'rolled' };
            if (seed === 'BLANK-1') emptyField(this);
            else denseField(this);
        };

        engine.generate(null, 'BLANK-1');
        expect(calls).toEqual(['BLANK-1', 'BLANK-1:v1']);
        expect(engine.coverage.sparse).toBe(false);
        expect(engine.acceptedSeed).toBe('BLANK-1:v1');

        calls.length = 0;
        const again = new Ostensoria();
        again._bake = engine._bake;
        again.generate(null, 'BLANK-1');
        expect(calls).toEqual(['BLANK-1', 'BLANK-1:v1']);
        expect(again.acceptedSeed).toBe(engine.acceptedSeed);
    });

    it('keeps a blank when acceptSparse is set', () => {
        const calls = [];
        const engine = new Ostensoria();
        engine._bake = function (_signal, seed) {
            calls.push(seed);
            this.cur = { seed };
            emptyField(this);
        };
        engine.generate(null, 'BLANK-1', { acceptSparse: true });
        expect(calls).toEqual(['BLANK-1']);
        expect(engine.coverage.sparse).toBe(true);
        expect(engine.coverage.voidFraction).toBeGreaterThanOrEqual(VOID_FRACTION_LIMIT);
    });

    it('leaves a dense seed on the first bake', () => {
        const calls = [];
        const engine = new Ostensoria();
        engine._bake = function (_signal, seed) {
            calls.push(seed);
            this.cur = { seed };
            denseField(this);
        };
        engine.generate(null, 'LUX-1234');
        expect(calls).toEqual(['LUX-1234']);
        expect(engine.coverage.sparse).toBe(false);
    });
});

describe('Ostensoria preload queue', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fills FIFO plates and takePlate adopts the next one', async () => {
        let n = 0;
        vi.spyOn(Ostensoria.prototype, '_bake').mockImplementation(function bake() {
            n += 1;
            this.cur = { seed: `q${n}`, id: n };
            this.look = { palette: 'ice' };
            this.ready = true;
            denseField(this);
        });

        const engine = new Ostensoria();
        expect(engine.isReady()).toBe(false);
        await engine.fillQueue(2);
        expect(engine.isReady()).toBe(true);
        expect(engine.queue).toHaveLength(2);

        expect(engine.takePlate()).toBe(true);
        expect(engine.cur.id).toBe(1);
        expect(engine.acceptedSeed).toBe('q1');
        expect(engine.coverage.sparse).toBe(false);
        expect(engine.queue[0].cur.id).toBe(2);
        if (engine._fillPromise) await engine._fillPromise;

        engine.destroy();
        expect(engine.isReady()).toBe(false);
        expect(engine.queue).toHaveLength(0);
    });
});
