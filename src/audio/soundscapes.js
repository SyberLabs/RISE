/**
 * R.I.S.E. Soundscapes — living compositions synthesized in real time.
 *
 * Unlike the pure-tone layers (entrainment, harmonics, noise, drone),
 * a soundscape is a composed piece: several voices plus an autonomous
 * behavior scheduler, tuned by ear in the SoundSandbox and promoted
 * here with its mix frozen. Slowly evolving, never looping.
 *
 * AURORA (from soundsandbox lab-aureole + lab-halo, 2026-07):
 *   A deep just-intoned pad at root 108 Hz (432/4) with slow interior
 *   beating, spectral breath, restrained stereo drift, and a locally
 *   synthesized diffuse tail — visited at random intervals by the
 *   five-partial harmonic series fading in at 200 or 216 Hz, drifting
 *   between the two, then resting in silence. 216 lands on the pad's
 *   2nd harmonic (pure agreement); 200 shades a wide whole-tone below
 *   (gentle tension). Mix approved by ear on the sandbox crossfader:
 *   pad 0.17, halo 0.05, halo presence ~8s average.
 *
 * Contract: createSoundscape(id, ctx, destination) → { start, stop }
 * or null for an unknown id. Handles connect only to `destination`
 * (the engine's soundscape layer gain) and ramp every transition.
 */

function rampIn(ctx, gainParam, level, seconds = 1.2) {
    const t = ctx.currentTime;
    gainParam.cancelScheduledValues(t);
    gainParam.setValueAtTime(Math.max(gainParam.value, 0.0001), t);
    gainParam.setTargetAtTime(level, t, seconds / 3);
}

function rampOut(ctx, gainParam, seconds = 1.2) {
    const t = ctx.currentTime;
    gainParam.cancelScheduledValues(t);
    gainParam.setValueAtTime(gainParam.value, t);
    gainParam.setTargetAtTime(0, t, seconds / 3);
}

// ═══════════════════════════════════════════════════════════
// AURORA · pad voice (Aureole)
// ═══════════════════════════════════════════════════════════

const AURORA = {
    root: 108,                 // 432 / 4
    ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2, 3, 15 / 4, 4],  // Just bloom
    voiceLevels: [0.245, 0.17, 0.145, 0.112, 0.086, 0.068, 0.052, 0.04],
    panPositions: [-0.12, 0.34, -0.46, 0.55, -0.66, 0.73, -0.82, 0.88],
    beatShapes: [0.79, 0.93, 1.07, 1.21, 0.86, 1.14, 0.72, 1.28],
    beat: 0.12,                // inner beat Hz
    motion: 0.04,              // breath LFO Hz
    bloom: 0.56,               // upper-partial presence
    color: 1850,               // lowpass Hz
    width: 0.72,
    space: 0.24,
    padLevel: 0.17,            // ≈ sandbox fader at 78% toward the pad
    // halo (wandering harmonics)
    haloTunings: [200, 216],
    haloRest: 10,              // avg seconds of silence
    haloPresence: 8,           // avg seconds sounding (user-tuned)
    haloFade: 3.5,             // seconds per arrival/departure
    haloWander: 0.55,          // p(jump to other tuning) vs fade out
    haloLevel: 0.05
};

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

function buildAurorePad(ctx, destination, nodes) {
    const A = AURORA;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    const bus = ctx.createGain();
    bus.gain.value = 1;

    const protection = ctx.createBiquadFilter();
    protection.type = 'highpass';
    protection.frequency.value = 32;
    protection.Q.value = 0.71;

    const color = ctx.createBiquadFilter();
    color.type = 'lowpass';
    color.frequency.value = A.color;
    color.Q.value = 0.62;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 1 - A.space * 0.22;
    wet.gain.value = A.space * 0.72;

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
    breath.frequency.value = A.motion;
    const filterBreath = ctx.createGain();
    filterBreath.gain.value = A.color * 0.14;
    breath.connect(filterBreath).connect(color.frequency);

    // Sine-led custom wave: enough upper structure to read as a pad,
    // with rapidly falling partials to stay dark.
    const real = new Float32Array(8);
    const imag = new Float32Array([0, 1, 0.18, 0.095, 0.045, 0.028, 0.014, 0.009]);
    const warmWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    A.ratios.forEach((ratio, index) => {
        const main = ctx.createOscillator();
        const shadow = ctx.createOscillator();
        main.setPeriodicWave(warmWave);
        shadow.setPeriodicWave(warmWave);

        const frequency = A.root * ratio;
        main.frequency.value = frequency;
        shadow.frequency.value = frequency + A.beat * A.beatShapes[index];

        const mainMix = ctx.createGain();
        const shadowMix = ctx.createGain();
        mainMix.gain.value = 0.72;
        shadowMix.gain.value = 0.28;

        const level = ctx.createGain();
        const baseLevel = A.voiceLevels[index];
        level.gain.value = index < 3 ? baseLevel : baseLevel * (0.35 + A.bloom * 1.15);

        const panner = ctx.createStereoPanner();
        panner.pan.value = A.panPositions[index] * A.width;

        const panMod = ctx.createGain();
        panMod.gain.value = (index % 2 ? 1 : -1) * 0.055 * A.width;
        breath.connect(panMod).connect(panner.pan);

        main.connect(mainMix).connect(level);
        shadow.connect(shadowMix).connect(level);
        level.connect(panner).connect(bus);
        main.start();
        shadow.start();

        nodes.push(main, shadow, mainMix, shadowMix, level, panner, panMod);
    });

    // The quiet undertone supplies physical weight at 54 Hz while the
    // 32 Hz highpass protects small playback systems.
    const undertone = ctx.createOscillator();
    undertone.type = 'sine';
    undertone.frequency.value = A.root / 2;
    const undertoneGain = ctx.createGain();
    undertoneGain.gain.value = 0.055;
    undertone.connect(undertoneGain).connect(bus);

    breath.start();
    undertone.start();

    nodes.push(
        out, bus, protection, color, dry, wet, predelay, convolver,
        wetHighpass, wetLowpass, breath, filterBreath, undertone, undertoneGain
    );

    return out;
}

