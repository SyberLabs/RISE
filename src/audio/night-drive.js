/**
 * Night Drive — a procedural four-on-the-floor electronic bed.
 *
 * NEW: nothing else in RISE has percussion or a tempo above 116 BPM.
 * Every voice is synthesized here (no samples, no recordings), in
 * A minor over a four-bar i–VI–III–VII loop (Am F C G).
 *
 *   kick     sine with a fast pitch drop, every beat
 *   clap     band-passed noise on beats 2 and 4
 *   hats     high-passed noise on off-beats (16ths when intense)
 *   bass     filtered saw, rolling 16ths between the kicks
 *   arp      filtered square arpeggio with a dotted-eighth echo
 *   pad      detuned saw chord, ducked by the kick (the "pump")
 *
 * All notes are scheduled on the AUDIO clock (not setTimeout), so the
 * timing is sample-accurate and the same code renders in an
 * OfflineAudioContext: `renderInto(ctx, seconds)` pre-schedules a span.
 */

export const NIGHT_DRIVE_LIMITS = Object.freeze({
    bpm: Object.freeze({ min: 96, max: 140, default: 124 }),
    intensity: Object.freeze({ min: 0, max: 1, default: 0.6 })
});

const PROGRESSION = [
    { root: 45, third: 3 },  // Am
    { root: 41, third: 4 },  // F
    { root: 48, third: 4 },  // C
    { root: 43, third: 4 }   // G
];
const STEPS_PER_BAR = 16;
const LOOKAHEAD_S = 0.2;
const TICK_MS = 25;

