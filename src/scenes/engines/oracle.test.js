/**
 * The oracle: RISE's own face, a native engine the Live venue runs in the scene worker
 * (docs/plans/LIVE-CURRENT.md §22; the approved study, docs/assets/live/sophia-face-study.html).
 *
 * Driven here as the worker drives it: the default export given a `rise`, then frames in milliseconds, cues
 * and the reader's pointer. The canvas is a fake that answers every call, so what is held is the face's own
 * arithmetic (states eased, the blink's phases, the gaze clamped), that it never speaks for the reader, and
 * what a frame costs before any pixel is drawn.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import oracle, { ORACLE_MANIFEST, ORACLE_SKINS, ORACLE_STATES, blinkClosure } from './oracle.js';
import { SCENE_ENGINES } from '../manifests.js';
import { FRAME_SEED, frameGeometry, roomLayout } from '../../live/host/frames.js';

/** A 2D context that does nothing, counting what a frame would allocate. */
function fakeContext() {
    const counts = { gradients: 0, opaqueFills: 0, cleared: 0, under: 0, arcs: [] };
    const gradient = () => { counts.gradients += 1; return { addColorStop() {} }; };
    const kept = [];
    const ctx = {
        counts,
        fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
        // What a real context keeps across save and restore that a frame's counts depend on.
        save() { kept.push([ctx.globalCompositeOperation, ctx.globalAlpha]); },
        restore() { [ctx.globalCompositeOperation, ctx.globalAlpha] = kept.pop() ?? [ctx.globalCompositeOperation, ctx.globalAlpha]; },
        translate() {}, rotate() {}, scale() {}, setTransform() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc(x, y, r) { counts.arcs.push([x, y, r]); }, bezierCurveTo() {}, clip() {}, stroke() {},
        fill() { if (ctx.globalCompositeOperation === 'destination-out') counts.cleared += 1; },
        fillRect() {
            // The ground laid under the trails, or back over them by each channel's maximum.
            if (ctx.globalCompositeOperation === 'destination-over' || ctx.globalCompositeOperation === 'lighten') counts.under += 1;
            else if (/, 1\)$/u.test(String(ctx.fillStyle))) counts.opaqueFills += 1;
        },
        createLinearGradient: gradient, createRadialGradient: gradient
    };
    return ctx;
}

function make({ skin, state, reducedMotion = false, width = 400, height = 400, dpr = 2 } = {}) {
    const ctx = fakeContext();
    const rise = {
        ctx, size: { width, height, dpr }, theme: { ...(skin ? { skin } : {}), ...(state ? { state } : {}) }, reducedMotion,
        listen: vi.fn(), emit: vi.fn(), done: vi.fn()
    };
    const scene = oracle(rise);
    let t = 0;
    scene.frame(0, 0);
    /** Frames of `dt` ms, until `ms` have passed. */
    const run = (ms, dt = 1000 / 60) => {
        for (let gone = 0; gone < ms - 1e-9; gone += dt) {
            t += dt;
            scene.frame(t, dt);
        }
    };
    return { rise, ctx, scene, run, now: () => t };
}

afterEach(() => vi.restoreAllMocks());

/**
 * An 8-bit RGBA raster that composites the frame's whole-canvas fills as the GPU does (each channel rounded to a
 * level) and draws nothing else: what is left of a stroke is only what the fades leave of it.
 * Chromium's faint source-over does not move a level up toward a source fewer than 14 levels above it (measured
 * at 8%), where it does move down toward one 8 below; the raster keeps that stall.
 */