// ═══════════════════════════════════════════════════════════
// AURORA · halo voice (wandering harmonics)
// ═══════════════════════════════════════════════════════════

const HALO_RATIOS = [1, 2, 3, 4, 5];
const HALO_AMPS = [0.5, 0.25, 0.125, 0.0625, 0.03125];

// avg seconds → randomized 0.6×–1.5× milliseconds
const jitter = (avg) => avg * (0.6 + Math.random() * 0.9) * 1000;

function buildHalo(ctx, destination, nodes) {
    const A = AURORA;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(destination);

    const envelope = ctx.createGain();
    envelope.gain.value = 0;
    envelope.connect(out);

    const voices = HALO_RATIOS.map((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = A.haloTunings[0] * ratio;
        gain.gain.value = HALO_AMPS[i];
        osc.connect(gain).connect(envelope);
        osc.start();
        nodes.push(osc, gain);
        return { osc, ratio };
    });
    nodes.push(envelope, out);

    let timer = null;
    let alive = true;
    let tuning = 0;

    function retune(freq, tau) {
        tuning = freq;
        const t = ctx.currentTime;
        voices.forEach(({ osc, ratio }) =>
            osc.frequency.setTargetAtTime(freq * ratio, t, tau));
    }

    function pickTuning() {
        const candidates = A.haloTunings.filter(f => f !== tuning);
        return candidates[Math.floor(Math.random() * candidates.length)]
            ?? A.haloTunings[0];
    }

    function wait(ms, next) {
        timer = setTimeout(() => { if (alive) next(); }, ms);
    }

    function restPhase() {
        rampOut(ctx, envelope.gain, A.haloFade);
        wait(A.haloFade * 1000 + jitter(A.haloRest), enterPhase);
    }

    function enterPhase() {
        retune(pickTuning(), 0.02); // silent — snap to the new tuning
        rampIn(ctx, envelope.gain, 1, A.haloFade);
        wait(A.haloFade * 1000 + jitter(A.haloPresence), decidePhase);
    }

    function decidePhase() {
        if (Math.random() < A.haloWander) {
            retune(pickTuning(), 0.12); // audible jump: fast clickless glide
            wait(jitter(A.haloPresence), decidePhase);
        } else {
            restPhase();
        }
    }

    return {
        out,
        begin() {
            // Start from silence so the first arrival is an event
            wait(jitter(A.haloRest) * 0.5, enterPhase);
        },
        halt() {
            alive = false;
            clearTimeout(timer);
        }
    };
}

// ═══════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════

function createAurora(ctx, destination) {
    let nodes = [];
    let halo = null;
    let padOut = null;

    return {
        start() {
            padOut = buildAurorePad(ctx, destination, nodes);
            halo = buildHalo(ctx, destination, nodes);
            rampIn(ctx, padOut.gain, AURORA.padLevel, 2.4);
            rampIn(ctx, halo.out.gain, AURORA.haloLevel, 2.4);
            halo.begin();
        },
        stop(instant = false) {
            if (halo) halo.halt();
            if (padOut) {
                if (instant) {
                    padOut.gain.cancelScheduledValues(ctx.currentTime);
                    padOut.gain.setValueAtTime(0, ctx.currentTime);
                    halo.out.gain.cancelScheduledValues(ctx.currentTime);
                    halo.out.gain.setValueAtTime(0, ctx.currentTime);
                } else {
                    rampOut(ctx, padOut.gain);
                    rampOut(ctx, halo.out.gain);
                }
            }
            const held = nodes;
            nodes = [];
            halo = null;
            padOut = null;
            setTimeout(() => held.forEach(node => {
                try {
                    if (node.stop) node.stop();
                    node.disconnect();
                } catch (e) { /* already released */ }
            }), instant ? 0 : 1400);
        }
    };
}

export const SOUNDSCAPES = {
    aurora: {
        name: 'Aurora',
        description: 'A deep just-intoned pad visited by wandering harmonics — slowly evolving, never looping.',
        create: createAurora
    }
};

/**
 * @param {string} id - soundscape id (e.g. 'aurora')
 * @returns {{start: Function, stop: Function} | null}
 */
export function createSoundscape(id, ctx, destination) {
    const entry = SOUNDSCAPES[id];
    if (!entry) return null;
    return entry.create(ctx, destination);
}
