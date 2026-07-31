/**
 * PARADISE LOST — ENGINE 4: SULFUR & BRIMSTONE MAGMA NETWORK
 * (Organic Smoldering Magma Flows & Molten Basalt Crusts)
 * 
 * "Satan awakening on the Burning Lake of Hell...
 *  A dungeon horrible, on all sides round As one great furnace flamed; yet from those flames
 *  No light, but rather darkness visible." — John Milton, Paradise Lost (Book I & VI)
 * 
 * Visual Architecture:
 * 1. Organic Branching Magma Rivers: Multi-harmonic fluid lava paths with viscous current flow animation.
 * 2. Multi-Pass Incandescent Plasma: Deep molten crimson underglow, intense lava orange streams,
 *    and white-hot sulfur core channels pulsing along fluid paths.
 * 3. Cooling Obsidian Basalt Plates: Dark textured rock crusts between rivers with smoldering micro-fissures.
 * 4. Infernal Artillery Explosive Shockwaves: Radial blast waves causing magma rivers to flare with divine fire.
 * 5. Smoldering Brimstone Smoke & Embers: 150+ rising sulfur smoke tendrils and swirling molten ash sparks.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class ParadiseSulfurMagmaEngine {
    constructor() {
        this.name = "Sulfur & Brimstone Magma Network";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "infernal-lake-01";
        this.time = 0;

        // Organic Magma River Paths
        this.rivers = [];
        // Obsidian Rock Crust Plates
        this.plates = [];
        // Smoldering Embers & Smoke
        this.embers = [];
        // Artillery Shockwaves
        this.pulses = [];

        this.params = {
            riverCount: 22,
            flowSpeed: 0.6,
            heatIntensity: 1.0,
            colorPalette: 'infernal_lake' // 'infernal_lake', 'abyssal_chasm', 'tartarus_fire'
        };
    }

    generate(signal = {}, seed = 'infernal-lake-01', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.time = 0;

        const riverCount = this.params.riverCount || 22;
        this.rivers = [];

        // Generate 22+ Organic Branching Magma Rivers
        for (let r = 0; r < riverCount; r++) {
            const startAng = (r / riverCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
            const startRad = 0.05 + rng() * 0.25;
            const startX = Math.cos(startAng) * startRad;
            const startY = Math.sin(startAng) * startRad;

            const endAng = startAng + (rng() - 0.5) * 1.2;
            const endRad = 1.1 + rng() * 0.4;
            const endX = Math.cos(endAng) * endRad;
            const endY = Math.sin(endAng) * endRad;

            const segCount = 14 + Math.floor(rng() * 8);
            const points = [];

            // Harmonics for organic meander wiggles
            const freq1 = 1.5 + rng() * 2.5;
            const freq2 = 3.0 + rng() * 4.0;
            const amp1 = 0.06 + rng() * 0.12;
            const amp2 = 0.03 + rng() * 0.06;
            const phase1 = rng() * Math.PI * 2;
            const phase2 = rng() * Math.PI * 2;

            for (let s = 0; s <= segCount; s++) {
                const p = s / segCount;
                // Linear interpolation base
                let x = startX + p * (endX - startX);
                let y = startY + p * (endY - startY);

                // Perpendicular vector for organic wiggle
                const dx = endX - startX;
                const dy = endY - startY;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;

                const wiggle = Math.sin(p * Math.PI * freq1 + phase1) * amp1 
                             + Math.cos(p * Math.PI * freq2 + phase2) * amp2;

                x += nx * wiggle;
                y += ny * wiggle;

                points.push({ x, y });
            }

            this.rivers.push({
                points,
                isMain: r % 3 === 0, // Main arterial rivers vs branch tributaries
                width: (r % 3 === 0) ? (14 + rng() * 10) : (4 + rng() * 6),
                flowOffset: rng() * 10,
                flowSpeed: 0.5 + rng() * 0.8,
                heat: 0.5 + rng() * 0.5
            });
        }

        // Generate Obsidian Basalt Plates between rivers
        this.plates = [];
        for (let i = 0; i < 28; i++) {
            const ang = (i / 28) * Math.PI * 2 + (rng() - 0.5) * 0.3;
            const rad = 0.2 + rng() * 0.8;
            this.plates.push({
                x: Math.cos(ang) * rad,
                y: Math.sin(ang) * rad,
                radius: 0.12 + rng() * 0.18,
                crackAngle: rng() * Math.PI * 2,
                temp: rng()
            });
        }

        // Generate rising brimstone embers & sulfur smoke
        this.embers = [];
        for (let i = 0; i < 150; i++) {
            this.embers.push({
                x: (rng() - 0.5) * 2.2,
                y: (rng() - 0.5) * 2.2,
                vx: (rng() - 0.5) * 0.08,
                vy: -0.25 - rng() * 0.6,
                size: 1.5 + rng() * 5.0,
                life: rng(),
                maxLife: 0.5 + rng() * 0.9,
                isSmoke: rng() > 0.65
            });
        }

        // Infernal Explosive Artillery Pulses
        this.pulses = [
            { x: -0.15, y: 0.1, radius: 0, maxRadius: 1.3, speed: 0.7 },
            { x: 0.35, y: -0.3, radius: 0.5, maxRadius: 1.5, speed: 0.55 }
        ];

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;

        // Update rising embers & smoke
        if (this.embers) {
            for (let i = 0; i < this.embers.length; i++) {
                const e = this.embers[i];
                e.life += dt;
                e.y += e.vy * dt;
                e.x += e.vx * dt + Math.sin(this.time * 3 + e.life * 6) * 0.006;

                if (e.life >= e.maxLife || e.y < -1.15) {
                    e.life = 0;
                    e.y = 1.05 + Math.random() * 0.2;
                    e.x = (Math.random() - 0.5) * 2.2;
                }
            }
        }

        // Update explosive shockwave pulses
        if (this.pulses) {
            for (let i = 0; i < this.pulses.length; i++) {
                const p = this.pulses[i];
                p.radius += p.speed * dt;
                if (p.radius > p.maxRadius) {
                    p.radius = 0;
                    p.x = (Math.random() - 0.5) * 1.4;
                    p.y = (Math.random() - 0.5) * 1.4;
                }
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

        if (this.rivers.length === 0) {
            this.generate({}, this.seed);
        }

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.max(w, h) * 0.55;

        // 1. Deep Abyssal Base Background
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.3);
        bgGrad.addColorStop(0, '#1c0502');
        bgGrad.addColorStop(0.5, '#0c0201');
        bgGrad.addColorStop(1, '#020000');

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const flowT = this.time * this.params.flowSpeed;

        // 2. Render COOLING OBSIDIAN BASALT CRUST PLATES & MICRO-CRACKS
        this.plates.forEach(p => {
            const px = cx + p.x * scale;
            const py = cy + p.y * scale;
            const pr = p.radius * scale;

            // Dark cooling basalt stone texture
            const plateGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
            plateGrad.addColorStop(0, '#180a08');
            plateGrad.addColorStop(0.7, '#0e0504');
            plateGrad.addColorStop(1, 'rgba(5, 2, 2, 0)');

            ctx.fillStyle = plateGrad;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();

            // Smoldering micro-cracks across the plate
            const crackLen = pr * 0.75;
            const cx1 = px + Math.cos(p.crackAngle) * crackLen;
            const cy1 = py + Math.sin(p.crackAngle) * crackLen;
            const cx2 = px - Math.cos(p.crackAngle) * crackLen;
            const cy2 = py - Math.sin(p.crackAngle) * crackLen;

            const crackPulse = Math.sin(this.time * 3 + p.temp * 10) * 0.35 + 0.65;
            ctx.strokeStyle = `rgba(255, 90, 0, ${(0.4 * crackPulse).toFixed(2)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx1, cy1);
            ctx.lineTo(cx2, cy2);
            ctx.stroke();
        });

        // 3. Render ORGANIC SMOLDERING MAGMA RIVERS (Multi-pass Plasma Layering)
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        this.rivers.forEach(riv => {
            const pts = riv.points;
            if (pts.length < 2) return;

            // Compute distance to active shockwave pulses to flare magma streams
            let pulseFlare = 0;
            const midPt = pts[Math.floor(pts.length / 2)];
            this.pulses.forEach(p => {
                const pdx = midPt.x - p.x;
                const pdy = midPt.y - p.y;
                const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
                const waveDist = Math.abs(pDist - p.radius);
                if (waveDist < 0.25) {
                    pulseFlare += (1 - waveDist / 0.25) * 0.9;
                }
            });

            // PASS A — Deep Molten Crimson Wide Aura Understroke
            ctx.strokeStyle = `rgba(200, 25, 0, ${Math.min(1.0, 0.45 + pulseFlare * 0.55)})`;
            ctx.lineWidth = riv.width * 1.8 + pulseFlare * 12;
            ctx.beginPath();
            ctx.moveTo(cx + pts[0].x * scale, cy + pts[0].y * scale);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(cx + pts[i].x * scale, cy + pts[i].y * scale);
            }
            ctx.stroke();

            // PASS B — Viscous Intense Lava Orange Fluid Stream
            ctx.strokeStyle = `rgba(255, 115, 0, ${Math.min(1.0, 0.8 + pulseFlare * 0.2)})`;
            ctx.lineWidth = riv.width + pulseFlare * 6;
            ctx.beginPath();
            ctx.moveTo(cx + pts[0].x * scale, cy + pts[0].y * scale);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(cx + pts[i].x * scale, cy + pts[i].y * scale);
            }
            ctx.stroke();

            // PASS C — White-Hot Sulfur Core Stream (Flowing Liquid Wave Currents)
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i];
                const p2 = pts[i + 1];

                const px1 = cx + p1.x * scale;
                const py1 = cy + p1.y * scale;
                const px2 = cx + p2.x * scale;
                const py2 = cy + p2.y * scale;

                // Pulsing liquid lava current along the stream path
                const flowWave = Math.sin(i * 0.45 - flowT * riv.flowSpeed * 3 + riv.flowOffset) * 0.5 + 0.5;
                const coreAlpha = Math.min(1.0, 0.75 + flowWave * 0.25 + pulseFlare * 0.25).toFixed(2);
                const coreWidth = Math.max(1.5, riv.width * 0.35 + flowWave * 2.5 + pulseFlare * 3);

                ctx.strokeStyle = (flowWave > 0.45 || pulseFlare > 0.3) 
                    ? `rgba(255, 248, 180, ${coreAlpha})` // Sulfur White-Hot Core
                    : `rgba(255, 190, 40, ${coreAlpha})`;  // Molten Gold Core

                ctx.lineWidth = coreWidth;
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();
            }
        });

        // 4. Render INFERNAL ARTILLERY EXPLOSIVE SHOCKWAVES
        this.pulses.forEach(p => {
            const px = cx + p.x * scale;
            const py = cy + p.y * scale;
            const pr = p.radius * scale;
            const alpha = Math.max(0, (1 - p.radius / p.maxRadius) * 0.65).toFixed(2);

            ctx.strokeStyle = `rgba(255, 220, 110, ${alpha})`;
            ctx.lineWidth = 4.5;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 22;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });

        // 5. Render SMOLDERING BRIMSTONE SMOKE & EMBERS
        if (this.embers) {
            for (let i = 0; i < this.embers.length; i++) {
                const e = this.embers[i];
                const px = cx + e.x * scale;
                const py = cy + e.y * scale;
                const normLife = 1 - (e.life / e.maxLife);
                const alpha = (normLife * 0.8).toFixed(2);

                if (e.isSmoke) {
                    // Rising Sulfur Smoke Puff
                    const smkGrad = ctx.createRadialGradient(px, py, 0, px, py, e.size * 5);
                    smkGrad.addColorStop(0, `rgba(45, 20, 15, ${alpha * 0.4})`);
                    smkGrad.addColorStop(0.6, `rgba(95, 42, 10, ${alpha * 0.15})`);
                    smkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                    ctx.fillStyle = smkGrad;
                    ctx.beginPath();
                    ctx.arc(px, py, e.size * 5, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Incandescent Magma Ember Spark
                    ctx.fillStyle = (i % 2 === 0) 
                        ? `rgba(255, 245, 140, ${alpha})` // Sulfur Yellow Spark
                        : `rgba(255, 120, 20, ${alpha})`;  // Incandescent Orange Spark

                    ctx.beginPath();
                    ctx.arc(px, py, Math.max(1, e.size), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        return true;
    }
}
