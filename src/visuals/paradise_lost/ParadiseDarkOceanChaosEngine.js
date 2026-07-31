/**
 * PARADISE LOST — ENGINE 5: THE DARK OCEAN OF CHAOS
 * (Cosmic Curl Noise Flow Fields & Primordial Antimatter Streams)
 * 
 * "A dark illimitable Ocean without bound,
 *  Where length, breadth, and highth and time and place are lost;
 *  Where eldest Night and Chaos, Ancestors of Nature, hold
 *  Eternal Anarchy..." — John Milton, Paradise Lost (Book II)
 * 
 * Visual Architecture:
 * 1. Divergence-Free Curl Noise Field: Incompressible fluid vector flow calculating 2D curl from multi-octave noise.
 * 2. 1,500+ Streaming Antimatter Particles: Flow lines leaving smooth velocity-aligned motion trails in the cosmic void.
 * 3. Primordial Void Vortex & Gravimetric Singularities: Swirling accretion field pulling unformed matter into deep spirals.
 * 4. Stardust & Quantum Energy Fluctuation Clusters: Glowing primordial star-seeds and cosmic nebula dust.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class ParadiseDarkOceanChaosEngine {
    constructor() {
        this.name = "The Dark Ocean of Chaos (Cosmic Flow Fields)";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "dark-ocean-01";
        this.time = 0;

        // Cosmic Particles
        this.particles = [];
        // Quantum Stardust Clusters
        this.stardust = [];

        this.params = {
            particleCount: 1400,
            flowSpeed: 0.8,
            curlScale: 2.2,
            vortexStrength: 0.35,
            colorPalette: 'cosmic_void' // 'cosmic_void', 'primordial_abyss', 'chaos_singularity'
        };
    }

    generate(signal = {}, seed = 'dark-ocean-01', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        this.time = 0;

        const count = this.params.particleCount || 1400;
        this.particles = [];

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: (rng() - 0.5) * 2.2,
                y: (rng() - 0.5) * 2.2,
                prevX: 0,
                prevY: 0,
                speed: 0.4 + rng() * 0.9,
                life: rng(),
                maxLife: 1.5 + rng() * 2.5,
                colorType: rng(), // 0..0.4 = Sapphire, 0.4..0.7 = Magenta/Indigo, 0.7..1.0 = Teal/Gold
                size: 1.0 + rng() * 2.2
            });
            this.particles[i].prevX = this.particles[i].x;
            this.particles[i].prevY = this.particles[i].y;
        }

        // Primordial Stardust Clusters
        this.stardust = [];
        for (let i = 0; i < 90; i++) {
            const rad = 0.1 + rng() * 1.1;
            const ang = rng() * Math.PI * 2;
            this.stardust.push({
                x: Math.cos(ang) * rad,
                y: Math.sin(ang) * rad,
                radius: rad,
                angle: ang,
                orbitSpeed: (0.1 + rng() * 0.3) * (rng() > 0.5 ? 1 : -1),
                size: 1.5 + rng() * 3.5,
                alpha: 0.3 + rng() * 0.6
            });
        }

        return true;
    }

    // 2D Multi-octave Procedural Noise for Curl Noise field
    _noise2D(x, y, t) {
        const sin1 = Math.sin(x * 2.4 + t * 0.6);
        const cos1 = Math.cos(y * 2.4 - t * 0.5);
        const sin2 = Math.sin(x * 5.1 - y * 3.8 + t * 0.8);
        const cos2 = Math.cos(y * 4.9 + x * 4.1 - t * 0.7);
        return (sin1 + cos1 + sin2 * 0.5 + cos2 * 0.5) / 3.0;
    }

    // Compute divergence-free Curl Vector field (vx = dPsi/dy, vy = -dPsi/dx)
    _getCurlVector(x, y, t) {
        const eps = 0.005;
        const n1 = this._noise2D(x, y + eps, t);
        const n2 = this._noise2D(x, y - eps, t);
        const dPsi_dy = (n1 - n2) / (2 * eps);

        const n3 = this._noise2D(x + eps, y, t);
        const n4 = this._noise2D(x - eps, y, t);
        const dPsi_dx = (n3 - n4) / (2 * eps);

        // Curl velocity: vx = dPsi/dy, vy = -dPsi/dx
        let vx = dPsi_dy;
        let vy = -dPsi_dx;

        // Add Primordial Vortex Gravimetric Pull (Inward Spiral towards center)
        const distSq = x * x + y * y;
        const dist = Math.sqrt(distSq) + 0.001;
        const vortexStrength = this.params.vortexStrength || 0.35;

        // Tangential swirl + radial inward pull
        const vSwirlX = -y / dist;
        const vSwirlY = x / dist;
        const vPullX = -x / dist;
        const vPullY = -y / dist;

        vx += (vSwirlX * 0.7 + vPullX * 0.3) * vortexStrength / (dist + 0.3);
        vy += (vSwirlY * 0.7 + vPullY * 0.3) * vortexStrength / (dist + 0.3);

        return [vx, vy];
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;
        const t = this.time * this.params.flowSpeed;

        // Update particle positions along Curl Field lines
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.prevX = p.x;
            p.prevY = p.y;

            p.life += dt;

            const [vx, vy] = this._getCurlVector(p.x * this.params.curlScale, p.y * this.params.curlScale, t);
            p.x += vx * p.speed * dt * 0.65;
            p.y += vy * p.speed * dt * 0.65;

            // Reset when expired or out of bounds
            if (p.life >= p.maxLife || Math.abs(p.x) > 1.25 || Math.abs(p.y) > 1.25) {
                p.life = 0;
                // Respawn near edges or center
                const ang = Math.random() * Math.PI * 2;
                const r = 0.2 + Math.random() * 0.95;
                p.x = Math.cos(ang) * r;
                p.y = Math.sin(ang) * r;
                p.prevX = p.x;
                p.prevY = p.y;
            }
        }

        // Orbit stardust clusters
        if (this.stardust) {
            for (let i = 0; i < this.stardust.length; i++) {
                const s = this.stardust[i];
                s.angle += s.orbitSpeed * dt;
                s.x = Math.cos(s.angle) * s.radius;
                s.y = Math.sin(s.angle) * s.radius;
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

        if (this.particles.length === 0) {
            this.generate({}, this.seed);
        }

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.max(w, h) * 0.55;

        // 1. Dark Illimitable Void Background Gradient
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.3);
        bgGrad.addColorStop(0, '#0a0518');   // Deep Void Core
        bgGrad.addColorStop(0.45, '#04020c'); // Cosmic Indigo
        bgGrad.addColorStop(1, '#010004');    // Illimitable Abyss

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // 2. Render CENTRAL GRAVIMETRIC VORTEX ACCRETION BLOOM
        const vortexGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.35);
        vortexGrad.addColorStop(0, 'rgba(160, 90, 255, 0.45)');  // Quantum Violet
        vortexGrad.addColorStop(0.4, 'rgba(40, 140, 255, 0.25)'); // Cosmic Sapphire
        vortexGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = vortexGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 3. Render STREAMING ANTIMATTER PARTICLES & MOTION TRAILS
        ctx.lineCap = 'round';

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const px = cx + p.x * scale;
            const py = cy + p.y * scale;
            const prevPx = cx + p.prevX * scale;
            const prevPy = cy + p.prevY * scale;

            const normLife = 1 - (p.life / p.maxLife);
            const alpha = (normLife * 0.75).toFixed(2);

            // Color palettes based on particle colorType
            let pColor = `rgba(100, 200, 255, ${alpha})`; // Cosmic Sapphire
            if (p.colorType > 0.7) {
                pColor = `rgba(80, 240, 220, ${alpha})`;  // Primordial Teal
            } else if (p.colorType > 0.4) {
                pColor = `rgba(220, 110, 255, ${alpha})`; // Void Magenta
            } else if (p.colorType > 0.2) {
                pColor = `rgba(255, 215, 120, ${alpha})`; // Stardust Gold
            }

            ctx.strokeStyle = pColor;
            ctx.lineWidth = Math.max(0.8, p.size);
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        // 4. Render QUANTUM STARDUST CLUSTERS & PRIMORDIAL NODES
        if (this.stardust) {
            for (let i = 0; i < this.stardust.length; i++) {
                const s = this.stardust[i];
                const px = cx + s.x * scale;
                const py = cy + s.y * scale;

                const nodeGrad = ctx.createRadialGradient(px, py, 0, px, py, s.size * 3.5);
                nodeGrad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha.toFixed(2)})`);
                nodeGrad.addColorStop(0.5, `rgba(140, 180, 255, ${(s.alpha * 0.5).toFixed(2)})`);
                nodeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = nodeGrad;
                ctx.beginPath();
                ctx.arc(px, py, s.size * 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        return true;
    }
}
