/**
 * The three frames (docs/plans/LIVE-CURRENT.md §23): which frame a visual takes, how the room's frame moves from one
 * to the next on the venue's clock, and the one geometry everything that draws or masks reads.
 */
import { describe, expect, it } from 'vitest';
import {
    CUT_MS, FRAME_OF, FRAME_OPEN_MS, createFrameDirector, cutAmount, frameGeometry, frameOf, roomLayout, visualTransform
} from './frames.js';

const W = 1440;
const H = 900;
const layout = roomLayout({ width: W, height: H, bar: { left: 592, top: 16, width: 256, height: 54 }, wordsTop: 690 });
const smooth = u => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

describe('the visual chooses the frame', () => {
    it('keeps the table in one place, keyed by engine and scene kind', () => {
        expect(FRAME_OF).toEqual({
            attractor: 'shell', 'living-flame': 'shell', turrell: 'shell',
            harmonograph: 'inner', ostensoria: 'inner', apparitio: 'inner',
            genesis: 'full', fractal: 'full', neural: 'full', rockgarden: 'full', sourced: 'full', figure: 'full', scene: 'full'
        });
    });

    it('reads the frame from the cue on screen: a field by its renderer, a pattern by its engine, a scene by its kind', () => {
        expect(frameOf({ kind: 'field', renderer: 'attractor', config: {} })).toBe('shell');
        expect(frameOf({ kind: 'field', renderer: 'living-flame', config: {} })).toBe('shell');
        expect(frameOf({ kind: 'field', renderer: 'genesis', config: {} })).toBe('full');
        expect(frameOf({ kind: 'procedural', collections: ['harmonograph'], config: {} })).toBe('inner');
        expect(frameOf({ kind: 'procedural', collections: ['turrell'], config: {} })).toBe('shell');
        expect(frameOf({ kind: 'procedural', collections: ['fractal'], config: {} })).toBe('full');
        expect(frameOf({ kind: 'sourced', collections: ['rijksmuseum'] })).toBe('full');
        expect(frameOf({ kind: 'scene', sceneId: 'h', svg: '<svg/>' })).toBe('full');
        expect(frameOf({ kind: 'scene', sceneId: 'd', code: 'export default () => ({})' })).toBe('full');
    });

    it('gives no frame to no visual, or to a still, which draws nothing in a Live reading: the eye stays', () => {
        expect(frameOf(null)).toBe(null);
        expect(frameOf(undefined)).toBe(null);
        expect(frameOf({ kind: 'still' })).toBe(null);
    });

    it('gives a kind it does not name the whole room, so nothing is cropped', () => {
        expect(frameOf({ kind: 'procedural', collections: ['something-new'] })).toBe('full');
        expect(frameOf({ kind: 'video' })).toBe('full');
    });
});

describe('a cut is one blink of the open aperture', () => {
    it('shuts over 220 ms (smoothstep), holds 70 ms, opens over 360 ms, and is over', () => {
        expect(CUT_MS).toEqual({ close: 220, hold: 70, open: 360 });
        expect(cutAmount(0)).toBe(0);
        expect(cutAmount(110)).toBeCloseTo(0.5, 6);
        expect(cutAmount(220)).toBe(1);
        expect(cutAmount(289)).toBe(1);
        expect(cutAmount(290 + 180)).toBeCloseTo(0.5, 6);
        expect(cutAmount(650)).toBe(null);
    });
});

