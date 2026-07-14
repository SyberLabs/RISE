/**
 * PATCH · Synth Drone (App Port)
 * Faithful port of src/audio/engine.js startDrone() — a sine at the
 * chosen frequency plus a second sine detuned by ratio 1.002 mixed at
 * half strength, whose ~0.86Hz beating (at 432Hz) gives the drone its
 * slow interior shimmer. BASELINE: keep faithful.
 *
 * Note: the app also offers Solfeggio drone frequencies
 * (396/417/528/639/741/852) via startSolfeggioDrone(); the frequency
 * marks below expose them alongside the carrier tunings.
 */
import { TUNINGS, SOLFEGGIO, rampIn, rampOut } from '../sandbox-lib.js';

export function createDrone(ctx, destination, opts = {}) {
    const state = {
        freq: opts.freq ?? 432,
        detune: opts.detune ?? 1.002,
        gain: opts.gain ?? 0.18
    };

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    let main = null, shadow = null, shadowGain = null;

    return {
        start() {
            main = ctx.createOscillator();
            main.frequency.value = state.freq;
            main.type = 'sine';
            shadow = ctx.createOscillator();
            shadow.frequency.value = state.freq * state.detune;
            shadow.type = 'sine';
            shadowGain = ctx.createGain();
            shadowGain.gain.value = 0.5;
            main.connect(out);
            shadow.connect(shadowGain).connect(out);
            main.start();
            shadow.start();
            rampIn(ctx, out.gain, state.gain);
        },
        stop() {
            rampOut(ctx, out.gain);
            const held = [main, shadow];
            main = shadow = null;
            setTimeout(() => held.forEach(o => {
                try { o.stop(); o.disconnect(); } catch (e) { /* done */ }
            }), 1400);
        },
        set(id, value) {
            state[id] = value;
            const t = ctx.currentTime;
            if (id === 'gain') out.gain.setTargetAtTime(value, t, 0.1);
            if ((id === 'freq' || id === 'detune') && main) {
                main.frequency.setTargetAtTime(state.freq, t, 0.08);
                shadow.frequency.setTargetAtTime(state.freq * state.detune, t, 0.08);
            }
        }
    };
}

export default {
    id: 'app-drone',
    name: 'Synth Drone',
    category: 'app baseline',
    description: 'Sine + half-strength 1.002-detuned twin; the beat between them is the drone’s slow breath.',
    params: [
        { id: 'freq', label: 'Frequency (Hz)', type: 'range', min: 60, max: 880, step: 1, value: 432, marks: { ...TUNINGS, ...SOLFEGGIO } },
        { id: 'detune', label: 'Detune Ratio', type: 'range', min: 1.0, max: 1.01, step: 0.0005, value: 1.002 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.6, step: 0.01, value: 0.18 }
    ],
    build: (ctx, dest, opts) => createDrone(ctx, dest, opts)
};
