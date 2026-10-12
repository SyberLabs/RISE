/**
 * The face's layer: the oracle engine started in a scene worker on a canvas the venue owns, given the reader's
 * pointer for its gaze, cued by the venue, and held to the same frame budget and flash gate as any scene.
 *
 * The worker is a fake that records what it is sent and says what the test makes it say; frames are hand-cranked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TO_HOST, TO_WORKER } from '../../scenes/scene-protocol.js';
import { mountFace } from './face-layer.js';

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
