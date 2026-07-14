/**
 * PATCH - Still Passage
 * An original sparse felt-tone procession: softly attacked, slightly
 * stretched piano partials emerge from a deterministic walk through
 * just-ratio pitch pools, then dissolve into a locally computed dark
 * room. It borrows no melody; the influence is structural and textural
 * - patient spacing, acoustic fragility, and electronic afterimage.
 *
 * Character notes (keep this section in every lab patch):
 * - vs lab-aureole: far less continuous and harmonically saturated;
 *   silence becomes part of the patch, but each entrance is more salient
 * - sits well over app-noise at 0.03-0.06 and with Aureole below 0.08;
 *   fights faster entrainment beds when Pace is below about 8 seconds
 * - Felt above 2800 Hz and Decay above 14 seconds can turn the notes into
 *   foreground music; Dusk is warmer but less harmonically neutral
 */
import { rampIn, rampOut } from '../sandbox-lib.js';

const PATHS = {
    'Open path': [1, 9 / 8, 5 / 4, 3 / 2, 15 / 8, 2, 5 / 2, 3],
    'Suspended path': [1, 9 / 8, 4 / 3, 3 / 2, 2, 9 / 4, 8 / 3, 3],
    'Dusk path': [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5, 2, 12 / 5, 8 / 3]
};

const PARTIALS = [1, 2.002, 3.008, 4.018, 5.032];
const PARTIAL_LEVELS = [1, 0.19, 0.072, 0.031, 0.012];
const WALK_STEPS = [-2, -1, 1, 1, 2];

function roomLevels(space) {
    return {
        dry: 1 - space * 0.18,
        wet: space * 0.68
    };
}

function disconnectNodes(nodes) {
    nodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch (error) { /* already stopped */ }
        try { node.disconnect(); } catch (error) { /* already disconnected */ }
    });
}

function makeRoomImpulse(ctx, seconds = 3.6) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        let seed = channel ? 0x9e3779b9 : 0x85ebca6b;
        let dark = 0;

        for (let i = 0; i < length; i += 1) {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            const white = (seed / 0xffffffff) * 2 - 1;
            dark += (white - dark) * 0.16;

            const time = i / ctx.sampleRate;
            const progress = i / length;
            const onset = Math.min(1, time / 0.018);
            const decay = Math.pow(1 - progress, 3.1) * Math.exp(-time * 0.36);
            data[i] = dark * onset * decay;
        }
    }

    return impulse;
}

function makeAirBuffer(ctx, seconds = 6) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0xc2b2ae35;
    let brown = 0;
    const edge = Math.max(1, Math.floor(ctx.sampleRate * 0.08));

    for (let i = 0; i < length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const white = (seed / 0xffffffff) * 2 - 1;
        brown = brown * 0.985 + white * 0.015;
        const fadeIn = Math.min(1, i / edge);
        const fadeOut = Math.min(1, (length - 1 - i) / edge);
        data[i] = brown * 2.2 * Math.max(0, Math.min(fadeIn, fadeOut));
    }

    return buffer;
}

