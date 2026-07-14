/**
 * PATCH · Layer Presets (App Port)
 * Composes the four baseline layers exactly as LAYER_PRESETS stacks
 * them in src/audio/engine.js — so the sandbox can play "what Focus
 * actually sounds like" as one unit and A/B a whole preset against a
 * candidate replacement. BASELINE: volumes mirror the app verbatim.
 */
import { createEntrainment } from './app-binaural.js';
import { createHarmonics } from './app-harmonics.js';
import { createPinkNoise } from './app-noise.js';
import { createDrone } from './app-drone.js';

// Mirrors LAYER_PRESETS (engine.js) — band resolved to its default Hz
const PRESETS = {
    focus: {
        binaural: { beat: 10, gain: 0.25 },   // alpha
        harmonics: { gain: 0.15 }
    },
    deep: {
        binaural: { beat: 6, gain: 0.3 },     // theta
        harmonics: { gain: 0.2 },
        noise: { gain: 0.08 },
        drone: { gain: 0.15 }
    },
    drift: {
        binaural: { beat: 2, gain: 0.2 },     // delta
        harmonics: { gain: 0.25 },
        noise: { gain: 0.12 },
        drone: { gain: 0.2 }
    },
    gateway: {
        binaural: { beat: 6, gain: 0.35 },    // theta, hemi-sync inspired
        harmonics: { gain: 0.15 },
        noise: { gain: 0.1 },
        drone: { gain: 0.18 }
    }
};

const LAYER_FACTORIES = {
    binaural: createEntrainment,
    harmonics: createHarmonics,
    noise: createPinkNoise,
    drone: createDrone
};

export default {
    id: 'app-presets',
    name: 'Layer Presets',
    category: 'app baseline',
    description: 'The app’s full preset stacks (Focus / Deep / Drift / Gateway) as single playable units.',
    params: [
        { id: 'preset', label: 'Preset', type: 'select', value: 'gateway', options: Object.keys(PRESETS) },
        { id: 'carrier', label: 'Carrier (Hz)', type: 'range', min: 60, max: 528, step: 1, value: 432 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 1, step: 0.01, value: 0.8 }
    ],
    build(ctx, destination, opts = {}) {
        const state = {
            preset: opts.preset || 'gateway',
            carrier: opts.carrier ?? 432,
            gain: opts.gain ?? 0.8
        };
        const out = ctx.createGain();
        out.gain.value = state.gain;
        out.connect(destination);

        let handles = [];
        let playing = false;

        function spawn() {
            const recipe = PRESETS[state.preset];
            handles = Object.entries(recipe).map(([layer, layerOpts]) =>
                LAYER_FACTORIES[layer](ctx, out, { ...layerOpts, carrier: state.carrier, freq: state.carrier }));
            handles.forEach(h => h.start());
        }

        return {
            start() { playing = true; spawn(); },
            stop() {
                playing = false;
                handles.forEach(h => h.stop());
                handles = [];
            },
            set(id, value) {
                state[id] = value;
                if (id === 'gain') {
                    out.gain.setTargetAtTime(value, ctx.currentTime, 0.1);
                } else if (id === 'carrier') {
                    handles.forEach(h => { h.set('carrier', value); h.set('freq', value); });
                } else if (id === 'preset' && playing) {
                    handles.forEach(h => h.stop()); // crossfades via layer ramps
                    spawn();
                }
            }
        };
    }
};
