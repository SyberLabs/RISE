/**
 * STORM OF STEEL — ENGINE 3: DRUMFIRE STRANGE ATTRACTORS
 * (Strange Attractors Engine)
 * 
 * Visualizes Lorenz, Clifford, De Jong, and Aizawa strange attractors representing
 * the hypnotic mathematical chaos and mechanical rhythm of continuous heavy artillery drumfire.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormAttractorEngine {
    constructor() {
        this.name = "Storm Drumfire Strange Attractor";
        this.category = "DIMENSIONAL / SPATIAL";
        this.trace = [];
        this.type = 'lorenz'; // 'lorenz', 'clifford', 'dejong', 'aizawa'
        this.seed = "storm-attractor-01";
        this.time = 0;

        this.params = {
            iterations: 18000,
            attractorType: 'lorenz',
            glowIntensity: 0.7,
            rotationSpeed: 0.4,
            zoom: 1.0,
            colorPalette: 'ember_crucible' // 'ember_crucible', 'phosphor_mist', 'cyan_steel'
        };
    }

    generate(signal = {}, seed = 'attractor-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.type = options.attractorType || this.params.attractorType;
        const count = options.iterations || this.params.iterations;

        this.trace = new Float32Array(count * 3);

        if (this.type === 'lorenz') {
            let x = 0.1, y = 0, z = 0;
            const sigma = 10, rho = 28, beta = 8 / 3;
            const dt = 0.005;

            for (let i = 0; i < count; i++) {
                const dx = sigma * (y - x);
                const dy = x * (rho - z) - y;
                const dz = x * y - beta * z;

                x += dx * dt;
                y += dy * dt;
                z += dz * dt;

                this.trace[i * 3] = x * 0.03;
                this.trace[i * 3 + 1] = y * 0.03;
                this.trace[i * 3 + 2] = (z - 25) * 0.03;
            }
        } else if (this.type === 'clifford') {
            let x = 0.1, y = 0.1;
            const a = -1.4 + (rng() - 0.5) * 0.4;
            const b = 1.6 + (rng() - 0.5) * 0.4;
            const c = 1.0 + (rng() - 0.5) * 0.4;
            const d = 0.7 + (rng() - 0.5) * 0.4;

            for (let i = 0; i < count; i++) {
                const nx = Math.sin(a * y) + c * Math.cos(a * x);
                const ny = Math.sin(b * x) + d * Math.cos(b * y);
                x = nx; y = ny;

                this.trace[i * 3] = x * 0.35;
                this.trace[i * 3 + 1] = y * 0.35;
                this.trace[i * 3 + 2] = Math.sin(i * 0.01) * 0.2;
            }
        } else if (this.type === 'aizawa') {
            let x = 0.1, y = 0, z = 0;
            const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
            const dt = 0.01;

            for (let i = 0; i < count; i++) {
                const dx = (z - b) * x - d * y;
                const dy = d * x + (z - b) * y;
                const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * (x * x * x);

                x += dx * dt;
                y += dy * dt;
                z += dz * dt;

                this.trace[i * 3] = x * 0.4;
                this.trace[i * 3 + 1] = y * 0.4;
                this.trace[i * 3 + 2] = z * 0.4;
            }
        } else {
            // De Jong
            let x = 0.1, y = 0.1;
            const a = 1.4, b = -2.3, c = 2.4, d = -2.1;

            for (let i = 0; i < count; i++) {
                const nx = Math.sin(a * y) - Math.cos(b * x);
                const ny = Math.sin(c * x) - Math.cos(d * y);
                x = nx; y = ny;

                this.trace[i * 3] = x * 0.38;
                this.trace[i * 3 + 1] = y * 0.38;
                this.trace[i * 3 + 2] = Math.cos(i * 0.02) * 0.2;
            }
        }

        if (signal.arousal !== undefined) {
            this.params.rotationSpeed = 0.2 + signal.arousal * 0.8;
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.rotationSpeed * (1 + (signal.arousal ?? 0.5) * 0.5);
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        ctx.fillStyle = options.backgroundColor || '#060504';
        ctx.fillRect(0, 0, w, h);

        if (!this.trace || this.trace.length === 0) {
            this.generate({}, this.seed);
        }

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) * 0.85 * this.params.zoom;

        const rotY = this.time * 0.6;
        const rotX = Math.sin(this.time * 0.4) * 0.4;

        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

        const count = this.trace.length / 3;

        // Color palettes
        const palettes = {
            ember_crucible: [
                'rgba(255, 240, 200, 0.7)',
                'rgba(255, 140, 30, 0.5)',
                'rgba(210, 50, 10, 0.3)',
                'rgba(90, 20, 10, 0.15)'
            ],
            phosphor_mist: [
                'rgba(220, 255, 230, 0.7)',
                'rgba(70, 220, 130, 0.5)',
                'rgba(20, 140, 70, 0.3)',
                'rgba(10, 50, 30, 0.15)'
            ],
            cyan_steel: [
                'rgba(220, 245, 255, 0.7)',
                'rgba(70, 180, 240, 0.5)',
                'rgba(20, 90, 170, 0.3)',
                'rgba(10, 30, 70, 0.15)'
            ]
        };

        const colors = palettes[options.colorPalette || this.params.colorPalette] || palettes.ember_crucible;

        // Render point cloud with depth buffer shading
        const stepSize = Math.max(1, Math.floor(count / 14000));

        for (let i = 0; i < count; i += stepSize) {
            const x0 = this.trace[i * 3];
            const y0 = this.trace[i * 3 + 1];
            const z0 = this.trace[i * 3 + 2];

            // 3D rotation
            const x1 = x0 * cosY + z0 * sinY;
            const z1 = -x0 * sinY + z0 * cosY;

            const y2 = y0 * cosX - z1 * sinX;
            const z2 = y0 * sinX + z1 * cosX;

            const perspective = 1 / (1 + z2 * 0.4);
            const px = cx + x1 * scale * perspective;
            const py = cy + y2 * scale * perspective;

            const depthIdx = Math.min(colors.length - 1, Math.max(0, Math.floor((z2 + 1) * 1.5)));
            ctx.fillStyle = colors[depthIdx];

            const pSize = Math.max(1, (1.8 * perspective).toFixed(1));
            ctx.fillRect(px, py, pSize, pSize);
        }

        return true;
    }
}
