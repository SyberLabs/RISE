/**
 * SoundSandbox harness — the rack.
 *
 * Signal chain (fixed; patches never see anything past their slot):
 *   patch → slot gain (A/B crossfade × slot level) → master gain
 *         → safety limiter (DynamicsCompressor) → analyser → speakers
 *
 * Two slots, A and B, each hosting any patch from the manifest with
 * live params. The crossfader is equal-power. Patches are trusted to
 * ramp their own envelopes (sandbox-lib rampIn/rampOut) but the slot
 * gain and limiter make a click or a blast impossible even if one
 * misbehaves.
 */
import { PATCHES } from './patches/manifest.js';

let ctx = null;
let master, limiter, analyser;
const slots = {};
let crossfade = 0.5;

function ensureContext() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.9;

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 16;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.25;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.82;

    master.connect(limiter).connect(analyser).connect(ctx.destination);

    for (const name of ['A', 'B']) {
        const gain = ctx.createGain();
        gain.connect(master);
        slots[name].gain = gain;
        applySlotGain(name);
    }
    drawAnalyser();
    return ctx;
}

// ── Slots ────────────────────────────────────────────────────────

function makeSlotState(name, patchIndex) {
    return {
        name,
        patch: PATCHES[patchIndex],
        handle: null,
        playing: false,
        level: 1,
        gain: null,
        values: {}
    };
}

function applySlotGain(name) {
    const slot = slots[name];
    if (!slot.gain) return;
    // Equal-power crossfade: A fades on cos, B on sin
    const x = crossfade * Math.PI / 2;
    const fade = name === 'A' ? Math.cos(x) : Math.sin(x);
    slot.gain.gain.setTargetAtTime(fade * slot.level, ctx.currentTime, 0.05);
}

function currentParams(slot) {
    const values = {};
    for (const p of slot.patch.params) values[p.id] = slot.values[p.id] ?? p.value;
    return values;
}

function play(name) {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    const slot = slots[name];
    if (slot.playing) return;
    slot.handle = slot.patch.build(ctx, slot.gain, currentParams(slot));
    slot.handle.start();
    slot.playing = true;
    renderSlot(name);
}

function stop(name) {
    const slot = slots[name];
    if (!slot.playing) return;
    slot.handle.stop();
    slot.handle = null;
    slot.playing = false;
    renderSlot(name);
}

function selectPatch(name, index) {
    const slot = slots[name];
    const wasPlaying = slot.playing;
    if (wasPlaying) stop(name);
    slot.patch = PATCHES[index];
    slot.values = {};
    renderSlot(name);
    if (wasPlaying) play(name);
}