const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createNightDrive(ctx, destination, options = {}) {
    let bpm = clamp(options.bpm ?? NIGHT_DRIVE_LIMITS.bpm.default, NIGHT_DRIVE_LIMITS.bpm.min, NIGHT_DRIVE_LIMITS.bpm.max);
    let intensity = clamp(options.intensity ?? NIGHT_DRIVE_LIMITS.intensity.default, 0, 1);
    // Output level. RISE's registry passes a lower level so this bed sits
    // near the loudness of the other soundscapes instead of jumping out.
    const level = clamp(options.level ?? 1, 0, 1);

    // ── bus ────────────────────────────────────────────────────────
    const out = ctx.createGain();
    out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.12;
    comp.connect(out);
    out.connect(destination);

    const drums = ctx.createGain();
    drums.gain.value = 0.9;
    drums.connect(comp);

    // everything melodic goes through the duck so the kick "pumps" it
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(comp);

    const echo = ctx.createDelay(2);
    const echoFb = ctx.createGain();
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2600;
    echoFb.gain.value = 0.34;
    echo.connect(echoTone);
    echoTone.connect(echoFb);
    echoFb.connect(echo);
    const echoReturn = ctx.createGain();
    echoReturn.gain.value = 0.42;
    echoTone.connect(echoReturn);
    echoReturn.connect(duck);

    const noise = (() => {
        const len = Math.floor(ctx.sampleRate * 1.0);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let seed = 0x2f6b1d;
        for (let i = 0; i < len; i++) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            d[i] = (seed / 0xffffffff) * 2 - 1;
        }
        return buf;
    })();

    const stepDur = () => 60 / bpm / 4;
    const setEcho = () => { echo.delayTime.value = stepDur() * 3; };
    setEcho();

    // ── voices ─────────────────────────────────────────────────────
    function kick(t) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.95, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
        o.connect(g); g.connect(drums);
        o.start(t); o.stop(t + 0.4);
        // sidechain pump
        duck.gain.cancelScheduledValues(t);
        duck.gain.setValueAtTime(0.32, t);
        duck.gain.linearRampToValueAtTime(1, t + Math.min(0.2, stepDur() * 1.6));
    }

    function noiseHit(t, { type, freq, q = 0.8, level, decay }) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        src.connect(f); f.connect(g); g.connect(drums);
        src.start(t, Math.random() * 0.5); src.stop(t + decay + 0.02);
    }

    const clap = t => noiseHit(t, { type: 'bandpass', freq: 1400, q: 0.9, level: 0.5, decay: 0.16 });
    const hat = (t, level) => noiseHit(t, { type: 'highpass', freq: 7200, q: 0.7, level, decay: 0.045 });

    function tone(t, { freq, type, dur, level, cutoff, attack = 0.004, send = 0, detune = 0 }) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(cutoff * 1.8, t);
        f.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(dur, 0.12));
        f.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(duck);
        if (send) {
            const s = ctx.createGain();
            s.gain.value = send;
            g.connect(s); s.connect(echo);
        }
        o.start(t); o.stop(t + dur + 0.05);
    }

    function pad(t, chord, bars) {
        const dur = stepDur() * STEPS_PER_BAR * bars;
        const notes = [chord.root + 12, chord.root + 12 + chord.third, chord.root + 19];
        for (const n of notes) {
            for (const det of [-9, 9]) {
                const o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = hz(n);
                o.detune.value = det;
                const f = ctx.createBiquadFilter();
                f.type = 'lowpass';
                f.frequency.value = 700 + 900 * intensity;
                const g = ctx.createGain();
                const lvl = 0.018 + 0.012 * intensity;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(lvl, t + 0.25);
                g.gain.setValueAtTime(lvl, t + dur - 0.2);
                g.gain.linearRampToValueAtTime(0.0001, t + dur);
                o.connect(f); f.connect(g); g.connect(duck);
                o.start(t); o.stop(t + dur + 0.05);
            }
        }
    }

    const ARP_SHAPE = [0, 1, 2, 3, 2, 1, 2, 4, 0, 1, 2, 3, 4, 3, 2, 1];

    function scheduleStep(step, t) {
        const bar = Math.floor(step / STEPS_PER_BAR);
        const s = step % STEPS_PER_BAR;
        const chord = PROGRESSION[bar % PROGRESSION.length];
        const sd = stepDur();

        if (s % 4 === 0) kick(t);
        if (s === 4 || s === 12) clap(t);
        if (s % 4 === 2) hat(t, 0.16 + 0.08 * intensity);
        else if (intensity >= 0.5 && s % 2 === 1) hat(t, 0.05 + 0.05 * intensity);

        // rolling bass between the kicks
        if (s % 4 !== 0 && (intensity >= 0.35 || s % 4 === 2)) {
            tone(t, {
                freq: hz(chord.root - 12), type: 'sawtooth', dur: sd * 0.85,
                level: 0.17, cutoff: 260 + 420 * intensity
            });
        }

        // arpeggio over the chord, two octaves up
        const tones = [0, chord.third, 7, 12, 12 + chord.third];
        const n = chord.root + 24 + tones[ARP_SHAPE[s]];
        tone(t, {
            freq: hz(n), type: 'square', dur: sd * 0.9,
            level: 0.035 + 0.035 * intensity, cutoff: 1400 + 2600 * intensity,
            send: 0.55
        });

        if (s === 0) pad(t, chord, 1);
    }

    // ── clock ──────────────────────────────────────────────────────
    let step = 0;
    let nextTime = 0;
    let timer = null;
    let running = false;

    function pump(horizon) {
        while (nextTime < horizon) {
            scheduleStep(step, nextTime);
            nextTime += stepDur();
            step += 1;
        }
    }

    return {
        get bpm() { return bpm; },
        get intensity() { return intensity; },
        start() {
            if (running) return;
            running = true;
            const t = ctx.currentTime + 0.06;
            out.gain.cancelScheduledValues(ctx.currentTime);
            out.gain.setValueAtTime(0, ctx.currentTime);
            out.gain.linearRampToValueAtTime(level, t + 0.4);
            nextTime = t;
            timer = setInterval(() => pump(ctx.currentTime + LOOKAHEAD_S), TICK_MS);
            pump(ctx.currentTime + LOOKAHEAD_S);
        },
        stop(instant = false) {
            running = false;
            if (timer) clearInterval(timer);
            timer = null;
            const now = ctx.currentTime;
            out.gain.cancelScheduledValues(now);
            out.gain.setValueAtTime(out.gain.value, now);
            out.gain.linearRampToValueAtTime(0, now + (instant ? 0.03 : 0.6));
            setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, instant ? 60 : 700);
        },
        /** Change tempo/intensity; takes effect on the next scheduled step. */
        setParams(next = {}) {
            if (Number.isFinite(next.bpm)) {
                bpm = clamp(next.bpm, NIGHT_DRIVE_LIMITS.bpm.min, NIGHT_DRIVE_LIMITS.bpm.max);
                setEcho();
            }
            if (Number.isFinite(next.intensity)) intensity = clamp(next.intensity, 0, 1);
        },
        /** Offline rendering: schedule `seconds` of music from time 0. */
        renderInto(seconds) {
            out.gain.setValueAtTime(level, 0);
            nextTime = 0.02;
            pump(seconds);
        }
    };
}

