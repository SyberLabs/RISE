/**
 * THE LAUNCH GATE WITH THE IMAGE STREAM SWITCHED ON.
 *
 * `IMAGE_STREAM_ENABLED` is off in the build; this file mocks it on to state
 * what the gate does when somebody flips it. The stream is treated as a
 * flash: the photosensitivity notice is raised and must be accepted before
 * it starts. Declined, or with photosensitivity mode on, the reading opens as
 * Gallery. The visual engine is never handed the stream: it runs Gallery, and
 * the Chamber is told separately, and only after an accepted notice, that it
 * may mount the stream over it.
 *
 * The flag-off half is in chamber-session-factory.test.js and
 * src/core/flashing-disabled.test.js.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChamberSession } from './chamber-session-factory.js';
import { Chamber } from '../components/read/Chamber.js';
import { compileRiseCurrent, RISE_CURRENT_LOOKS } from '../core/rise-current.js';
import { lowerCurrentLook } from '../core/current-look.js';
import { endVisualInterlocutionSession } from '../core/visual-safety.js';

vi.mock('../core/visual-presence.js', async importOriginal => {
    const real = await importOriginal();
    return {
        ...real,
        IMAGE_STREAM_ENABLED: true,
        normalizePresentation: value => real.resolvePresentation(value, {
            flashing: real.FLASHING_ENABLED,
            stream: true
        })
    };
});
vi.mock('../components/read/Chamber.js', () => ({
    Chamber: vi.fn(function Chamber(container, options) { this.options = options; this.announceMovement = vi.fn(); })
}));

function operations() {
    const cortex = {
        warmImagery: vi.fn(),
        resetSessionVisualIdentity: vi.fn(),
        beginSessionVisualIdentity: vi.fn(),
        preloadProgram: vi.fn(async () => {}),
        preload: vi.fn(async () => {}),
        updateConfig: vi.fn()
    };
    const audio = { stopAmbient: vi.fn(), stopSession: vi.fn(), startSession: vi.fn(async () => {}) };
    return {
        cortex,
        router: { navigationRevision: 1, back: vi.fn(), getViewInstance: () => null },
        ensureVisualCortex: async () => cortex,
        ensureAudioEngine: async () => audio,
        getVisualCortex: () => cortex,
        getAudioEngine: () => audio,
        getSettings: () => ({}),
        showLoading: vi.fn(), updateLoadingStatus: vi.fn(), hideLoading: vi.fn(), showToast: vi.fn(),
        handleSettingsChange: vi.fn(), handleDataCleared: vi.fn(), handleNavigate: vi.fn(),
        releaseSession: vi.fn()
    };
}

const streamReading = (patch = {}) => ({
    atoms: [{ content: 'One.', duration: 400 }, { content: 'Two.', duration: 400 }],
    visualConfig: {
        visualMode: 'interlocution',
        interlocution: { presentation: 'stream', procedural: ['fractal'], sourced: [] }
    },
    ...patch
});

const modal = () => document.getElementById('photosensitivity-modal');

/** Launch, answering the notice with `answer` ('accept', 'cancel' or null for none expected). */
async function launch(op, reading, answer) {
    vi.useFakeTimers();
    let settled = false;
    const pending = createChamberSession(op, document.createElement('div'), reading)
        .finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(1);
    const shown = !modal().classList.contains('hidden');
    if (answer) document.getElementById(`safety-${answer}`).click();
    // Lazy imports land on their own time; keep the clock moving until it is up.
    for (let i = 0; i < 100 && !settled; i++) await vi.advanceTimersByTimeAsync(50);
    await pending;
    return { shown, options: Chamber.mock.calls.at(-1)?.[1] };
}

/** Every presentation the visual engine was configured with. */
const engineSurfaces = op => op.cortex.beginSessionVisualIdentity.mock.calls.map(([config]) => config.presentation);

beforeAll(async () => {
    // The factory imports this lazily; loading it here keeps a real-time
    // module load from racing the fake clock.
    await import('../core/memory.js');
});