function rasterContext(width, height) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const kept = [];
    const ctx = {
        ...fakeContext(),
        pixels,
        save() { kept.push([ctx.globalCompositeOperation, ctx.globalAlpha]); },
        restore() { [ctx.globalCompositeOperation, ctx.globalAlpha] = kept.pop() ?? [ctx.globalCompositeOperation, ctx.globalAlpha]; },
        fillRect(x, y, w, h) {
            const style = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/u.exec(String(ctx.fillStyle));
            if (!style || x > 0 || y > 0 || w < width || h < height) return;
            const [r, g, b, a] = style.slice(1).map(Number);
            const alpha = a * ctx.globalAlpha;
            for (let i = 0; i < pixels.length; i += 4) {
                const source = [r, g, b];
                for (let c = 0; c < 3; c += 1) {
                    const under = pixels[i + c];
                    if (ctx.globalCompositeOperation === 'lighten') pixels[i + c] = Math.round(Math.max(source[c], under) * alpha + under * (1 - alpha));
                    else if (ctx.globalCompositeOperation === 'darken') pixels[i + c] = Math.round(Math.min(source[c], under) * alpha + under * (1 - alpha));
                    else if (ctx.globalCompositeOperation === 'lighter') pixels[i + c] = under + Math.round(source[c] * alpha);
                    else if (ctx.globalCompositeOperation === 'source-over' && alpha < 1 && source[c] > under && source[c] - under < 14) pixels[i + c] = under;
                    else if (ctx.globalCompositeOperation === 'source-over') pixels[i + c] = Math.round(source[c] * alpha + under * (1 - alpha));
                }
                if (ctx.globalCompositeOperation !== 'destination-out') pixels[i + 3] = 255;
            }
        },
        /** A stroke of light over the whole canvas. */
        paint(rgb) {
            for (let i = 0; i < pixels.length; i += 4) pixels.set([...rgb, 255], i);
        }
    };
    return ctx;
}

describe('the ground, in 8 bits', () => {
    const W = 48;
    const H = 32;
    const sophia = ORACLE_SKINS.sophia.trail;
    const furthest = ctx => {
        let worst = 0;
        for (let i = 0; i < ctx.pixels.length; i += 4) for (let c = 0; c < 3; c += 1) worst = Math.max(worst, Math.abs(ctx.pixels[i + c] - sophia[c]));
        return worst;
    };
    const raster = () => {
        const ctx = rasterContext(W, H);
        const scene = oracle({ ctx, size: { width: W, height: H, dpr: 1 }, theme: { state: 'speaking' }, reducedMotion: false, listen: vi.fn(), emit: vi.fn(), done: vi.fn() });
        let t = 0;
        scene.frame(0, 0);
        const run = frames => { for (let i = 0; i < frames; i += 1) { t += 1000 / 60; scene.frame(t, 1000 / 60); } };
        return { ctx, scene, run };
    };
    const layout = roomLayout({ width: 1440, height: 900, bar: { left: 592, top: 16, width: 256, height: 54 }, wordsTop: 690 });

    it('fades every stroke back to exactly its ground, in the room and in its own square: nothing is left a few levels above it', () => {
        for (const inRoom of [false, true]) {
            const { ctx, scene, run } = raster();
            if (inRoom) scene.cue(`aperture:${JSON.stringify(frameGeometry({ frame: 'shell', a: 1, cut: 0, layout }))}`);
            run(1);
            for (const stroke of [[200, 220, 240], [40, 46, 52], [16, 17, 22]]) {
                ctx.paint(stroke);
                run(180);
                expect(furthest(ctx), `${inRoom ? 'room' : 'square'} after ${stroke}`).toBeLessThanOrEqual(1);
            }
        }
    });

    it('keeps the study’s 8% trail: a stroke dims as it did, darker only by what fading 8 levels lower adds up to, and never below the ground', () => {
        const { ctx, run } = raster();
        run(1);
        ctx.paint([200, 220, 240]);
        let study = [200, 220, 240];
        for (let frame = 1; frame <= 60; frame += 1) {
            run(1);
            study = study.map((v, c) => Math.round(sophia[c] * 0.08 + v * 0.92));
            // Toward a dark 8 levels below the ground, a trail darkens by at most 0.64 of a level a frame more, never
            // past 8 and never below the ground (two levels more for the rounding of each).
            for (let c = 0; c < 3; c += 1) {
                const darker = study[c] - ctx.pixels[c];
                expect(darker).toBeGreaterThanOrEqual(-1);
                expect(darker).toBeLessThanOrEqual(Math.min(8, Math.ceil(8 * (1 - 0.92 ** frame)) + 2));
                expect(ctx.pixels[c]).toBeGreaterThanOrEqual(sophia[c]);
            }
        }
    });

    it('fades a light skin’s ink back to exactly its pale ground, the mirror of the dark: never above it', () => {
        for (const name of Object.keys(ORACLE_SKINS).filter(key => ORACLE_SKINS[key].light)) {
            const ground = ORACLE_SKINS[name].trail;
            const ctx = rasterContext(W, H);
            const scene = oracle({ ctx, size: { width: W, height: H, dpr: 1 }, theme: { state: 'speaking', skin: name }, reducedMotion: false, listen: vi.fn(), emit: vi.fn(), done: vi.fn() });
            let t = 0;
            scene.frame(0, 0);
            for (const stroke of [[20, 40, 80], [200, 196, 190]]) {
                ctx.paint(stroke);
                for (let i = 0; i < 180; i += 1) { t += 1000 / 60; scene.frame(t, 1000 / 60); }
                for (let c = 0; c < 3; c += 1) {
                    expect(Math.abs(ctx.pixels[c] - ground[c]), `${name} after ${stroke}`).toBeLessThanOrEqual(1);
                    expect(ctx.pixels[c]).toBeLessThanOrEqual(ground[c]);
                }
            }
        }
    });
});