/* ── Offline rendering (MP4 export) ─────────────────────────────────
 * The export mixer samples beds as pure functions of time. This is the
 * same pattern and progression, drawn in closed form: no nodes, no
 * filters, deterministic noise. It is a sketch of the live bed, not a
 * sample-exact copy.
 */
const hash = n => {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (((x ^ (x >>> 16)) >>> 0) / 4294967295) * 2 - 1;
};
const saw = phase => 2 * (phase - Math.floor(phase + 0.5));
const square = phase => (phase - Math.floor(phase) < 0.5 ? 1 : -1);

export function sampleNightDrive(timeSec, channel = 0, { bpm = 124, intensity = 0.6 } = {}) {
    if (!(timeSec >= 0)) return 0;
    const step = 60 / bpm / 4;
    const index = Math.floor(timeSec / step);
    const into = timeSec - index * step;
    const s = index % STEPS_PER_BAR;
    const chord = PROGRESSION[Math.floor(index / STEPS_PER_BAR) % PROGRESSION.length];
    let out = 0;

    // kick: every beat, a sine sweeping 150 → 46 Hz
    const beatInto = timeSec % (step * 4);
    const kickPhase = 46 * beatInto + (104 / 9) * (1 - Math.exp(-9 * beatInto));
    out += Math.sin(2 * Math.PI * kickPhase) * Math.exp(-beatInto / 0.09) * 0.5;
    const duck = 0.35 + 0.65 * Math.min(1, beatInto / 0.2);

    // clap on 2 and 4, hats on the off-beats (16ths when intense)
    const noise = hash(Math.floor(timeSec * 22050) + channel * 7919);
    if (s === 4 || s === 12) out += noise * Math.exp(-into / 0.05) * 0.16;
    if (s % 4 === 2) out += noise * Math.exp(-into / 0.012) * (0.06 + 0.03 * intensity);
    else if (intensity >= 0.5 && s % 2 === 1) out += noise * Math.exp(-into / 0.01) * 0.03;

    // rolling bass between kicks
    if (s % 4 !== 0 && (intensity >= 0.35 || s % 4 === 2)) {
        out += saw(hz(chord.root - 12) * timeSec) * Math.exp(-into / 0.08) * 0.07 * duck;
    }
    // arpeggio, two octaves up
    const tones = [0, chord.third, 7, 12, 12 + chord.third];
    const ARP = [0, 1, 2, 3, 2, 1, 2, 4, 0, 1, 2, 3, 4, 3, 2, 1];
    const note = chord.root + 24 + tones[ARP[s]];
    out += square(hz(note) * timeSec) * Math.exp(-into / 0.06) * (0.012 + 0.012 * intensity) * duck
        * (channel === 0 ? 1 : 0.85);
    // pad: the chord, quietly
    for (const n of [chord.root + 12, chord.root + 12 + chord.third, chord.root + 19]) {
        out += Math.sin(2 * Math.PI * hz(n) * timeSec) * 0.008 * duck;
    }
    return out;
}