describe('the room’s frame, on the venue’s clock', () => {
    it('opens a frame from the eye over its own time: 1100, 1600 and 1900 ms', () => {
        expect(FRAME_OPEN_MS).toEqual({ inner: 1100, shell: 1600, full: 1900 });
        for (const [frame, ms] of Object.entries(FRAME_OPEN_MS)) {
            const director = createFrameDirector();
            expect(director.at(0)).toEqual({ frame: 'none', a: 0, cut: 0 });
            director.see(frame, 1000);
            expect(director.at(1000)).toEqual({ frame, a: 0, cut: 0 });
            expect(director.at(1000 + ms / 2).a).toBeCloseTo(0.5, 6);
            expect(director.at(1000 + ms)).toEqual({ frame, a: 1, cut: 0 });
            expect(director.at(1000 + ms * 3)).toEqual({ frame, a: 1, cut: 0 });
        }
    });

    it('changes the visual within the same frame by one blink of the open aperture', () => {
        const director = createFrameDirector();
        director.see('shell', 0);
        director.at(2000);
        director.see('shell', 2000);
        expect(director.at(2110).cut).toBeCloseTo(0.5, 6);
        expect(director.at(2250)).toEqual({ frame: 'shell', a: 1, cut: 1 });
        expect(director.at(2700)).toEqual({ frame: 'shell', a: 1, cut: 0 });
    });

    it('changes frame by shutting the aperture, closing the frame, and opening the next', () => {
        const director = createFrameDirector();
        director.see('shell', 0);
        director.at(1600);
        director.see('full', 2000);
        // Shut at once, and kept shut while the shell closes over its own time.
        expect(director.at(2220)).toMatchObject({ frame: 'shell', cut: 1 });
        expect(director.at(2800)).toMatchObject({ frame: 'shell', a: 0.5, cut: 1 });
        // Closed: the full frame opens, its aperture no longer shut.
        expect(director.at(3600)).toEqual({ frame: 'full', a: 0, cut: 0 });
        expect(director.at(3600 + 950).a).toBeCloseTo(0.5, 6);
        expect(director.at(3600 + 1900)).toEqual({ frame: 'full', a: 1, cut: 0 });
    });

    it('closes to the eye when there is no visual, and takes the newest visual asked for while closing', () => {
        const director = createFrameDirector();
        director.see('inner', 0);
        director.at(1100);
        director.see(null, 1100);
        expect(director.at(1650)).toMatchObject({ frame: 'inner', a: 0.5 });
        expect(director.at(2200)).toEqual({ frame: 'none', a: 0, cut: 0 });
        director.see('inner', 3000);
        expect(director.at(3550).a).toBeCloseTo(0.5, 6);
        director.see('full', 3550);
        director.see('shell', 3600);
        expect(director.at(3800)).toMatchObject({ frame: 'inner', cut: 1 });
        expect(director.at(4200)).toMatchObject({ frame: 'shell', cut: 0 });
    });

    it('under reduced motion changes every frame at once, and never blinks', () => {
        const director = createFrameDirector({ reduced: true });
        director.see('shell', 0);
        expect(director.at(0)).toEqual({ frame: 'shell', a: 1, cut: 0 });
        director.see('shell', 10);
        expect(director.at(120)).toEqual({ frame: 'shell', a: 1, cut: 0 });
        director.see('full', 200);
        expect(director.at(200)).toEqual({ frame: 'full', a: 1, cut: 0 });
        director.see(null, 300);
        expect(director.at(300)).toEqual({ frame: 'none', a: 0, cut: 0 });
    });
});

describe('the room’s layout', () => {
    it('gives the face its square between the ask bar and the words, and the dock at the bar’s left end', () => {
        expect(layout.big).toEqual({ x: 720, y: 82 + (678 - 82) / 2, s: 678 - 82 });
        expect(layout.dock).toEqual({ x: 592 - 8 - 24, y: 43, s: 48 * 1.15 });
        expect(layout.wordsTop).toBe(690);
        expect(layout.far).toBeCloseTo(Math.hypot(720, 900 - layout.big.y), 6);
    });

    it('is narrower than the room on a phone, never smaller than 80 px', () => {
        const phone = roomLayout({ width: 390, height: 844, bar: { left: 67, top: 16, width: 256, height: 54 }, wordsTop: 650 });
        expect(phone.big.s).toBe(390 - 32);
        expect(roomLayout({ width: 300, height: 200, bar: null, wordsTop: 60 }).big.s).toBe(80);
    });
});