beforeEach(() => {
    document.body.innerHTML = `
        <div id="photosensitivity-modal" class="hidden">
            <div class="safety-modal-content"></div>
            <button id="safety-cancel" type="button">Cancel</button>
            <button id="safety-accept" type="button">Enable visuals</button>
        </div>`;
});

afterEach(() => {
    endVisualInterlocutionSession();
    document.documentElement.classList.remove('photosensitivity-mode');
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe('a reading that asks for the image stream, with its flag on', () => {
    it('raises the photosensitivity notice before anything starts, and streams once it is accepted', async () => {
        const op = operations();
        const { shown, options } = await launch(op, streamReading(), 'accept');
        expect(shown).toBe(true);
        expect(options.imageStream).toBe(true);
        expect(engineSurfaces(op)).toEqual(['continuous']);
    });

    it('opens as Gallery, with no stream, when the notice is declined', async () => {
        const op = operations();
        const reading = streamReading();
        const { shown, options } = await launch(op, reading, 'cancel');
        expect(shown).toBe(true);
        expect(options.imageStream).not.toBe(true);
        expect(reading.visualConfig.visualMode).toBe('interlocution');
        expect(engineSurfaces(op)).toEqual(['continuous']);
        expect(op.showToast).toHaveBeenCalledWith(expect.stringContaining('image stream'), expect.any(Number));
    });

    it('opens as Gallery, with no notice and no stream, under photosensitivity mode', async () => {
        document.documentElement.classList.add('photosensitivity-mode');
        const op = operations();
        const { shown, options } = await launch(op, streamReading(), null);
        expect(shown).toBe(false);
        expect(options.imageStream).not.toBe(true);
        expect(engineSurfaces(op)).toEqual(['continuous']);
    });

    it('never streams a reading that opens as a page, neither now nor when it leaves the page', async () => {
        const op = operations();
        const { shown, options } = await launch(op, streamReading({ projection: 'page' }), null);
        expect(shown).toBe(false);
        expect(options.imageStream).not.toBe(true);
        expect(engineSurfaces(op)).toEqual(['continuous']);
        await expect(options.onEnterStream()).resolves.toBe(true);
        expect(modal().classList.contains('hidden')).toBe(true);
        expect(op.cortex.updateConfig).not.toHaveBeenCalledWith(expect.objectContaining({ presentation: 'stream' }));
    });

    it('leaves Gallery and the other surfaces exactly as they were', async () => {
        const op = operations();
        const { shown, options } = await launch(op, streamReading({
            visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['fractal'] } }
        }), null);
        expect(shown).toBe(false);
        expect(options.imageStream).not.toBe(true);
        expect(engineSurfaces(op)).toEqual(['continuous']);
    });
});

describe('a Composer Current, with the stream flag on', () => {
    const current = look => ({
        schema: 'rise.current.v1',
        id: 'probe',
        title: 'Probe',
        origin: { kind: 'model', name: 'Probe', provider: 'example-provider' },
        segments: [{ id: 'one', text: 'Gravity curves spacetime.', visual: 'attractor' }],
        ...(look ? { look } : {})
    });

    it('can never select the stream, whatever look it names', () => {
        for (const look of [undefined, ...RISE_CURRENT_LOOKS]) {
            const session = compileRiseCurrent(current(look), { lowerLook: lowerCurrentLook });
            expect(session.visualConfig.interlocution?.presentation, `look ${look}`).not.toBe('stream');
        }
    });

    it('cannot name a presentation at all', () => {
        expect(() => compileRiseCurrent({ ...current(), presentation: 'stream' })).toThrow();
        expect(() => compileRiseCurrent({
            ...current(),
            segments: [{ id: 'one', text: 'Gravity.', visual: 'stream' }]
        })).toThrow();
    });

    it('launches without a notice and without a stream', async () => {
        const op = operations();
        const session = compileRiseCurrent(current('gallery'), { lowerLook: lowerCurrentLook });
        const { shown, options } = await launch(op, session, null);
        expect(shown).toBe(false);
        expect(options.imageStream).not.toBe(true);
    });
});
