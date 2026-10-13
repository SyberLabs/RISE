/**
 * Harmonograph — the chord you can see.
 *
 * A damped-pendulum drawing machine: two lateral pendulums (one per
 * axis) tuned to a just-intonation frequency ratio, plus a small
 * rotary pendulum stirring the center, all decaying exponentially so
 * the pen visibly loses energy and dies into stillness. The Victorian
 * parlor instrument, rebuilt as a conductor's instrument: the ratio
 * is a musical interval chosen by the text's valence, the pendulum's
 * energy by its arousal (see planHarmonograph in the conductor).
 *
 *   x(u) = A·sin(p·θ + φ₁)·E(u) + R·cos(θ + φ₃)·E(u)^0.6
 *   y(u) = A·sin(q·(1+detune)·θ + φ₂)·E(u) + R·sin(θ + φ₃)·E(u)^0.6
 *   E(u) = e^(−damping·u),  θ = u·2π·cycles,  u ∈ [0,1]
 *
 * The detune is the drone's 1.002 shimmer drawn as line: the figure
 * precesses instead of retracing itself, so consonant ratios become
 * layered rosettes and golden ratios weave without ever closing.
 *
 * Rotary pendulums are the other machine: two rotary pendulums turning
 * opposite ways, each decaying at its own rate, until their energy is
 * under 5%. The pen is stroked additively, so where it crosses itself
 * it brightens, and moves from the climate's iris toward its core as
 * the energy is lost.
 *
 *   z(τ) = 0.55·e^(−d₁τ)·e^(i(f₁τ + φ₁)) + 0.45·e^(−d₂τ)·e^(i(f₂τ + φ₂))
 *   f₁ ∈ {2, 3},  f₂ = −(3 | 4) ± 0.02,  d ∈ [0.010, 0.018]
 *
 * |z| ≤ 1, and the figure spans 0.44 of the frame's shorter side, so it
 * always stays inside the inscribed circle.
 *
 * House rules honored: Rhythmic flashes and behind-stream are still
 * frames (progress defaults to 1). Gallery is the exception — after
 * the incoming plane is visible the pen travels across the remaining
 * dwell and rests complete for a few seconds; a rotary pen travels at
 * its own pace (drawMs) instead.
 * Glow via wide understroke (never shadowBlur), deterministic under a
 * seed, and a null-ctx guard so headless environments stay silent.
 */
import { createSeededRandom } from './lib/klee-core.js';
import { planHarmonograph } from '../core/conductor.js';

const TAU = Math.PI * 2;

// Rotary pendulums, in units of pendulum time τ.
const ROTARY_STEP = 0.01;
const ROTARY_UNITS_PER_SECOND = 18;
const ROTARY_END_ENERGY = 0.05;
const ROTARY_EXTENT = 0.44;
// Substeps per stroke: crossings between strokes add light, so the
// batch is the study's one frame of pen travel.
const ROTARY_BATCH = 30;
const ROTARY_ALPHA = 0.55;

function lerpAnchors(anchors, t) {
    // Interpolate across the upper stops (1..4) — stop 0 is near-void
    const span = anchors.length - 2;
    const pos = 1 + Math.max(0, Math.min(1, t)) * span;
    const seg = Math.min(anchors.length - 2, Math.floor(pos));
    const f = pos - seg;
    const a = anchors[seg], b = anchors[seg + 1] || anchors[seg];
    return [
        Math.round(a[0] + (b[0] - a[0]) * f),
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f)
    ];
}

export class Harmonograph {
    constructor() {
        this.plan = null;
        this.trace = null;      // Float32Array [x0,y0,x1,y1,...] in unit space
        this.envelope = null;   // Float32Array of E(u) per point
        this.pendulums = 'lateral';
        this.pair = null;       // the rotary pendulums, when chosen
        this.drawMs = null;     // a rotary pen's own travel time
    }

    /**
     * Compute a trace for a semantic signal. Deterministic for a given
     * (signal, seed) pair; a fresh random seed per flash otherwise.
     * @param {Object} [signal] - { valence, arousal }
     * @param {string|number} [seed]
     * @param {Object} [options] - { climate: 'auto' | climate name, anchors, pendulums: 'lateral' | 'rotary' }
     * @returns {boolean} true when a trace is ready
     */
    generate(signal, seed, options = {}) {
        const rng = createSeededRandom(seed ?? `hg-${Math.random()}`);
        const plan = planHarmonograph(signal, rng, options);
        if (options.pendulums === 'rotary') return this.generateRotary(plan, rng);
        this.pendulums = 'lateral';
        this.pair = null;
        this.drawMs = null;

        const [p, q] = plan.ratio;
        const fx = p;
        const fy = q * (1 + plan.detune);
        const phase1 = rng() * TAU;
        const phase2 = rng() * TAU;
        const phase3 = rng() * TAU;

        const steps = 6400;
        const trace = new Float32Array(steps * 2);
        const envelope = new Float32Array(steps);

        for (let i = 0; i < steps; i++) {
            const u = i / (steps - 1);
            const theta = u * TAU * plan.cycles;
            const decay = Math.exp(-plan.damping * u);
            const rotaryDecay = Math.pow(decay, 0.6);

            let x = Math.sin(fx * theta + phase1) * decay
                + Math.cos(theta + phase3) * plan.rotary * rotaryDecay;
            let y = Math.sin(fy * theta + phase2) * decay
                + Math.sin(theta + phase3) * plan.rotary * rotaryDecay;

            // Whole-figure precession over the trace's life
            const rot = plan.rotation * u;
            const cos = Math.cos(rot), sin = Math.sin(rot);
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;

            trace[i * 2] = rx;
            trace[i * 2 + 1] = ry;
            envelope[i] = decay;
        }

        this.plan = plan;
        this.trace = trace;
        this.envelope = envelope;
        return true;
    }

