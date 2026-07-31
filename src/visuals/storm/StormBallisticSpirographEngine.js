/**
 * STORM OF STEEL — ENGINE 6: BALLISTIC TRAJECTORY SPIROGRAPH
 * (Spirograph / Harmonograph Engine)
 * 
 * Visualizes mathematical Lissajous and harmonograph arc traces plotting
 * heavy artillery shell flight paths, sound-ranging geometry, and counter-battery fire orbits.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormBallisticSpirographEngine {
    constructor() {
        this.name = "Storm Ballistic Trajectory Spirograph";
        this.category = "GEOMETRIC / STRUCTURAL";
        this.trace = null;
        this.seed = "storm-spiro-01";
        this.time = 0;

        this.params = {
            ratioP: 3,
            ratioQ: 4,
            cycles: 36,
            damping: 0.18,
            rotary: 0.22,
            detune: 0.003,
            speed: 0.4,
            colorPalette: 'copper_steel' // 'copper_steel', 'sulfur_gold', 'phosphor_emerald', 'cyan_spark'
        };
    }

    generate(signal = {}, seed = 'spiro-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);

        const p = options.ratioP || (2 + Math.floor(rng() * 4));
        const q = options.ratioQ || (3 + Math.floor(rng() * 5));
        const cycles = options.cycles || (24 + Math.floor(rng() * 24));
        const damping = options.damping || (0.12 + rng() * 0.15);

        this.params.ratioP = p;
        this.params.ratioQ = q;
        this.params.cycles = cycles;
        this.params.damping = damping;

        const steps = 4800;
        this.trace = new Float32Array(steps * 3); // x, y, envelope decay

        const fx = p;
        const fy = q * (1 + this.params.detune);
        const phase1 = rng() * Math.PI * 2;
        const phase2 = rng() * Math.PI * 2;
        const phase3 = rng() * Math.PI * 2;

        for (let i = 0; i < steps; i++) {
            const u = i / (steps - 1);
            const theta = u * Math.PI * 2 * cycles;
            const decay = Math.exp(-damping * u);
            const rotDecay = Math.pow(decay, 0.6);

            const x = Math.sin(fx * theta + phase1) * decay + Math.cos(theta + phase3) * this.params.rotary * rotDecay;
            const y = Math.sin(fy * theta + phase2) * decay + Math.sin(theta + phase3) * this.params.rotary * rotDecay;

            // Precession angle over trajectory life
            const rot = 0.8 * u;
            const rx = x * Math.cos(rot) - y * Math.sin(rot);
            const ry = x * Math.sin(rot) + y * Math.cos(rot);

            this.trace[i * 3] = rx;
            this.trace[i * 3 + 1] = ry;
            this.trace[i * 3 + 2] = decay;
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.speed;
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        if (!this.trace || this.trace.length === 0) {
            this.generate({}, this.seed);
        }

        ctx.fillStyle = options.backgroundColor || '#060608';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) * 0.42;

        const steps = this.trace.length / 3;
        const rotTime = this.time * 0.15;
        const cosT = Math.cos(rotTime), sinT = Math.sin(rotTime);

        // Color palettes
        const palettes = {
            copper_steel: {
                start: [255, 180, 70],
                end: [120, 60, 20]
            },
            sulfur_gold: {
                start: [240, 220, 80],
                end: [140, 120, 30]
            },
            phosphor_emerald: {
                start: [90, 240, 140],
                end: [20, 110, 60]
            },
            cyan_spark: {
                start: [100, 210, 255],
                end: [20, 80, 160]
            }
        };

        const pal = palettes[options.colorPalette || this.params.colorPalette] || palettes.copper_steel;

        // Render multi-segment trace with color decay along ballistic path
        const batch = 60;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let start = 0; start < steps - 1; start += batch) {
            const end = Math.min(start + batch, steps - 1);
            const u = start / steps;
            const decay = this.trace[start * 3 + 2];

            const r = Math.round(pal.start[0] + (pal.end[0] - pal.start[0]) * u);
            const g = Math.round(pal.start[1] + (pal.end[1] - pal.start[1]) * u);
            const b = Math.round(pal.start[2] + (pal.end[2] - pal.start[2]) * u);
            const alpha = (0.15 + decay * 0.7).toFixed(2);

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();

            for (let i = start; i <= end; i++) {
                const rx0 = this.trace[i * 3];
                const ry0 = this.trace[i * 3 + 1];

                // Slow canvas rotation
                const rx = rx0 * cosT - ry0 * sinT;
                const ry = rx0 * sinT + ry0 * cosT;

                const px = cx + rx * scale;
                const py = cy + ry * scale;

                if (i === start) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Draw center ballistic targeting reticle
        ctx.strokeStyle = 'rgba(215, 140, 60, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.15, 0, Math.PI * 2);
        ctx.moveTo(cx - scale * 0.25, cy); ctx.lineTo(cx + scale * 0.25, cy);
        ctx.moveTo(cx, cy - scale * 0.25); ctx.lineTo(cx, cy + scale * 0.25);
        ctx.stroke();

        ctx.setLineDash([]);

        return true;
    }
}
