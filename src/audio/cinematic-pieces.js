const DEFINITIONS = {
    wonder: {
        name: 'Wonder',
        description: 'An open, slowly breathing major-pentatonic horizon with soft, bell-like answers.',
        root: 130.81, type: 'sine', partials: [1, 1.25, 1.5], filter: 1800,
        notes: [2, 2.2449240966, 2.5198420998, 3, 3.363585661, 3, 2.5198420998, 2.2449240966, 2],
        interval: 2600, duration: 1.9, noteType: 'sine', pan: 0.48
    },
    mystery: {
        name: 'Mystery',
        description: 'A dark, suspended low drone with a slow, unresolved chromatic motif.',
        root: 73.42, type: 'triangle', partials: [1, 1.414, 2.13], filter: 620,
        notes: [1.414, 1.189, 1.587, 1.414, 1.06], interval: 3100, duration: 2.4, noteType: 'triangle', pan: 0.24
    },
    chase: {
        name: 'Chase',
        description: 'A tight, accelerating-feeling low ostinato with clipped pulses and urgent minor thirds.',
        root: 55, type: 'sawtooth', partials: [1, 1.5], filter: 900,
        notes: [1, 1.5, 1.78, 1.5, 1.19, 1.5], interval: 360, duration: 0.27, noteType: 'square', pan: 0.12
    },
    triumph: {
        name: 'Triumph',
        description: 'A warm, brass-like rising chord progression with broad, steady harmonic weight.',
        root: 110, type: 'sawtooth', partials: [1, 1.25, 1.5, 2], filter: 1250,
        notes: [1.25, 1.5, 2, 1.5, 1.25], interval: 1900, duration: 1.25, noteType: 'sawtooth', pan: 0.3
    },
    haunted: {
        name: 'Haunted',
        description: 'A wavering, dissonant minor haze with distant, fragile tones and long gaps.',
        root: 65.41, type: 'triangle', partials: [1, 1.059, 1.414], filter: 740,
        notes: [1.414, 1.059, 1.26, 1.414], interval: 3400, duration: 2.8, noteType: 'sine', pan: 0.62
    },
    starlight: {
        name: 'Starlight',
        description: 'A high, glassy arpeggio drifting over a clear fifth, with generous space between notes.',
        root: 392, type: 'sine', partials: [1, 1.5, 2], filter: 4000,
        notes: [1, 1.5, 2, 3, 2, 1.5], interval: 820, duration: 0.68, noteType: 'sine', pan: 0.82
    }
};

export const CINEMATIC_PIECE_PROFILES = Object.freeze(Object.fromEntries(
    Object.entries(DEFINITIONS).map(([id, definition]) => [id, Object.freeze({
        ...definition,
        partials: Object.freeze([...definition.partials]),
        notes: Object.freeze([...definition.notes])
    })])
));

function setLevel(param, value, ctx, seconds) {
    param.cancelScheduledValues?.(ctx.currentTime);
    param.setValueAtTime?.(param.value, ctx.currentTime);
    param.linearRampToValueAtTime?.(value, ctx.currentTime + seconds);
    if (!param.setValueAtTime) param.value = value;
}

function createCinematicPiece(id, ctx, destination, options = {}) {
    const definition = DEFINITIONS[id];
    const nodes = new Set();
    const oscillators = new Set();
    const baseOscillators = [];
    const timers = new Set();
    let active = false;
    let disposed = false;
    let started = false;
    let noteIndex = 0;

    function keep(node) {
        nodes.add(node);
        return node;
    }

    const output = keep(ctx.createGain());
    output.gain.value = 0;
    output.connect(destination);

    const color = keep(ctx.createBiquadFilter());
    color.type = 'lowpass';
    color.frequency.value = definition.filter;
    color.Q.value = id === 'triumph' || id === 'chase' ? 0.8 : 0.55;
    color.connect(output);

    for (let index = 0; index < definition.partials.length; index += 1) {
        const osc = keep(ctx.createOscillator());
        const gain = keep(ctx.createGain());
        osc.type = definition.type;
        osc.frequency.value = definition.root * definition.partials[index];
        gain.gain.value = index === 0 ? 0.13 : 0.055 / index;
        osc.connect(gain).connect(color);
        oscillators.add(osc);
        baseOscillators.push(osc);
    }

    const root = definition.root;
    function scheduleNext() {
        if (!active || disposed) return;
        const mayAdvance = options.mayAdvance || (() => true);
        if (!mayAdvance()) {
            const holdTimer = setTimeout(() => {
                timers.delete(holdTimer);
                scheduleNext();
            }, 180);
            timers.add(holdTimer);
            return;
        }

        const frequency = root * definition.notes[noteIndex % definition.notes.length];
        noteIndex += 1;
        const osc = keep(ctx.createOscillator());
        const envelope = keep(ctx.createGain());
        const colorFilter = keep(ctx.createBiquadFilter());
        const pan = keep(ctx.createStereoPanner());
        osc.type = definition.noteType;
        osc.frequency.value = frequency;
        colorFilter.type = 'lowpass';
        colorFilter.frequency.value = definition.filter * (id === 'starlight' ? 1.6 : 1.25);
        colorFilter.Q.value = 0.65;
        pan.pan.value = (noteIndex % 2 ? -1 : 1) * definition.pan;
        envelope.gain.value = 0;
        osc.connect(envelope).connect(colorFilter).connect(pan).connect(output);

        const now = ctx.currentTime;
        const attack = id === 'chase' ? 0.012 : 0.08;
        const length = definition.duration;
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(id === 'chase' ? 0.085 : 0.065, now + attack);
        envelope.gain.linearRampToValueAtTime(0, now + length);
        osc.start(now);
        osc.stop(now + length + 0.03);
        oscillators.add(osc);

        const cleanup = setTimeout(() => {
            timers.delete(cleanup);
            oscillators.delete(osc);
            for (const node of [osc, envelope, colorFilter, pan]) {
                nodes.delete(node);
                try { node.disconnect(); } catch { /* already disconnected */ }
            }
        }, (length + 0.1) * 1000);
        timers.add(cleanup);

        const next = setTimeout(() => {
            timers.delete(next);
            scheduleNext();
        }, definition.interval);
        timers.add(next);
    }

    function release() {
        if (disposed) return;
        disposed = true;
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
        for (const osc of oscillators) {
            try { osc.stop(); } catch { /* note already ended */ }
        }
        oscillators.clear();
        for (const node of nodes) {
            try { node.disconnect(); } catch { /* already disconnected */ }
        }
        nodes.clear();
    }

    return {
        start() {
            if (active || disposed || started) return;
            active = true;
            started = true;
            for (const osc of baseOscillators) osc.start();
            setLevel(output.gain, 0.72, ctx, 1.1);
            noteIndex = 0;
            scheduleNext();
        },
        stop(instant = false) {
            if (disposed) return;
            if (!active) {
                if (instant) release();
                return;
            }
            active = false;
            for (const timer of timers) clearTimeout(timer);
            timers.clear();
            if (instant) {
                release();
                return;
            }
            setLevel(output.gain, 0, ctx, 1.25);
            const finish = setTimeout(release, 1300);
            timers.add(finish);
        }
    };
}

export const CINEMATIC_SOUNDSCAPES = Object.freeze(Object.fromEntries(
    Object.entries(DEFINITIONS).map(([id, definition]) => [id, Object.freeze({
        name: definition.name,
        description: definition.description,
        create: (ctx, destination, options) => createCinematicPiece(id, ctx, destination, options)
    })])
));