describe('one geometry: the aperture at its phase boundaries', () => {
    const c = layout.big;

    it('is the eye at rest with no frame, free to blink', () => {
        const g = frameGeometry({ frame: 'none', a: 0, cut: 0, layout });
        expect(g).toMatchObject({ frame: 'none', face: c, small: 0, dim: 1, spread: 1, travel: 0, eyeClosed: 0, blink: true, aperture: null, wipe: null, crown: null });
    });

    it('inner eye: the iris folds shut by 0.25, the shutter dilates to 0.36 by 0.6, the blades are drawn back by 1', () => {
        const at = a => frameGeometry({ frame: 'inner', a, cut: 0, layout });
        expect(at(0)).toMatchObject({ eyeClosed: 0, blink: true, aperture: null, dim: 1, spread: 1 });
        expect(at(0.125).eyeClosed).toBeCloseTo(0.5, 6);
        expect(at(0.25)).toMatchObject({ eyeClosed: 1, blink: false, aperture: null });
        const dilating = at(0.425).aperture;
        expect(dilating.r).toBeCloseTo((c.s * 0.0995 + c.s * 0.36) / 2, 6);
        expect(dilating.hole).toBe(0);
        const dilated = at(0.6).aperture;
        expect(dilated).toMatchObject({ x: c.x, y: c.y, hole: 0, open: 0 });
        expect(dilated.r).toBeCloseTo(c.s * 0.36, 9);
        const open = at(1);
        expect(open.aperture).toMatchObject({ x: c.x, y: c.y, hole: 1, open: 1, settle: 1, fade: 1, petals: 0 });
        expect(open.aperture.r).toBeCloseTo(c.s * 0.36, 9);
        expect(open.aperture.ring).toBeCloseTo(0.5, 9);
        // The face around it, dimmed to 45% and drawn 12% outward; the petals a fine crown at the aperture's edge.
        expect(open.dim).toBeCloseTo(0.45, 9);
        expect(open.spread).toBeCloseTo(1.12, 9);
        expect(open.crown).toMatchObject({ x: c.x, y: c.y, alpha: 1, layers: 2 });
        expect(at(0.8).aperture.hole).toBeCloseTo(0.5, 6);
        expect(at(0.8).aperture.settle).toBeCloseTo(0.96, 6);
    });

    it('outer shell: fold by 0.1, shrink by 0.4, travel 0.15 to 0.75, dilate to 0.41 by 0.7, open by 1', () => {
        const at = a => frameGeometry({ frame: 'shell', a, cut: 0, layout });
        expect(at(0.1)).toMatchObject({ eyeClosed: 1, aperture: null, travel: 0 });
        expect(at(0.15).travel).toBe(0);
        expect(at(0.45).travel).toBeCloseTo(0.5, 6);
        expect(at(0.75).travel).toBe(1);
        expect(at(0.4).aperture.r).toBeCloseTo(c.s * 0.0995 * 0.3, 9);
        expect(at(0.7).aperture).toMatchObject({ hole: 0, open: 0 });
        expect(at(0.7).aperture.r).toBeCloseTo(c.s * 0.41, 9);
        expect(at(0.85).aperture.hole).toBeCloseTo(0.5, 6);
        const open = at(1);
        expect(open.aperture).toMatchObject({ x: c.x, y: c.y, hole: 1, settle: 1 });
        expect(open.aperture.r).toBeCloseTo(c.s * 0.41, 9);
        expect(open.aperture.ring).toBeCloseTo(0.45, 9);
        // The face is not dimmed: it has become the frame. Its crown: three layers at 0.41.
        expect(open).toMatchObject({ dim: 1, spread: 1, travel: 1 });
        expect(open.crown).toMatchObject({ x: c.x, y: c.y, alpha: 1, layers: 3 });
        expect(open.crown.r).toBeCloseTo(c.s * 0.41, 9);
    });

    it('full frame: close by 0.15, travel to the dock 0.1 to 0.55, reopen 0.5 to 0.65, the wipe 0.2 to 1 past every corner', () => {
        const at = a => frameGeometry({ frame: 'full', a, cut: 0, layout });
        const near = (face, place) => ['x', 'y', 's'].forEach(key => expect(face[key]).toBeCloseTo(place[key], 9));
        expect(at(0.1)).toMatchObject({ small: 0, face: c });
        expect(at(0.15)).toMatchObject({ eyeClosed: 1, wipe: null });
        expect(at(0.55).small).toBe(1);
        near(at(0.55).face, layout.dock);
        expect(at(0.5).eyeClosed).toBe(1);
        expect(at(0.65).eyeClosed).toBe(0);
        expect(at(0.6).wipe.hole).toBeCloseTo(0.5, 6);
        const open = at(1);
        expect(open).toMatchObject({ small: 1, eyeClosed: 0, blink: true });
        near(open.face, layout.dock);
        expect(open.wipe).toMatchObject({ x: c.x, y: c.y, hole: 1, fade: 1, ring: 0, turn: 1.2, scrimTop: 690 - 30 });
        // Past every corner: the nine-gon's inscribed circle reaches beyond the farthest one.
        expect(open.wipe.r * Math.cos(Math.PI / 9)).toBeGreaterThan(layout.far);
    });

    it('a cut shuts the open aperture whatever the frame', () => {
        expect(frameGeometry({ frame: 'inner', a: 1, cut: 1, layout }).aperture.hole).toBe(0);
        expect(frameGeometry({ frame: 'shell', a: 1, cut: 0.5, layout }).aperture.hole).toBeCloseTo(0.5, 9);
        expect(frameGeometry({ frame: 'full', a: 1, cut: 1, layout }).wipe).toBe(null);
    });

    it('scales the visual so the circle inscribed in its own square is the aperture, settling from 92% to 100%', () => {
        const open = frameGeometry({ frame: 'shell', a: 1, cut: 0, layout });
        const t = visualTransform(open, { width: W, height: H });
        expect(t.k * Math.min(W, H) / 2).toBeCloseTo(open.aperture.r, 9);
        expect(t.x).toBeCloseTo(open.aperture.x - W / 2, 9);
        expect(t.y).toBeCloseTo(open.aperture.y - H / 2, 9);
        const opening = frameGeometry({ frame: 'inner', a: 0.6, cut: 0, layout });
        expect(visualTransform(opening, { width: W, height: H }).k * Math.min(W, H) / 2).toBeCloseTo(opening.aperture.r * 0.92, 9);
        // Before the shutter has dilated, the visual is already where it will open, at 92%.
        const folding = frameGeometry({ frame: 'inner', a: 0.1, cut: 0, layout });
        expect(visualTransform(folding, { width: W, height: H }).k * Math.min(W, H) / 2).toBeCloseTo(c.s * 0.36 * 0.92, 9);
    });

    it('leaves the visual whole and unmoved in the full frame and with no frame', () => {
        expect(visualTransform(frameGeometry({ frame: 'full', a: 0.5, cut: 0, layout }), { width: W, height: H })).toEqual({ x: 0, y: 0, k: 1 });
        expect(visualTransform(frameGeometry({ frame: 'none', a: 0, cut: 0, layout }), { width: W, height: H })).toEqual({ x: 0, y: 0, k: 1 });
    });

    it('is the same numbers wherever it is asked for: one function, no state', () => {
        const once = frameGeometry({ frame: 'shell', a: 0.83, cut: 0.2, layout });
        expect(frameGeometry({ frame: 'shell', a: 0.83, cut: 0.2, layout })).toEqual(once);
        expect(JSON.parse(JSON.stringify(once))).toEqual(once);
    });

    it('eases each phase by smoothstep', () => {
        const g = frameGeometry({ frame: 'inner', a: 0.7, cut: 0, layout });
        expect(g.aperture.open).toBeCloseTo(smooth(0.25), 9);
    });
});
