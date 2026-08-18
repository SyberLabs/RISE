/**
 * A swell is one voice.
 *
 * A reader imported a personal swell, scored it across a whole text, and heard
 * the same audio playing over itself with an offset. Two triggers can fire
 * close together — the entry swell at session start, and the scored swell lane
 * as the first atoms resolve — and `playSwell` started a new buffer source
 * every time without stopping the one already sounding. Both stayed connected
 * to the single swell gain, whose envelope is cancelled and re-ramped from
 * zero on every call, so the second start ducked the first and then lifted the
 * pair together.
 */
import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.js';

function bench() {
    const engine = new AudioEngine();
    const started = [];
    const stopped = [];
    engine.isInitialized = true;
    engine.context = {
        currentTime: 0,
        createBufferSource: () => {
            const source = {
                buffer: null, onended: null,
                connect: vi.fn(),
                start: vi.fn(() => started.push(source)),
                stop: vi.fn(() => stopped.push(source))
            };
            return source;
        },
        createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: {
            value: 1,
            cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn()
        } })
    };
    const gainStub = () => ({
        value: 1,
        cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn()
    });
    engine.masterGain = { connect: vi.fn(), gain: gainStub() };
    engine.layerGains = {};
    engine.layers = {};
    engine.buffers = { swells: [{ id: 'standard' }], personalSwells: [{ id: 'mine' }] };
    engine.personalPool = new Map([['mine', { id: 'mine' }]]);
    return { engine, started, stopped };
}

describe('one swell at a time', () => {
    it('stops the sounding swell before starting the next', async () => {
        const { engine, started, stopped } = bench();
        await engine.playSwell('mine');
        await engine.playSwell('mine');
        expect(started).toHaveLength(2);
        // The first voice is stopped rather than left to finish underneath.
        expect(stopped).toHaveLength(1);
        expect(stopped[0]).toBe(started[0]);
        expect(engine.layers.swell).toBe(started[1]);
    });

    it('leaves nothing sounding when the pool cannot answer a name', async () => {
        const { engine, started } = bench();
        await engine.playSwell('not-in-the-pool');
        expect(started).toHaveLength(0);
    });

    it('does not fire the entry swell when a score owns the lane', async () => {
        const { engine } = bench();
        vi.spyOn(engine, 'init').mockResolvedValue(undefined);
        vi.spyOn(engine, 'resume').mockResolvedValue(undefined);
        vi.spyOn(engine, 'fadeInSession').mockResolvedValue(undefined);
        vi.spyOn(engine, 'stopAmbient').mockImplementation(() => {});
        const swell = vi.spyOn(engine, 'playSwell').mockResolvedValue(undefined);

        await engine.startSession({ entrySwell: false, swellId: null });
        expect(swell).not.toHaveBeenCalled();

        await engine.startSession({ swellId: 'mine' });
        expect(swell).toHaveBeenCalledWith('mine');
    });
});