    /** Two rotary pendulums turning opposite ways, traced until their energy is under 5%. */
    generateRotary(plan, rng) {
        const f1 = rng() < 0.5 ? 2 : 3;
        const f2 = -(rng() < 0.5 ? 3 : 4) + (rng() - 0.5) * 0.04;
        const p1 = rng() * TAU, p2 = rng() * TAU;
        const d1 = 0.010 + rng() * 0.008, d2 = 0.010 + rng() * 0.008;

        const points = [];
        const energies = [];
        for (let i = 0; ; i++) {
            const tau = i * ROTARY_STEP;
            const e1 = Math.exp(-d1 * tau) * 0.55, e2 = Math.exp(-d2 * tau) * 0.45;
            points.push(
                e1 * Math.cos(f1 * tau + p1) + e2 * Math.cos(f2 * tau + p2),
                e1 * Math.sin(f1 * tau + p1) + e2 * Math.sin(f2 * tau + p2)
            );
            energies.push(e1 + e2);
            if (e1 + e2 < ROTARY_END_ENERGY) break;
        }

        this.plan = plan;
        this.pendulums = 'rotary';
        this.pair = { f1, f2, p1, p2, d1, d2 };
        this.trace = Float32Array.from(points);
        this.envelope = Float32Array.from(energies);
        this.drawMs = ((energies.length - 1) * ROTARY_STEP / ROTARY_UNITS_PER_SECOND) * 1000;
        return true;
    }

    /** Pixels per trace unit on a w × h canvas. */
    extent(w, h) {
        if (this.pendulums === 'rotary') return Math.min(w, h) * ROTARY_EXTENT;
        // Max extent is lateral (≤1) + rotary (≤0.26) ≈ 1.26 in unit
        // space; 1.7 keeps the hottest trace inside the frame
        return Math.min(w, h) * 0.5 * this.plan.amplitude * 1.7;
    }

    /**
     * Draw the prepared trace to a canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options] - { backgroundColor, progress }
     *   progress 0..1 traces the pen; omitted or 1 is the finished figure.
     */
    render(canvas, options = {}) {
        if (!this.plan || !this.trace || !canvas) return false;
        const ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return false; // headless guard

        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const scale = this.extent(w, h);

        ctx.fillStyle = options.backgroundColor || '#0A0A0C';
        ctx.fillRect(0, 0, w, h);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const anchors = this.plan.anchors;
        const progress = Math.max(0, Math.min(1, options.progress ?? 1));
        const steps = Math.max(2, Math.floor(this.envelope.length * progress));
        const batch = 80; // segments per stroke, colored along the decay

        // Pass 1 — glow: one wide, faint understroke in the climate's
        // heart color (house rule: never shadowBlur)
        const glow = lerpAnchors(anchors, 0.55);
        ctx.strokeStyle = `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, 0.10)`;
        ctx.lineWidth = Math.max(2.6, Math.min(w, h) * 0.006);
        ctx.beginPath();
        ctx.moveTo(cx + this.trace[0] * scale, cy + this.trace[1] * scale);
        for (let i = 1; i < steps; i += 2) {
            ctx.lineTo(cx + this.trace[i * 2] * scale, cy + this.trace[i * 2 + 1] * scale);
        }
        ctx.stroke();

        if (this.pendulums === 'rotary') {
            this.strokeRotary(ctx, cx, cy, scale, steps, Math.min(w, h));
            return true;
        }

        // Pass 2 — the pen line: bright while the pendulum is young,
        // dimming with the envelope so the decay is drawn, not implied
        ctx.lineWidth = Math.max(0.9, Math.min(w, h) * 0.0016);
        for (let start = 0; start < steps - 1; start += batch) {
            const end = Math.min(start + batch, steps - 1);
            const u = start / steps;
            const energy = this.envelope[start];
            const color = lerpAnchors(anchors, 1 - u * 0.8);
            const alpha = 0.08 + energy * 0.55;

            ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(cx + this.trace[start * 2] * scale, cy + this.trace[start * 2 + 1] * scale);
            for (let i = start + 1; i <= end; i++) {
                ctx.lineTo(cx + this.trace[i * 2] * scale, cy + this.trace[i * 2 + 1] * scale);
            }
            ctx.stroke();
        }

        return true;
    }

    /**
     * The rotary pen: one additive stroke per batch, coloured from the
     * climate's iris (its fourth stop) toward its core as energy is lost.
     * Butt caps, so batches meet without a bright bead at each join.
     */
    strokeRotary(ctx, cx, cy, scale, steps, side) {
        const anchors = this.plan.anchors;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'butt';
        ctx.lineWidth = Math.max(1, side * 0.0017);
        for (let start = 0; start < steps - 1; start += ROTARY_BATCH) {
            const end = Math.min(start + ROTARY_BATCH, steps - 1);
            const color = lerpAnchors(anchors, (2 + (1 - this.envelope[end])) / 3);
            ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${ROTARY_ALPHA})`;
            ctx.beginPath();
            ctx.moveTo(cx + this.trace[start * 2] * scale, cy + this.trace[start * 2 + 1] * scale);
            for (let i = start + 1; i <= end; i++) {
                ctx.lineTo(cx + this.trace[i * 2] * scale, cy + this.trace[i * 2 + 1] * scale);
            }
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}
