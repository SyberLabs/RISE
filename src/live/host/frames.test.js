/**
 * The three frames (docs/plans/LIVE-CURRENT.md §23): which frame a visual takes, how the room's frame moves from one
 * to the next on the venue's clock, and the one geometry everything that draws or masks reads.
 */
import { describe, expect, it } from 'vitest';
import {
    CUT_MS, FRAME_ENTRY, FRAME_FOLD, FRAME_OF, FRAME_OPEN_MS, FRAME_SEED, FRAME_TOP, createFrameDirector, cutAmount, frameGeometry, frameOf, holdsContent, hungPicture, hungRect, restScale, roomLayout, visualOf, visualTransform
} from './frames.js';

const W = 1440;
const H = 900;
// 1440 by 900: the stage's instrument from 820 (16 px in, a 44 px row, a 16 px beat line), the open bar 576 px wide.
const layout = roomLayout({ width: W, height: H, instrumentTop: 820, bar: { left: 432, width: 576, height: 54 } });
const smooth = u => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

describe('the visual chooses the frame', () => {
    it('keeps the table in one place, keyed by engine and scene kind', () => {
        expect(FRAME_OF).toEqual({
            attractor: 'shell', 'living-flame': 'shell', turrell: 'shell',
            harmonograph: 'inner', ostensoria: 'inner', apparitio: 'inner',
            genesis: 'full', fractal: 'full', neural: 'full', rockgarden: 'full', 'night-streaks': 'full', sourced: 'full', figure: 'full', scene: 'full'
        });
    });

    it('gives the attractor the whole room when night streaks run under it, and still names the visual the attractor', () => {
        const night = { kind: 'field', renderer: 'attractor', config: { streaks: true } };
        expect(frameOf(night)).toBe('full');
        expect(visualOf(night)).toBe('attractor');
        expect(frameOf({ kind: 'field', renderer: 'attractor', config: { streaks: false } })).toBe('shell');
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

    it('knows a picture with content of its own (a figure, a generated scene) from a field, a texture or an image', () => {
        expect(holdsContent({ kind: 'scene', sceneId: 'h', svg: '<svg/>' })).toBe(true);
        expect(holdsContent({ kind: 'scene', sceneId: 'd', code: 'export default () => ({})' })).toBe(true);
        expect(holdsContent({ kind: 'field', renderer: 'genesis', config: {} })).toBe(false);
        expect(holdsContent({ kind: 'procedural', collections: ['fractal'] })).toBe(false);
        expect(holdsContent({ kind: 'sourced', collections: ['rijksmuseum'] })).toBe(false);
        expect(holdsContent({ kind: 'field', renderer: 'attractor', config: {} })).toBe(false);
        expect(holdsContent(null)).toBe(false);
    });

    it('hangs a collection image as a picture; a figure, a scene, a field or a pattern is not hung', () => {
        expect(hungPicture({ kind: 'sourced', collections: ['sci-astronomy'] })).toBe(true);
        expect(hungPicture({ kind: 'scene', sceneId: 'h', svg: '<svg/>' })).toBe(false);
        expect(hungPicture({ kind: 'field', renderer: 'genesis', config: {} })).toBe(false);
        expect(hungPicture({ kind: 'procedural', collections: ['fractal'] })).toBe(false);
        expect(hungPicture({ kind: 'still' })).toBe(false);
        expect(hungPicture(null)).toBe(false);
    });

    it('hangs it in the safe rectangle, centred, at most square on a tall screen and at most 3:2 on a wide one', () => {
        const wide = hungRect(layout);
        const { safe } = layout;
        expect(safe.w).toBeGreaterThan(1.5 * safe.h);
        expect(wide).toEqual({ x: safe.x - 0.75 * safe.h, y: safe.y - safe.h / 2, w: 1.5 * safe.h, h: safe.h });
        const phone = roomLayout({ width: 390, height: 844, bar: { left: 70, width: 300, height: 54 } });
        const tall = hungRect(phone);
        expect(phone.safe.h).toBeGreaterThan(phone.safe.w);
        expect(tall.w).toBe(phone.safe.w);
        expect(tall.h).toBe(phone.safe.w);
        expect(tall.x).toBe(16);
        expect(tall.y + tall.h / 2).toBeCloseTo(phone.safe.y, 9);
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
            expect(director.at(0)).toEqual({ frame: 'none', a: 0, cut: 0, lid: 0 });
            director.see(frame, 1000);
            expect(director.at(1000)).toEqual({ frame, a: 0, cut: 0, lid: 0 });
            expect(director.at(1000 + ms / 2).a).toBeCloseTo(0.5, 6);
            expect(director.at(1000 + ms)).toEqual({ frame, a: 1, cut: 0, lid: 0 });
            expect(director.at(1000 + ms * 3)).toEqual({ frame, a: 1, cut: 0, lid: 0 });
        }
    });

    it('changes the visual within the same frame by one blink of the open aperture', () => {
        const director = createFrameDirector();
        director.see('shell', 0);
        director.at(2000);
        director.see('shell', 2000);
        expect(director.at(2110).cut).toBeCloseTo(0.5, 6);
        expect(director.at(2250)).toEqual({ frame: 'shell', a: 1, cut: 1, lid: 0 });
        expect(director.at(2700)).toEqual({ frame: 'shell', a: 1, cut: 0, lid: 0 });
    });

    it('changes frame by shutting the aperture, closing the frame to the shut eye, and opening the next from there', () => {
        const director = createFrameDirector();
        director.see('shell', 0);
        director.at(1600);
        director.see('full', 2000);
        // Shut at once, and kept shut while the shell closes over its own time, as far as the shut eye: the eye is
        // never opened between the two frames.
        expect(director.at(2220)).toMatchObject({ frame: 'shell', cut: 1, lid: 1 });
        expect(director.at(2800)).toMatchObject({ frame: 'shell', a: 0.5, cut: 1, lid: 1 });
        const shut = 2000 + FRAME_OPEN_MS.shell * (1 - FRAME_SEED);
        // At the shell's seed: the full frame opens from where its glide begins, the eye kept shut until it is folded,
        // the shell's band still out around her.
        expect(director.at(shut)).toEqual({ frame: 'full', a: FRAME_ENTRY.full, cut: 0, lid: 1, carry: 'shell' });
        expect(director.at(shut + FRAME_OPEN_MS.full * (FRAME_FOLD.full - FRAME_ENTRY.full) + 1).lid).toBe(0);
        expect(director.at(shut + FRAME_OPEN_MS.full * (1 - FRAME_ENTRY.full))).toEqual({ frame: 'full', a: 1, cut: 0, lid: 0, carry: 'shell' });
    });

    it('closes the full frame from where its room is wholly open: what is past every corner is not waited for', () => {
        const director = createFrameDirector();
        director.see('full', 0);
        director.at(1900);
        director.see(null, 2000);
        expect(director.at(2000).a).toBeCloseTo(FRAME_TOP.full, 9);
        expect(director.at(2000 + FRAME_OPEN_MS.full * FRAME_TOP.full)).toEqual({ frame: 'none', a: 0, cut: 0, lid: 0 });
        // What is skipped is not seen: from the top to 1 only the wipe moves, past every corner of the room.
        const top = frameGeometry({ frame: 'full', a: FRAME_TOP.full, cut: 0, layout });
        for (const a of [0.75, 0.85, 1]) {
            const g = frameGeometry({ frame: 'full', a, cut: 0, layout });
            expect({ ...g, wipe: null, blink: false }).toEqual({ ...top, wipe: null });
            expect(g.wipe.hole * 1.08).toBeGreaterThanOrEqual(1);
        }
        expect(top.wipe.hole * 1.08).toBeGreaterThanOrEqual(1);
    });

    it('lifts the shut eye when the room goes back to the eye in the middle of a change of frame', () => {
        const director = createFrameDirector();
        director.see('inner', 0);
        director.at(1100);
        director.see('full', 2000);
        director.at(2500);
        director.see(null, 2500);
        const seen = [];
        for (let now = 2500; now <= 5000; now += 5) {
            const { frame, a, cut, lid } = director.at(now);
            seen.push(frameGeometry({ frame, a, cut, lid, layout }).eyeClosed);
        }
        // Shut until it reaches the eye, then open, and never shut again.
        const opened = seen.findIndex(value => value < 1);
        expect(opened).toBeGreaterThan(0);
        for (let i = opened + 1; i < seen.length; i += 1) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] + 1e-12);
        expect(seen.at(-1)).toBe(0);
        expect(director.settled(5000)).toBe(true);
    });

    it('says when the room has come to rest on the visual it was last shown: open, no cut running, nothing pending', () => {
        const director = createFrameDirector();
        expect(director.settled(0)).toBe(true);
        director.see('shell', 0);
        director.at(800);
        expect(director.settled(800)).toBe(false);
        director.at(1600);
        expect(director.settled(1600)).toBe(true);
        // Another visual in the same frame: not at rest until its blink has run.
        director.see('shell', 2000);
        director.at(2300);
        expect(director.settled(2300)).toBe(false);
        director.at(2000 + 650);
        expect(director.settled(2650)).toBe(true);
        // Another frame: not at rest while the shell closes or the full frame opens.
        director.see('full', 3000);
        director.at(3800);
        expect(director.settled(3800)).toBe(false);
        const shut = 3000 + FRAME_OPEN_MS.shell * (1 - FRAME_SEED);
        const open = shut + FRAME_OPEN_MS.full * (1 - FRAME_ENTRY.full);
        director.at(shut);
        director.at(open - 100);
        expect(director.settled(open - 100)).toBe(false);
        director.at(open);
        expect(director.settled(open)).toBe(true);
        // Under reduced motion every change is at rest at once.
        const still = createFrameDirector({ reduced: true });
        still.see('shell', 0);
        still.see('full', 10);
        still.at(10);
        expect(still.settled(10)).toBe(true);
    });

    it('closes to the eye when there is no visual, and takes the newest visual asked for while closing', () => {
        const director = createFrameDirector();
        director.see('inner', 0);
        director.at(1100);
        director.see(null, 1100);
        expect(director.at(1650)).toMatchObject({ frame: 'inner', a: 0.5 });
        expect(director.at(2200)).toEqual({ frame: 'none', a: 0, cut: 0, lid: 0 });
        director.see('inner', 3000);
        expect(director.at(3550).a).toBeCloseTo(0.5, 6);
        director.see('full', 3550);
        director.see('shell', 3600);
        expect(director.at(3800)).toMatchObject({ frame: 'inner', cut: 1 });
        const shut = 3550 + FRAME_OPEN_MS.inner * (0.5 - FRAME_ENTRY.inner);
        const entered = director.at(shut + 1);
        expect(entered).toMatchObject({ frame: 'shell', cut: 0 });
        expect(frameGeometry({ ...entered, layout }).eyeClosed).toBe(1);
    });

    it('under reduced motion changes every frame at once, and never blinks', () => {
        const director = createFrameDirector({ reduced: true });
        director.see('shell', 0);
        expect(director.at(0)).toEqual({ frame: 'shell', a: 1, cut: 0, lid: 0 });
        director.see('shell', 10);
        expect(director.at(120)).toEqual({ frame: 'shell', a: 1, cut: 0, lid: 0 });
        director.see('full', 200);
        expect(director.at(200)).toEqual({ frame: 'full', a: 1, cut: 0, lid: 0 });
        director.see('inner', 250);
        expect(director.at(250)).toEqual({ frame: 'inner', a: 1, cut: 0, lid: 0 });
        director.see(null, 300);
        expect(director.at(300)).toEqual({ frame: 'none', a: 0, cut: 0, lid: 0 });
    });
});

