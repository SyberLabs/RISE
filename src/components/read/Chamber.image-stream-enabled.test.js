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
const { directionStateFor } = await import('../../core/passage-visuals/reading-state.js');
const { LOOKS } = await import('../../core/looks.js');
const { compileSession } = await import('../../core/session-compiler.js');

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
    const session = opts.session || {
        title: 'Probe',
        atoms: [{ content: 'First', duration: 500 }, { content: 'Second', duration: 500 }],
        totalDuration: 1000,
        atomCount: 2,
        visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['fractal'] } }
    };
    if (opts.directionMode) directionStateFor(session).mode = opts.directionMode;
    const chamber = new Chamber(container, {
        session,
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
        expect(chamber.imageStreamGranted, 'a stream that stopped itself is not granted again').toBe(false);
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

    it('leaves no empty host behind when the presenter throws while mounting', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mountImageStream.mockImplementationOnce(() => { throw new Error('canvas unavailable'); });
        const { chamber, container } = mount();
        await settle();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('says once, and leaves no rejection unhandled, when the presenter cannot load', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            decodeStreamFrames.mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'));
            const { chamber, container } = mount();
            await settle();
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(unhandled).not.toHaveBeenCalled();
            expect(warn.mock.calls.filter(([message]) => String(message).includes('image stream'))).toHaveLength(1);
            expect(mountImageStream).not.toHaveBeenCalled();
            expect(container.querySelector('.chamber-image-stream')).toBeNull();
            chamber.destroy();
        } finally {
            process.off('unhandledRejection', unhandled);
        }
    });
});

describe('every way of turning the visuals off or changing them ends the stream', () => {
    /** Mount a playing stream, then assert `act` removes it for good. */
    async function expectEnded(act) {
        const { chamber, container, player } = mount();
        await settle();
        const [stream] = presenter.streams;
        expect(stream, 'the stream mounted').toBeDefined();
        act(chamber);
        expect(stream.destroy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        player.emit('state', { state: 'paused' });
        player.emit('state', { state: 'playing' });
        await settle();
        expect(mountImageStream).toHaveBeenCalledTimes(1);
        expect(stream.resume).toHaveBeenCalledTimes(1);
        return chamber;
    }

    it('Off in the Look sheet, and turning it back on does not bring the stream back', async () => {
        const chamber = await expectEnded(c => expect(c.setVisualsOff(true)).toBe(true));
        chamber.setVisualsOff(false);
        await settle();
        expect(mountImageStream).toHaveBeenCalledTimes(1);
        chamber.destroy();
    });

    it('the visual direction set to Off', async () => {
        const chamber = await expectEnded(c => expect(c.setVisualDirectionMode('off')).toBe(true));
        chamber.destroy();
    });

    it('a scene, field or still put on screen, at once or held for the shut eye of the Live venue', async () => {
        for (const swapAtShut of [false, true]) {
            for (const cue of [
                { kind: 'still' },
                { kind: 'field', renderer: 'genesis', config: {} },
                { kind: 'focal', focal: { type: 'standard', standardGlyph: 'breath' } },
                null
            ]) {
                presenter.streams.length = 0;
                vi.clearAllMocks();
                const chamber = await expectEnded(c => {
                    c.setVisualSwapAtShut(swapAtShut);
                    c.applyScheduledVisualCue(cue, { transitionMs: 0 });
                });
                chamber.destroy();
            }
        }
    });

    it('Follow text, which puts a still on screen before its first directed cue', async () => {
        // A reading whose own text can be followed, opened holding its Gallery.
        const session = compileSession({
            title: 'Follow',
            text: 'The first passage speaks of light.\n\nThe second passage speaks of water and of stone.',
            wpm: 300,
            chunkMode: 'phrase',
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: { presentation: 'continuous', procedural: [], sourced: ['wikimedia-impressionism'] }
            }
        });
        const { chamber, container } = mount({ session });
        await settle();
        const [stream] = presenter.streams;
        expect(stream, 'the stream mounted').toBeDefined();
        expect(chamber.toggleHoldScene()).toBe(true);
        expect(stream.destroy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        expect(chamber.imageStreamGranted).toBe(false);
        chamber.destroy();
    });

    it('Follow text already in force when the reading opens: nothing mounts', async () => {
        // An empty shelf follows the text by default, from the first frame.
        const session = compileSession({
            title: 'Follow',
            text: 'The first passage speaks of light. The second speaks of stone.',
            wpm: 300,
            chunkMode: 'phrase',
            visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: [], sourced: [] } }
        });
        const { chamber, container } = mount({ session });
        expect(chamber._direction.mode).toBe('follow');
        await settle();
        expect(mountImageStream).not.toHaveBeenCalled();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        chamber.destroy();
    });

    it('a change of look', async () => {
        let accepted = 0;
        for (const look of LOOKS) {
            presenter.streams.length = 0;
            vi.clearAllMocks();
            const { chamber, container } = mount();
            await settle();
            const [stream] = presenter.streams;
            if (chamber.chooseLook(look.id)) {
                accepted += 1;
                expect(stream.destroy, look.id).toHaveBeenCalledTimes(1);
                expect(container.querySelector('.chamber-image-stream')).toBeNull();
            }
            chamber.destroy();
        }
        expect(accepted).toBeGreaterThan(0);
    });

    it('keeps the stream through a change of the pool the Gallery draws from', async () => {
        const { chamber } = mount();
        await settle();
        const [stream] = presenter.streams;
        chamber.applyScheduledVisualCue({ kind: 'procedural', collections: ['fractal'] }, { transitionMs: 0 });
        expect(stream.destroy).not.toHaveBeenCalled();
        chamber.destroy();
    });

    it('Off already in force when the reading opens: nothing mounts, nothing resumes', async () => {
        const { chamber, container } = mount({ directionMode: 'off' });
        await settle();
        expect(mountImageStream).not.toHaveBeenCalled();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        chamber.destroy();
    });

    it('Off chosen while the frames decode: nothing mounts', async () => {
        let decoded;
        decodeStreamFrames.mockImplementationOnce(() => new Promise(resolve => { decoded = resolve; }));
        const { chamber, container } = mount();
        await settle();
        chamber.setVisualsOff(true);
        decoded(presenter.frames);
        await settle();
        expect(mountImageStream).not.toHaveBeenCalled();
        expect(container.querySelector('.chamber-image-stream')).toBeNull();
        chamber.destroy();
    });
});
