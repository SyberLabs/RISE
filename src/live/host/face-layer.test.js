/**
 * The face's layer: the oracle engine started in a scene worker on a canvas the venue owns, given the reader's
 * pointer for its gaze, cued by the venue, and held to the same frame budget and flash gate as any scene.
 *
 * The worker is a fake that records what it is sent and says what the test makes it say; frames are hand-cranked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TO_HOST, TO_WORKER } from '../../scenes/scene-protocol.js';
import { facePixelRatio, mountFace } from './face-layer.js';

function fakeWorker() {
    return {
        sent: [], terminated: false, onmessage: null, onerror: null,
        postMessage(message) { this.sent.push(message); },
        terminate() { this.terminated = true; },
        say(data) { this.onmessage?.({ data }); },
        of(type) { return this.sent.filter(message => message.type === type); }
    };
}

function frames() {
    let callbacks = new Map();
    let next = 1;
    return {
        request: callback => { const id = next; next += 1; callbacks.set(id, callback); return id; },
        cancel: id => callbacks.delete(id),
        run(timestamp) { const due = callbacks; callbacks = new Map(); for (const callback of due.values()) callback(timestamp); }
    };
}

let face;

async function mounted(options = {}) {
    const host = document.createElement('div');
    document.body.append(host);
    const worker = fakeWorker();
    const raf = frames();
    const firsts = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'transferControlToOffscreen').mockImplementation(() => ({ offscreen: true }));
    face = mountFace({
        host, skin: 'jade', state: 'arrival', reducedMotion: false,
        createWorker: () => worker, requestFrame: raf.request, cancelFrame: raf.cancel,
        onFirstFrame: () => firsts.push(true), ...options
    });
    await face.started;
    worker.say({ type: TO_HOST.ready, reportsCompletion: false, listens: ['pointer'] });
    face.play();
    return { host, worker, raf, firsts, canvas: host.querySelector('canvas') };
}

// jsdom has no transferControlToOffscreen; the spy above needs a property to replace.
HTMLCanvasElement.prototype.transferControlToOffscreen ??= () => null;

afterEach(() => {
    face?.destroy();
    face = null;
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('the face’s layer', () => {
    it('starts the oracle’s own source in a worker, in the skin and state it is given', async () => {
        const { worker, canvas } = await mounted();
        const [init] = worker.of(TO_WORKER.init);
        expect(init.code).toContain('export default function oracle(rise)');
        expect(init.theme).toEqual({ skin: 'jade', state: 'arrival' });
        expect(canvas.getAttribute('aria-hidden')).toBe('true');
    });

    it('says when the engine has drawn its first frame, once', async () => {
        const { worker, raf, firsts } = await mounted();
        raf.run(16);
        expect(firsts).toEqual([]);
        worker.say({ type: TO_HOST.frameDone, t: 0, ms: 3 });
        raf.run(32);
        worker.say({ type: TO_HOST.frameDone, t: 16, ms: 4 });
        expect(firsts).toEqual([true]);
        expect(face.frameTimes()).toEqual([3, 4]);
    });

    it('gives the engine the reader’s pointer over it, and says the pointer is gone when it leaves', async () => {
        const { worker, canvas } = await mounted();
        canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 40 }));
        canvas.dispatchEvent(new MouseEvent('pointerleave', { clientX: 300, clientY: 400 }));
        await vi.waitFor(() => expect(worker.of(TO_WORKER.input)).toHaveLength(2));
        const [moved, left] = worker.of(TO_WORKER.input);
        expect(moved).toMatchObject({ kind: 'pointermove', x: 0, y: 0 });
        expect(left).toMatchObject({ kind: 'pointercancel' });
    });

    it('cues the engine by name: a state, a blink, a skin', async () => {
        const { worker } = await mounted();
        face.cue('thinking');
        face.cue('blink');
        face.setSkin('ember');
        expect(worker.of(TO_WORKER.cue).map(message => message.name)).toEqual(['thinking', 'blink', 'set:skin=ember']);
    });

    it('gives the engine the room’s geometry once it has drawn, and never before (docs/plans/LIVE-CURRENT.md §23)', async () => {
        const { worker } = await mounted();
        const geometry = { frame: 'shell', face: { x: 1, y: 2, s: 3 } };
        face.place(geometry);
        expect(worker.of(TO_WORKER.cue)).toEqual([]);
        worker.say({ type: TO_HOST.frameDone, t: 0, ms: 3 });
        face.place(geometry);
        face.place(null);
        expect(worker.of(TO_WORKER.cue).map(message => message.name)).toEqual([`aperture:${JSON.stringify(geometry)}`, 'aperture:null']);
    });

    it('gives the engine a geometry only when it has changed: a room at rest sends nothing, so its trails are kept', async () => {
        const { worker } = await mounted();
        worker.say({ type: TO_HOST.frameDone, t: 0, ms: 3 });
        const resting = { frame: 'shell', face: { x: 1, y: 2, s: 3 } };
        const moved = { frame: 'shell', face: { x: 1, y: 2, s: 4 } };
        for (let i = 0; i < 5; i++) face.place({ ...resting, face: { ...resting.face } });
        face.place(moved);
        face.place(moved);
        face.place(null);
        face.place(null);
        expect(worker.of(TO_WORKER.cue).map(message => message.name)).toEqual([`aperture:${JSON.stringify(resting)}`, `aperture:${JSON.stringify(moved)}`, 'aperture:null']);
    });

    it('draws each geometry in the animation frame it is placed in: the venue’s place sends it, then the frame that draws it', async () => {
        const { worker, raf } = await mounted();
        const order = () => worker.sent.filter(message => message.type === TO_WORKER.frame || message.type === TO_WORKER.cue).map(message => (message.type === TO_WORKER.cue ? message.name : `frame@${message.t}`));
        raf.run(16);
        worker.say({ type: TO_HOST.frameDone, t: 0, ms: 1 });
        const first = { frame: 'full', face: { x: 1, y: 2, s: 3 } };
        const second = { frame: 'full', face: { x: 1, y: 5, s: 3 } };
        face.place(first, 32);
        worker.say({ type: TO_HOST.frameDone, t: 16, ms: 1 });
        // While the venue places the room, the window's own animation frame draws nothing of its own.
        raf.run(48);
        face.place(second, 48);
        worker.say({ type: TO_HOST.frameDone, t: 32, ms: 1 });
        face.place(second, 64);
        worker.say({ type: TO_HOST.frameDone, t: 48, ms: 1 });
        // Given back its own square, the face draws on the window's animation frames again.
        face.place(null, 80);
        raf.run(96);
        expect(order()).toEqual([
            'frame@0', `aperture:${JSON.stringify(first)}`, 'frame@16', `aperture:${JSON.stringify(second)}`, 'frame@32', 'frame@48',
            'aperture:null', 'frame@80'
        ]);
    });

    it('gives the engine the pointer anywhere in the room, in the canvas’s own pixels', async () => {
        const { worker, canvas } = await mounted();
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 400, height: 300 });
        face.point(110, 70);
        await vi.waitFor(() => expect(worker.of(TO_WORKER.input)).toHaveLength(1));
        expect(worker.of(TO_WORKER.input)[0]).toMatchObject({ kind: 'pointermove' });
    });

    it('freezes the face rather than let it flash', async () => {
        const { worker } = await mounted();
        let t = 0;
        for (const value of [0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9]) {
            t += 100;
            worker.say({ type: TO_HOST.luma, value, t });
        }
        expect(face.frozen()).toBe(true);
    });

    it('lets everything go when destroyed', async () => {
        const { worker, host } = await mounted();
        face.destroy();
        expect(worker.terminated).toBe(true);
        expect(host.querySelector('canvas')).toBeNull();
        face = null;
    });
});

describe('the face’s pixels, now that it covers the room (docs/plans/LIVE-CURRENT.md §23)', () => {
    it('is the device’s ratio up to 2, held to the pixels of a 1440 by 900 room at 1.5, and never under 1', () => {
        expect(facePixelRatio(420, 420, 2)).toBe(2);
        expect(facePixelRatio(390, 844, 3)).toBe(2);
        expect(facePixelRatio(1440, 900, 2)).toBeCloseTo(1.5, 9);
        expect(facePixelRatio(1440, 900, 1)).toBe(1);
        expect(facePixelRatio(1920, 1080, 2)).toBeCloseTo(Math.sqrt((1440 * 900 * 2.25) / (1920 * 1080)), 9);
        expect(facePixelRatio(3840, 2160, 2)).toBe(1);
        expect(facePixelRatio(0, 0, 2)).toBe(2);
    });
});