describe('the room’s layout', () => {
    it('stacks the room from its foot: the instrument, the ask bar 8 px above it, a line for the bar’s note, the words, the face’s square', () => {
        expect(layout).toMatchObject({ barTop: 758, barFoot: 88, wordsFoot: 900 - 758 + 32, wordsSize: 34 });
        expect(layout.wordsTop).toBeCloseTo(900 - 174 - 2 * 1.4 * 34, 9);
        // The bar is wholly above the instrument, the words' zone wholly above the bar and its note.
        expect(H - layout.barFoot).toBeLessThanOrEqual(820 - 8);
        expect(H - layout.wordsFoot).toBeLessThanOrEqual(layout.barTop - 26);
        const bottom = layout.wordsTop - 12;
        expect(layout.big).toEqual({ x: 720, y: 16 + (bottom - 16) / 2, s: bottom - 16 });
        expect(layout.far).toBeCloseTo(Math.hypot(720, 900 - layout.big.y), 6);
    });

    it('docks the face at the bar’s left end, centred on the bar, wherever the bar is', () => {
        expect(layout.dock).toEqual({ x: 432 - 8 - 24, y: 758 + 27, s: 48 * 1.15 });
        expect(432 - layout.dock.x).toBeLessThan(40);
        expect(layout.dock.x + 24).toBeLessThanOrEqual(432);
    });

    it('on a phone, 390 by 844: the same stack, the square narrower than the room, the docked face on screen', () => {
        // The instrument's 36 px row from 776; in the full frame the open bar steps right to x 72 to give the dock room.
        const phone = roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: { left: 72, width: 302, height: 54 } });
        expect(phone).toMatchObject({ barTop: 714, barFoot: 76, wordsFoot: 844 - 714 + 32, wordsSize: 26 });
        expect(phone.big.s).toBe(390 - 32);
        expect(phone.big.y + phone.big.s / 2).toBeLessThanOrEqual(phone.wordsTop - 12 + 1e-9);
        expect(phone.dock).toEqual({ x: 40, y: 714 + 27, s: 48 * 1.15 });
        expect(phone.dock.x - phone.dock.s / 2).toBeGreaterThanOrEqual(0);
        expect(roomLayout({ width: 300, height: 200, instrumentTop: 140, bar: null }).big.s).toBe(80);
    });

    it('lifts the bar above an on-screen keyboard, the words above it, and lets it down when the keyboard goes', () => {
        const typing = roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: { left: 67, width: 256, height: 54 }, keyboard: 336 });
        expect(typing).toMatchObject({ barFoot: 336 + 8, barTop: 844 - 344 - 54 });
        expect(844 - typing.wordsFoot).toBe(typing.barTop - 32);
        expect(typing.big.y + typing.big.s / 2).toBeLessThanOrEqual(typing.wordsTop - 12 + 1e-9);
        // A keyboard lower than the bar's own place moves nothing.
        expect(roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: null, keyboard: 40 }).barFoot).toBe(76);
    });

    it('gives a bar note longer than a line its room, so it never meets the words', () => {
        const noted = roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: null, note: 38 });
        expect(844 - noted.wordsFoot).toBe(noted.barTop - 6 - 38 - 6);
        expect(roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: null, note: 19 }).wordsFoot).toBe(844 - 714 + 32);
    });

    it('without a bar on screen, keeps the bar’s place, so nothing moves when it comes', () => {
        const bare = roomLayout({ width: W, height: H, instrumentTop: 820, bar: null });
        expect(bare).toMatchObject({ barTop: 758, barFoot: 88, wordsFoot: layout.wordsFoot, big: layout.big });
        expect(bare.dock).toEqual({ x: 16 + 24, y: 785, s: 48 * 1.15 });
    });
});

