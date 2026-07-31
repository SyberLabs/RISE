/**
 * PARADISE LOST — ENGINE 1: FALL OF THE REBEL ANGELS
 * (4D Hypercube Projection & Falling Streams Engine)
 * 
 * "Nine days they fell; confounded Chaos roared
 *  And Heaven ruined from Heaven..." — John Milton, Paradise Lost (Book VI)
 * 
 * Visualizes a rotating 4D Tesseract (Hypercube) perspective projection cascading
 * downwards into infinite abyss depth, accompanied by thousands of incandescent golden
 * particles tumbling from celestial light into chaotic darkness.
 */

import { hashSeed, createSeededRandom } from '../lib/klee-core.js';

export class ParadiseFallHypercubeEngine {
    constructor() {
        this.name = "Fall of the Rebel Angels (4D Hypercube)";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "paradise-fall-01";
        this.time = 0;

        // 4D Tesseract geometry (16 vertices, 32 edges)
        this.vertices4D = [];
        this.edges = [];
        this.particles = [];

        this.params = {
            rotSpeedXW: 0.45,
            rotSpeedYW: 0.35,
            rotSpeedZW: 0.25,
            particleCount: 1200,
            fallSpeed: 2.2,
            edgeWeight: 1.8,
            colorPalette: 'empyrean_gold' // 'empyrean_gold', 'seraphic_flame', 'void_abyss'
        };

        this._initGeometry();
    }

    _initGeometry() {
        // Construct 16 vertices of a 4D Hypercube [-1, 1]^4
        this.vertices4D = [];
        for (let i = 0; i < 16; i++) {
            this.vertices4D.push([
                (i & 1) ? 1 : -1,
                (i & 2) ? 1 : -1,
                (i & 4) ? 1 : -1,
                (i & 8) ? 1 : -1
            ]);
        }

        // Construct 32 edges (connect pairs differing by exactly 1 coordinate)
        this.edges = [];
        for (let i = 0; i < 16; i++) {
            for (let j = i + 1; j < 16; j++) {
                let diff = 0;
                for (let k = 0; k < 4; k++) {
                    if (this.vertices4D[i][k] !== this.vertices4D[j][k]) diff++;
                }
                if (diff === 1) {
                    this.edges.push([i, j]);
                }
            }
        }
    }

