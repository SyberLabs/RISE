/**
 * PATCH · Entrainment (App Port)
 * Faithful port of src/audio/engine.js startEntrainment() — the app's
 * binaural / monaural / isochronic layer. This is a BASELINE patch:
 * keep it byte-faithful to the app so A/B comparisons against new
 * work always have honest ground truth. Do not "improve" this file;
 * copy it into a lab-*.js patch and improve that.
 */
import { BANDS, TUNINGS, rampIn, rampOut } from '../sandbox-lib.js';

export function createEntrainment(ctx, destination, opts = {}) {
    const state = {
        mode: opts.mode || 'binaural',
        waveform: opts.waveform || 'sine',
        carrier: opts.carrier ?? 432,
        beat: opts.beat ?? 6,
        depth: opts.depth ?? 1,
        gain: opts.gain ?? 0.25
    };

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    let nodes = [];

    function teardown() {
        for (const n of nodes) {
            try { if (n.stop) n.stop(); } catch (e) { /* already stopped */ }
            try { n.disconnect(); } catch (e) { /* detached */ }
        }
        nodes = [];
    }

    function buildGraph() {
        teardown();
        if (state.mode === 'binaural') {
            const left = ctx.createOscillator();
            const right = ctx.createOscillator();
            left.frequency.value = state.carrier;
            right.frequency.value = state.carrier + state.beat;
            left.type = right.type = state.waveform;
            const panL = ctx.createStereoPanner();
            const panR = ctx.createStereoPanner();
            panL.pan.value = -1;
            panR.pan.value = 1;
            left.connect(panL).connect(out);
            right.connect(panR).connect(out);
            left.start();
            right.start();
            nodes = [left, right, panL, panR];
        } else if (state.mode === 'monaural') {
            const left = ctx.createOscillator();
            const right = ctx.createOscillator();
            left.frequency.value = state.carrier;
            right.frequency.value = state.carrier + state.beat;
            left.type = right.type = state.waveform;
            const mix = ctx.createGain();
            left.connect(mix);
            right.connect(mix);
            mix.connect(out);
            left.start();
            right.start();
            nodes = [left, right, mix];
        } else { // isochronic — square LFO gates the carrier's amplitude
            const carrier = ctx.createOscillator();
            carrier.frequency.value = state.carrier;
            carrier.type = state.waveform;
            const pulse = ctx.createGain();
            pulse.gain.value = 0;
            const lfo = ctx.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = state.beat;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.5 * state.depth;
            const offset = ctx.createConstantSource();
            offset.offset.value = 1 - (0.5 * state.depth);
            lfo.connect(lfoGain).connect(pulse.gain);
            offset.connect(pulse.gain);
            carrier.connect(pulse);
            pulse.connect(out);
            carrier.start();
            lfo.start();
            offset.start();
            nodes = [carrier, pulse, lfo, lfoGain, offset];
        }
    }

    return {
        start() { buildGraph(); rampIn(ctx, out.gain, state.gain); },
        stop() { rampOut(ctx, out.gain); setTimeout(teardown, 1400); },
        set(id, value) {
            state[id] = value;
            const t = ctx.currentTime;
            // Continuous params glide; topology params rebuild the graph
            if (id === 'gain') {
                out.gain.setTargetAtTime(value, t, 0.1);
            } else if (id === 'carrier' || id === 'beat') {
                const [a, b] = nodes;
                if (state.mode !== 'isochronic' && a && b) {
                    a.frequency.setTargetAtTime(state.carrier, t, 0.08);
                    b.frequency.setTargetAtTime(state.carrier + state.beat, t, 0.08);
                } else if (a) {
                    a.frequency.setTargetAtTime(state.carrier, t, 0.08);
                    const lfo = nodes[2];
                    if (lfo) lfo.frequency.setTargetAtTime(state.beat, t, 0.08);
                }
            } else if (nodes.length) {
                buildGraph(); // mode / waveform / depth change
            }
        }
    };
}

export default {
    id: 'app-entrainment',
    name: 'Entrainment',
    category: 'app baseline',
    description: 'The app’s entrainment layer: binaural, monaural, or isochronic beat at a tunable carrier.',
    params: [
        { id: 'mode', label: 'Mode', type: 'select', value: 'binaural', options: ['binaural', 'monaural', 'isochronic'] },
        { id: 'waveform', label: 'Wave', type: 'select', value: 'sine', options: ['sine', 'triangle', 'sawtooth'] },
        { id: 'carrier', label: 'Carrier (Hz)', type: 'range', min: 60, max: 528, step: 1, value: 432, marks: TUNINGS },
        { id: 'beat', label: 'Beat (Hz)', type: 'range', min: 0.5, max: 40, step: 0.5, value: 6, marks: BANDS },
        { id: 'depth', label: 'Iso Depth', type: 'range', min: 0, max: 1, step: 0.05, value: 1 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.6, step: 0.01, value: 0.25 }
    ],
    build: (ctx, dest, opts) => createEntrainment(ctx, dest, opts)
};
