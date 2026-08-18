/**
 * Apparitio (Spectral Plates) — same seed, same apparition. Drawing
 * math is the HTML engine; these tests only pin the Chamber adapter's seed.
 */
import { describe, it, expect } from 'vitest';
import { Apparitio } from './apparitio.js';

describe('Apparitio engine', () => {
    it('generates deterministically for a fixed seed', () => {
        const a = new Apparitio();
        const b = new Apparitio();
        a.generate(null, 'SERAPH-1234');
        b.generate(null, 'SERAPH-1234');
        expect(a.cur.wings).toBe(b.cur.wings);
        expect(a.cur.reach).toBe(b.cur.reach);
        expect(a.cur.filigree).toBe(b.cur.filigree);
        expect(a.cur.crown).toBe(b.cur.crown);
        expect(a.cur.phase).toBe(b.cur.phase);
        expect(a.cur.flowSig).toBe(b.cur.flowSig);
        expect(a.cur.quality).toBeGreaterThanOrEqual(2);
    }, 30_000);

    it('a different seed yields a different apparition', () => {
        const a = new Apparitio();
        const b = new Apparitio();
        a.generate(null, 'SERAPH-1234');
        b.generate(null, 'VELUM-5678');
        expect([a.cur.wings, a.cur.reach, a.cur.filigree, a.cur.crown, a.cur.phase])
            .not.toEqual([b.cur.wings, b.cur.reach, b.cur.filigree, b.cur.crown, b.cur.phase]);
    }, 30_000);

    it('is silent without a 2d context or before generate', () => {
        const engine = new Apparitio();
        expect(engine.render({ getContext: () => ({}) })).toBe(false);
        expect(engine.render(null)).toBe(false);
    });

    it('stepBake drain matches generate for a fixed seed', () => {
        const a = new Apparitio();
        const b = new Apparitio();
        a.generate(null, 'SERAPH-1234');
        b.beginBake(null, 'SERAPH-1234');
        let n = 0;
        while (!b.stepBake(8) && n < 20_000) n++;
        expect(b.ready).toBe(true);
        expect(n).toBeGreaterThan(1);
        expect(b.cur.wings).toBe(a.cur.wings);
        expect(b.cur.reach).toBe(a.cur.reach);
        expect(b.cur.filigree).toBe(a.cur.filigree);
        expect(b.cur.crown).toBe(a.cur.crown);
        expect(b.cur.phase).toBe(a.cur.phase);
        expect(b.cur.flowSig).toBe(a.cur.flowSig);
    }, 30_000);
});
