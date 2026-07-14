/**
 * PATCH - Faded Signal
 * An original weathered-analog bed built from paired custom-wave voices,
 * just-ratio suspended harmony, two layers of slow pitch drift, softened
 * bandwidth, seamless local tape haze, and a tightly bounded feedback
 * smear. The language is nostalgic and imperfect without borrowing an
 * identifiable melody or turning degradation into a foreground effect.
 *
 * Character notes (keep this section in every lab patch):
 * - vs lab-aureole: darker, grainier, and deliberately less pure; it has
 *   more midrange character but less luminous upper harmonic detail
 * - sits well beneath lab-still-passage around 0.08-0.12; built-in Dust
 *   makes app-noise mostly redundant, while Halo can crowd its midrange
 * - Drift above 8 cents or Patina above 0.8 becomes conspicuously worn;
 *   keep both lower for reading that depends on analytical concentration
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

const VOICINGS = {
    'Faded suspension': [1, 9 / 8, 4 / 3, 3 / 2, 2, 9 / 4],
    'Warm sixth': [1, 5 / 4, 3 / 2, 5 / 3, 2, 5 / 2],
    'Open dusk': [1, 6 / 5, 3 / 2, 9 / 5, 2, 12 / 5]
};

const VOICE_LEVELS = [0.25, 0.17, 0.14, 0.105, 0.075, 0.052];
const PAN_POSITIONS = [-0.24, 0.34, -0.48, 0.58, -0.72, 0.8];
const DRIFT_SIGNS = [-1, 1, 1, -1, -1, 1];

function toneForAge(age) {
    return 3600 - age * 2400;
}

function smearLevels(smear) {
    return {
        dry: 1 - smear * 0.12,
        wet: smear * 0.32
    };
}

function makeSoftCurve(amount = 1.35, size = 2048) {
    const curve = new Float32Array(size);
    const normal = Math.tanh(amount);
    for (let i = 0; i < size; i += 1) {
        const x = i * 2 / (size - 1) - 1;
        curve[i] = Math.tanh(x * amount) / normal;
    }
    return curve;
}

function makeHazeBuffer(ctx, seconds = 8) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const edge = Math.max(1, Math.floor(ctx.sampleRate * 0.1));
    let seed = 0x7f4a7c15;
    let pinkish = 0;

    for (let i = 0; i < length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const white = (seed / 0xffffffff) * 2 - 1;
        pinkish += (white - pinkish) * 0.075;
        const fadeIn = Math.min(1, i / edge);
        const fadeOut = Math.min(1, (length - 1 - i) / edge);
        const edgeGain = Math.max(0, Math.min(fadeIn, fadeOut));
        data[i] = (pinkish * 0.78 + white * 0.12) * edgeGain;
    }
    return buffer;
}

function disconnectNodes(nodes) {
    nodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch (error) { /* already stopped */ }
        try { node.disconnect(); } catch (error) { /* already disconnected */ }
    });
}