// ── UI ───────────────────────────────────────────────────────────

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function renderSlot(name) {
    const slot = slots[name];
    const host = document.getElementById(`slot-${name}`);
    host.innerHTML = '';

    const head = el('div', 'slot-head');
    head.appendChild(el('span', 'slot-tag', name));

    const select = document.createElement('select');
    PATCHES.forEach((p, i) => {
        const opt = el('option', '', `${p.name} · ${p.category}`);
        opt.value = i;
        if (p.id === slot.patch.id) opt.selected = true;
        select.appendChild(opt);
    });
    select.onchange = () => selectPatch(name, Number(select.value));
    head.appendChild(select);

    const btn = el('button', slot.playing ? 'play-btn playing' : 'play-btn',
        slot.playing ? '■ stop' : '▶ play');
    btn.onclick = () => (slot.playing ? stop(name) : play(name));
    head.appendChild(btn);
    host.appendChild(head);

    host.appendChild(el('p', 'slot-desc', slot.patch.description));

    const paramsBox = el('div', 'params');
    for (const p of slot.patch.params) {
        const row = el('div', 'param-row');
        row.appendChild(el('label', '', p.label));
        const value = slot.values[p.id] ?? p.value;

        if (p.type === 'select') {
            const sel = document.createElement('select');
            p.options.forEach(o => {
                const opt = el('option', '', o);
                opt.value = o;
                if (o === value) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.onchange = () => {
                slot.values[p.id] = sel.value;
                if (slot.handle) slot.handle.set(p.id, sel.value);
            };
            row.appendChild(sel);
        } else {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = p.min; input.max = p.max; input.step = p.step;
            input.value = value;
            const readout = el('span', 'readout', String(value));
            input.oninput = () => {
                const v = Number(input.value);
                slot.values[p.id] = v;
                readout.textContent = String(v);
                if (slot.handle) slot.handle.set(p.id, v);
            };
            row.appendChild(input);
            row.appendChild(readout);
            if (p.marks) {
                const marks = el('div', 'marks');
                for (const [label, v] of Object.entries(p.marks)) {
                    const m = el('button', 'mark', label);
                    m.onclick = () => {
                        input.value = v;
                        input.dispatchEvent(new Event('input'));
                    };
                    marks.appendChild(m);
                }
                row.appendChild(marks);
            }
        }
        paramsBox.appendChild(row);
    }

    // Slot trim (independent of the crossfader)
    const trim = el('div', 'param-row');
    trim.appendChild(el('label', '', 'Slot Trim'));
    const trimInput = document.createElement('input');
    trimInput.type = 'range';
    trimInput.min = 0; trimInput.max = 1; trimInput.step = 0.01;
    trimInput.value = slot.level;
    trimInput.oninput = () => {
        slot.level = Number(trimInput.value);
        if (ctx) applySlotGain(name);
    };
    trim.appendChild(trimInput);
    paramsBox.appendChild(trim);

    host.appendChild(paramsBox);
}

function wireMaster() {
    const fader = document.getElementById('crossfade');
    fader.oninput = () => {
        crossfade = Number(fader.value);
        if (ctx) { applySlotGain('A'); applySlotGain('B'); }
    };
    document.getElementById('solo-a').onclick = () => { fader.value = 0; fader.dispatchEvent(new Event('input')); };
    document.getElementById('solo-b').onclick = () => { fader.value = 1; fader.dispatchEvent(new Event('input')); };
    document.getElementById('both').onclick = () => { fader.value = 0.5; fader.dispatchEvent(new Event('input')); };

    const masterVol = document.getElementById('master-vol');
    masterVol.oninput = () => {
        if (ctx) master.gain.setTargetAtTime(Number(masterVol.value), ctx.currentTime, 0.05);
    };
    document.getElementById('panic').onclick = () => { stop('A'); stop('B'); };
}

// ── Analyser ─────────────────────────────────────────────────────

function drawAnalyser() {
    const canvas = document.getElementById('scope');
    const g = canvas.getContext('2d');
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(2048);

    (function frame() {
        requestAnimationFrame(frame);
        const w = canvas.width = canvas.clientWidth;
        const h = canvas.height = canvas.clientHeight;
        g.clearRect(0, 0, w, h);

        // Spectrum, log frequency axis (20Hz–8kHz is where our life is)
        analyser.getByteFrequencyData(freqData);
        const nyquist = ctx.sampleRate / 2;
        const fMin = 20, fMax = 8000;
        g.fillStyle = 'rgba(140, 172, 255, 0.55)';
        const bars = 160;
        for (let i = 0; i < bars; i++) {
            const f = fMin * Math.pow(fMax / fMin, i / bars);
            const bin = Math.min(freqData.length - 1, Math.round(f / nyquist * freqData.length));
            const v = freqData[bin] / 255;
            const bh = v * v * (h - 14);
            g.fillRect(i / bars * w, h - bh, w / bars - 1, bh);
        }

        // Waveform overlay
        analyser.getByteTimeDomainData(timeData);
        g.strokeStyle = 'rgba(255, 208, 130, 0.7)';
        g.lineWidth = 1.2;
        g.beginPath();
        for (let i = 0; i < timeData.length; i++) {
            const x = i / timeData.length * w;
            const y = (timeData[i] / 255) * h * 0.5 + h * 0.25;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
    })();
}

// ── Boot ─────────────────────────────────────────────────────────

slots.A = makeSlotState('A', 0);
slots.B = makeSlotState('B', PATCHES.length - 1);
renderSlot('A');
renderSlot('B');
wireMaster();
