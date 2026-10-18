/**
 * THE CHAMBER WITH `IMAGE_STREAM_ENABLED` MOCKED ON.
 *
 * The launch gate tells the Chamber it may stream (`imageStream: true`) only
 * after an accepted notice, and hands it a Gallery session: the stream is
 * mounted over that Gallery, between it and the words, with frames decoded
 * from the Gallery's own pool. It plays only while the reading plays, and
 * when it stops itself, the Gallery underneath is what remains.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/visual-presence.js', async importOriginal => ({
    ...await importOriginal(),
    IMAGE_STREAM_ENABLED: true
}));

const presenter = vi.hoisted(() => ({ streams: [], frames: [{ id: 'decoded' }] }));
vi.mock('../../visuals/image-stream.js', () => ({
    decodeStreamFrames: vi.fn(async () => presenter.frames),
    mountImageStream: vi.fn((stage, options) => {
        const stream = { stage, options, resume: vi.fn(), pause: vi.fn(), destroy: vi.fn() };
        presenter.streams.push(stream);
        return stream;
    })
}));

const { Chamber } = await import('./Chamber.js');
const { visualCortex } = await import('../../visuals/visual-cortex.js');
const { decodeStreamFrames, mountImageStream } = await import('../../visuals/image-stream.js');

function fakePlayer(state = 'playing') {
    const handlers = new Map();
    return {
        state,
        on: (event, listener) => handlers.set(event, [...(handlers.get(event) || []), listener]),
        emit: (event, payload) => (handlers.get(event) || []).forEach(listener => listener(payload)),
        play: vi.fn(), pause: vi.fn(), stop: vi.fn(), setInterlocutionHandler: vi.fn()
    };
}

function mount(opts = {}) {
    const { state = 'playing' } = opts;
    const imageStream = 'imageStream' in opts ? opts.imageStream : true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = fakePlayer(state);
    const chamber = new Chamber(container, {
        session: {
            title: 'Probe',
            atoms: [{ content: 'First', duration: 500 }, { content: 'Second', duration: 500 }],
            totalDuration: 1000,
            atomCount: 2,
            visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['fractal'] } }
        },
        player,
        autoStart: false,
        ...(imageStream === undefined ? {} : { imageStream })
    });
    return { chamber, container, player };
}

const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 0)); };

afterEach(() => {
    presenter.streams.length = 0;
    vi.clearAllMocks();
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

describe('the Chamber with the image stream flag on', () => {
    it('mounts the stream between the Gallery and the words, from the Gallery\'s own pool', async () => {
        vi.spyOn(visualCortex, '_continuousPool').mockReturnValue([
            { url: 'https://a.test/1.jpg' }, { url: 'https://a.test/2.jpg' }, { title: 'no url' }
        ]);
        const { chamber, container } = mount();
        await settle();
        expect(decodeStreamFrames).toHaveBeenCalledWith(['https://a.test/1.jpg', 'https://a.test/2.jpg']);
        expect(mountImageStream).toHaveBeenCalledTimes(1);
        const [stream] = presenter.streams;
        expect(stream.options.frames).toBe(presenter.frames);
        const field = container.querySelector('#chamber-field');
        const children = [...field.children];
        const gallery = container.querySelector('#chamber-continuous-field');
        expect(stream.stage.parentNode).toBe(field);
        expect(children.indexOf(stream.stage)).toBeGreaterThan(children.indexOf(gallery));
        const words = field.querySelector('#atom-band') || field.querySelector('#atom-display');
        expect(children.indexOf(stream.stage)).toBeLessThan(children.indexOf(words));
        expect(stream.resume).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    for (const imageStream of [undefined, false, 'true', 1]) {
        it(`mounts nothing unless the gate granted it (imageStream: ${JSON.stringify(imageStream)})`, async () => {
            const { chamber, container } = mount({ imageStream });
            await settle();
            expect(decodeStreamFrames).not.toHaveBeenCalled();
            expect(mountImageStream).not.toHaveBeenCalled();
            expect(container.querySelector('.chamber-image-stream')).toBeNull();
            chamber.destroy();
        });
    }

    it('waits for the reading to play', async () => {
        const { chamber } = mount({ state: 'paused' });
        await settle();
        const [stream] = presenter.streams;
        expect(stream.resume).not.toHaveBeenCalled();
        chamber.destroy();
    });

    it('pauses with the reading, resumes with it, and holds at the end', async () => {
        const { chamber, player } = mount();
        await settle();
        const [stream] = presenter.streams;
        stream.resume.mockClear();
        player.emit('state', { state: 'paused' });
        expect(stream.pause).toHaveBeenCalledTimes(1);
        player.emit('state', { state: 'playing' });
        expect(stream.resume).toHaveBeenCalledTimes(1);
        player.emit('state', { state: 'complete' });
        expect(stream.pause).toHaveBeenCalledTimes(2);
        chamber.destroy();
    });

    it('lets the Gallery take the place when the stream stops itself', async () => {
        const { chamber, container, player } = mount();
        await settle();
        const [stream] = presenter.streams;
        stream.options.onFallback('meter');
        expect(stream.destroy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        expect(container.querySelector('#chamber-continuous-field')).not.toBeNull();
        player.emit('state', { state: 'paused' });
        player.emit('state', { state: 'playing' });
        expect(stream.resume).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('lets go of the stream with the Chamber', async () => {
        const { chamber, container } = mount();
        await settle();
        const [stream] = presenter.streams;
        chamber.destroy();
        expect(stream.destroy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
    });

    it('mounts nothing if the Chamber is gone before the presenter has loaded', async () => {
        const { chamber } = mount();
        chamber.destroy();
        await settle();
        expect(mountImageStream).not.toHaveBeenCalled();
    });

    it('mounts nothing if the Chamber is gone while the frames decode', async () => {
        let decoded;
        decodeStreamFrames.mockImplementationOnce(() => new Promise(resolve => { decoded = resolve; }));
        const { chamber, container } = mount();
        await settle();
        expect(decodeStreamFrames).toHaveBeenCalledTimes(1);
        chamber.destroy();
        decoded(presenter.frames);
        await settle();
        expect(mountImageStream).not.toHaveBeenCalled();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
    });

    it('mounts nothing when the presenter stands down', async () => {
        mountImageStream.mockReturnValueOnce(null);
        const { chamber, container } = mount();
        await settle();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        chamber.destroy();
    });
});
