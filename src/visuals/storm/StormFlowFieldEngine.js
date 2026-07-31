/**
 * STORM OF STEEL — ENGINE 2: STEEL SHRAPNEL & TRACER VECTOR FIELD
 * (Flow Fields Engine)
 * 
 * Visualizes thousands of high-velocity ballistic particles following curl noise
 * vector fields, tracer sparks, shell ricochets, and iron dust streams across No Man's Land.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormFlowFieldEngine {
    constructor() {
        this.name = "Storm Steel Shrapnel Flow Field";
        this.category = "ORGANIC / NATURAL";
        this.particles = [];
        this.field = [];
        this.seed = "storm-flow-01";
        this.time = 0;

        this.params = {
            particleCount: 2200,
            noiseScale: 0.0035,
            tracerLength: 12,
            particleSpeed: 3.2,
            smokeFade: 0.12, // Trail fade factor
            colorPalette: 'combustion' // 'combustion', 'phosphor', 'steel', 'mud_ash'
        };
    }

    generate(signal = {}, seed = 'flow-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        const count = options.particleCount || this.params.particleCount;

        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: rng(),
                y: rng(),
                vx: 0,
                vy: 0,
                life: rng(),
                maxLife: 0.5 + rng() * 1.5,
                weight: 0.5 + rng() * 1.5,
                temp: rng() // 1 = white hot, 0 = cold soot
            });
        }

        if (signal.arousal !== undefined) {
            this.params.particleSpeed = 2.0 + signal.arousal * 3.5;
        }

        return true;
    }

    // Fast 2D Simplex/Perlin-style noise approximation
    _noise(x, y, z) {
        const sin1 = Math.sin(x * 12.9898 + y * 78.233 + z * 37.711);
        const cos1 = Math.cos(x * 26.311 + y * 43.19 + z * 19.82);
        return Math.sin(sin1 * 43758.5453 + cos1 * 12345.678);
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;
        const speed = this.params.particleSpeed * (1 + (signal.arousal ?? 0.5) * 0.5);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            // Vector angle from noise field
            const nx = p.x * this.params.noiseScale * 1000;
            const ny = p.y * this.params.noiseScale * 1000;
            const angle = this._noise(nx, ny, this.time * 0.3) * Math.PI * 4;

            // Velocity update
            const targetVx = Math.cos(angle) * speed * 0.001;
            const targetVy = Math.sin(angle) * speed * 0.001 + 0.0003; // slight ballistic gravity downward

            p.vx = p.vx * 0.85 + targetVx * 0.15;
            p.vy = p.vy * 0.85 + targetVy * 0.15;

            p.x += p.vx;
            p.y += p.vy;
            p.life += dt;

            // Respawn particle if it leaves bounds or dies
            if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.life > p.maxLife) {
                p.x = Math.random();
                p.y = Math.random();
                p.vx = (Math.random() - 0.5) * 0.002;
                p.vy = (Math.random() - 0.5) * 0.002;
                p.life = 0;
                p.temp = Math.random();
            }
        }
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        // Semi-transparent fade trail effect
        ctx.fillStyle = `rgba(10, 9, 8, ${this.params.smokeFade})`;
        ctx.fillRect(0, 0, w, h);

        if (this.particles.length === 0) {
            this.generate({}, this.seed);
        }

        const tracerLen = this.params.tracerLength;

        // Color palettes mapped by particle temperature
        const getColor = (temp, alpha) => {
            const pal = options.colorPalette || this.params.colorPalette;
            if (pal === 'phosphor') {
                if (temp > 0.8) return `rgba(220, 255, 230, ${alpha})`;
                if (temp > 0.4) return `rgba(80, 220, 130, ${alpha})`;
                return `rgba(30, 120, 60, ${alpha})`;
            } else if (pal === 'steel') {
                if (temp > 0.8) return `rgba(230, 245, 255, ${alpha})`;
                if (temp > 0.4) return `rgba(100, 180, 240, ${alpha})`;
                return `rgba(40, 90, 150, ${alpha})`;
            } else if (pal === 'mud_ash') {
                if (temp > 0.8) return `rgba(240, 220, 180, ${alpha})`;
                if (temp > 0.4) return `rgba(160, 130, 90, ${alpha})`;
                return `rgba(70, 55, 40, ${alpha})`;
            } else {
                // Combustion (default)
                if (temp > 0.85) return `rgba(255, 250, 220, ${alpha})`; // Incandescent white
                if (temp > 0.60) return `rgba(255, 170, 40, ${alpha})`;  // Sulfur yellow
                if (temp > 0.30) return `rgba(230, 70, 20, ${alpha})`;   // Iron orange/red
                return `rgba(110, 40, 20, ${alpha})`;                   // Oxidized cinder
            }
        };

        // Render particle traces
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const px = p.x * w;
            const py = p.y * h;
            const tailX = px - p.vx * w * tracerLen;
            const tailY = py - p.vy * h * tracerLen;

            const alpha = Math.min(1, Math.sin((p.life / p.maxLife) * Math.PI) * 0.85);

            ctx.strokeStyle = getColor(p.temp, alpha.toFixed(3));
            ctx.lineWidth = p.weight;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        return true;
    }
}