describe('what the face is', () => {
    it('is the study’s four skins, the light room’s Porcelain, and five states, exactly', () => {
        expect(Object.keys(ORACLE_SKINS)).toEqual(['sophia', 'ember', 'jade', 'silver', 'porcelain']);
        expect(Object.keys(ORACLE_SKINS).filter(name => ORACLE_SKINS[name].light)).toEqual(['porcelain']);
        expect(ORACLE_SKINS.porcelain).toEqual({ core: [255, 253, 248], iris: [47, 95, 179], glow: [168, 192, 230], deep: [14, 27, 54], trail: [244, 239, 230], ink: [23, 42, 79], light: true });
        expect(ORACLE_SKINS.sophia).toEqual({ core: [245, 245, 220], iris: [135, 206, 235], glow: [176, 196, 222], deep: [25, 25, 112], trail: [10, 10, 15] });
        expect(ORACLE_SKINS.silver.trail).toEqual([9, 9, 11]);
        expect(Object.keys(ORACLE_STATES)).toEqual(['arrival', 'listening', 'thinking', 'speaking', 'rest']);
        expect(ORACLE_STATES.thinking).toEqual({ open: 0.80, orbit: 0.55, spin: 0.40, field: 1.6, tight: 0.62, glow: 1.00 });
        // She no longer withdraws while a reading speaks (§23): speaking is the aperture study's, wholly present.
        expect(ORACLE_STATES.speaking).toEqual({ open: 0.70, orbit: 0.10, spin: 0.06, field: 0.6, tight: 1.10, glow: 0.35 });
    });

    it('states its parameters and cues as a manifest does, and is not an engine the model may name', () => {
        expect(ORACLE_MANIFEST.parameters.skin.values).toEqual(['sophia', 'ember', 'jade', 'silver', 'porcelain']);
        expect(ORACLE_MANIFEST.parameters.state.values).toEqual(['arrival', 'listening', 'thinking', 'speaking', 'rest']);
        expect(Object.keys(ORACLE_MANIFEST.cues)).toEqual(['arrival', 'listening', 'thinking', 'speaking', 'rest', 'blink']);
        expect(ORACLE_MANIFEST.cues.thinking).toEqual({ state: 'thinking' });
        expect(SCENE_ENGINES).not.toContain('oracle');
    });

    it('begins in the skin and state it is given, and in Sophia at arrival when given none it knows', () => {
        expect(make({ skin: 'jade', state: 'rest' }).scene.inspect()).toMatchObject({ skin: 'jade', state: 'rest', live: ORACLE_STATES.rest });
        expect(make({ skin: 'gold', state: 'dancing' }).scene.inspect()).toMatchObject({ skin: 'sophia', state: 'arrival', live: ORACLE_STATES.arrival });
    });
});

describe('it listens to the pointer and says nothing', () => {
    it('asks for the pointer before its first frame, and never emits whatever the reader does', () => {
        const { rise, scene, run } = make();
        expect(rise.listen).toHaveBeenCalledWith('pointer');
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
            scene.input({ type, x: 10, y: 20, buttons: 1, key: null, modifiers: {} });
            run(50);
        }
        scene.cue('thinking', { instant: false });
        scene.cue('blink', { instant: false });
        run(1000);
        expect(rise.emit).not.toHaveBeenCalled();
        expect(rise.done).not.toHaveBeenCalled();
    });
});

