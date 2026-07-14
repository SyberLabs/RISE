/**
 * PATCH - Aureole
 * A long-form additive pad voiced as a just-intoned harmonic bloom.
 * Eight paired PeriodicWave voices carry pure-ratio consonances while
 * tiny absolute-Hz offsets make the interior breathe without turning
 * the harmony into chorus. A quiet undertone, slow spectral opening,
 * restrained stereo drift, and a locally synthesized diffuse tail add
 * scale without relying on samples or drawing attention to themselves.
 *
 * Character notes (keep this section in every lab patch):
 * - vs app-harmonics: fuller below, wider, and much slower-moving; less
 *   exposed and bell-like, but also less transparent around speech
 * - sits well under app-noise at 0.03-0.07 and behind gentle binaural
 *   beds; fights app-drone at the same root through low-mid buildup
 * - Bloom above 0.75 or Color above 3200 Hz can crowd bright narration;
 *   Open fifth is the leanest mode when the default voicing feels dense
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

const HARMONIES = {
    'Just bloom': [1, 5 / 4, 3 / 2, 2, 5 / 2, 3, 15 / 4, 4],
    'Open fifth': [1, 3 / 2, 2, 3, 4, 9 / 2, 6, 8],
    'Harmonic seventh': [1, 5 / 4, 3 / 2, 7 / 4, 2, 5 / 2, 3, 7 / 2]
};

const VOICE_LEVELS = [0.245, 0.17, 0.145, 0.112, 0.086, 0.068, 0.052, 0.04];
const PAN_POSITIONS = [-0.12, 0.34, -0.46, 0.55, -0.66, 0.73, -0.82, 0.88];
const BEAT_SHAPES = [0.79, 0.93, 1.07, 1.21, 0.86, 1.14, 0.72, 1.28];

function voiceLevel(index, bloom) {
    if (index < 3) return VOICE_LEVELS[index];
    return VOICE_LEVELS[index] * (0.35 + bloom * 1.15);
}

function spaceLevels(space) {
    return {
        dry: 1 - space * 0.22,
        wet: space * 0.72
    };
}

// Deterministic, stereo-decorrelated room response: locally computed,
// gently dark, and free of conspicuous early reflections.
function makeDiffuseImpulse(ctx, seconds = 2.8) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        let seed = channel ? 0x6d2b79f5 : 0x1b873593;
        let smooth = 0;

        for (let i = 0; i < length; i += 1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const white = (seed / 0xffffffff) * 2 - 1;
            smooth += (white - smooth) * 0.22;

            const time = i / ctx.sampleRate;
            const progress = i / length;
            const fadeIn = Math.min(1, time / 0.012);
            const decay = Math.pow(1 - progress, 2.7) * Math.exp(-time * 0.48);
            data[i] = smooth * decay * fadeIn;
        }
    }

    return impulse;
}

export default {
    id: 'lab-aureole',
    name: 'Aureole (Just pad)',
    category: 'lab',
    description: 'A deep just-intoned pad with slow beating, spectral breath, and a dark diffuse halo.',
    params: [
        {
            id: 'root', label: 'Root (Hz)', type: 'range', min: 80, max: 216, step: 1, value: 108,
            marks: { '432 / 4': 108, '432 / 2': 216, 'A3 / 2': 110 }
        },
        {
            id: 'harmony', label: 'Voicing', type: 'select', value: 'Just bloom',
            options: Object.keys(HARMONIES)
        },
        { id: 'beat', label: 'Inner Beat (Hz)', type: 'range', min: 0.03, max: 0.35, step: 0.01, value: 0.12 },
        { id: 'motion', label: 'Breath (Hz)', type: 'range', min: 0.01, max: 0.12, step: 0.01, value: 0.04 },
        { id: 'bloom', label: 'Upper Bloom', type: 'range', min: 0, max: 1, step: 0.01, value: 0.56 },
        { id: 'color', label: 'Color (Hz)', type: 'range', min: 500, max: 4800, step: 25, value: 1850 },
        { id: 'width', label: 'Width', type: 'range', min: 0, max: 1, step: 0.01, value: 0.72 },
        { id: 'space', label: 'Diffuse Space', type: 'range', min: 0, max: 0.55, step: 0.01, value: 0.24 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.4, step: 0.01, value: 0.18 }
    ],

    build(ctx, destination, opts = {}) {
        const state = {
            root: opts.root ?? 108,
            harmony: opts.harmony || 'Just bloom',
            beat: opts.beat ?? 0.12,
            motion: opts.motion ?? 0.04,
            bloom: opts.bloom ?? 0.56,
            color: opts.color ?? 1850,
            width: opts.width ?? 0.72,
            space: opts.space ?? 0.24,
            gain: opts.gain ?? 0.18
        };

        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(destination);

        let nodes = [out];
        let refs = { voices: [] };

        function retune(time) {
            const ratios = HARMONIES[state.harmony] || HARMONIES['Just bloom'];
            refs.voices.forEach((voice, index) => {
                const frequency = state.root * ratios[index];
                voice.ratio = ratios[index];
                voice.main.frequency.setTargetAtTime(frequency, time, 0.18);
                voice.shadow.frequency.setTargetAtTime(
                    frequency + state.beat * BEAT_SHAPES[index], time, 0.18);
            });
            if (refs.undertone) {
                refs.undertone.frequency.setTargetAtTime(state.root / 2, time, 0.2);
            }
        }

        function setBloom(time) {
            refs.voices.forEach((voice, index) => {
                voice.level.gain.setTargetAtTime(voiceLevel(index, state.bloom), time, 0.2);
            });
        }

        function setWidth(time) {
            refs.voices.forEach((voice, index) => {
                voice.panner.pan.setTargetAtTime(PAN_POSITIONS[index] * state.width, time, 0.2);
                const drift = (index % 2 ? 1 : -1) * 0.055 * state.width;
                voice.panMod.gain.setTargetAtTime(drift, time, 0.25);
            });
        }

        function setSpace(time) {
            if (!refs.dry || !refs.wet) return;
            const levels = spaceLevels(state.space);
            refs.dry.gain.setTargetAtTime(levels.dry, time, 0.2);
            refs.wet.gain.setTargetAtTime(levels.wet, time, 0.25);
        }

        return {
            start() {
                const bus = ctx.createGain();
                bus.gain.value = 1;

                const protection = ctx.createBiquadFilter();
                protection.type = 'highpass';
                protection.frequency.value = 32;
                protection.Q.value = 0.71;

                const color = ctx.createBiquadFilter();
                color.type = 'lowpass';
                color.frequency.value = state.color;
                color.Q.value = 0.62;

                const dry = ctx.createGain();
                const wet = ctx.createGain();
                const initialSpace = spaceLevels(state.space);
                dry.gain.value = initialSpace.dry;
                wet.gain.value = initialSpace.wet;

                const predelay = ctx.createDelay(0.08);
                predelay.delayTime.value = 0.031;
                const convolver = ctx.createConvolver();
                convolver.buffer = makeDiffuseImpulse(ctx);

                const wetHighpass = ctx.createBiquadFilter();
                wetHighpass.type = 'highpass';
                wetHighpass.frequency.value = 115;
                wetHighpass.Q.value = 0.7;

                const wetLowpass = ctx.createBiquadFilter();
                wetLowpass.type = 'lowpass';
                wetLowpass.frequency.value = 3300;
                wetLowpass.Q.value = 0.55;

                bus.connect(protection).connect(color);
                color.connect(dry).connect(out);
                color.connect(predelay).connect(convolver)
                    .connect(wetHighpass).connect(wetLowpass).connect(wet).connect(out);

                const breath = ctx.createOscillator();
                breath.type = 'sine';
                breath.frequency.value = state.motion;
                const filterBreath = ctx.createGain();
                filterBreath.gain.value = state.color * 0.14;
                breath.connect(filterBreath).connect(color.frequency);

                // A sine-led custom wave: enough upper structure to read as
                // a pad, with rapidly falling odd/even partials to stay dark.
                const real = new Float32Array(8);
                const imag = new Float32Array([0, 1, 0.18, 0.095, 0.045, 0.028, 0.014, 0.009]);
                const warmWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
                const ratios = HARMONIES[state.harmony] || HARMONIES['Just bloom'];

                const voices = ratios.map((ratio, index) => {
                    const main = ctx.createOscillator();
                    const shadow = ctx.createOscillator();
                    main.setPeriodicWave(warmWave);
                    shadow.setPeriodicWave(warmWave);

                    const frequency = state.root * ratio;
                    main.frequency.value = frequency;
                    shadow.frequency.value = frequency + state.beat * BEAT_SHAPES[index];

                    const mainMix = ctx.createGain();
                    const shadowMix = ctx.createGain();
                    mainMix.gain.value = 0.72;
                    shadowMix.gain.value = 0.28;

                    const level = ctx.createGain();
                    level.gain.value = voiceLevel(index, state.bloom);
                    const panner = ctx.createStereoPanner();
                    panner.pan.value = PAN_POSITIONS[index] * state.width;

                    const panMod = ctx.createGain();
                    panMod.gain.value = (index % 2 ? 1 : -1) * 0.055 * state.width;
                    breath.connect(panMod).connect(panner.pan);

                    main.connect(mainMix).connect(level);
                    shadow.connect(shadowMix).connect(level);
                    level.connect(panner).connect(bus);
                    main.start();
                    shadow.start();

                    nodes.push(main, shadow, mainMix, shadowMix, level, panner, panMod);
                    return { main, shadow, level, panner, panMod, ratio };
                });

                // The quiet undertone supplies physical weight at 108 Hz
                // while the 32 Hz highpass protects small playback systems.
                const undertone = ctx.createOscillator();
                undertone.type = 'sine';
                undertone.frequency.value = state.root / 2;
                const undertoneGain = ctx.createGain();
                undertoneGain.gain.value = 0.055;
                undertone.connect(undertoneGain).connect(bus);

                breath.start();
                undertone.start();

                nodes.push(
                    bus, protection, color, dry, wet, predelay, convolver,
                    wetHighpass, wetLowpass, breath, filterBreath,
                    undertone, undertoneGain
                );
                refs = {
                    voices, undertone, breath, filterBreath,
                    color, dry, wet
                };

                rampIn(ctx, out.gain, state.gain, 2.4);
            },

            stop() {
                rampOut(ctx, out.gain);
                const held = nodes;
                nodes = [];
                refs = { voices: [] };

                setTimeout(() => held.forEach(node => {
                    try {
                        if (node.stop) node.stop();
                        node.disconnect();
                    } catch (error) { /* already released */ }
                }), 1400);
            },

            set(id, value) {
                state[id] = value;
                const time = ctx.currentTime;
                if (!refs.color) return;

                if (id === 'gain') out.gain.setTargetAtTime(value, time, 0.12);
                if (id === 'root' || id === 'harmony' || id === 'beat') retune(time);
                if (id === 'motion') refs.breath.frequency.setTargetAtTime(value, time, 0.2);
                if (id === 'bloom') setBloom(time);
                if (id === 'color') {
                    refs.color.frequency.setTargetAtTime(value, time, 0.18);
                    refs.filterBreath.gain.setTargetAtTime(value * 0.14, time, 0.2);
                }
                if (id === 'width') setWidth(time);
                if (id === 'space') setSpace(time);
            }
        };
    }
};