describe('one geometry: the aperture at its phase boundaries', () => {
    const c = layout.big;

    it('is the eye at rest with no frame, free to blink', () => {
        const g = frameGeometry({ frame: 'none', a: 0, cut: 0, layout });
        expect(g).toMatchObject({ frame: 'none', face: c, small: 0, dim: 1, spread: 1, travel: 0, eyeClosed: 0, blink: true, aperture: null, wipe: null, crown: null });
    });

    it('inner eye: the iris folds shut by 0.25, then dilates to 0.36 by 0.7, the blades drawn back from 0.55 to 1', () => {
        const at = a => frameGeometry({ frame: 'inner', a, cut: 0, layout });
        expect(at(0)).toMatchObject({ eyeClosed: 0, blink: true, aperture: null, dim: 1, spread: 1 });
        expect(at(0.125).eyeClosed).toBeCloseTo(0.5, 6);
        // Folded, and nothing else moved yet: the face dims and spreads as the shutter dilates, not before.
        expect(at(0.25)).toMatchObject({ eyeClosed: 1, blink: false, aperture: null, dim: 1, spread: 1 });
        const dilating = at(0.475).aperture;
        expect(dilating.r).toBeCloseTo((c.s * 0.0995 + c.s * 0.36) / 2, 6);
        expect(dilating.hole).toBe(0);
        expect(at(0.55).aperture.hole).toBe(0);
        expect(at(0.7).aperture.r).toBeCloseTo(c.s * 0.36, 9);
        const open = at(1);
        expect(open.aperture).toMatchObject({ x: c.x, y: c.y, hole: 1, open: 1, settle: 1, fade: 1, petals: 0 });
        expect(open.aperture.r).toBeCloseTo(c.s * 0.36, 9);
        expect(open.aperture.ring).toBeCloseTo(0.5, 9);
        // The face around it, dimmed to 45% and drawn 12% outward; the petals a fine crown at the aperture's edge.
        expect(open.dim).toBeCloseTo(0.45, 9);
        expect(open.spread).toBeCloseTo(1.12, 9);
        expect(open.crown).toMatchObject({ x: c.x, y: c.y, alpha: 1, layers: 2 });
        expect(at(0.775).aperture.hole).toBeCloseTo(0.5, 6);
        expect(at(0.775).aperture.settle).toBeCloseTo(0.96, 6);
    });

    it('outer shell: fold by 0.1, the eye drawn in 0.1 to 0.4, travel 0.15 to 0.75, dilate to 0.41 0.36 to 0.78, open 0.66 to 1', () => {
        const at = a => frameGeometry({ frame: 'shell', a, cut: 0, layout });
        expect(at(0.1)).toMatchObject({ eyeClosed: 1, aperture: null, travel: 0 });
        expect(at(0.15).travel).toBe(0);
        expect(at(0.45).travel).toBeCloseTo(0.5, 6);
        expect(at(0.75).travel).toBe(1);
        // The eye draws in to under a third of itself and turns outward again without stopping.
        const radii = Array.from({ length: 61 }, (_, i) => at(0.1 + i * 0.005).aperture?.r ?? c.s * 0.0995);
        expect(Math.min(...radii)).toBeLessThan(c.s * 0.0995 * 0.4);
        expect(at(0.66).aperture.hole).toBe(0);
        expect(at(0.78).aperture.r).toBeCloseTo(c.s * 0.41, 9);
        expect(at(0.83).aperture.hole).toBeCloseTo(0.5, 6);
        const open = at(1);
        expect(open.aperture).toMatchObject({ x: c.x, y: c.y, hole: 1, settle: 1 });
        expect(open.aperture.r).toBeCloseTo(c.s * 0.41, 9);
        expect(open.aperture.ring).toBeCloseTo(0.45, 9);
        // The face is not dimmed: it has become the frame. Its crown: three layers at 0.41.
        expect(open).toMatchObject({ dim: 1, spread: 1, travel: 1 });
        expect(open.crown).toMatchObject({ x: c.x, y: c.y, alpha: 1, layers: 3 });
        expect(open.crown.r).toBeCloseTo(c.s * 0.41, 9);
    });

    it('full frame: the eye shuts by 0.12 as the glide begins at 0.05, arrives at the dock by 0.6, reopens 0.5 to 0.72, the wipe past every corner by then', () => {
        const at = a => frameGeometry({ frame: 'full', a, cut: 0, layout });
        const near = (face, place) => ['x', 'y', 's'].forEach(key => expect(face[key]).toBeCloseTo(place[key], 9));
        expect(at(0.05)).toMatchObject({ small: 0, face: c, wipe: null });
        expect(at(0.05).eyeClosed).toBeGreaterThan(0.2);
        expect(at(0.05).eyeClosed).toBeLessThan(0.6);
        expect(at(0.12).eyeClosed).toBe(1);
        expect(at(0.12).face.y).toBeGreaterThan(c.y);
        expect(at(0.5).eyeClosed).toBe(1);
        expect(at(0.56).small).toBe(1);
        near(at(0.6).face, layout.dock);
        expect(at(0.72).eyeClosed).toBe(0);
        expect(at(FRAME_TOP.full).wipe.hole * 1.08).toBeGreaterThanOrEqual(1);
        const open = at(1);
        expect(open).toMatchObject({ small: 1, eyeClosed: 0, blink: true });
        near(open.face, layout.dock);
        expect(open.wipe).toMatchObject({ x: c.x, y: c.y, hole: 1, fade: 1, ring: 0, turn: 1.2, scrimTop: layout.wordsTop - 30 });
        // Past every corner: the nine-gon's inscribed circle reaches beyond the farthest one.
        expect(open.wipe.r * Math.cos(Math.PI / 9)).toBeGreaterThan(layout.far);
    });

    it('a cut shuts the open aperture whatever the frame', () => {
        expect(frameGeometry({ frame: 'inner', a: 1, cut: 1, layout }).aperture.hole).toBe(0);
        expect(frameGeometry({ frame: 'shell', a: 1, cut: 0.5, layout }).aperture.hole).toBeCloseTo(0.5, 9);
        expect(frameGeometry({ frame: 'full', a: 1, cut: 1, layout }).wipe).toBe(null);
    });

    it('scales the visual so the circle inscribed in its own square is the aperture once open, settling from 92% to 100%', () => {
        const open = frameGeometry({ frame: 'shell', a: 1, cut: 0, layout });
        const t = visualTransform(open, { width: W, height: H });
        expect(t.k * Math.min(W, H) / 2).toBeCloseTo(open.aperture.r, 9);
        expect(t.x).toBeCloseTo(open.aperture.x - W / 2, 9);
        expect(t.y).toBeCloseTo(open.aperture.y - H / 2, 9);
        const opening = frameGeometry({ frame: 'inner', a: 0.775, cut: 0, layout });
        expect(visualTransform(opening, { width: W, height: H }).k * Math.min(W, H) / 2).toBeCloseTo(c.s * 0.36 * 0.96, 9);
        // Before the blades draw back, the visual already waits where it will open, at 92%: it is never seen smaller.
        for (const a of [0.1, 0.3, 0.5]) {
            const shut = frameGeometry({ frame: 'inner', a, cut: 0, layout });
            expect(visualTransform(shut, { width: W, height: H }).k * Math.min(W, H) / 2).toBeCloseTo(c.s * 0.36 * 0.92, 9);
        }
    });

    it('declares the scale a circle frame shows its visual at once open, so the visual is drawn at that size; 1 elsewhere', () => {
        for (const frame of ['inner', 'shell']) {
            const open = frameGeometry({ frame, a: 1, cut: 0, layout });
            expect(restScale(frame, layout)).toBeCloseTo(visualTransform(open, { width: W, height: H }).k, 12);
        }
        expect(restScale('shell', layout)).toBeLessThan(1);
        expect(restScale('full', layout)).toBe(1);
        expect(restScale(null, layout)).toBe(1);
    });

    it('leaves a field, a texture or an image whole and unmoved in the full frame, and any visual with no frame', () => {
        expect(visualTransform(frameGeometry({ frame: 'full', a: 0.5, cut: 0, layout }), { width: W, height: H })).toEqual({ x: 0, y: 0, k: 1 });
        expect(visualTransform(frameGeometry({ frame: 'full', a: 1, cut: 0, layout, content: false }), { width: W, height: H })).toEqual({ x: 0, y: 0, k: 1 });
        expect(frameGeometry({ frame: 'full', a: 1, cut: 0, layout, content: false }).fit).toBe(null);
        expect(visualTransform(frameGeometry({ frame: 'none', a: 0, cut: 0, layout, content: true }), { width: W, height: H })).toEqual({ x: 0, y: 0, k: 1 });
    });

    /** The room's own box after the transform: where every visual layer the size of the room is drawn. */
    const placed = (t, width, height) => ({
        left: width / 2 + t.x - (width * t.k) / 2, right: width / 2 + t.x + (width * t.k) / 2,
        top: height / 2 + t.y - (height * t.k) / 2, bottom: height / 2 + t.y + (height * t.k) / 2
    });

    it('fits a figure or a generated scene in the full frame into the safe rectangle, between the bar and the words, aspect kept', () => {
        // 1440 by 900: from 12 px below the corner's sign-in link (10 px down, 44 px tall) to 12 px above the words' zone,
        // which is above the bar and the docked face.
        const g = frameGeometry({ frame: 'full', a: 1, cut: 0, layout, content: true });
        expect(layout.safe).toMatchObject({ x: 720, w: W - 32 });
        expect(layout.safe.y - layout.safe.h / 2).toBeCloseTo(66, 9);
        expect(layout.safe.y + layout.safe.h / 2).toBeCloseTo(layout.wordsTop - 12, 9);
        expect(layout.safe.y + layout.safe.h / 2).toBeLessThan(layout.dock.y - layout.dock.s / 2);
        const t = visualTransform(g, { width: W, height: H });
        expect(t.k).toBeCloseTo(Math.min((W - 32) / W, layout.safe.h / H), 9);
        const box = placed(t, W, H);
        expect(box.top).toBeCloseTo(layout.safe.y - layout.safe.h / 2, 6);
        expect(box.bottom).toBeCloseTo(layout.wordsTop - 12, 6);
        expect((box.left + box.right) / 2).toBeCloseTo(W / 2, 9);
        expect(box.left).toBeGreaterThanOrEqual(16);
        // The same fit while the frame opens, so the visual waits where it will be seen.
        expect(visualTransform(frameGeometry({ frame: 'full', a: 0.3, cut: 0.5, layout, content: true }), { width: W, height: H })).toEqual(t);

        // A phone, 390 by 844: the width binds no more than the height does.
        const phone = roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: { left: 72, width: 302, height: 54 } });
        const p = visualTransform(frameGeometry({ frame: 'full', a: 1, cut: 0, layout: phone, content: true }), { width: 390, height: 844 });
        expect(p.k).toBeCloseTo(Math.min(358 / 390, phone.safe.h / 844), 9);
        const small = placed(p, 390, 844);
        expect(small.top).toBeGreaterThanOrEqual(66 - 1e-9);
        expect(small.bottom).toBeLessThanOrEqual(phone.wordsTop - 12 + 1e-9);
        expect(small.bottom).toBeLessThan(phone.barTop);
        expect(small.left).toBeGreaterThanOrEqual(16);
        expect(small.right).toBeLessThanOrEqual(390 - 16);
    });

    it('is the same numbers wherever it is asked for: one function, no state', () => {
        const once = frameGeometry({ frame: 'shell', a: 0.83, cut: 0.2, layout });
        expect(frameGeometry({ frame: 'shell', a: 0.83, cut: 0.2, layout })).toEqual(once);
        expect(JSON.parse(JSON.stringify(once))).toEqual(once);
    });

    it('eases each phase from rest to rest', () => {
        const g = frameGeometry({ frame: 'inner', a: 0.6625, cut: 0, layout });
        expect(g.aperture.open).toBeCloseTo(smooth(0.25), 9);
    });
});