describe('states are eased', () => {
    it('moves toward a cued state with a 0.18 s time constant, and arrives', () => {
        const { scene, run } = make();
        scene.cue('thinking', { instant: false });
        const from = ORACLE_STATES.arrival.orbit;
        const to = ORACLE_STATES.thinking.orbit;
        run(180, 1);
        const travelled = (scene.inspect().live.orbit - from) / (to - from);
        expect(travelled).toBeGreaterThan(0.6);
        expect(travelled).toBeLessThan(0.66);
        run(3000);
        for (const [key, value] of Object.entries(ORACLE_STATES.thinking)) expect(scene.inspect().live[key]).toBeCloseTo(value, 4);
        expect(scene.inspect().state).toBe('thinking');
    });

    it('takes a state at once when the cue is instant, and by `set:state=`', () => {
        const { scene } = make();
        scene.cue('speaking', { instant: true });
        expect(scene.inspect().live).toEqual(ORACLE_STATES.speaking);
        scene.cue('set:state=rest', { instant: true });
        expect(scene.inspect().live).toEqual(ORACLE_STATES.rest);
        scene.cue('set:state=dancing', { instant: true });
        expect(scene.inspect().state).toBe('rest');
    });

    it('changes skin by `set:skin=`, repainting its dark at once, and ignores a skin it does not have', () => {
        const { scene, ctx, run } = make();
        const before = ctx.counts.opaqueFills;
        scene.cue('set:skin=ember', { instant: false });
        run(17);
        expect(scene.inspect().skin).toBe('ember');
        expect(ctx.counts.opaqueFills).toBeGreaterThan(before);
        scene.cue('set:skin=gold', { instant: false });
        expect(scene.inspect().skin).toBe('ember');
    });
});

describe('the blink: the iris closing on itself', () => {
    it('closes in 220 ms (smoothstep), holds 70 ms, opens in 360 ms', () => {
        expect(blinkClosure(0, false)).toBe(0);
        expect(blinkClosure(0.11, false)).toBeCloseTo(0.5, 6);
        expect(blinkClosure(0.22, false)).toBe(1);
        expect(blinkClosure(0.25, false)).toBe(1);
        expect(blinkClosure(0.29 + 0.18, false)).toBeCloseTo(0.5, 6);
        expect(blinkClosure(0.649, false)).toBeLessThan(0.001);
        expect(blinkClosure(0.65, false)).toBeNull();
    });

    it('is 1.2 times slower while thinking, the hold unchanged', () => {
        expect(blinkClosure(0.132, true)).toBeCloseTo(0.5, 6);
        expect(blinkClosure(0.264, true)).toBe(1);
        expect(blinkClosure(0.264 + 0.07 + 0.216, true)).toBeCloseTo(0.5, 6);
        expect(blinkClosure(0.264 + 0.07 + 0.432, true)).toBeNull();
    });

    it('blinks when cued: closed at the hold, open again after 650 ms', () => {
        const { scene, run } = make();
        scene.cue('blink', { instant: false });
        run(250, 1);
        expect(scene.inspect().closed).toBe(1);
        run(400, 1);
        expect(scene.inspect().closed).toBe(0);
    });

    it('blinks on its own, first between 3 and 7 s, then every 4 to 8 s', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const { scene, run } = make();
        const closings = [];
        let was = 0;
        for (let ms = 0; ms < 20_000; ms += 10) {
            run(10, 10);
            const { closed } = scene.inspect();
            if (closed > 0 && was === 0) closings.push(ms);
            was = closed;
        }
        expect(closings[0]).toBeGreaterThanOrEqual(2990);
        expect(closings[0]).toBeLessThanOrEqual(3010);
        const gaps = closings.slice(1).map((at, i) => at - closings[i]);
        // A blink lasts 650 ms, and the next is 4 s after it ends.
        for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(4600);
        expect(gaps.length).toBeGreaterThan(1);
    });
});

