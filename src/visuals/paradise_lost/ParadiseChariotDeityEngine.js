/**
 * PARADISE LOST — ENGINE 2: CHARIOT OF PATERNAL DEITY & WHEELS OF THUNDER
 * (3D Ezekiel Strange Attractor & Divine Lightning Engine)
 * 
 * "Forth rush'd with whirlwind sound
 *  The Chariot of Paternal Deity,
 *  Flashing thick flames, wheel within wheel undrawn,
 *  It self instinct with Spirit..." — John Milton, Paradise Lost (Book VI)
 * 
 * Visualizes multi-ringed 3D strange attractors (Aizawa / Clifford) representing
 * Ezekiel's wheels within wheels, pulsing with divine sapphire blue, radiant gold,
 * and procedural branching lightning arcs sweeping across the cosmic canvas.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class ParadiseChariotDeityEngine {
    constructor() {
        this.name = "Chariot of Paternal Deity (Ezekiel Wheels)";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "paradise-chariot-01";
        this.time = 0;

        this.wheels = [];
        this.lightningArcs = [];
        this.nextLightningTime = 0;

        this.params = {
            iterationsPerWheel: 4500,
            wheelCount: 3,
            rotSpeed: 0.6,
            lightningFreq: 1.5,
            glowIntensity: 0.95,
            colorPalette: 'sapphire_throne' // 'sapphire_throne', 'empyrean_thunder', 'celestial_wrath'
        };
    }

    generate(signal = {}, seed = 'chariot-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        const count = options.iterationsPerWheel || this.params.iterationsPerWheel;
        const wheelCount = options.wheelCount || this.params.wheelCount;

        this.wheels = [];

        // Build 3 interlocking Aizawa/Clifford 3D strange attractor wheels ("wheels within wheels")
        for (let wIdx = 0; wIdx < wheelCount; wIdx++) {
            const trace = new Float32Array(count * 3);
            let x = 0.1, y = 0, z = 0;
            const a = 0.95 + wIdx * 0.05, b = 0.7, c = 0.6, d = 3.5 + wIdx * 0.3, e = 0.25, f = 0.1;
            const dt = 0.01;

            for (let i = 0; i < count; i++) {
                const dx = (z - b) * x - d * y;
                const dy = d * x + (z - b) * y;
                const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * (x * x * x);

                x += dx * dt;
                y += dy * dt;
                z += dz * dt;

                trace[i * 3] = x * 0.42;
                trace[i * 3 + 1] = y * 0.42;
                trace[i * 3 + 2] = z * 0.42;
            }

            this.wheels.push({
                trace,
                tiltX: (wIdx * Math.PI) / 3,
                tiltY: (wIdx * Math.PI) / 4,
                rotSpeed: 0.4 + wIdx * 0.25,
                scale: 0.85 + wIdx * 0.25
            });
        }

        this.lightningArcs = [];
        this.spawnLightning(rng);

        return true;
    }

    /**
     * Generate procedural branching divine lightning bolt (fractal arc)
     */
    spawnLightning(rng = Math.random) {
        const startX = 0.5;
        const startY = 0.5; // Center divine throne
        const angle = rng() * Math.PI * 2;
        const length = 0.35 + rng() * 0.45;

        const path = [{ x: startX, y: startY }];
        const steps = 14;
        let curX = startX;
        let curY = startY;

        for (let i = 0; i < steps; i++) {
            const stepLen = length / steps;
            const jitterAngle = angle + (rng() - 0.5) * 0.8;
            curX += Math.cos(jitterAngle) * stepLen;
            curY += Math.sin(jitterAngle) * stepLen;
            path.push({ x: curX, y: curY });
        }

        this.lightningArcs.push({
            path,
            life: 0,
            maxLife: 0.15 + rng() * 0.2,
            width: 2 + rng() * 3
        });
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.rotSpeed;

        // Periodic divine lightning strikes
        this.nextLightningTime -= dt;
        if (this.nextLightningTime <= 0) {
            this.spawnLightning();
            this.nextLightningTime = 0.4 + Math.random() * 0.8;
        }

        // Update active lightning arcs
        for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
            const arc = this.lightningArcs[i];
            arc.life += dt;
            if (arc.life >= arc.maxLife) {
                this.lightningArcs.splice(i, 1);
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

        if (this.wheels.length === 0) {
            this.generate({}, this.seed);
        }

        // Deep Sapphire Void background gradient
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        bgGrad.addColorStop(0, '#040b1f');
        bgGrad.addColorStop(0.5, '#020612');
        bgGrad.addColorStop(1, '#010206');

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const baseScale = Math.min(w, h) * 0.75;

        // Color Palettes
        const pal = options.colorPalette || this.params.colorPalette;
        const getPaletteColors = () => {
            if (pal === 'empyrean_thunder') {
                return [
                    'rgba(255, 250, 220, 0.85)',
                    'rgba(255, 190, 40, 0.65)',
                    'rgba(230, 110, 20, 0.45)',
                    'rgba(140, 40, 10, 0.25)'
                ];
            } else if (pal === 'celestial_wrath') {
                return [
                    'rgba(255, 230, 250, 0.85)',
                    'rgba(220, 80, 200, 0.65)',
                    'rgba(140, 30, 160, 0.45)',
                    'rgba(60, 10, 90, 0.25)'
                ];
            } else {
                // Sapphire Throne (default divine sapphire + gold)
                return [
                    'rgba(230, 245, 255, 0.90)',
                    'rgba(80, 180, 255, 0.70)',
                    'rgba(255, 215, 0, 0.50)',
                    'rgba(20, 80, 200, 0.25)'
                ];
            }
        };

        const colors = getPaletteColors();

        // 1. Render Chariot Core Sapphire Bloom
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseScale * 0.25);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        coreGrad.addColorStop(0.2, 'rgba(100, 200, 255, 0.75)');
        coreGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.35)');
        coreGrad.addColorStop(1, 'rgba(20, 50, 150, 0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseScale * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // 2. Render Ezekiel's Wheels Within Wheels (3D Attractor Traces)
        this.wheels.forEach((wheel, wIdx) => {
            const rotY = this.time * wheel.rotSpeed + wheel.tiltY;
            const rotX = Math.sin(this.time * 0.3 + wheel.tiltX) * 0.6;

            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

            const count = wheel.trace.length / 3;
            const scale = baseScale * wheel.scale;
            const stepSize = Math.max(1, Math.floor(count / 3200));

            for (let i = 0; i < count; i += stepSize) {
                const x0 = wheel.trace[i * 3];
                const y0 = wheel.trace[i * 3 + 1];
                const z0 = wheel.trace[i * 3 + 2];

                // 3D Rotations
                const x1 = x0 * cosY + z0 * sinY;
                const z1 = -x0 * sinY + z0 * cosY;

                const y2 = y0 * cosX - z1 * sinX;
                const z2 = y0 * sinX + z1 * cosX;

                const perspective = 1 / (1 + z2 * 0.45);
                const px = cx + x1 * scale * perspective;
                const py = cy + y2 * scale * perspective;

                const depthIdx = Math.min(colors.length - 1, Math.max(0, Math.floor((z2 + 1) * 1.5)));
                ctx.fillStyle = colors[depthIdx];

                const pSize = Math.max(1, (2.0 * perspective).toFixed(1));
                ctx.fillRect(px, py, pSize, pSize);
            }
        });

        // 3. Render Procedural Divine Lightning Arcs
        this.lightningArcs.forEach(arc => {
            if (arc.path.length < 2) return;

            const normLife = 1 - (arc.life / arc.maxLife);
            const alpha = (normLife * 0.9).toFixed(2);

            // Pass 1 - Wide Sapphire Glow
            ctx.strokeStyle = `rgba(100, 200, 255, ${(normLife * 0.4).toFixed(2)})`;
            ctx.lineWidth = arc.width * 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(arc.path[0].x * w, arc.path[0].y * h);
            for (let p = 1; p < arc.path.length; p++) {
                ctx.lineTo(arc.path[p].x * w, arc.path[p].y * h);
            }
            ctx.stroke();

            // Pass 2 - Intense White-Hot Core Bolt
            ctx.strokeStyle = `rgba(255, 255, 250, ${alpha})`;
            ctx.lineWidth = arc.width;

            ctx.beginPath();
            ctx.moveTo(arc.path[0].x * w, arc.path[0].y * h);
            for (let p = 1; p < arc.path.length; p++) {
                ctx.lineTo(arc.path[p].x * w, arc.path[p].y * h);
            }
            ctx.stroke();
        });

        return true;
    }
}
