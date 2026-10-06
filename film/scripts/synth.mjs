#!/usr/bin/env node
/**
 * Compose and render the film's score in Node: a small deterministic
 * synthesiser, no browser, no sample library.
 *
 *   node film/scripts/synth.mjs            # film/music/through-the-vortex.wav
 *
 * Four minutes at 96 BPM in D minor, written to the marks in
 * MUSIC-AND-SOUND.md: a drone and a struck bell, the vortex build, the
 * phoenix lift with the hook, the sneak, a bed under the pitch, the hook's
 * return, one held chord. A Suno track, when it exists, replaces this file.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'music', 'through-the-vortex.wav');
const RATE = 48_000;
const SECONDS = 240;
const N = SECONDS * RATE;
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const TAU = Math.PI * 2;

/* ───────────────────────────── primitives ───────────────────────────── */

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** RBJ biquad; coefficients recomputed when asked. */
class Biquad {
  constructor(type, freq, q = 0.707) { this.type = type; this.z1 = 0; this.z2 = 0; this.set(freq, q); }
  set(freq, q = 0.707) {
    const f = Math.min(RATE * 0.45, Math.max(20, freq));
    const w = TAU * f / RATE, cos = Math.cos(w), sin = Math.sin(w), a = sin / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    else if (this.type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    a0 = 1 + a; a1 = -2 * cos; a2 = 1 - a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}

const note = (n, oct) => 440 * Math.pow(2, (n - 9) / 12 + (oct - 4));
const [D, E, F, G, A, Bb, C] = [2, 4, 5, 7, 9, 10, 0];

/** A stereo layer with its own buffer; `gain(t)` is a piecewise-linear curve. */
class Layer {
  constructor(name, points, { send = 0.25, delay = 0 } = {}) {
    this.name = name; this.L = new Float32Array(N); this.R = new Float32Array(N); this.points = points; this.send = send; this.delay = delay;
  }
  gainAt(t) {
    const p = this.points; if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i += 1) if (t <= p[i][0]) { const [t0, v0] = p[i - 1], [t1, v1] = p[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
    return p[p.length - 1][1];
  }
  /** Add a mono signal (function of sample index k within the note) at `start` for `dur`, panned. */
  add(start, dur, pan, fn) {
    const s0 = Math.max(0, Math.floor(start * RATE)), n = Math.min(N - s0, Math.floor(dur * RATE));
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    for (let k = 0; k < n; k += 1) { const v = fn(k); this.L[s0 + k] += v * l; this.R[s0 + k] += v * r; }
  }
}

const env = (k, n, a, d, sus, r) => {
  // a/d/r in samples; sustain level; release begins at n - r.
  if (k < a) return k / a;
  if (k < a + d) return 1 - (1 - sus) * (k - a) / d;
  if (k > n - r) return sus * Math.max(0, (n - k) / r);
  return sus;
};

/* ─────────────────────────────── layers ─────────────────────────────── */

const PAD = new Layer('pad', [[0, 0], [3, 0], [12, 0.26], [46, 0.26], [48, 0.4], [110, 0.4], [112, 0.22], [116, 0.18], [176, 0.18], [178, 0.4], [226, 0.4], [232, 0.34], [240, 0]], { send: 0.6 });
const ARP = new Layer('arp', [[0, 0], [6, 0], [10, 0.1], [26, 0.2], [46, 0.2], [48, 0.16], [70, 0.16], [72, 0], [176, 0], [178, 0.18], [226, 0.18], [228, 0]], { send: 0.3, delay: 0.35 });
const BASS = new Layer('bass', [[0, 0], [16, 0], [17, 0.5], [70, 0.5], [72, 0.4], [112, 0.4], [113, 0], [176, 0], [177, 0.5], [226, 0.5], [227, 0]], { send: 0.03 });
const DRUMS = new Layer('drums', [[0, 0], [16, 0], [16.5, 0.5], [70, 0.5], [72, 0.3], [94, 0.3], [95, 0.08], [100, 0.08], [101, 0.38], [112, 0.38], [113, 0], [176, 0], [177, 0.55], [216, 0.55], [226, 0.3], [227, 0]], { send: 0.12 });
const LEAD = new Layer('lead', [[0, 0], [45, 0], [46, 0.3], [70, 0.3], [72, 0], [176, 0], [178, 0.32], [226, 0.32], [232, 0]], { send: 0.4, delay: 0.3 });
const PULSE = new Layer('pulse', [[0, 0], [70, 0], [72, 0.35], [94, 0.35], [95, 0.12], [100, 0.12], [101, 0.35], [112, 0.35], [113, 0], [116, 0.12], [176, 0.12], [177, 0]], { send: 0.1 });
const DRONE = new Layer('drone', [[0, 0], [0.5, 0.45], [26, 0.45], [30, 0.18], [112, 0.18], [113, 0.3], [176, 0.3], [177, 0.14], [232, 0.14], [233, 0.6], [240, 0]], { send: 0.45 });
const LAYERS = [PAD, ARP, BASS, DRUMS, LEAD, PULSE, DRONE];

/* ───────────────────────────── instruments ───────────────────────────── */

function pad(freq, start, dur, layer, pan = 0) {
  const n = Math.floor(dur * RATE), a = Math.min(1.6, dur * 0.4) * RATE, r = 1.1 * RATE;
  const lp = new Biquad('lowpass', 900, 0.8);
  const ph = [0, 0, 0, 0], det = [0.996, 1, 1.004, 0.5];
  const f1 = 900, f2 = 2400;
  layer.add(start, dur, pan, k => {
    if ((k & 255) === 0) lp.set(f1 + (f2 - f1) * Math.min(1, k / (n * 0.6)), 0.8);
    let v = 0;
    for (let i = 0; i < 3; i += 1) { ph[i] += freq * det[i] / RATE; if (ph[i] >= 1) ph[i] -= 1; v += (ph[i] * 2 - 1) * 0.1; }
    ph[3] += freq * 0.5 / RATE; if (ph[3] >= 1) ph[3] -= 1; v += Math.sin(ph[3] * TAU) * 0.12;
    return lp.run(v) * env(k, n, a, 1, 1, r);
  });
}
function bass(freq, start, dur, layer) {
  const n = Math.floor(dur * RATE); let p1 = 0, p2 = 0; const lp = new Biquad('lowpass', 420, 0.9);
  layer.add(start, dur, 0, k => {
    p1 += freq / RATE; if (p1 >= 1) p1 -= 1; p2 += freq * 2 / RATE; if (p2 >= 1) p2 -= 1;
    const tri = 1 - 4 * Math.abs(p2 - 0.5);
    const e = k < 0.01 * RATE ? k / (0.01 * RATE) : Math.max(0, 0.7 * Math.exp(-(k - 0.01 * RATE) / (dur * 0.5 * RATE)) * Math.min(1, (n - k) / (0.02 * RATE)));
    return lp.run(Math.sin(p1 * TAU) * 0.7 + tri * 0.18) * e;
  });
}
function arp(freq, start, dur, layer, bright = 1, pan = 0) {
  const n = Math.floor(dur * RATE); let p = 0; const lp = new Biquad('lowpass', 600 + 2200 * bright, 5);
  const f0 = 600 + 2200 * bright;
  layer.add(start, dur, pan, k => {
    if ((k & 127) === 0) lp.set(300 + (f0 - 300) * Math.exp(-k / (n * 0.35)), 5);
    p += freq / RATE; if (p >= 1) p -= 1;
    const sq = p < 0.5 ? 1 : -1;
    return lp.run(sq * 0.35) * (k < 60 ? k / 60 : Math.exp(-(k - 60) / (n * 0.3)));
  });
}
function lead(freq, start, dur, layer, glide = null) {
  const n = Math.floor(dur * RATE); const ph = [0, 0]; const lp = new Biquad('lowpass', 2400, 1.1);
  layer.add(start, dur, 0, k => {
    const t = k / RATE;
    const f = (glide && t < 0.08 ? glide + (freq - glide) * (t / 0.08) : freq) * (1 + 0.004 * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.3));
    let v = 0;
    for (let i = 0; i < 2; i += 1) { ph[i] += f * (i ? 1.003 : 0.997) / RATE; if (ph[i] >= 1) ph[i] -= 1; v += (ph[i] * 2 - 1) * 0.28; }
    return lp.run(v) * env(k, n, 0.04 * RATE, 1, 1, 0.12 * RATE);
  });
}
function kick(start, layer, weight = 1) {
  let p = 0; const n = Math.floor(0.45 * RATE);
  layer.add(start, 0.45, 0, k => {
    const t = k / RATE; const f = 42 + 118 * Math.exp(-t / 0.045); p += f / RATE;
    const body = Math.sin(p * TAU) * Math.exp(-t / 0.13) * 1.1;
    const click = (rnd() * 2 - 1) * Math.exp(-t / 0.004) * 0.25;
    return (body + click) * weight * Math.min(1, (n - k) / 200);
  });
}
function hat(start, layer, open = false, level = 0.2) {
  const hp = new Biquad('highpass', 7800, 0.7); const dur = open ? 0.28 : 0.06;
  layer.add(start, dur + 0.02, 0.2, k => hp.run(rnd() * 2 - 1) * level * Math.exp(-k / (dur * RATE * 0.35)));
}
function snare(start, layer, level = 0.5) {
  const bp = new Biquad('bandpass', 1900, 0.8); let p = 0;
  layer.add(start, 0.25, -0.1, k => {
    const t = k / RATE; const f = 140 + 80 * Math.exp(-t / 0.03); p += f / RATE;
    return (bp.run(rnd() * 2 - 1) * Math.exp(-t / 0.07) + Math.sin(p * TAU) * 0.6 * Math.exp(-t / 0.04)) * level;
  });
}
function taiko(start, layer) {
  let p = 0; const lp = new Biquad('lowpass', 900, 0.7);
  layer.add(start, 1.5, 0, k => {
    const t = k / RATE; const f = 55 + 55 * Math.exp(-t / 0.12); p += f / RATE;
    return Math.sin(p * TAU) * Math.exp(-t / 0.45) * 1.0 + lp.run(rnd() * 2 - 1) * 0.5 * Math.exp(-t / 0.08);
  });
}
function riser(start, dur, layer, peak = 0.45) {
  const bp = new Biquad('bandpass', 200, 1.4);
  layer.add(start, dur + 0.15, 0, k => {
    const t = k / RATE; const x = Math.min(1, t / dur);
    if ((k & 255) === 0) bp.set(200 * Math.pow(30, x), 1.4);
    return bp.run(rnd() * 2 - 1) * peak * Math.pow(x, 2.2) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1);
  });
}
function bell(freq, start, layer, dur = 6) {
  let pc = 0, pm = 0;
  layer.add(start, dur, 0.3, k => {
    const t = k / RATE; const idx = 1.5 * Math.exp(-t / (dur * 0.3));
    pm += freq * 2.01 / RATE; pc += freq / RATE;
    return Math.sin(pc * TAU + idx * Math.sin(pm * TAU)) * 0.6 * Math.exp(-t / (dur * 0.35));
  });
}
function drone(freq, start, dur, layer) {
  const parts = [[1, 0.5], [0.5, 0.35], [1.5, 0.08], [2, 0.05]]; const ph = parts.map(() => 0); const lp = new Biquad('lowpass', 700, 0.7);
  layer.add(start, dur, 0, k => {
    const t = k / RATE; let v = 0;
    for (let i = 0; i < parts.length; i += 1) { const [m, lvl] = parts[i]; ph[i] += freq * m / RATE; if (ph[i] >= 1) ph[i] -= 1;
      const w = i === 2 ? 1 - 4 * Math.abs(ph[i] - 0.5) : i === 3 ? ph[i] * 2 - 1 : Math.sin(ph[i] * TAU);
      v += w * lvl * (1 + 0.3 * Math.sin(TAU * (0.07 + m * 0.03) * t)); }
    return lp.run(v) * Math.min(1, t / 2);
  });
}

/* ─────────────────────────────── the piece ─────────────────────────────── */

const CYCLE = [
  { root: [D, 2], tones: [[D, 3], [F, 3], [A, 3], [D, 4]] },
  { root: [Bb, 1], tones: [[Bb, 2], [D, 3], [F, 3], [Bb, 3]] },
  { root: [F, 2], tones: [[F, 2], [A, 2], [C, 3], [F, 3]] },
  { root: [C, 2], tones: [[C, 3], [E, 3], [G, 3], [C, 4]] }
];
const chordAt = bar => CYCLE[((bar % 4) + 4) % 4];
const firstBar = Math.ceil(6 / BAR);
const lastBar = Math.floor(232 / BAR);

console.time('compose');
drone(note(D, 1), 0, 240, DRONE);
bell(note(A, 4), 0.6, DRONE, 7);
bell(note(D, 5), 1.4, DRONE, 7);

for (let bar = firstBar; bar < lastBar; bar += 1) {
  const t = bar * BAR; const ch = chordAt(bar);
  ch.tones.forEach(([n, o], i) => pad(note(n, o + 1), t, BAR + 0.5, PAD, (i - 1.5) * 0.4));
}
[[D, 3], [A, 3], [D, 4], [F, 4], [E, 5]].forEach(([n, o], i) => pad(note(n, o), 232, 7.6, DRONE, (i - 2) * 0.3));

for (let bar = firstBar; bar < lastBar; bar += 1) {
  const ch = chordAt(bar);
  for (let s = 0; s < 16; s += 1) {
    const t = bar * BAR + s * BEAT / 4;
    const pick = ch.tones[[0, 1, 2, 3, 2, 1][s % 6]]; const oct = s % 8 >= 4 ? 2 : 1;
    arp(note(pick[0], pick[1] + oct), t, BEAT / 4 * 1.6, ARP, Math.min(1, Math.max(0, (t - 16) / 30)), (s % 2 ? 0.35 : -0.35));
  }
}
for (let bar = firstBar; bar < lastBar; bar += 1) {
  const ch = chordAt(bar);
  for (let b = 0; b < 4; b += 1) bass(note(ch.root[0], ch.root[1]), bar * BAR + b * BEAT, BEAT * 0.9, BASS);
  bass(note(ch.root[0], ch.root[1] + 1), bar * BAR + 3.5 * BEAT, BEAT * 0.45, BASS);
}
for (let bar = firstBar; bar < lastBar; bar += 1) {
  for (let b = 0; b < 4; b += 1) {
    const t = bar * BAR + b * BEAT;
    kick(t, DRUMS, b === 0 ? 1 : 0.85);
    if (b === 1 || b === 3) snare(t, DRUMS);
    hat(t, DRUMS, false, 0.18); hat(t + BEAT / 2, DRUMS, b === 3, 0.14);
  }
}
for (const t of [26, 46, 70, 100, 110, 176, 226]) taiko(t, DRONE);
riser(36, 10, DRONE, 0.45); riser(100, 10, DRONE, 0.35); riser(166, 10, DRONE, 0.4); riser(216, 8, DRONE, 0.3);
for (let bar = Math.floor(70 / BAR); bar < Math.ceil(176 / BAR); bar += 1) {
  const ch = chordAt(bar);
  for (let s = 0; s < 8; s += 1) { const t = bar * BAR + s * BEAT / 2; if (t > 176) break; arp(note(ch.root[0], ch.root[1] + 1), t, BEAT / 2 * 0.5, PULSE, 0.15); }
}
const HOOK = [[D, 5, 2], [F, 5, 1], [A, 5, 1], [G, 5, 2], [F, 5, 1], [E, 5, 1], [D, 5, 3], [C, 5, 1],
  [D, 5, 2], [F, 5, 1], [A, 5, 1], [C, 6, 2], [Bb, 5, 1], [A, 5, 1], [G, 5, 4], [null, 0, 4],
  [A, 5, 2], [G, 5, 1], [F, 5, 1], [E, 5, 2], [D, 5, 1], [C, 5, 1], [D, 5, 6], [null, 0, 2]];
const hookAt = (start, repeats) => { let t = start;
  for (let r = 0; r < repeats; r += 1) { let prev = null;
    for (const [n, o, beats] of HOOK) { const dur = beats * BEAT; if (n !== null) { lead(note(n, o), t, dur * 0.92, LEAD, prev); prev = note(n, o); } t += dur; } } };
hookAt(46, 1);
hookAt(178, 2);
console.timeEnd('compose');

/* ──────────────────────────────── mix ──────────────────────────────── */

console.time('mix');
const mixL = new Float32Array(N), mixR = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
for (const layer of LAYERS) {
  if (layer.delay) {
    // Dotted-eighth feedback delay with a darkening tone, mixed back into the layer.
    const d = Math.round(BEAT * 0.75 * RATE); const fb = 0.38; const tone = [new Biquad('lowpass', 3200), new Biquad('lowpass', 3200)];
    for (let i = d; i < N; i += 1) { layer.L[i] += tone[0].run(layer.L[i - d]) * fb * layer.delay / 0.38 * 0.38; layer.R[i] += tone[1].run(layer.R[i - d]) * fb; }
  }
  for (let i = 0; i < N; i += 1) {
    const g = (i & 1023) === 0 ? (layer._g = layer.gainAt(i / RATE)) : layer._g;
    const l = layer.L[i] * g, r = layer.R[i] * g;
    mixL[i] += l; mixR[i] += r; sendL[i] += l * layer.send; sendR[i] += r * layer.send;
  }
}
// Schroeder reverb: four combs and two allpasses per side, slightly different lengths per side.
function reverb(input, out, combs, allpasses) {
  const cb = combs.map(len => ({ buf: new Float32Array(len), i: 0, len, store: 0 }));
  const ap = allpasses.map(len => ({ buf: new Float32Array(len), i: 0, len }));
  const damp = 0.3, fbk = 0.84;
  for (let n = 0; n < N; n += 1) {
    const x = input[n]; let y = 0;
    for (const c of cb) { const o = c.buf[c.i]; c.store = o * (1 - damp) + c.store * damp; c.buf[c.i] = x + c.store * fbk; c.i = (c.i + 1) % c.len; y += o; }
    y *= 0.25;
    for (const a of ap) { const b = a.buf[a.i]; const v = -y + b; a.buf[a.i] = y + b * 0.5; a.i = (a.i + 1) % a.len; y = v; }
    out[n] += y * 0.5;
  }
}
reverb(sendL, mixL, [1557, 1617, 1491, 1422].map(v => v * 2), [225 * 2, 556 * 2]);
reverb(sendR, mixR, [1579, 1601, 1511, 1447].map(v => v * 2), [233 * 2, 571 * 2]);

// Soft ceiling, then normalise to -1 dBFS.
let peak = 0;
for (let i = 0; i < N; i += 1) { mixL[i] = Math.tanh(mixL[i] * 1.2); mixR[i] = Math.tanh(mixR[i] * 1.2); peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i])); }
const norm = Math.pow(10, -1 / 20) / (peak || 1);
console.timeEnd('mix');

const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i += 1) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[i] * norm)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[i] * norm)) * 32767), 46 + i * 4);
}
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, wav);
console.log(`${OUT}: ${SECONDS} s, peak ${peak.toFixed(2)} before normalising`);