describe('reduced motion', () => {
    it('never blinks, takes every state at once, and neither orbits nor drifts', () => {
        const { scene, run } = make({ reducedMotion: true });
        const nodes = scene.inspect().nodes;
        scene.cue('blink', { instant: false });
        scene.cue('thinking', { instant: false });
        run(17);
        expect(scene.inspect().live).toEqual(ORACLE_STATES.thinking);
        for (let ms = 0; ms < 20_000; ms += 50) {
            run(50, 50);
            expect(scene.inspect().closed).toBe(0);
        }
        expect(scene.inspect().nodes).toEqual(nodes);
        expect(scene.inspect().drift).toBe(0);
    });
});

describe('the gaze', () => {
    it('follows the pointer eased over about 0.35 s, clamped to the face', () => {
        const { scene, run } = make({ width: 400, height: 400 });
        scene.input({ type: 'pointermove', x: 4000, y: 200, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim).toEqual({ x: 1, y: 0, depth: 0 });
        run(350, 1);
        expect(scene.inspect().gaze.x).toBeGreaterThan(0.6);
        expect(scene.inspect().gaze.x).toBeLessThan(0.66);
        run(3000);
        expect(scene.inspect().gaze.x).toBeCloseTo(1, 3);
        expect(scene.inspect().gaze.x).toBeLessThanOrEqual(1);
    });

    it('keeps the eye in its socket and moves only the pupil, within the iris, toward the pointer', () => {
        /** The pupil and the catchlight, the frame's last two arcs, after the gaze has settled on `x`. */
        const settled = x => {
            // The first blink waits 3 to 7 seconds; pin it past the run, since a blink shuts the eye and shrinks the reach.
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const { scene, run, ctx } = make({ width: 400, height: 400, dpr: 1 });
            if (x !== null) scene.input({ type: 'pointermove', x, y: 200, buttons: 0, key: null, modifiers: {} });
            run(4800, 16);
            ctx.counts.arcs.length = 0;
            run(16, 16);
            return ctx.counts.arcs.slice(-2);
        };
        // The catchlight sits at a fixed place on the eye, up and left of its centre by a share of the pupil.
        const [[restX, , restPupil], [restLight]] = settled(null);
        const [[lookX, , pupil], [lookLight]] = settled(4000);
        const restEye = restLight + restPupil * 0.35;
        const eye = lookLight + pupil * 0.35;
        // The eye leans under 1% of the face; the pupil goes further, and its edge stays well inside the eye (the iris
        // is the pupil over 0.34).
        expect(eye - restEye).toBeGreaterThan(0);
        expect(eye - restEye).toBeLessThan(4);
        expect(lookX - restX).toBeGreaterThan(2 * (eye - restEye));
        expect(lookX - eye + pupil).toBeLessThan((pupil / 0.34) * 0.7);
    });

    it('draws nearer as the pointer comes to the centre, and looks ahead again when it leaves', () => {
        const { scene, run } = make({ width: 400, height: 400 });
        scene.input({ type: 'pointermove', x: 200, y: 200, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim.depth).toBe(1);
        run(3000);
        expect(scene.inspect().gaze.depth).toBeCloseTo(1, 2);
        scene.input({ type: 'pointercancel', x: 200, y: 200, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim).toEqual({ x: 0, y: 0, depth: 0 });
    });

    it('takes no key, and nothing that is not a number', () => {
        const { scene } = make();
        scene.input({ type: 'keydown', x: null, y: null, buttons: 0, key: 'a', modifiers: {} });
        scene.input({ type: 'pointermove', x: Number.NaN, y: 3, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim).toEqual({ x: 0, y: 0, depth: 0 });
    });
});

describe('what a frame costs', () => {
    it('builds the torus once per size, and again only when the size changes', () => {
        const { rise, scene, run, ctx } = make();
        run(500);
        expect(scene.inspect().torusBuilds).toBe(1);
        const fills = ctx.counts.opaqueFills;
        Object.assign(rise.size, { width: 600, height: 500 });
        run(500);
        expect(scene.inspect().torusBuilds).toBe(2);
        expect(ctx.counts.opaqueFills).toBe(fills + 1);
    });

    it('makes a dozen gradients a frame with the eye open, and draws a frame in a few milliseconds', () => {
        const { scene, ctx, run } = make({ width: 760, height: 760, dpr: 2 });
        run(100);
        const before = ctx.counts.gradients;
        run(1000 / 60);
        // Three petal layers, seven nodes, the pupil: the socket and the seed are not drawn while the eye is open.
        expect(ctx.counts.gradients - before).toBe(11);
        scene.cue('thinking', { instant: true });
        const times = [];
        let t = 1000;
        for (let i = 0; i < 400; i += 1) {
            if (i % 100 === 0) scene.cue('blink', { instant: false });
            const began = performance.now();
            t += 1000 / 60;
            scene.frame(t, 1000 / 60);
            times.push(performance.now() - began);
        }
        times.sort((a, b) => a - b);
        const median = times[times.length >> 1];
        const p95 = times[Math.floor(times.length * 0.95)];
        console.log(`oracle frame on the fake canvas, 760 px at 2x, thinking, with blinks: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms`);
        expect(median).toBeLessThan(4);
    });
});

describe('the room: the three frames, drawn from the venue’s geometry alone (docs/plans/LIVE-CURRENT.md §23)', () => {
    const W = 1440;
    const H = 900;
    const layout = roomLayout({ width: W, height: H, bar: { left: 592, top: 16, width: 256, height: 54 }, wordsTop: 690 });
    const room = (frame, a, cut = 0) => `aperture:${JSON.stringify(frameGeometry({ frame, a, cut, layout }))}`;
    const inRoom = (options = {}) => make({ width: W, height: H, dpr: 1, state: 'speaking', ...options });

    it('takes the geometry it is given, and goes back to its own square when told there is none', () => {
        const { scene, run } = inRoom();
        scene.cue(room('shell', 0.5));
        run(17);
        expect(scene.inspect().room).toEqual(frameGeometry({ frame: 'shell', a: 0.5, cut: 0, layout }));
        scene.cue('aperture:null');
        run(17);
        expect(scene.inspect().room).toBe(null);
        scene.cue('aperture:{not json');
        scene.cue('aperture:"a string"');
        run(17);
        expect(scene.inspect().room).toBe(null);
    });

    it('covers the room but for the aperture: opaque every frame, the hole cleared only while it is open', () => {
        const { scene, run, ctx } = inRoom();
        scene.cue(room('inner', 0.4));
        run(17);
        expect(ctx.counts.under).toBeGreaterThan(0);
        expect(ctx.counts.cleared).toBe(0);
        for (const frame of ['inner', 'shell', 'full']) {
            const before = ctx.counts.cleared;
            scene.cue(room(frame, 1));
            // One frame: one hole cleared.
            run(16);
            expect(ctx.counts.cleared - before).toBe(1);
        }
        const shut = ctx.counts.cleared;
        scene.cue(room('shell', 1, 1));
        run(17);
        expect(ctx.counts.cleared).toBe(shut);
    });

    it('keeps its slow trails in the room as the study does: wholly repainted only on entering the room and leaving it', () => {
        const { scene, run, ctx } = inRoom();
        run(17);
        const opaque = () => ctx.counts.opaqueFills;
        const atRest = opaque();
        scene.cue(room('shell', 1));
        run(17);
        expect(opaque()).toBe(atRest + 1);
        // A new geometry in the room, every frame while a frame opens: the 8% fade, never a whole repaint.
        for (const a of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
            scene.cue(room('inner', a));
            run(17);
        }
        scene.cue(room('full', 1));
        run(170);
        expect(opaque()).toBe(atRest + 1);
        scene.cue('aperture:null');
        run(17);
        expect(opaque()).toBe(atRest + 2);
    });

    it('draws the open inner eye’s rim where the geometry puts it, at its radius', () => {
        const { scene, run, ctx } = inRoom();
        const g = frameGeometry({ frame: 'inner', a: 1, cut: 0, layout });
        scene.cue(room('inner', 1));
        ctx.counts.arcs.length = 0;
        run(17);
        expect(ctx.counts.arcs).toContainEqual([g.aperture.x, g.aperture.y, g.aperture.r]);
    });

    it('keeps blinking docked in the full frame, and does not start a blink while a frame opens', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const opening = inRoom();
        opening.scene.cue(room('inner', 0.5));
        for (let ms = 0; ms < 10_000; ms += 20) {
            opening.run(20, 20);
            expect(opening.scene.inspect().closed).toBe(1);
        }
        const docked = inRoom();
        docked.scene.cue(room('full', 1));
        let blinked = false;
        for (let ms = 0; ms < 10_000; ms += 20) {
            docked.run(20, 20);
            if (docked.scene.inspect().closed > 0.5) blinked = true;
        }
        expect(blinked).toBe(true);
    });

    it('waits at least 2 s after a transition has let the eye be before it blinks on its own again', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const { scene, run } = inRoom();
        scene.cue(room('full', 0.5));
        run(8000, 20);
        scene.cue(room('full', 1));
        let first = null;
        for (let ms = 0; ms < 6000 && first === null; ms += 20) {
            run(20, 20);
            if (scene.inspect().closed > 0) first = ms;
        }
        expect(first).toBeGreaterThanOrEqual(2000);
    });

    it('finishes a blink already under way when a transition begins, rather than snapping the eye open', () => {
        const { scene, run } = inRoom();
        scene.cue(room('full', 1));
        run(20, 20);
        scene.cue('blink', { instant: false });
        run(100, 20);
        const midway = scene.inspect().closed;
        expect(midway).toBeGreaterThan(0.2);
        // The room starts back from the dock: the eye may not begin a blink of its own here, and is not held shut.
        scene.cue(room('full', 0.72));
        let last = midway;
        for (let ms = 0; ms < 800; ms += 20) {
            run(20, 20);
            const closed = scene.inspect().closed;
            expect(Math.abs(closed - last)).toBeLessThan(0.2);
            last = closed;
        }
        expect(last).toBe(0);
    });

    it('sets off for the dock from the shell’s seed at the seed’s own size, the shell’s band and crown still around her', () => {
        const socket = (ctx, x, y) => ctx.counts.arcs.filter(([ax, ay]) => Math.abs(ax - x) < 1e-6 && Math.abs(ay - y) < 1e-6).map(([, , r]) => r);
        const { scene, run, ctx } = inRoom();
        const shell = frameGeometry({ frame: 'shell', a: FRAME_SEED, cut: 1, lid: 1, close: { from: 1, to: FRAME_SEED }, layout });
        scene.cue(`aperture:${JSON.stringify(shell)}`);
        ctx.counts.arcs.length = 0;
        run(17);
        const seedSocket = Math.max(...socket(ctx, shell.aperture.x, shell.aperture.y));
        const full = frameGeometry({ frame: 'full', a: 0.05, cut: 0, lid: 1, carry: 'shell', layout });
        expect(full.crown.layers).toBe(3);
        expect(full.crown.alpha).toBeCloseTo(shell.crown.alpha, 9);
        scene.cue(`aperture:${JSON.stringify(full)}`);
        ctx.counts.arcs.length = 0;
        run(17);
        expect(Math.max(...socket(ctx, full.face.x, full.face.y))).toBeCloseTo(seedSocket, 6);
    });

    it('looks toward the pointer from where the face is in the room, not from the canvas’s centre', () => {
        const { scene, run } = inRoom();
        scene.cue(room('none', 0));
        run(17);
        const { x, y, s } = layout.big;
        scene.input({ type: 'pointermove', x, y, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim).toEqual({ x: 0, y: 0, depth: 1 });
        scene.input({ type: 'pointermove', x: x + s / 2, y, buttons: 0, key: null, modifiers: {} });
        expect(scene.inspect().aim.x).toBe(1);
    });

    it('draws a whole room in a few milliseconds on the fake canvas, in every frame open and opening', () => {
        const { scene, ctx } = inRoom({ dpr: 1.5 });
        const times = [];
        let t = 0;
        for (const [frame, a] of [['inner', 0.8], ['inner', 1], ['shell', 0.5], ['shell', 1], ['full', 0.4], ['full', 1]]) {
            scene.cue(room(frame, a));
            for (let i = 0; i < 60; i += 1) {
                const began = performance.now();
                t += 1000 / 60;
                scene.frame(t, 1000 / 60);
                times.push(performance.now() - began);
            }
        }
        times.sort((a, b) => a - b);
        const median = times[times.length >> 1];
        console.log(`oracle room frame on the fake canvas, ${W}x${H} at 1.5x, every frame: median ${median.toFixed(3)} ms, p95 ${times[Math.floor(times.length * 0.95)].toFixed(3)} ms; ${ctx.counts.gradients} gradients`);
        expect(median).toBeLessThan(4);
    });
});
