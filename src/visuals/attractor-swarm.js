/**
 * The attractor as a swarm.
 *
 * Seven hundred particles, each ridden live through the same system the
 * filament integrates once: a tick is three Euler substeps, sixty ticks
 * to a second of motion. Every tick the trail fades by 7% and each
 * particle is plotted as a small square, added as light, coloured by its
 * height along six steps of the palette, and mirrored left and right.
 * The projection turns about the vertical axis at 0.18 rad a second.
 *
 * The figure is centred on the system's centroid and scaled by its widest
 * reach from it (the filament's modelR), so its radius is 0.38 of the
 * frame's shorter side, inside the inscribed circle with room to spare.
 * Particles start in a small seeded ball about the system's seed point and
 * are warmed 300 filament steps, so a swarm is the same for every reader.
 */
import { createSeededRandom } from './lib/klee-core.js';

export const SWARM_PARTICLES = 700;
export const SWARM_TICK_HZ = 60;
export const SWARM_FADE = 0.07;
const SUBSTEPS = 3;
// Euler substep as a share of the system's filament step (Aizawa: 0.008).
const STEP_SHARE = 0.8;
const PREWARM = 300;
const BALL = 0.5;
const TURN = 0.18;
const THETA0 = 0.6;
const FILL = 0.38;
const RAMP_STEPS = 6;
const ALPHA = 0.5;
const KALEIDO_SECTORS = 6;
const KALEIDO_COS = Array.from({ length: KALEIDO_SECTORS }, (_, k) => Math.cos((k * 2 * Math.PI) / KALEIDO_SECTORS));
const KALEIDO_SIN = Array.from({ length: KALEIDO_SECTORS }, (_, k) => Math.sin((k * 2 * Math.PI) / KALEIDO_SECTORS));

/** Six fill styles from the palette's halo hue to its light core. */
export function swarmRamp(palette) {
    const [from, to] = palette.core.map(pass => pass.col.split(',').map(Number));
    return Array.from({ length: RAMP_STEPS }, (_, i) => {
        const k = i / (RAMP_STEPS - 1);
        const c = from.map((v, j) => Math.round(v + (to[j] - v) * k));
        return `rgba(${c[0]},${c[1]},${c[2]},${ALPHA})`;
    });
}

/** The projection's turn at `seconds` of motion. */
export function swarmTheta(seconds) {
    return THETA0 + TURN * seconds;
}

export class AttractorSwarm {
    /**
     * @param {{f: Function, dt: number, seed: number[]}} system
     * @param {{cx: number, cy: number, cz: number, radius: number, zMin: number, zMax: number}} frame
     * @param {string} seed
     */
    constructor(system, frame, seed) {
        this.system = system;
        this.frame = frame;
        this.seed = seed;
        this.count = SWARM_PARTICLES;
        this.h = system.dt * STEP_SHARE;
        this.x = new Float64Array(this.count);
        this.y = new Float64Array(this.count);
        this.z = new Float64Array(this.count);
        this.sx = new Float32Array(this.count);
        this.sy = new Float32Array(this.count);
        this.bucket = new Uint8Array(this.count);
        this._d = [0, 0, 0];
        this.reset();
    }

    reset() {
        const random = createSeededRandom(this.seed);
        const [x0, y0, z0] = this.system.seed;
        for (let i = 0; i < this.count; i++) {
            this.x[i] = x0 + (random() - 0.5) * BALL;
            this.y[i] = y0 + (random() - 0.5) * BALL;
            this.z[i] = z0 + (random() - 0.5) * BALL;
        }
        this.steps(PREWARM, this.system.dt);
    }

    steps(n, h) {
        const { f } = this.system, d = this._d;
        const { x, y, z } = this;
        for (let i = 0; i < this.count; i++) {
            let px = x[i], py = y[i], pz = z[i];
            for (let k = 0; k < n; k++) {
                f(px, py, pz, d);
                px += d[0] * h; py += d[1] * h; pz += d[2] * h;
            }
            x[i] = px; y[i] = py; z[i] = pz;
        }
    }

    /** One tick of motion. */
    advance() {
        this.steps(SUBSTEPS, this.h);
    }

    /**
     * Screen positions on a w × h frame turned to `theta`, and each
     * particle's step on the height ramp.
     */
    project(w, h, theta) {
        const { cx, cy, cz, radius, zMin, zMax } = this.frame;
        const s = (FILL * Math.min(w, h)) / radius;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const span = zMax - zMin;
        for (let i = 0; i < this.count; i++) {
            const ax = this.x[i] - cx, ay = this.y[i] - cy, z = this.z[i];
            this.sx[i] = w / 2 + (ax * cos - ay * sin) * s;
            this.sy[i] = h / 2 - (z - cz) * s;
            const step = Math.round(((z - zMin) / span) * (RAMP_STEPS - 1));
            this.bucket[i] = step < 0 ? 0 : step >= RAMP_STEPS ? RAMP_STEPS - 1 : step;
        }
        return { x: this.sx, y: this.sy, bucket: this.bucket };
    }

    /**
     * Add the swarm, as it stands, to a trail. `mirror` and `bilateral`
     * reflect each square across the vertical axis; `kaleido` turns a sixth
     * of the particles into six sectors, each twice reflected, so the
     * rosette costs and weighs what the mirror does.
     */
    plot(ctx, w, h, theta, ramp, form) {
        const { x, y, bucket } = this.project(w, h, theta);
        const dot = Math.max(1.2, Math.min(w, h) / 500);
        const half = dot / 2;
        const cx = w / 2, cy = h / 2;
        ctx.globalCompositeOperation = 'lighter';
        if (form === 'kaleido') {
            const sample = Math.ceil(this.count / KALEIDO_SECTORS);
            for (let b = 0; b < RAMP_STEPS; b++) {
                ctx.fillStyle = ramp[b];
                for (let i = 0; i < sample; i++) {
                    if (bucket[i] !== b) continue;
                    const dx = x[i] - cx, dy = y[i] - cy;
                    for (let k = 0; k < KALEIDO_SECTORS; k++) {
                        const cos = KALEIDO_COS[k], sin = KALEIDO_SIN[k];
                        ctx.fillRect(cx + dx * cos - dy * sin - half, cy + dx * sin + dy * cos - half, dot, dot);
                        ctx.fillRect(cx + dx * cos + dy * sin - half, cy + dx * sin - dy * cos - half, dot, dot);
                    }
                }
            }
        } else {
            for (let b = 0; b < RAMP_STEPS; b++) {
                ctx.fillStyle = ramp[b];
                for (let i = 0; i < this.count; i++) {
                    if (bucket[i] !== b) continue;
                    ctx.fillRect(x[i] - half, y[i] - half, dot, dot);
                    ctx.fillRect(2 * cx - x[i] - half, y[i] - half, dot, dot);
                }
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }
}