/**
 * Every number the face draws and the visual is moved by, as one list, an absent aperture or wipe read as the shut
 * one it becomes, so a motion can be followed through the moment one appears.
 */
function sampled(g, room) {
    const ap = g.aperture ?? { r: g.eye.r, hole: 0, open: 0, turn: 0, ring: 0, petals: 1, fade: 0, settle: 0.92 };
    // The eye as the face draws it: the aperture's own radius while there is one; in the full frame, between its size
    // as she sets off (a share of her face, `seed` of the eye at rest) and 0.28 of her face at the dock.
    const eyeR = g.aperture ? g.aperture.r : g.frame === 'full' ? g.face.s * (0.0995 * (g.seed ?? 1) * (1 - g.small) + 0.28 * g.small) : g.eye.r;
    const wipe = g.wipe ?? { r: 0, hole: 0, turn: 0, fade: 0, ring: 0.5 };
    const t = visualTransform(g, room);
    return {
        fx: g.face.x, fy: g.face.y, fs: g.face.s, small: g.small, eyeClosed: g.eyeClosed, dim: g.dim, spread: g.spread, travel: g.travel,
        crown: g.crown?.alpha ?? 0, crownR: g.crown?.r ?? ap.r, eyeR,
        r: ap.r, hole: ap.hole, open: ap.open, turn: ap.turn, ring: ap.ring, petals: ap.petals, fade: ap.fade, settle: ap.settle,
        wr: wipe.r, wipeHole: wipe.hole, wipeTurn: wipe.turn, wipeFade: wipe.fade, wipeRing: wipe.ring,
        vx: t.x, vy: t.y, vk: t.k
    };
}

