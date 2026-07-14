/**
 * PATCH · Harmonic Overtones (App Port)
 * Faithful port of src/audio/engine.js startHarmonics() — five sine
 * partials of the natural harmonic series (1×..5×) with amplitudes
 * halving each step (0.5, 0.25, 0.125, 0.0625, 0.03125). BASELINE:
 * keep faithful; iterate in a lab-*.js copy.
 */
import { TUNINGS, rampIn, rampOut } from '../sandbox-lib.js';

export function createHarmonics(ctx, destination, opts = {}) {
    const state = { carrier: opts.carrier ?? 432, gain: opts.gain ?? 0.15 };
    const RATIOS = [1, 2, 3, 4, 5];
    const AMPS = [0.5, 0.25, 0.125, 0.0625, 0.03125];

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    let voices = [];

    return {
        start() {
            voices = RATIOS.map((ratio, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = state.carrier * ratio;
                osc.type = 'sine';
                gain.gain.value = AMPS[i];
                osc.connect(gain).connect(out);
                osc.start();
                return { osc, gain, ratio };
            });
            rampIn(ctx, out.gain, state.gain);
        },
        stop() {
            rampOut(ctx, out.gain);
            const held = voices;
            voices = [];
            setTimeout(() => held.forEach(({ osc }) => {
                try { osc.stop(); osc.disconnect(); } catch (e) { /* done */ }
            }), 1400);
        },
        set(id, value) {
            state[id] = value;
            const t = ctx.currentTime;
            if (id === 'gain') out.gain.setTargetAtTime(value, t, 0.1);
            if (id === 'carrier') {
                voices.forEach(({ osc, ratio }) =>
                    osc.frequency.setTargetAtTime(value * ratio, t, 0.08));
            }
        }
    };
}

export default {
    id: 'app-harmonics',
    name: 'Harmonics',
    category: 'app baseline',
    description: 'Five-partial natural harmonic series on the carrier — the app’s overtone bed.',
    params: [
        { id: 'carrier', label: 'Fundamental (Hz)', type: 'range', min: 60, max: 528, step: 1, value: 432, marks: TUNINGS },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.6, step: 0.01, value: 0.15 }
    ],
    build: (ctx, dest, opts) => createHarmonics(ctx, dest, opts)
};
