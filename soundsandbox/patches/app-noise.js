/**
 * PATCH · Pink Noise (App Port)
 * Faithful port of src/audio/engine.js startNoise() — Paul Kellet's
 * refined pink noise (equal energy per octave, 1/f spectrum), rendered
 * into a 2-second looping buffer. BASELINE: keep faithful.
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

export function createPinkNoise(ctx, destination, opts = {}) {
    const state = { gain: opts.gain ?? 0.1 };

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    let source = null;

    return {
        start() {
            const bufferSize = 2 * ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
            source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(out);
            source.start();
            rampIn(ctx, out.gain, state.gain);
        },
        stop() {
            rampOut(ctx, out.gain);
            const held = source;
            source = null;
            setTimeout(() => { try { held.stop(); held.disconnect(); } catch (e) { /* done */ } }, 1400);
        },
        set(id, value) {
            state[id] = value;
            if (id === 'gain') out.gain.setTargetAtTime(value, ctx.currentTime, 0.1);
        }
    };
}

export default {
    id: 'app-noise',
    name: 'Pink Noise',
    category: 'app baseline',
    description: 'Kellet-filtered pink noise — the app’s 1/f texture floor.',
    params: [
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.5, step: 0.01, value: 0.1 }
    ],
    build: (ctx, dest, opts) => createPinkNoise(ctx, dest, opts)
};
