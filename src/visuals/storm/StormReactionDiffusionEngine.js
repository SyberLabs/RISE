/**
 * STORM OF STEEL — ENGINE 4: MUSTARD GAS & TRENCH VAPOR
 * (Reaction-Diffusion / Turing Patterns Engine)
 * 
 * Visualizes morphogenetic chemical gradients (Gray-Scott model / multiscale Turing patterns)
 * representing toxic mustard gas, smoldering phosphorus clouds, and creeping sulfur vapors.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormReactionDiffusionEngine {
    constructor() {
        this.name = "Storm Mustard Gas Turing Patterns";
        this.category = "ORGANIC / NATURAL";
        this.gridW = 120;
        this.gridH = 120;
        this.u = null;
        this.v = null;
        this.nextU = null;
        this.nextV = null;
        this.seed = "storm-gas-01";
        this.time = 0;

        // Gray-Scott parameters for spots/stripes gas morphs
        this.params = {
            feed: 0.0545,  // Feed rate
            kill: 0.062,   // Kill rate
            diffU: 1.0,
            diffV: 0.5,
            speed: 1.2,
            colorPalette: 'mustard_gas' // 'mustard_gas', 'phosphor_glow', 'smoke_soot', 'crucible_heat'
        };
    }

    generate(signal = {}, seed = 'gas-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);

        const w = this.gridW;
        const h = this.gridH;
        const size = w * h;

        this.u = new Float32Array(size);
        this.v = new Float32Array(size);
        this.nextU = new Float32Array(size);
        this.nextV = new Float32Array(size);

        // Fill background with U = 1.0, V = 0
        for (let i = 0; i < size; i++) {
            this.u[i] = 1.0;
            this.v[i] = 0.0;
        }

        // Seed 12-20 chemical disturbance centers (mustard gas canisters / phosphorus bursts)
        const seedCount = 16;
        for (let s = 0; s < seedCount; s++) {
            const cx = Math.floor(0.15 * w + rng() * 0.7 * w);
            const cy = Math.floor(0.15 * h + rng() * 0.7 * h);
            const rad = Math.floor(4 + rng() * 8);

            for (let r = -rad; r <= rad; r++) {
                for (let c = -rad; c <= rad; c++) {
                    const gx = cx + c;
                    const gy = cy + r;
                    if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
                        if (c * c + r * r <= rad * rad) {
                            const idx = gy * w + gx;
                            this.v[idx] = 0.9 + rng() * 0.1;
                            this.u[idx] = 0.2;
                        }
                    }
                }
            }
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        if (!this.u) return;

        const w = this.gridW;
        const h = this.gridH;
        const f = this.params.feed;
        const k = this.params.kill;
        const du = this.params.diffU;
        const dv = this.params.diffV;

        const stepsPerFrame = Math.max(1, Math.floor(this.params.speed * 2));

        for (let iter = 0; iter < stepsPerFrame; iter++) {
            for (let y = 1; y < h - 1; y++) {
                const yOffset = y * w;
                for (let x = 1; x < w - 1; x++) {
                    const idx = yOffset + x;

                    const uVal = this.u[idx];
                    const vVal = this.v[idx];

                    // 5-point discrete Laplacian stencil
                    const lapU = (
                        this.u[idx - 1] + this.u[idx + 1] +
                        this.u[idx - w] + this.u[idx + w] - 4 * uVal
                    );
                    const lapV = (
                        this.v[idx - 1] + this.v[idx + 1] +
                        this.v[idx - w] + this.v[idx + w] - 4 * vVal
                    );

                    const uvv = uVal * vVal * vVal;

                    this.nextU[idx] = Math.max(0, Math.min(1, uVal + (du * lapU - uvv + f * (1 - uVal)) * 0.9));
                    this.nextV[idx] = Math.max(0, Math.min(1, vVal + (dv * lapV + uvv - (f + k) * vVal) * 0.9));
                }
            }

            // Swap buffers
            const tempU = this.u; this.u = this.nextU; this.nextU = tempU;
            const tempV = this.v; this.v = this.nextV; this.nextV = tempV;
        }

        this.time += dt;
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        if (!this.u) {
            this.generate({}, this.seed);
        }

        const gw = this.gridW;
        const gh = this.gridH;

        // Render to offscreen buffer then scale to target canvas
        const imgData = ctx.createImageData(gw, gh);
        const pixels = imgData.data;

        const pal = options.colorPalette || this.params.colorPalette;

        for (let i = 0; i < gw * gh; i++) {
            const val = this.v[i];
            let r = 0, g = 0, b = 0;

            if (pal === 'phosphor_glow') {
                r = Math.min(255, Math.floor(val * 120));
                g = Math.min(255, Math.floor(val * 255));
                b = Math.min(255, Math.floor(val * 180));
            } else if (pal === 'crucible_heat') {
                r = Math.min(255, Math.floor(val * 255));
                g = Math.min(255, Math.floor(val * 130));
                b = Math.min(255, Math.floor(val * 30));
            } else if (pal === 'smoke_soot') {
                const gray = Math.min(255, Math.floor(val * 190));
                r = gray; g = gray; b = gray;
            } else {
                // Mustard Gas (default)
                r = Math.min(255, Math.floor(val * 210 + 20));
                g = Math.min(255, Math.floor(val * 230 + 15));
                b = Math.min(255, Math.floor(val * 40));
            }

            const pixelIdx = i * 4;
            pixels[pixelIdx] = r;
            pixels[pixelIdx + 1] = g;
            pixels[pixelIdx + 2] = b;
            pixels[pixelIdx + 3] = Math.min(255, Math.floor(val * 240 + 15));
        }

        // Draw scaled image with smoothing disabled for crisp chemical texture
        ctx.fillStyle = options.backgroundColor || '#080806';
        ctx.fillRect(0, 0, w, h);

        const offscreen = document.createElement('canvas');
        offscreen.width = gw;
        offscreen.height = gh;
        offscreen.getContext('2d').putImageData(imgData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, w, h);

        return true;
    }
}
