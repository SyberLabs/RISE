/**
 * STORM OF STEEL — ENGINE 5: MAGNESIUM FLARE & ENTOPTIC PHOSPHENES
 * (Ganzfeld & Phosphene Simulation Engine)
 * 
 * Visualizes blinding magnesium star-shells hanging in the night sky over No Man's Land,
 * illuminating trench parapets while inducing Klüver entoptic phosphene patterns
 * (lattices, spirals, tunnels, cobwebs) and retinitis afterimage halos.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormFlarePhospheneEngine {
    constructor() {
        this.name = "Storm Flare & Entoptic Phosphenes";
        this.category = "PERCEPTUAL / PHENOMENOLOGICAL";
        this.flares = [];
        this.phosphenes = [];
        this.seed = "storm-flare-01";
        this.time = 0;

        this.params = {
            flareCount: 2,
            phospheneType: 'lattice', // 'lattice', 'spiral', 'tunnel', 'cobweb'
            flareIntensity: 0.9,
            driftSpeed: 0.25,
            colorPalette: 'magnesium_white' // 'magnesium_white', 'sulfur_flare', 'phosphor_green'
        };
    }

    generate(signal = {}, seed = 'flare-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.params.phospheneType = options.phospheneType || this.params.phospheneType;

        // Flares hanging over No Man's Land
        this.flares = [];
        const fCount = options.flareCount || this.params.flareCount;
        for (let i = 0; i < fCount; i++) {
            this.flares.push({
                x: 0.3 + rng() * 0.4,
                y: 0.15 + rng() * 0.25,
                vy: 0.005 + rng() * 0.008, // Slow parachute descent
                radius: 0.15 + rng() * 0.1,
                intensity: 0.8 + rng() * 0.2,
                flickerFreq: 8 + rng() * 12
            });
        }

        // Drifting phosphene entoptic forms (grids, circles, spirals)
        this.phosphenes = [];
        const pCount = 28;
        for (let i = 0; i < pCount; i++) {
            this.phosphenes.push({
                angle: (i / pCount) * Math.PI * 2,
                radius: 0.1 + (i / pCount) * 0.35,
                rotSpeed: (rng() - 0.5) * 0.3,
                pulseFreq: 1.5 + rng() * 2.5,
                size: 4 + rng() * 12,
                opacity: 0.2 + rng() * 0.5
            });
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.driftSpeed;

        // Parachute flares descend slowly
        for (let i = 0; i < this.flares.length; i++) {
            const f = this.flares[i];
            f.y += f.vy * dt;
            if (f.y > 0.8) f.y = 0.15; // reset flare launch
        }
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        if (this.flares.length === 0) {
            this.generate({}, this.seed);
        }

        const bg = options.backgroundColor || '#040405';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // 1. Draw Blinding Magnesium Flare Bloom
        this.flares.forEach(flare => {
            const fx = flare.x * w;
            const fy = flare.y * h;
            const rad = flare.radius * Math.min(w, h);
            const flicker = 0.9 + Math.sin(this.time * flare.flickerFreq) * 0.1;

            const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad * 2 * flicker);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.15, 'rgba(255, 240, 200, 0.7)');
            grad.addColorStop(0.4, 'rgba(230, 160, 60, 0.25)');
            grad.addColorStop(1, 'rgba(10, 8, 12, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(fx, fy, rad * 2 * flicker, 0, Math.PI * 2);
            ctx.fill();

            // Flare core starburst rays
            ctx.strokeStyle = 'rgba(255, 255, 240, 0.35)';
            ctx.lineWidth = 1;
            const rayCount = 12;
            for (let r = 0; r < rayCount; r++) {
                const angle = (r / rayCount) * Math.PI * 2 + this.time * 0.2;
                const rLen = rad * (1.2 + Math.sin(angle * 3) * 0.4);
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx + Math.cos(angle) * rLen, fy + Math.sin(angle) * rLen);
                ctx.stroke();
            }
        });

        // 2. Draw Klüver Entoptic Phosphenes (Retinal Afterimage Structures)
        const pType = options.phospheneType || this.params.phospheneType;
        ctx.lineWidth = 1.2;

        if (pType === 'spiral') {
            // Spiral phosphene funnel
            ctx.strokeStyle = 'rgba(255, 180, 80, 0.4)';
            ctx.beginPath();
            const turns = 6;
            const maxRad = Math.min(w, h) * 0.42;
            for (let a = 0; a < Math.PI * 2 * turns; a += 0.05) {
                const r = (a / (Math.PI * 2 * turns)) * maxRad;
                const rotA = a + this.time * 0.5;
                const px = cx + Math.cos(rotA) * r;
                const py = cy + Math.sin(rotA) * r;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        } else if (pType === 'tunnel') {
            // Concentric phosphene tunnel rings
            const ringCount = 10;
            for (let r = 1; r <= ringCount; r++) {
                const rad = (r / ringCount) * Math.min(w, h) * 0.45;
                const pulse = Math.sin(this.time * 2 + r * 0.5) * 0.1 + 0.9;
                ctx.strokeStyle = `rgba(240, 160, 60, ${(0.45 - r * 0.03).toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(cx, cy, rad * pulse, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else {
            // Lattice / Cobweb grid (default)
            this.phosphenes.forEach(p => {
                const rotA = p.angle + this.time * p.rotSpeed;
                const r = p.radius * Math.min(w, h);
                const px = cx + Math.cos(rotA) * r;
                const py = cy + Math.sin(rotA) * r;
                const pulseAlpha = Math.sin(this.time * p.pulseFreq) * 0.2 + p.opacity;

                ctx.fillStyle = `rgba(255, 190, 100, ${pulseAlpha.toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fill();

                // Connect adjacent phosphene nodes into lattice filigree
                ctx.strokeStyle = `rgba(200, 120, 50, ${(pulseAlpha * 0.4).toFixed(2)})`;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(px, py);
                ctx.stroke();
            });
        }

        // 3. Silhouette Horizon (Trench Parapets & Barbwire Pickets)
        ctx.fillStyle = '#020203';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.82);

        const trenchSteps = 30;
        for (let i = 0; i <= trenchSteps; i++) {
            const tx = (i / trenchSteps) * w;
            const ty = h * (0.82 + Math.sin(i * 1.7) * 0.04 + (i % 2 === 0 ? -0.02 : 0.02));
            ctx.lineTo(tx, ty);
        }

        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        return true;
    }
}
