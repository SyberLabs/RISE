/**
 * STORM OF STEEL — ENGINE 1: VORONOI TRENCH & MUD NETWORK
 * (Voronoi Tessellation & Mud Fracture Engine)
 * 
 * Visualizes space divided into cell-like trench perimeters, barbwire perimeters,
 * mud fractures, and explosive shell impact craters.
 */

import { hashSeed, createSeededRandom } from '../lib/klee-core.js';

export class StormVoronoiEngine {
    constructor() {
        this.name = "Storm Voronoi Trench Network";
        this.category = "GEOMETRIC / STRUCTURAL";
        this.points = [];
        this.velocities = [];
        this.craters = [];
        this.seed = "storm-voronoi-01";
        this.time = 0;
        
        // Parameters
        this.params = {
            pointCount: 36,
            lineWeight: 1.8,
            fillMode: 'crater', // 'outline', 'gradient', 'crater', 'iron'
            trenchJitter: 0.45,
            emberGlow: 0.85,
            speed: 0.3,
            colorPalette: 'iron_ember' // 'iron_ember', 'sulfur_mud', 'phosphor_green', 'steel_cyan'
        };
    }

    /**
     * Generate / seed points for the Voronoi network
     */
    generate(signal = {}, seed = 'voronoi-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);
        const count = options.pointCount || this.params.pointCount;
        
        this.points = [];
        this.velocities = [];
        this.craters = [];

        // Grid-seeded with organic jitter to create coherent trench sections
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (this.points.length >= count) break;
                const baseNormX = (c + 0.5) / cols;
                const baseNormY = (r + 0.5) / rows;
                
                const jitterX = (rng() - 0.5) * 0.7 / cols;
                const jitterY = (rng() - 0.5) * 0.7 / rows;

                const x = Math.max(0.05, Math.min(0.95, baseNormX + jitterX));
                const y = Math.max(0.05, Math.min(0.95, baseNormY + jitterY));

                this.points.push({
                    x, y,
                    origX: x, origY: y,
                    phase: rng() * Math.PI * 2,
                    freq: 0.5 + rng() * 1.5,
                    intensity: 0.4 + rng() * 0.6,
                    isCrater: rng() < 0.25
                });

                this.velocities.push({
                    vx: (rng() - 0.5) * 0.05,
                    vy: (rng() - 0.5) * 0.05
                });
            }
        }

        // Add 3-5 major shell impact craters
        const craterCount = 4;
        for (let i = 0; i < craterCount; i++) {
            this.craters.push({
                x: 0.15 + rng() * 0.7,
                y: 0.15 + rng() * 0.7,
                radius: 0.08 + rng() * 0.14,
                glow: 0.6 + rng() * 0.4,
                pulseSpeed: 1 + rng() * 2
            });
        }

        if (signal.arousal !== undefined) {
            this.params.speed = 0.2 + signal.arousal * 0.6;
        }

        return true;
    }

    /**
     * Advance animation step
     */
    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.speed;
        const arousal = signal.arousal ?? 0.5;

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const v = this.velocities[i];

            // Harmonic drift representing shifting trench boundaries
            const driftX = Math.sin(this.time * p.freq + p.phase) * 0.002 * (1 + arousal);
            const driftY = Math.cos(this.time * p.freq * 1.3 + p.phase) * 0.002 * (1 + arousal);

            p.x = p.origX + driftX + v.vx * Math.sin(this.time);
            p.y = p.origY + driftY + v.vy * Math.cos(this.time);

            // Clamp bounds
            p.x = Math.max(0.02, Math.min(0.98, p.x));
            p.y = Math.max(0.02, Math.min(0.98, p.y));
        }
    }

    /**
     * Render the Voronoi Trench Network to HTML5 Canvas
     */
    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        const bg = options.backgroundColor || '#080706';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (this.points.length === 0) {
            this.generate({}, this.seed);
        }

        // Color palettes
        const palettes = {
            iron_ember: {
                line: 'rgba(215, 140, 60, 0.85)',
                glow: 'rgba(255, 90, 20, 0.25)',
                crater: 'rgba(240, 110, 40, ',
                fill: 'rgba(35, 22, 16, 0.6)',
                node: '#ffaa44'
            },
            sulfur_mud: {
                line: 'rgba(180, 170, 70, 0.85)',
                glow: 'rgba(200, 190, 40, 0.25)',
                crater: 'rgba(210, 190, 50, ',
                fill: 'rgba(28, 26, 18, 0.6)',
                node: '#ddcc44'
            },
            phosphor_green: {
                line: 'rgba(90, 210, 120, 0.85)',
                glow: 'rgba(40, 180, 80, 0.25)',
                crater: 'rgba(80, 220, 110, ',
                fill: 'rgba(16, 28, 20, 0.6)',
                node: '#66ff99'
            },
            steel_cyan: {
                line: 'rgba(110, 190, 230, 0.85)',
                glow: 'rgba(40, 130, 200, 0.25)',
                crater: 'rgba(90, 200, 240, ',
                fill: 'rgba(16, 24, 32, 0.6)',
                node: '#88ddff'
            }
        };

        const pal = palettes[options.colorPalette || this.params.colorPalette] || palettes.iron_ember;

        // Pixel-based brute force Voronoi for crisp rendering with crater effects
        const gridStep = Math.max(4, Math.floor(Math.min(w, h) / 120));
        const cols = Math.ceil(w / gridStep);
        const rows = Math.ceil(h / gridStep);

        const ptsPixel = this.points.map(p => ({ px: p.x * w, py: p.y * h, orig: p }));

        // Render cells & distance boundary lines
        for (let r = 0; r < rows; r++) {
            const py = r * gridStep;
            for (let c = 0; c < cols; c++) {
                const px = c * gridStep;

                let d1 = Infinity, d2 = Infinity;

                for (let i = 0; i < ptsPixel.length; i++) {
                    const pt = ptsPixel[i];
                    const dx = px - pt.px;
                    const dy = py - pt.py;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < d1) {
                        d2 = d1;
                        d1 = dist;
                    } else if (dist < d2) {
                        d2 = dist;
                    }
                }

                // Boundary line thickness check
                const boundaryDiff = d2 - d1;
                if (boundaryDiff < gridStep * 1.4) {
                    const edgeAlpha = Math.max(0.1, 1 - (boundaryDiff / (gridStep * 1.4)));
                    ctx.fillStyle = pal.line.replace('0.85', (0.35 + edgeAlpha * 0.5).toFixed(2));
                    ctx.fillRect(px, py, gridStep, gridStep);
                } else if (this.params.fillMode === 'crater' || this.params.fillMode === 'gradient') {
                    // Cell interior shading
                    const normD = Math.min(1, d1 / (Math.min(w, h) * 0.25));
                    const cellAlpha = (1 - normD) * 0.25;
                    ctx.fillStyle = pal.glow.replace('0.25', cellAlpha.toFixed(3));
                    ctx.fillRect(px, py, gridStep, gridStep);
                }
            }
        }

        // Draw Shell Impact Craters with glowing blast rings & barbwire grid overlay
        this.craters.forEach(crater => {
            const cx = crater.x * w;
            const cy = crater.y * h;
            const rad = crater.radius * Math.min(w, h);
            const pulse = Math.sin(this.time * crater.pulseSpeed) * 0.15 + 0.85;

            // Radial crater blast glow
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.5 * pulse);
            grad.addColorStop(0, pal.crater + '0.65)');
            grad.addColorStop(0.4, pal.crater + '0.25)');
            grad.addColorStop(1, pal.crater + '0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, rad * 1.5 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Concentric shockwave lines
            ctx.strokeStyle = pal.line;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(cx, cy, rad * 0.8 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw trench nodes & barbwire connectors
        ctx.fillStyle = pal.node;
        ctx.strokeStyle = pal.line;
        ctx.lineWidth = this.params.lineWeight;

        ptsPixel.forEach((pt, idx) => {
            // Node core
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Connect nearest neighbor nodes with wire strokes
            for (let j = idx + 1; j < ptsPixel.length; j++) {
                const pt2 = ptsPixel[j];
                const dx = pt2.px - pt.px;
                const dy = pt2.py - pt.py;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < Math.min(w, h) * 0.18) {
                    ctx.beginPath();
                    ctx.moveTo(pt.px, pt.py);
                    ctx.lineTo(pt2.px, pt2.py);
                    ctx.stroke();
                }
            }
        });

        return true;
    }
}