describe('the motion: one continuous gesture, no jump and no sudden change of speed', () => {
    const rooms = {
        desk: { layout, size: { width: W, height: H } },
        phone: { layout: roomLayout({ width: 390, height: 844, instrumentTop: 776, bar: { left: 72, width: 302, height: 54 } }), size: { width: 390, height: 844 } }
    };
    const h = 1e-4;

    it('moves every number continuously in a, with a continuous speed, through every phase boundary', () => {
        for (const [name, room] of Object.entries(rooms)) {
            for (const frame of ['inner', 'shell', 'full']) {
                for (const lid of [0, 1]) {
                    for (const content of [false, true]) {
                        const from = lid ? FRAME_ENTRY[frame] : 0;
                        const at = a => sampled(frameGeometry({ frame, a, cut: 0, lid, layout: room.layout, content }), room.size);
                        const keys = Object.keys(at(0));
                        const span = Object.fromEntries(keys.map(key => [key, 1]));
                        for (let a = from; a <= 1; a += 0.01) for (const key of keys) span[key] = Math.max(span[key], Math.abs(at(a)[key]));
                        let before = at(from);
                        let now = at(from + h);
                        for (let a = from + 2 * h; a <= 1 + 1e-12; a += h) {
                            const next = at(Math.min(1, a));
                            for (const key of keys) {
                                const scale = span[key];
                                const step = Math.abs(next[key] - now[key]) / scale;
                                const bend = Math.abs(next[key] - 2 * now[key] + before[key]) / scale;
                                // A jump moves more than 60 times the whole range per unit of a in one step; a sudden
                                // change of speed bends more than a smoothstep over 4% of a would.
                                if (step > 60 * h || bend > 6 / 0.04 ** 2 * h * h * 1.01) {
                                    throw new Error(`${name} ${frame} lid ${lid} content ${content}: ${key} at a ${a.toFixed(4)} steps ${(step / h).toFixed(1)}/a and bends ${(bend / h / h).toFixed(0)}/a²`);
                                }
                            }
                            before = now;
                            now = next;
                        }
                    }
                }
            }
        }
    });

    it('keeps every open frame at rest where it was, and the eye at rest the eye', () => {
        for (const frame of ['inner', 'shell', 'full']) {
            const open = frameGeometry({ frame, a: 1, cut: 0, lid: 0, layout, content: frame === 'full' });
            expect(frameGeometry({ frame, a: 1, cut: 0, layout, content: frame === 'full' })).toEqual(open);
            // The shell's crown waits at its rim with nothing drawn.
            const shut = frameGeometry({ frame, a: 0, cut: 0, layout });
            expect({ ...shut, crown: shut.crown?.alpha ? shut.crown : null }).toEqual({ ...frameGeometry({ frame: 'none', a: 0, cut: 0, layout }), frame });
        }
        expect(frameGeometry({ frame: 'inner', a: 1, cut: 0, layout })).toMatchObject({
            face: layout.big, small: 0, travel: 0, eyeClosed: 1, blink: false, wipe: null, fit: null
        });
        expect(frameGeometry({ frame: 'full', a: 1, cut: 0, layout, content: true })).toMatchObject({
            face: layout.dock, small: 1, dim: 1, spread: 1, travel: 0, eyeClosed: 0, blink: true, aperture: null, crown: null,
            fit: { x: layout.safe.x, y: layout.safe.y, k: Math.min(layout.safe.w / W, layout.safe.h / H) }
        });
    });

    it('glides to the dock on a gentle arc below the straight line, the shrink on the same curve, done just before she arrives', () => {
        for (const room of Object.values(rooms)) {
            const { big, dock } = room.layout;
            const d = Math.hypot(dock.x - big.x, dock.y - big.y);
            // The unit normal to the straight path, on its lower side.
            let n = { x: -(dock.y - big.y) / d, y: (dock.x - big.x) / d };
            if (n.y < 0) n = { x: -n.x, y: -n.y };
            let bow = 0;
            let shrunk = null;
            for (let a = 0.05; a <= 0.6; a += 0.001) {
                const g = frameGeometry({ frame: 'full', a, cut: 0, layout: room.layout });
                const off = (g.face.x - big.x) * n.x + (g.face.y - big.y) * n.y;
                expect(off).toBeGreaterThanOrEqual(-1e-9);
                bow = Math.max(bow, off);
                // Shrinks as it goes: the size is a share of the way between, on a ratio scale.
                const share = Math.log(g.face.s / big.s) / Math.log(dock.s / big.s);
                const along = ((g.face.x - big.x) * (dock.x - big.x) + (g.face.y - big.y) * (dock.y - big.y)) / (d * d);
                if (along > 0.05 && along < 0.95) expect(Math.abs(share - along)).toBeLessThan(0.2);
                if (shrunk === null && g.small === 1) shrunk = a;
            }
            expect(bow / d).toBeGreaterThan(0.03);
            expect(bow / d).toBeLessThan(0.08);
            expect(shrunk).toBeGreaterThan(0.5);
            expect(shrunk).toBeLessThan(0.6);
        }
    });

    it('opens the room behind her as she leaves: half open by the time she arrives', () => {
        const atDock = frameGeometry({ frame: 'full', a: 0.6, cut: 0, layout });
        expect(atDock.wipe.hole).toBeGreaterThan(0.5);
        // Nothing opens before she has begun to move.
        expect(frameGeometry({ frame: 'full', a: 0.08, cut: 0, layout }).wipe).toBe(null);
    });

    /** Every 4 ms of a change of frame on the director's clock, what is drawn, from the visual chosen to rest. */
    function change(from, to, room = rooms.desk) {
        const director = createFrameDirector();
        director.see(from, 0);
        director.at(5000);
        director.see(to, 5000);
        const seen = [];
        for (let now = 5000; now <= 12000; now += 4) {
            const state = director.at(now);
            seen.push({ now, ...state, g: sampled(frameGeometry({ ...state, layout: room.layout }), room.size) });
            if (director.settled(now)) break;
        }
        return seen;
    }

    it('never opens the eye between two frames: it shuts once and opens once', () => {
        for (const [from, to] of [['inner', 'full'], ['shell', 'full'], ['full', 'inner'], ['full', 'shell'], ['inner', 'shell'], ['shell', 'inner']]) {
            const eye = change(from, to).map(entry => entry.g.eyeClosed);
            const shut = eye.indexOf(1);
            const opens = eye.findIndex((value, i) => i > shut && value < 1);
            for (let i = shut; i < eye.length; i += 1) {
                if (i >= opens && opens >= 0) expect(eye[i], `${from} to ${to}`).toBeLessThanOrEqual(eye[i - 1] + 1e-12);
                else expect(eye[i], `${from} to ${to}`).toBe(1);
            }
        }
    });

    it('never stands still in the middle of a change of frame', () => {
        for (const [from, to] of [['inner', 'full'], ['shell', 'full'], ['full', 'inner'], ['full', 'shell'], ['inner', 'shell'], ['shell', 'inner']]) {
            const seen = change(from, to);
            const visible = ['fx', 'fy', 'fs', 'eyeClosed', 'dim', 'spread', 'travel', 'crown', 'r', 'hole', 'open', 'ring', 'petals', 'wipeHole'];
            const moving = seen.map((entry, i) => i > 0 && visible.some(key => Math.abs(entry.g[key] - seen[i - 1].g[key]) > 1e-6));
            const first = moving.indexOf(true);
            const last = moving.lastIndexOf(true);
            let still = 0;
            let longest = 0;
            for (let i = first; i <= last; i += 1) {
                still = moving[i] ? 0 : still + 4;
                longest = Math.max(longest, still);
            }
            expect(longest, `${from} to ${to}`).toBeLessThanOrEqual(24);
        }
    });

    it('comes to rest sooner than before on a change of frame, the eye kept shut between: inner to full in under 2.8 s', () => {
        const seen = change('inner', 'full');
        expect(seen.at(-1).now - 5000).toBeLessThan(2800);
        expect(seen.at(-1)).toMatchObject({ frame: 'full', a: 1 });
    });
    /** A frame's geometry swept over `a`, every number checked for a jump or a sudden change of speed. */
    function smoothIn(label, room, at, from, to) {
        const keys = Object.keys(at(from));
        const span = Object.fromEntries(keys.map(key => [key, 1]));
        for (let a = from; a <= to; a += 0.01) for (const key of keys) span[key] = Math.max(span[key], Math.abs(at(a)[key]));
        let before = at(from);
        let now = at(from + h);
        for (let a = from + 2 * h; a <= to + 1e-12; a += h) {
            const next = at(Math.min(to, a));
            for (const key of keys) {
                const step = Math.abs(next[key] - now[key]) / span[key];
                const bend = Math.abs(next[key] - 2 * now[key] + before[key]) / span[key];
                if (step > 60 * h || bend > 6 / 0.04 ** 2 * h * h * 1.01) throw new Error(`${label}: ${key} at a ${a.toFixed(4)} steps ${(step / h).toFixed(1)}/a and bends ${(bend / h / h).toFixed(0)}/a²`);
            }
            before = now;
            now = next;
        }
    }

    it('closes a circle frame toward another as smoothly as it opens, and opens the full frame from the shell as smoothly', () => {
        for (const [name, room] of Object.entries(rooms)) {
            for (const [frame, to] of [['inner', FRAME_ENTRY.inner], ['shell', FRAME_ENTRY.shell], ['shell', FRAME_SEED]]) {
                for (const from of [1, 0.8]) {
                    const close = { from, to };
                    smoothIn(`${name} ${frame} closing ${from} to ${to}`, room, a => sampled(frameGeometry({ frame, a, cut: 0, lid: 1, close, layout: room.layout }), room.size), to, from);
                }
            }
            smoothIn(`${name} full from the shell`, room, a => sampled(frameGeometry({ frame: 'full', a, cut: 0, lid: 0, carry: 'shell', layout: room.layout }), room.size), FRAME_ENTRY.full, 1);
        }
    });

    it('meets the full frame from the shell exactly where the shell left her: her place, her eye, the band and its crown', () => {
        for (const room of Object.values(rooms)) {
            const shell = sampled(frameGeometry({ frame: 'shell', a: FRAME_SEED, cut: 1, lid: 1, close: { from: 1, to: FRAME_SEED }, layout: room.layout }), room.size);
            const full = sampled(frameGeometry({ frame: 'full', a: FRAME_ENTRY.full, cut: 0, lid: 1, carry: 'shell', layout: room.layout }), room.size);
            for (const key of ['fx', 'fy', 'fs', 'eyeR', 'travel', 'crown', 'crownR', 'eyeClosed', 'dim', 'spread']) expect(full[key], key).toBeCloseTo(shell[key], 6);
        }
    });

    it('never lets her grow on the way to the dock: from the cut, the shell and the inner eye close straight into the glide', () => {
        for (const room of Object.values(rooms)) {
            for (const from of ['shell', 'inner']) {
                const seen = change(from, 'full', room);
                const docked = seen.findIndex(entry => entry.frame === 'full' && entry.g.small === 1);
                expect(docked, from).toBeGreaterThan(0);
                for (let i = 1; i <= docked; i += 1) {
                    expect(seen[i].g.eyeR, `${from} eye at ${seen[i].now - 5000} ms`).toBeLessThanOrEqual(seen[i - 1].g.eyeR + 1e-9);
                    expect(seen[i].g.fs, `${from} face at ${seen[i].now - 5000} ms`).toBeLessThanOrEqual(seen[i - 1].g.fs + 1e-9);
                }
            }
        }
    });

    it('takes the shell’s band back into her as she leaves for the dock', () => {
        const seen = change('shell', 'full');
        const full = seen.filter(entry => entry.frame === 'full');
        expect(full[0].g.travel).toBeGreaterThan(0.2);
        expect(full[0].g.crown).toBeGreaterThan(0.2);
        for (let i = 1; i < full.length; i += 1) expect(full[i].g.travel).toBeLessThanOrEqual(full[i - 1].g.travel + 1e-12);
        const docked = full.find(entry => entry.g.small === 1);
        expect(docked.g.travel).toBe(0);
        expect(docked.g.crown).toBe(0);
    });

    it('closes as one motion from the cut’s first frame: the aperture contracts as the blades shut and the petals fold', () => {
        for (const [from, to] of [['inner', 'full'], ['inner', 'shell'], ['shell', 'full'], ['shell', 'inner']]) {
            const early = change(from, to).filter(entry => entry.now - 5000 <= 50);
            for (let i = 2; i < early.length; i += 1) {
                expect(early[i].g.r, `${from} to ${to} at ${early[i].now - 5000} ms`).toBeLessThan(early[i - 1].g.r);
                expect(early[i].g.petals, `${from} to ${to}`).toBeGreaterThan(early[i - 1].g.petals);
            }
        }
    });
});

