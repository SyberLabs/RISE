/**
 * PATCH · Tide (Lab Example)
 * The extension-path exemplar: this is what a NEW sound looks like in
 * the sandbox. A two-operator FM pad whose modulation index breathes
 * on a very slow LFO (~0.05Hz — the tempo of resting respiration),
 * through a gently resonant lowpass. Inharmonic ratio 2.01 keeps the
 * spectrum alive without landing on a chord.
 *
 * Character notes (keep this section in every lab patch):
 * - vs app-drone: wider spectrum, slower interior motion, darker top
 * - sits well under app-noise at 0.05; fights app-harmonics above 300Hz
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

export default {
    id: 'lab-fm-tide',
    name: 'Tide (FM pad)',
    category: 'lab',
    description: 'Breathing two-operator FM pad — modulation index rides a respiration-rate LFO.',
    params: [
        { id: 'freq', label: 'Base (Hz)', type: 'range', min: 40, max: 300, step: 1, value: 108 },
        { id: 'ratio', label: 'Mod Ratio', type: 'range', min: 0.5, max: 4, step: 0.01, value: 2.01 },
        { id: 'index', label: 'FM Index', type: 'range', min: 0, max: 300, step: 1, value: 90 },
        { id: 'breath', label: 'Breath (Hz)', type: 'range', min: 0.01, max: 0.3, step: 0.01, value: 0.05 },
        { id: 'cutoff', label: 'Filter (Hz)', type: 'range', min: 100, max: 2000, step: 10, value: 640 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.6, step: 0.01, value: 0.22 }
    ],
    build(ctx, destination, opts = {}) {
        const state = {
            freq: opts.freq ?? 108, ratio: opts.ratio ?? 2.01,
            index: opts.index ?? 90, breath: opts.breath ?? 0.05,
            cutoff: opts.cutoff ?? 640, gain: opts.gain ?? 0.22
        };

        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(destination);

        let nodes = [];
        let refs = {};

        return {
            start() {
                const carrier = ctx.createOscillator();
                carrier.frequency.value = state.freq;
                const modulator = ctx.createOscillator();
                modulator.frequency.value = state.freq * state.ratio;
                const modDepth = ctx.createGain();
                modDepth.gain.value = state.index;

                // breath LFO swings the FM index between ~40% and 100%
                const lfo = ctx.createOscillator();
                lfo.frequency.value = state.breath;
                const lfoGain = ctx.createGain();
                lfoGain.gain.value = state.index * 0.3;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = state.cutoff;
                filter.Q.value = 0.9;

                modulator.connect(modDepth).connect(carrier.frequency);
                lfo.connect(lfoGain).connect(modDepth.gain);
                carrier.connect(filter).connect(out);

                carrier.start(); modulator.start(); lfo.start();
                nodes = [carrier, modulator, lfo, modDepth, lfoGain, filter];
                refs = { carrier, modulator, modDepth, lfoGain, filter };
                rampIn(ctx, out.gain, state.gain);
            },
            stop() {
                rampOut(ctx, out.gain);
                const held = nodes;
                nodes = []; refs = {};
                setTimeout(() => held.forEach(n => {
                    try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* done */ }
                }), 1400);
            },
            set(id, value) {
                state[id] = value;
                const t = ctx.currentTime;
                if (!refs.carrier) return;
                if (id === 'gain') out.gain.setTargetAtTime(value, t, 0.1);
                if (id === 'freq' || id === 'ratio') {
                    refs.carrier.frequency.setTargetAtTime(state.freq, t, 0.08);
                    refs.modulator.frequency.setTargetAtTime(state.freq * state.ratio, t, 0.08);
                }
                if (id === 'index') {
                    refs.modDepth.gain.setTargetAtTime(value, t, 0.1);
                    refs.lfoGain.gain.setTargetAtTime(value * 0.3, t, 0.1);
                }
                if (id === 'breath') nodes[2].frequency.setTargetAtTime(value, t, 0.1);
                if (id === 'cutoff') refs.filter.frequency.setTargetAtTime(value, t, 0.1);
            }
        };
    }
};