export default {
    id: 'lab-faded-signal',
    name: 'Faded Signal (Analog memory)',
    category: 'lab',
    description: 'Sun-worn suspended harmony with slow tape drift, softened bandwidth, and a quiet feedback afterimage.',
    params: [
        {
            id: 'root', label: 'Root (Hz)', type: 'range', min: 80, max: 180, step: 1, value: 108,
            marks: { '216 / 2': 108, '220 / 2': 110, '432 / 3': 144 }
        },
        {
            id: 'voicing', label: 'Memory Field', type: 'select', value: 'Faded suspension',
            options: Object.keys(VOICINGS)
        },
        { id: 'drift', label: 'Tape Drift (cents)', type: 'range', min: 0, max: 12, step: 0.25, value: 4.5 },
        { id: 'motion', label: 'Wow Rate (Hz)', type: 'range', min: 0.01, max: 0.12, step: 0.005, value: 0.035 },
        { id: 'age', label: 'Patina', type: 'range', min: 0, max: 1, step: 0.01, value: 0.62 },
        { id: 'width', label: 'Width', type: 'range', min: 0, max: 1, step: 0.01, value: 0.68 },
        { id: 'smear', label: 'Feedback Smear', type: 'range', min: 0, max: 0.7, step: 0.01, value: 0.28 },
        { id: 'dust', label: 'Tape Dust', type: 'range', min: 0, max: 0.08, step: 0.002, value: 0.018 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.35, step: 0.01, value: 0.17 }
    ],

    build(ctx, destination, opts = {}) {
        const state = {
            root: opts.root ?? 108,
            voicing: opts.voicing || 'Faded suspension',
            drift: opts.drift ?? 4.5,
            motion: opts.motion ?? 0.035,
            age: opts.age ?? 0.62,
            width: opts.width ?? 0.68,
            smear: opts.smear ?? 0.28,
            dust: opts.dust ?? 0.018,
            gain: opts.gain ?? 0.17
        };

        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(destination);

        let nodes = [out];
        let refs = { voices: [] };

        function currentVoicing() {
            return VOICINGS[state.voicing] || VOICINGS['Faded suspension'];
        }

        function retune(time) {
            const ratios = currentVoicing();
            refs.voices.forEach((voice, index) => {
                const frequency = state.root * ratios[index];
                voice.ratio = ratios[index];
                voice.main.frequency.setTargetAtTime(frequency, time, 0.3);
                voice.shadow.frequency.setTargetAtTime(frequency, time, 0.3);
            });
            if (refs.undertone) {
                refs.undertone.frequency.setTargetAtTime(state.root / 2, time, 0.35);
            }
        }

        function setDrift(time) {
            refs.voices.forEach((voice, index) => {
                const direction = DRIFT_SIGNS[index];
                voice.main.detune.setTargetAtTime(-state.drift * direction * 0.28, time, 0.25);
                voice.shadow.detune.setTargetAtTime(state.drift * direction, time, 0.25);
            });
            refs.wowDepth.gain.setTargetAtTime(state.drift * 0.82, time, 0.3);
            refs.flutterDepth.gain.setTargetAtTime(state.drift * 0.16, time, 0.3);
        }

        function setAge(time) {
            const tone = toneForAge(state.age);
            refs.tone.frequency.setTargetAtTime(tone, time, 0.3);
            refs.toneBreathDepth.gain.setTargetAtTime(tone * 0.1, time, 0.3);
            refs.smearFilter.frequency.setTargetAtTime(1750 - state.age * 700, time, 0.3);
            refs.hazeLowpass.frequency.setTargetAtTime(3800 - state.age * 1400, time, 0.3);
            refs.hazeGain.gain.setTargetAtTime(
                state.dust * (0.4 + state.age * 0.6), time, 0.3);
        }

        function setWidth(time) {
            refs.voices.forEach((voice, index) => {
                voice.panner.pan.setTargetAtTime(PAN_POSITIONS[index] * state.width, time, 0.25);
            });
        }

        function setSmear(time) {
            const levels = smearLevels(state.smear);
            refs.dry.gain.setTargetAtTime(levels.dry, time, 0.25);
            refs.smearWet.gain.setTargetAtTime(levels.wet, time, 0.3);
        }

        return {
            start() {
                const voiceBus = ctx.createGain();
                voiceBus.gain.value = 1;

                const chorusDelay = ctx.createDelay(0.04);
                chorusDelay.delayTime.value = 0.017;
                const chorusWet = ctx.createGain();
                chorusWet.gain.value = 0.16;

                const saturator = ctx.createWaveShaper();
                saturator.curve = makeSoftCurve();
                saturator.oversample = '2x';

                const protection = ctx.createBiquadFilter();
                protection.type = 'highpass';
                protection.frequency.value = 38;
                protection.Q.value = 0.7;

                const tone = ctx.createBiquadFilter();
                tone.type = 'lowpass';
                tone.frequency.value = toneForAge(state.age);
                tone.Q.value = 0.62;

                const dry = ctx.createGain();
                const smearWet = ctx.createGain();
                const initialSmear = smearLevels(state.smear);
                dry.gain.value = initialSmear.dry;
                smearWet.gain.value = initialSmear.wet;

                const smearDelay = ctx.createDelay(0.8);
                smearDelay.delayTime.value = 0.29;
                const smearFilter = ctx.createBiquadFilter();
                smearFilter.type = 'lowpass';
                smearFilter.frequency.value = 1750 - state.age * 700;
                smearFilter.Q.value = 0.56;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.115;

                voiceBus.connect(saturator);
                voiceBus.connect(chorusDelay).connect(chorusWet).connect(saturator);
                saturator.connect(protection).connect(tone);
                tone.connect(dry).connect(out);
                tone.connect(smearDelay).connect(smearFilter).connect(smearWet).connect(out);
                smearFilter.connect(feedback).connect(smearDelay);

                const ratios = currentVoicing();
                const real = new Float32Array(9);
                const imag = new Float32Array([0, 1, 0.38, 0.17, 0.082, 0.041, 0.021, 0.011, 0.006]);
                const warmWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

                const wow = ctx.createOscillator();
                wow.type = 'sine';
                wow.frequency.value = state.motion;
                const wowDepth = ctx.createGain();
                wowDepth.gain.value = state.drift * 0.82;
                wow.connect(wowDepth);

                const flutter = ctx.createOscillator();
                flutter.type = 'triangle';
                flutter.frequency.value = state.motion * 2.1;
                const flutterDepth = ctx.createGain();
                flutterDepth.gain.value = state.drift * 0.16;
                flutter.connect(flutterDepth);

                const chorusLfo = ctx.createOscillator();
                chorusLfo.type = 'sine';
                chorusLfo.frequency.value = 0.073;
                const chorusDepth = ctx.createGain();
                chorusDepth.gain.value = 0.0022;
                chorusLfo.connect(chorusDepth).connect(chorusDelay.delayTime);

                const toneBreath = ctx.createOscillator();
                toneBreath.type = 'sine';
                toneBreath.frequency.value = 0.027;
                const toneBreathDepth = ctx.createGain();
                toneBreathDepth.gain.value = toneForAge(state.age) * 0.1;
                toneBreath.connect(toneBreathDepth).connect(tone.frequency);

                const bedBreath = ctx.createOscillator();
                bedBreath.type = 'sine';
                bedBreath.frequency.value = 0.017;
                const bedBreathDepth = ctx.createGain();
                bedBreathDepth.gain.value = 0.024;
                bedBreath.connect(bedBreathDepth).connect(voiceBus.gain);

                const voices = ratios.map((ratio, index) => {
                    const main = ctx.createOscillator();
                    const shadow = ctx.createOscillator();
                    main.setPeriodicWave(warmWave);
                    shadow.setPeriodicWave(warmWave);
                    main.frequency.value = state.root * ratio;
                    shadow.frequency.value = state.root * ratio;

                    const direction = DRIFT_SIGNS[index];
                    main.detune.value = -state.drift * direction * 0.28;
                    shadow.detune.value = state.drift * direction;
                    wowDepth.connect(main.detune);
                    wowDepth.connect(shadow.detune);
                    flutterDepth.connect(main.detune);
                    flutterDepth.connect(shadow.detune);

                    const mainMix = ctx.createGain();
                    const shadowMix = ctx.createGain();
                    mainMix.gain.value = 0.68;
                    shadowMix.gain.value = 0.32;
                    const level = ctx.createGain();
                    level.gain.value = VOICE_LEVELS[index];
                    const panner = ctx.createStereoPanner();
                    panner.pan.value = PAN_POSITIONS[index] * state.width;

                    main.connect(mainMix).connect(level);
                    shadow.connect(shadowMix).connect(level);
                    level.connect(panner).connect(voiceBus);
                    main.start();
                    shadow.start();

                    nodes.push(main, shadow, mainMix, shadowMix, level, panner);
                    return { main, shadow, level, panner, ratio };
                });

                const undertone = ctx.createOscillator();
                undertone.type = 'sine';
                undertone.frequency.value = state.root / 2;
                const undertoneGain = ctx.createGain();
                undertoneGain.gain.value = 0.042;
                wowDepth.connect(undertone.detune);
                undertone.connect(undertoneGain).connect(voiceBus);

                const haze = ctx.createBufferSource();
                haze.buffer = makeHazeBuffer(ctx);
                haze.loop = true;
                const hazeHighpass = ctx.createBiquadFilter();
                hazeHighpass.type = 'highpass';
                hazeHighpass.frequency.value = 190;
                hazeHighpass.Q.value = 0.5;
                const hazeLowpass = ctx.createBiquadFilter();
                hazeLowpass.type = 'lowpass';
                hazeLowpass.frequency.value = 3800 - state.age * 1400;
                hazeLowpass.Q.value = 0.5;
                const hazeGain = ctx.createGain();
                hazeGain.gain.value = state.dust * (0.4 + state.age * 0.6);
                haze.connect(hazeHighpass).connect(hazeLowpass).connect(hazeGain).connect(saturator);

                wow.start();
                flutter.start();
                chorusLfo.start();
                toneBreath.start();
                bedBreath.start();
                undertone.start();
                haze.start();

                nodes.push(
                    voiceBus, chorusDelay, chorusWet, saturator, protection, tone,
                    dry, smearWet, smearDelay, smearFilter, feedback,
                    wow, wowDepth, flutter, flutterDepth, chorusLfo, chorusDepth,
                    toneBreath, toneBreathDepth, bedBreath, bedBreathDepth,
                    undertone, undertoneGain, haze, hazeHighpass, hazeLowpass, hazeGain
                );
                refs = {
                    voices, undertone, tone, dry, smearWet, smearFilter,
                    wow, wowDepth, flutter, flutterDepth,
                    toneBreathDepth, hazeLowpass, hazeGain
                };

                rampIn(ctx, out.gain, state.gain, 2.6);
            },

            stop() {
                rampOut(ctx, out.gain);
                const held = nodes;
                nodes = [];
                refs = { voices: [] };
                setTimeout(() => disconnectNodes(held), 1400);
            },

            set(id, value) {
                state[id] = value;
                const time = ctx.currentTime;
                if (!refs.tone) return;

                if (id === 'gain') out.gain.setTargetAtTime(value, time, 0.12);
                if (id === 'root' || id === 'voicing') retune(time);
                if (id === 'drift') setDrift(time);
                if (id === 'motion') {
                    refs.wow.frequency.setTargetAtTime(value, time, 0.25);
                    refs.flutter.frequency.setTargetAtTime(value * 2.1, time, 0.25);
                }
                if (id === 'age') setAge(time);
                if (id === 'width') setWidth(time);
                if (id === 'smear') setSmear(time);
                if (id === 'dust') {
                    refs.hazeGain.gain.setTargetAtTime(
                        value * (0.4 + state.age * 0.6), time, 0.3);
                }
            }
        };
    }
};