export default {
    id: 'lab-still-passage',
    name: 'Still Passage (Felt tones)',
    category: 'lab',
    description: 'Sparse felt-tone arrivals, patient silence, and a dark electronic room afterimage.',
    params: [
        {
            id: 'root', label: 'Root (Hz)', type: 'range', min: 80, max: 180, step: 1, value: 108,
            marks: { '216 / 2': 108, '220 / 2': 110, '432 / 3': 144 }
        },
        {
            id: 'path', label: 'Harmonic Path', type: 'select', value: 'Open path',
            options: Object.keys(PATHS)
        },
        { id: 'pace', label: 'Pace (seconds)', type: 'range', min: 5, max: 18, step: 0.5, value: 9.5 },
        { id: 'decay', label: 'Decay (seconds)', type: 'range', min: 5, max: 18, step: 0.5, value: 10.5 },
        { id: 'felt', label: 'Felt (Hz)', type: 'range', min: 550, max: 3600, step: 25, value: 1750 },
        { id: 'width', label: 'Width', type: 'range', min: 0, max: 1, step: 0.01, value: 0.58 },
        { id: 'space', label: 'Room', type: 'range', min: 0, max: 0.65, step: 0.01, value: 0.34 },
        { id: 'air', label: 'Room Air', type: 'range', min: 0, max: 0.12, step: 0.005, value: 0.025 },
        { id: 'gain', label: 'Level', type: 'range', min: 0, max: 0.35, step: 0.01, value: 0.17 }
    ],

    build(ctx, destination, opts = {}) {
        const state = {
            root: opts.root ?? 108,
            path: opts.path || 'Open path',
            pace: opts.pace ?? 9.5,
            decay: opts.decay ?? 10.5,
            felt: opts.felt ?? 1750,
            width: opts.width ?? 0.58,
            space: opts.space ?? 0.34,
            air: opts.air ?? 0.025,
            gain: opts.gain ?? 0.17
        };

        const out = ctx.createGain();
        out.gain.value = 0;
        out.connect(destination);

        let playing = false;
        let eventTimer = null;
        let randomState = 0x243f6a88;
        let degree = 0;
        let eventCount = 0;
        let persistentNodes = [out];
        let activeNotes = [];
        let refs = { floorVoices: [], floorPanners: [] };

        function random() {
            randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
            return randomState / 0x100000000;
        }

        function currentPath() {
            return PATHS[state.path] || PATHS['Open path'];
        }

        function chooseDegree() {
            const step = WALK_STEPS[Math.floor(random() * WALK_STEPS.length)];
            degree += step;
            const maximum = currentPath().length - 1;
            if (degree < 0) degree = Math.abs(degree);
            if (degree > maximum) degree = maximum - (degree - maximum);
            degree = Math.max(0, Math.min(maximum, degree));
            return degree;
        }

        function removeNote(note) {
            activeNotes = activeNotes.filter(candidate => candidate !== note);
            disconnectNodes(note.nodes);
        }

        function spawnVoice(degreeIndex, peak, panPosition) {
            if (!playing || !refs.noteBus) return;

            const path = currentPath();
            const note = {
                degree: degreeIndex % path.length,
                oscillators: [],
                nodes: [],
                cleanupTimer: null
            };
            const noteMix = ctx.createGain();
            noteMix.gain.value = 1;
            const envelope = ctx.createGain();
            envelope.gain.value = 0.0001;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = state.felt;
            filter.Q.value = 0.72;
            const panner = ctx.createStereoPanner();
            panner.pan.value = panPosition * state.width;

            noteMix.connect(envelope).connect(filter).connect(panner).connect(refs.noteBus);

            const ratio = path[note.degree];
            const now = ctx.currentTime;
            PARTIALS.forEach((partial, index) => {
                const oscillator = ctx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.value = state.root * ratio * partial;
                const partialGain = ctx.createGain();
                partialGain.gain.value = PARTIAL_LEVELS[index];
                oscillator.connect(partialGain).connect(noteMix);
                oscillator.start(now);
                oscillator.stop(now + 31);
                note.oscillators.push({ oscillator, partial });
                note.nodes.push(oscillator, partialGain);
            });

            envelope.gain.setValueAtTime(0.0001, now);
            envelope.gain.setTargetAtTime(peak, now, 0.16);
            envelope.gain.setTargetAtTime(0, now + 0.72, state.decay / 3.4);

            note.envelope = envelope;
            note.filter = filter;
            note.panner = panner;
            note.panPosition = panPosition;
            note.nodes.push(noteMix, envelope, filter, panner);
            activeNotes.push(note);
            note.cleanupTimer = setTimeout(() => removeNote(note), 30500);
        }

        function spawnEvent() {
            if (!playing) return;
            const selectedDegree = chooseDegree();
            const pan = random() * 0.8 - 0.4;
            const gentleVariance = 0.9 + random() * 0.16;
            spawnVoice(selectedDegree, 0.255 * gentleVariance, pan);

            // Quiet upper dyads occur irregularly, so the patch develops
            // harmony without settling into a repeated identifiable phrase.
            if (eventCount > 0 && random() < 0.28) {
                const upper = Math.min(currentPath().length - 1, selectedDegree + 2);
                spawnVoice(upper, 0.112 * gentleVariance, -pan * 0.7);
            }
            eventCount += 1;
        }

        function scheduleNext() {
            if (!playing) return;
            clearTimeout(eventTimer);
            const variance = (random() - 0.5) * state.pace * 0.2;
            const delay = Math.max(3.5, state.pace + variance);
            eventTimer = setTimeout(() => {
                spawnEvent();
                scheduleNext();
            }, delay * 1000);
        }

        function retune(time) {
            const path = currentPath();
            activeNotes.forEach(note => {
                const ratio = path[note.degree % path.length];
                note.oscillators.forEach(({ oscillator, partial }) => {
                    oscillator.frequency.setTargetAtTime(state.root * ratio * partial, time, 0.25);
                });
            });
            refs.floorVoices.forEach(voice => {
                voice.main.frequency.setTargetAtTime(state.root * voice.ratio, time, 0.3);
                voice.shadow.frequency.setTargetAtTime(
                    state.root * voice.ratio + voice.offset, time, 0.3);
            });
        }

        function setDecay(time) {
            activeNotes.forEach(note => {
                if (note.envelope.gain.cancelAndHoldAtTime) {
                    note.envelope.gain.cancelAndHoldAtTime(time);
                } else {
                    note.envelope.gain.cancelScheduledValues(time);
                    note.envelope.gain.setValueAtTime(note.envelope.gain.value, time);
                }
                note.envelope.gain.setTargetAtTime(0, time, state.decay / 3.4);
            });
        }

        function setWidth(time) {
            activeNotes.forEach(note => {
                note.panner.pan.setTargetAtTime(note.panPosition * state.width, time, 0.2);
            });
            refs.floorPanners.forEach(item => {
                item.panner.pan.setTargetAtTime(item.position * state.width, time, 0.25);
            });
        }

        function setSpace(time) {
            if (!refs.dry || !refs.wet) return;
            const levels = roomLevels(state.space);
            refs.dry.gain.setTargetAtTime(levels.dry, time, 0.2);
            refs.wet.gain.setTargetAtTime(levels.wet, time, 0.3);
        }

        return {
            start() {
                playing = true;

                const noteBus = ctx.createGain();
                noteBus.gain.value = 1;
                const protection = ctx.createBiquadFilter();
                protection.type = 'highpass';
                protection.frequency.value = 32;
                protection.Q.value = 0.7;
                const ceiling = ctx.createBiquadFilter();
                ceiling.type = 'lowpass';
                ceiling.frequency.value = 6200;
                ceiling.Q.value = 0.55;

                const dry = ctx.createGain();
                const wet = ctx.createGain();
                const initialRoom = roomLevels(state.space);
                dry.gain.value = initialRoom.dry;
                wet.gain.value = initialRoom.wet;

                const predelay = ctx.createDelay(0.1);
                predelay.delayTime.value = 0.044;
                const convolver = ctx.createConvolver();
                convolver.buffer = makeRoomImpulse(ctx);
                const wetHighpass = ctx.createBiquadFilter();
                wetHighpass.type = 'highpass';
                wetHighpass.frequency.value = 135;
                wetHighpass.Q.value = 0.7;
                const wetLowpass = ctx.createBiquadFilter();
                wetLowpass.type = 'lowpass';
                wetLowpass.frequency.value = 2850;
                wetLowpass.Q.value = 0.58;

                noteBus.connect(protection).connect(ceiling);
                ceiling.connect(dry).connect(out);
                ceiling.connect(predelay).connect(convolver)
                    .connect(wetHighpass).connect(wetLowpass).connect(wet).connect(out);

                const airSource = ctx.createBufferSource();
                airSource.buffer = makeAirBuffer(ctx);
                airSource.loop = true;
                const airFilter = ctx.createBiquadFilter();
                airFilter.type = 'lowpass';
                airFilter.frequency.value = Math.min(850, state.felt * 0.34);
                airFilter.Q.value = 0.5;
                const airGain = ctx.createGain();
                airGain.gain.value = state.air;
                airSource.connect(airFilter).connect(airGain).connect(noteBus);

                const floorGain = ctx.createGain();
                floorGain.gain.value = 0.038;
                const floorFilter = ctx.createBiquadFilter();
                floorFilter.type = 'lowpass';
                floorFilter.frequency.value = 380;
                floorFilter.Q.value = 0.6;
                floorGain.connect(floorFilter).connect(noteBus);

                const floorBreath = ctx.createOscillator();
                floorBreath.type = 'sine';
                floorBreath.frequency.value = 0.025;
                const floorBreathDepth = ctx.createGain();
                floorBreathDepth.gain.value = 0.006;
                floorBreath.connect(floorBreathDepth).connect(floorGain.gain);

                const floorVoices = [
                    { ratio: 0.5, offset: 0.041, position: -0.2, level: 0.72 },
                    { ratio: 0.75, offset: 0.053, position: 0.2, level: 0.46 }
                ].map(spec => {
                    const main = ctx.createOscillator();
                    const shadow = ctx.createOscillator();
                    main.type = shadow.type = 'sine';
                    main.frequency.value = state.root * spec.ratio;
                    shadow.frequency.value = state.root * spec.ratio + spec.offset;
                    const mainGain = ctx.createGain();
                    const shadowGain = ctx.createGain();
                    mainGain.gain.value = spec.level * 0.68;
                    shadowGain.gain.value = spec.level * 0.32;
                    const panner = ctx.createStereoPanner();
                    panner.pan.value = spec.position * state.width;
                    main.connect(mainGain).connect(panner);
                    shadow.connect(shadowGain).connect(panner);
                    panner.connect(floorGain);
                    main.start();
                    shadow.start();
                    persistentNodes.push(main, shadow, mainGain, shadowGain, panner);
                    return { main, shadow, panner, ...spec };
                });

                airSource.start();
                floorBreath.start();
                persistentNodes.push(
                    noteBus, protection, ceiling, dry, wet, predelay, convolver,
                    wetHighpass, wetLowpass, airSource, airFilter, airGain,
                    floorGain, floorFilter, floorBreath, floorBreathDepth
                );
                refs = {
                    noteBus, dry, wet, airGain, airFilter,
                    floorVoices,
                    floorPanners: floorVoices.map(voice => ({
                        panner: voice.panner, position: voice.position
                    }))
                };

                rampIn(ctx, out.gain, state.gain, 2.6);
                spawnEvent();
                scheduleNext();
            },

            stop() {
                playing = false;
                clearTimeout(eventTimer);
                eventTimer = null;
                rampOut(ctx, out.gain);

                const heldPersistent = persistentNodes;
                const heldNotes = activeNotes;
                persistentNodes = [];
                activeNotes = [];
                refs = { floorVoices: [], floorPanners: [] };

                heldNotes.forEach(note => clearTimeout(note.cleanupTimer));
                setTimeout(() => {
                    heldNotes.forEach(note => disconnectNodes(note.nodes));
                    disconnectNodes(heldPersistent);
                }, 1400);
            },

            set(id, value) {
                state[id] = value;
                const time = ctx.currentTime;
                if (!refs.noteBus) return;

                if (id === 'gain') out.gain.setTargetAtTime(value, time, 0.12);
                if (id === 'root' || id === 'path') retune(time);
                if (id === 'pace') scheduleNext();
                if (id === 'decay') setDecay(time);
                if (id === 'felt') {
                    activeNotes.forEach(note =>
                        note.filter.frequency.setTargetAtTime(value, time, 0.18));
                    refs.airFilter.frequency.setTargetAtTime(Math.min(850, value * 0.34), time, 0.2);
                }
                if (id === 'width') setWidth(time);
                if (id === 'space') setSpace(time);
                if (id === 'air') refs.airGain.gain.setTargetAtTime(value, time, 0.25);
            }
        };
    }
};
