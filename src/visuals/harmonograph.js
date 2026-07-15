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
 * House rules honored: still frames only (all motion lives between
 * flashes, never during), glow via wide understroke (never
 * shadowBlur), deterministic under a seed, and a null-ctx guard so
 * headless environments stay silent.
 */
import { createSeededRandom } from './lib/klee-core.js';
import { planHarmonograph } from '../core/conductor.js';

const TAU = Math.PI * 2;

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
    }

    /**
     * Compute a trace for a semantic signal. Deterministic for a given
     * (signal, seed) pair; a fresh random seed per flash otherwise.
     * @param {Object} [signal] - { valence, arousal }
     * @param {string|number} [seed]
     * @returns {boolean} true when a trace is ready
     */
    generate(signal, seed) {
        const rng = createSeededRandom(seed ?? `hg-${Math.random()}`);
        const plan = planHarmonograph(signal, rng);

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

    /**
     * Draw the prepared trace to a canvas as a single still frame.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options] - { backgroundColor }
     */
    render(canvas, options = {}) {
        if (!this.plan || !this.trace || !canvas) return false;
        const ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return false; // headless guard

        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        // Max extent is lateral (≤1) + rotary (≤0.26) ≈ 1.26 in unit
        // space; 1.7 keeps the hottest trace inside the frame
        const scale = Math.min(w, h) * 0.5 * this.plan.amplitude * 1.7;

        ctx.fillStyle = options.backgroundColor || '#0c0c0e';
        ctx.fillRect(0, 0, w, h);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const anchors = this.plan.anchors;
        const steps = this.envelope.length;
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
}
