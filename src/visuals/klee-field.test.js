/**
 * KleeField (Genesis mode) unit tests — episode selection, semantic
 * following, stillness policy, and teardown. Engine is injected/mocked;
 * rendering no-ops headlessly.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { KleeField } from './klee-field.js';
import { KLEE_PRESET_NAMES } from './klee-enhanced.js';

function mockEngine() {
    return {
        width: 0,
        height: 0,
        renderStyle: { texture: 0.02 },
        generateRandomAsync: vi.fn().mockResolvedValue(undefined),
        render: vi.fn(),
        destroy: vi.fn()
    };
}

function makeField(options = {}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const engine = mockEngine();
    const field = new KleeField(host, { engine, ...options });
    return { field, engine, host };
}

describe('KleeField (Genesis)', () => {
    afterEach(() => document.documentElement.classList.remove('reduced-motion', 'photosensitivity-mode'));

    it('begins an episode on construction with the configured preset', () => {
        const { field, engine, host } = makeField({ preset: 'harmonic' });
        expect(engine.generateRandomAsync).toHaveBeenCalledTimes(1);
        expect(engine.generateRandomAsync.mock.calls[0][0]).toBe('harmonic');
        expect(field.lastPreset).toBe('harmonic');
        field.destroy();
        host.remove();
    });

    it('random mode never repeats the previous preset back-to-back', () => {
        const { field, host } = makeField({ preset: 'random' });
        const first = field.lastPreset;
        expect(KLEE_PRESET_NAMES).toContain(first);
        for (let i = 0; i < 20; i++) {
            const next = field._choosePreset();
            expect(next).not.toBe(field.lastPreset);
            field.lastPreset = next;
        }
        field.destroy();
        host.remove();
    });

    it('random mode follows the conductor quadrant when a signal is present', () => {
        const { field, host } = makeField({ preset: 'random' });
        field.lastPreset = 'harmonic'; // avoid the no-repeat guard interfering
        field.setSignal({ valence: -0.8, arousal: 0.9 });
        expect(field._choosePreset()).toBe('chaotic'); // dark-intense quadrant

        field.lastPreset = 'chaotic';
        field.setSignal({ valence: 0.8, arousal: 0.2 });
        expect(field._choosePreset()).toBe('harmonic'); // warm-calm quadrant
        field.destroy();
        host.remove();
    });

    it('an explicit preset stays locked regardless of signal', () => {
        const { field, host } = makeField({ preset: 'gravitational' });
        field.setSignal({ valence: -0.9, arousal: 0.9 });
        expect(field._choosePreset()).toBe('gravitational');
        field.destroy();
        host.remove();
    });

    it('stillness policy: reduced-motion renders complete compositions, no growth', () => {
        document.documentElement.classList.add('reduced-motion');
        const { field, host } = makeField({ preset: 'harmonic' });
        expect(field.progress).toBe(1);
        expect(field.phase).toBe('holding');
        document.documentElement.classList.remove('reduced-motion');
        field.destroy();
        host.remove();
    });

    it('stillness policy: under reduced motion a composition stays, and never blinks out', () => {
        // The 1.6s dissolve is cut to nothing by the reduced-motion CSS, so a
        // dissolve here would be the picture vanishing and another snapping in.
        document.documentElement.classList.add('reduced-motion');
        const { field, engine, host } = makeField({ preset: 'harmonic' });
        field.phaseStart = 0;
        field.tick(120000);
        expect(field.phase).toBe('holding');
        expect(field.canvas.style.opacity).toBe('1');
        expect(engine.generateRandomAsync).toHaveBeenCalledTimes(1);

        // With motion back on, the field moves on again.
        document.documentElement.classList.remove('reduced-motion');
        field.tick(120001);
        expect(field.phase).toBe('fading');
        field.destroy();
        host.remove();
    });

    it('stillness policy: photosensitivity alone keeps the slow dissolve between compositions', () => {
        document.documentElement.classList.add('photosensitivity-mode');
        const { field, host } = makeField({ preset: 'harmonic' });
        expect(field.phase).toBe('holding');
        field.phaseStart = 0;
        field.tick(120000);
        expect(field.phase).toBe('fading');
        field.destroy();
        host.remove();
    });

    it('stillness policy: reduced motion turned on mid-growth completes the composition at once', () => {
        const { field, host } = makeField({ preset: 'harmonic' });
        field.phaseStart = 0;
        field.tick(5000);
        expect(field.progress).toBeLessThan(1);
        document.documentElement.classList.add('reduced-motion');
        field.tick(5016);
        expect(field.progress).toBe(1);
        expect(field.phase).toBe('holding');
        field.destroy();
        host.remove();
    });

    it('growth eases progress forward and re-renders sparsely', () => {
        const { field, host } = makeField({ preset: 'harmonic' });
        expect(field.phase).toBe('growing');
        field.phaseStart = 0;
        field.tick(5000); // 5s into a 28s growth
        expect(field.progress).toBeGreaterThan(0.15);
        expect(field.progress).toBeLessThan(0.6);
        field.tick(28001);
        expect(field.progress).toBe(1);
        expect(field.phase).toBe('holding');
        field.destroy();
        host.remove();
    });

    it('pause freezes growth; resume continues exactly where it stopped', () => {
        const { field, host } = makeField({ preset: 'harmonic' });
        field.phaseStart = 0;
        field.tick(5000);
        const progressAtPause = field.progress;

        field.pause();
        field.tick(20000); // time passes while paused
        expect(field.progress).toBe(progressAtPause);

        field.resume();
        // phaseStart shifted by the paused span, so effective elapsed resumes
        expect(field.paused).toBe(false);
        field.tick(field.phaseStart + 5000); // same effective elapsed as before
        expect(field.progress).toBeCloseTo(progressAtPause, 5);

        field.destroy();
        host.remove();
    });

    it('destroy cancels the loop and removes the canvas', () => {
        const { field, engine, host } = makeField({ preset: 'harmonic' });
        const canvas = host.querySelector('.klee-field-canvas');
        expect(canvas).not.toBeNull();
        field.destroy();
        expect(field.rafId).toBeNull();
        expect(host.querySelector('.klee-field-canvas')).toBeNull();
        expect(engine.destroy).toHaveBeenCalled();
        host.remove();
    });
});