    generate(signal = {}, seed = 'fall-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        const count = options.particleCount || this.params.particleCount;

        // Falling rebel angel particles
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: (rng() - 0.5) * 1.8,
                y: -1.2 + rng() * 2.4, // Y position cascading downwards
                z: (rng() - 0.5) * 1.8,
                vy: 0.3 + rng() * 0.7,
                vx: (rng() - 0.5) * 0.1,
                vz: (rng() - 0.5) * 0.1,
                life: rng(),
                maxLife: 1.5 + rng() * 2.0,
                size: 1.2 + rng() * 3.0,
                temp: rng() // 1.0 = celestial gold, 0.0 = dark ember
            });
        }

        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;
        const fallSpeed = this.params.fallSpeed * (1 + (signal.arousal ?? 0.5) * 0.5);

        // Update falling rebel angel particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.y += p.vy * dt * fallSpeed;
            p.x += p.vx * dt;
            p.z += p.vz * dt;
            p.life += dt;

            // Respawn at top when falling beyond bottom threshold
            if (p.y > 1.4 || p.life > p.maxLife) {
                p.x = (Math.random() - 0.5) * 1.8;
                p.y = -1.2;
                p.z = (Math.random() - 0.5) * 1.8;
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

        if (this.particles.length === 0) {
            this.generate({}, this.seed);
        }

        // Deep cosmic abyss background gradient
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
        bgGrad.addColorStop(0, '#0d0714');
        bgGrad.addColorStop(0.5, '#060309');
        bgGrad.addColorStop(1, '#020104');

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) * 0.35;

        // 1. Rotate 4D Hypercube in XW, YW, ZW planes
        const angleXW = this.time * this.params.rotSpeedXW;
        const angleYW = this.time * this.params.rotSpeedYW;
        const angleZW = this.time * this.params.rotSpeedZW;

        const cosXW = Math.cos(angleXW), sinXW = Math.sin(angleXW);
        const cosYW = Math.cos(angleYW), sinYW = Math.sin(angleYW);
        const cosZW = Math.cos(angleZW), sinZW = Math.sin(angleZW);

        const projected3D = [];
        const projected2D = [];

        for (let i = 0; i < 16; i++) {
            let [x, y, z, w4] = this.vertices4D[i];

            // 4D Rotations
            // XW rotation
            let rx = x * cosXW - w4 * sinXW;
            let rw = x * sinXW + w4 * cosXW;
            x = rx; w4 = rw;

            // YW rotation
            let ry = y * cosYW - w4 * sinYW;
            rw = y * sinYW + w4 * cosYW;
            y = ry; w4 = rw;

            // ZW rotation
            let rz = z * cosZW - w4 * sinZW;
            rw = z * sinZW + w4 * cosZW;
            z = rz; w4 = rw;

            // 4D -> 3D Perspective Projection
            const distance4D = 2.4;
            const wPerspective = 1 / (distance4D - w4 * 0.45);
            const x3 = x * wPerspective;
            const y3 = y * wPerspective;
            const z3 = z * wPerspective;

            projected3D.push([x3, y3, z3, wPerspective]);

            // 3D -> 2D Perspective Projection
            const distance3D = 2.0;
            const zPerspective = 1 / (distance3D - z3 * 0.4);
            const px = cx + x3 * scale * zPerspective;
            const py = cy + y3 * scale * zPerspective;

            projected2D.push([px, py, zPerspective, wPerspective]);
        }

        // Color palettes
        const pal = options.colorPalette || this.params.colorPalette;
        const getParticleColor = (temp, alpha) => {
            if (pal === 'seraphic_flame') {
                if (temp > 0.7) return `rgba(255, 240, 200, ${alpha})`;
                if (temp > 0.35) return `rgba(255, 120, 30, ${alpha})`;
                return `rgba(180, 30, 10, ${alpha})`;
            } else if (pal === 'void_abyss') {
                if (temp > 0.7) return `rgba(220, 240, 255, ${alpha})`;
                if (temp > 0.35) return `rgba(100, 160, 240, ${alpha})`;
                return `rgba(40, 60, 150, ${alpha})`;
            } else {
                // Empyrean Gold (default)
                if (temp > 0.8) return `rgba(255, 255, 220, ${alpha})`; // Radiant white gold
                if (temp > 0.4) return `rgba(255, 190, 40, ${alpha})`;  // Imperial gold
                return `rgba(210, 80, 20, ${alpha})`;                   // Burning ember
            }
        };

        // 2. Render Falling Rebel Particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const pzScale = 1 / (2.0 - p.z * 0.4);
            const px = cx + p.x * scale * 1.6 * pzScale;
            const py = cy + p.y * scale * 1.6 * pzScale;

            const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.85;
            const pSize = Math.max(1, p.size * pzScale);

            // Velocity trail line
            const tailY = py - p.vy * scale * 0.12 * pzScale;
            ctx.strokeStyle = getParticleColor(p.temp, (alpha * 0.4).toFixed(2));
            ctx.lineWidth = Math.max(1, pSize * 0.7);
            ctx.beginPath();
            ctx.moveTo(px, tailY);
            ctx.lineTo(px, py);
            ctx.stroke();

            // Particle head
            ctx.fillStyle = getParticleColor(p.temp, alpha.toFixed(2));
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Render 4D Hypercube Tesseract Edges (Pass 1 - Glow understroke)
        ctx.strokeStyle = pal === 'void_abyss' ? 'rgba(80, 160, 255, 0.25)' : 'rgba(255, 170, 50, 0.25)';
        ctx.lineWidth = this.params.edgeWeight * 3;
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let i = 0; i < this.edges.length; i++) {
            const [v1, v2] = this.edges[i];
            const p1 = projected2D[v1];
            const p2 = projected2D[v2];
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
        }
        ctx.stroke();

        // Pass 2 - Sharp Core Edges
        ctx.strokeStyle = pal === 'void_abyss' ? 'rgba(200, 230, 255, 0.9)' : 'rgba(255, 235, 170, 0.9)';
        ctx.lineWidth = this.params.edgeWeight;

        ctx.beginPath();
        for (let i = 0; i < this.edges.length; i++) {
            const [v1, v2] = this.edges[i];
            const p1 = projected2D[v1];
            const p2 = projected2D[v2];
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
        }
        ctx.stroke();

        // 4. Render Hypercube Vertices
        for (let i = 0; i < 16; i++) {
            const [px, py, zScale, wScale] = projected2D[i];
            const nodeRad = Math.max(2, 4.5 * zScale * wScale);

            ctx.fillStyle = pal === 'void_abyss' ? '#ffffff' : '#fff4cc';
            ctx.beginPath();
            ctx.arc(px, py, nodeRad, 0, Math.PI * 2);
            ctx.fill();
        }

        return true;
    }
}
