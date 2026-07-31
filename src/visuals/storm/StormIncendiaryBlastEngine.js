/**
 * STORM OF STEEL — ENGINE 7: DEFORMABLE TERRAIN & REALISTIC SHELL CRATER IMPACTS
 * (Dimensional / Spatial - 3D Heightfield & Impact Deformation Engine)
 * 
 * Renders a textured 3D terrain heightmap with realistic normal lighting, specular depth,
 * and ambient occlusion. Shell impacts deform the ground in real-time—carving indented craters
 * with raised ejecta rims, leaving smoldering molten cores, and spawning realistic molten shrapnel streaks,
 * heavy mud clods, and billowing smoke plumes.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class StormIncendiaryBlastEngine {
    constructor() {
        this.name = "Storm Deformable Crater Terrain";
        this.category = "DIMENSIONAL / SPATIAL";
        
        // Grid dimensions for heightmap
        this.gridW = 160;
        this.gridH = 120;
        this.heightMap = null;
        this.baseHeightMap = null;
        this.heatMap = null;
        this.normalX = null;
        this.normalY = null;
        
        // Explosion Ejecta (No confetti! Realistic shrapnel streaks, mud clods, and smoke plumes)
        this.shrapnel = [];
        this.dirtClods = [];
        this.smokePuffs = [];
        this.shockwaves = [];
        
        this.seed = "storm-crater-01";
        this.time = 0;
        this.nextImpactTime = 0;

        this.params = {
            craterDepth: 0.85,
            rimHeight: 0.35,
            lightAngle: 0.75, // Radians light direction
            ambientOcclusion: 0.65,
            shrapnelCount: 80,
            dirtCount: 45,
            smokeCount: 20,
            speed: 1.0,
            colorPalette: 'scorched_earth' // 'scorched_earth', 'sulfur_mud', 'crucible_steel', 'phosphor_glow'
        };
    }

    // Perlin-style 2D noise generator for initial ground texture depth
    _noise(x, y) {
        const sin1 = Math.sin(x * 12.9898 + y * 78.233);
        const cos1 = Math.cos(x * 26.311 + y * 43.19);
        return Math.sin(sin1 * 43758.5453 + cos1 * 12345.678);
    }

    _fbm(x, y) {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1.0;
        for (let i = 0; i < 4; i++) {
            value += this._noise(x * frequency, y * frequency) * amplitude;
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    generate(signal = {}, seed = 'crater-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed);

        const w = this.gridW;
        const h = this.gridH;
        const size = w * h;

        this.heightMap = new Float32Array(size);
        this.baseHeightMap = new Float32Array(size);
        this.heatMap = new Float32Array(size);
        this.normalX = new Float32Array(size);
        this.normalY = new Float32Array(size);

        this.shrapnel = [];
        this.dirtClods = [];
        this.smokePuffs = [];
        this.shockwaves = [];

        // Build textured ground with natural rolling mud ridges & micro-roughness
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const nx = x / w * 6.0;
                const ny = y / h * 6.0;
                
                // Base ground elevation + micro-texture depth
                const baseH = 0.5 + this._fbm(nx, ny) * 0.25;
                this.heightMap[idx] = baseH;
                this.baseHeightMap[idx] = baseH;
                this.heatMap[idx] = 0;
            }
        }

        // Initial shell impacts (3 pre-carved craters on spawn)
        for (let c = 0; c < 3; c++) {
            const cx = Math.floor((0.2 + rng() * 0.6) * w);
            const cy = Math.floor((0.2 + rng() * 0.6) * h);
            this.createCrater(cx, cy, 10 + Math.floor(rng() * 8), 0.7 + rng() * 0.3, rng);
        }

        this.recomputeNormals();
        return true;
    }

    /**
     * Carve indented shell crater into 3D heightmap with raised ejecta rim & molten heat
     */
    createCrater(cx, cy, radius, depthFactor = 1.0, rng = Math.random) {
        const w = this.gridW;
        const h = this.gridH;
        const r2 = radius * radius;
        const rimR = radius * 1.35;
        const rimR2 = rimR * rimR;

        const minX = Math.max(0, Math.floor(cx - rimR));
        const maxX = Math.min(w - 1, Math.ceil(cx + rimR));
        const minY = Math.max(0, Math.floor(cy - rimR));
        const maxY = Math.min(h - 1, Math.ceil(cy + rimR));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const idx = y * w + x;
                const dx = x - cx;
                const dy = y - cy;
                const d2 = dx * dx + dy * dy;

                if (d2 <= r2) {
                    // Indented crater bowl (parabolic depression)
                    const normD = d2 / r2;
                    const indentation = (1 - normD) * 0.55 * depthFactor * this.params.craterDepth;
                    this.heightMap[idx] = Math.max(0.05, this.heightMap[idx] - indentation);
                    
                    // Heat injection in crater core
                    this.heatMap[idx] = Math.min(1.0, this.heatMap[idx] + (1 - normD) * 1.2);
                } else if (d2 <= rimR2) {
                    // Raised ejecta rim (displaced soil lip)
                    const rimNorm = (d2 - r2) / (rimR2 - r2);
                    const rimBump = Math.sin(rimNorm * Math.PI) * 0.18 * depthFactor * this.params.rimHeight;
                    this.heightMap[idx] = Math.min(1.5, this.heightMap[idx] + rimBump);
                }
            }
        }

        const normX = cx / w;
        const normY = cy / h;

        // 1. High-velocity Molten Metal Shrapnel Streaks (Razor-thin iron lines)
        const sCount = this.params.shrapnelCount;
        for (let i = 0; i < sCount; i++) {
            const angle = rng() * Math.PI * 2;
            const speed = (0.4 + Math.pow(rng(), 0.3) * 0.6) * 550;

            this.shrapnel.push({
                x: normX,
                y: normY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                life: 0,
                maxLife: 0.3 + rng() * 0.7,
                length: 8 + rng() * 18,
                temp: rng() // 1.0 = white hot, 0.0 = dark iron
            });
        }

        // 2. Heavy Mud & Soil Clods (Tumbling dark earth chunks)
        const dCount = this.params.dirtCount;
        for (let i = 0; i < dCount; i++) {
            const angle = rng() * Math.PI * 2;
            const speed = (0.2 + rng() * 0.8) * 320;

            this.dirtClods.push({
                x: normX,
                y: normY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 140, // High parabolic arc
                size: 2 + rng() * 4.5,
                rot: rng() * Math.PI * 2,
                vRot: (rng() - 0.5) * 12,
                life: 0,
                maxLife: 0.8 + rng() * 0.8
            });
        }

        // 3. Billowing Smoke & Ash Plumes (Expanding volumetric grey clouds)
        const smCount = this.params.smokeCount;
        for (let i = 0; i < smCount; i++) {
            const angle = rng() * Math.PI * 2;
            const speed = (0.1 + rng() * 0.4) * 120;

            this.smokePuffs.push({
                x: normX + (rng() - 0.5) * 0.02,
                y: normY + (rng() - 0.5) * 0.02,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                radius: 6 + rng() * 12,
                maxRadius: 25 + rng() * 35,
                alpha: 0.5 + rng() * 0.3,
                life: 0,
                maxLife: 1.2 + rng() * 1.0
            });
        }

        // 4. Low-lying Ground Shockwave Dust Ring
        this.shockwaves.push({
            x: normX,
            y: normY,
            radius: 0,
            maxRadius: (radius / w) * 2.5,
            alpha: 0.95
        });

        this.recomputeNormals();
    }

    /**
     * Compute 3D surface normals (Nx, Ny) via central height differences
     */
    recomputeNormals() {
        const w = this.gridW;
        const h = this.gridH;

        for (let y = 1; y < h - 1; y++) {
            const yOff = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = yOff + x;

                const dzdx = (this.heightMap[idx + 1] - this.heightMap[idx - 1]) * 2.5;
                const dzdy = (this.heightMap[idx + w] - this.heightMap[idx - w]) * 2.5;

                this.normalX[idx] = dzdx;
                this.normalY[idx] = dzdy;
            }
        }
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt * this.params.speed;

        // Cool thermal heat maps over time
        const size = this.gridW * this.gridH;
        for (let i = 0; i < size; i++) {
            if (this.heatMap[i] > 0) {
                this.heatMap[i] = Math.max(0, this.heatMap[i] - dt * 0.35);
            }
        }

        // Automatic shell bombardment timing
        this.nextImpactTime -= dt;
        if (this.nextImpactTime <= 0) {
            const w = this.gridW;
            const h = this.gridH;
            const cx = Math.floor((0.15 + Math.random() * 0.7) * w);
            const cy = Math.floor((0.15 + Math.random() * 0.7) * h);
            this.createCrater(cx, cy, 9 + Math.floor(Math.random() * 9), 0.8 + Math.random() * 0.4);
            this.nextImpactTime = 2.2 + Math.random() * 2.5;
        }

        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += dt * 0.8;
            sw.alpha -= dt * 0.7;
            if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }

        // 1. Update Shrapnel Lines
        for (let i = this.shrapnel.length - 1; i >= 0; i--) {
            const s = this.shrapnel[i];
            s.life += dt;
            s.vx *= 0.92; // High air resistance
            s.vy = s.vy * 0.92 + 180 * dt; // gravity

            s.x += (s.vx * dt) / 1000;
            s.y += (s.vy * dt) / 1000;

            if (s.life >= s.maxLife || s.x < 0 || s.x > 1 || s.y > 1) {
                this.shrapnel.splice(i, 1);
            }
        }

        // 2. Update Mud Dirt Clods
        for (let i = this.dirtClods.length - 1; i >= 0; i--) {
            const d = this.dirtClods[i];
            d.life += dt;
            d.rot += d.vRot * dt;
            d.vx *= 0.97;
            d.vy += 380 * dt; // Strong gravity

            d.x += (d.vx * dt) / 1000;
            d.y += (d.vy * dt) / 1000;

            if (d.life >= d.maxLife || d.x < 0 || d.x > 1 || d.y > 1) {
                this.dirtClods.splice(i, 1);
            }
        }

        // 3. Update Billowing Smoke Plumes
        for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
            const sm = this.smokePuffs[i];
            sm.life += dt;
            const progress = sm.life / sm.maxLife;
            
            sm.vx *= 0.94;
            sm.vy -= 15 * dt; // Thermal buoyancy rising

            sm.x += (sm.vx * dt) / 1000;
            sm.y += (sm.vy * dt) / 1000;
            sm.radius = sm.radius + (sm.maxRadius - sm.radius) * dt * 1.5;

            if (sm.life >= sm.maxLife || sm.x < 0 || sm.x > 1 || sm.y < 0) {
                this.smokePuffs.splice(i, 1);
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

        if (!this.heightMap) {
            this.generate({}, this.seed);
        }

        const gw = this.gridW;
        const gh = this.gridH;

        // Render 3D Normal-mapped & Bump-shaded Terrain to Offscreen Image Buffer
        const imgData = ctx.createImageData(gw, gh);
        const pixels = imgData.data;

        // Light direction vector (simulated sun/flare angle)
        const lx = Math.cos(this.params.lightAngle);
        const ly = Math.sin(this.params.lightAngle);
        const lz = 0.85;

        const pal = options.colorPalette || this.params.colorPalette;

        for (let y = 0; y < gh; y++) {
            const yOff = y * gw;
            for (let x = 0; x < gw; x++) {
                const idx = yOff + x;
                const hVal = this.heightMap[idx];
                const heat = this.heatMap[idx];

                // Surface normal
                const nx = -this.normalX[idx];
                const ny = -this.normalY[idx];
                const nz = 1.0;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

                // Diffuse lighting dot product N • L
                const dot = Math.max(0.15, (nx * lx + ny * ly + nz * lz) / len);

                // Height-based ambient shadow (craters are deeper & darker inside)
                const shadow = Math.max(0.2, Math.min(1.0, hVal * 1.3));

                // Final shading brightness
                const shade = dot * shadow;

                let r = 0, g = 0, b = 0;

                if (pal === 'sulfur_mud') {
                    r = Math.floor(shade * (130 + hVal * 40));
                    g = Math.floor(shade * (120 + hVal * 30));
                    b = Math.floor(shade * (60 + hVal * 20));
                } else if (pal === 'crucible_steel') {
                    r = Math.floor(shade * (90 + hVal * 60));
                    g = Math.floor(shade * (110 + hVal * 70));
                    b = Math.floor(shade * (140 + hVal * 80));
                } else if (pal === 'phosphor_glow') {
                    r = Math.floor(shade * (60 + hVal * 40));
                    g = Math.floor(shade * (140 + hVal * 80));
                    b = Math.floor(shade * (90 + hVal * 50));
                } else {
                    // Scorched Earth (default WWI iron mud)
                    r = Math.floor(shade * (115 + hVal * 50));
                    g = Math.floor(shade * (75 + hVal * 35));
                    b = Math.floor(shade * (45 + hVal * 25));
                }

                // Blend molten crater core heat glow
                if (heat > 0.05) {
                    const heatR = Math.min(255, Math.floor(heat * 255));
                    const heatG = Math.min(255, Math.floor(heat * 140));
                    const heatB = Math.min(255, Math.floor(heat * 30));

                    r = Math.min(255, Math.floor(r * (1 - heat) + heatR * heat));
                    g = Math.min(255, Math.floor(g * (1 - heat) + heatG * heat));
                    b = Math.min(255, Math.floor(b * (1 - heat) + heatB * heat));
                }

                const pixelIdx = idx * 4;
                pixels[pixelIdx] = r;
                pixels[pixelIdx + 1] = g;
                pixels[pixelIdx + 2] = b;
                pixels[pixelIdx + 3] = 255;
            }
        }

        // Draw textured 3D terrain canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = gw;
        offscreen.height = gh;
        offscreen.getContext('2d').putImageData(imgData, 0, 0);

        ctx.fillStyle = options.backgroundColor || '#040303';
        ctx.fillRect(0, 0, w, h);

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, w, h);

        // 1. Render Billowing Smoke Plumes (Volumetric ash clouds)
        for (let i = 0; i < this.smokePuffs.length; i++) {
            const sm = this.smokePuffs[i];
            const px = sm.x * w;
            const py = sm.y * h;
            const normLife = 1 - (sm.life / sm.maxLife);
            const alpha = (sm.alpha * normLife * 0.45).toFixed(2);

            const grad = ctx.createRadialGradient(px, py, 0, px, py, sm.radius);
            grad.addColorStop(0, `rgba(70, 65, 60, ${alpha})`);
            grad.addColorStop(0.5, `rgba(40, 38, 35, ${(alpha * 0.5).toFixed(2)})`);
            grad.addColorStop(1, 'rgba(10, 10, 10, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, sm.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Render Shockwave Rings
        this.shockwaves.forEach(sw => {
            const cx = sw.x * w;
            const cy = sw.y * h;
            const rad = sw.radius * Math.min(w, h);

            ctx.strokeStyle = `rgba(255, 170, 70, ${sw.alpha.toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            ctx.stroke();
        });

        // 3. Render Mud Soil Clods (Tumbling dark earth chunks)
        ctx.fillStyle = '#261b14';
        ctx.strokeStyle = '#120d0a';
        ctx.lineWidth = 1;

        for (let i = 0; i < this.dirtClods.length; i++) {
            const d = this.dirtClods[i];
            const px = d.x * w;
            const py = d.y * h;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(d.rot);

            // Irregular quad chunk shape
            ctx.beginPath();
            ctx.rect(-d.size / 2, -d.size / 2, d.size, d.size * 0.7);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // 4. Render Molten Shrapnel Velocity Lines (Razor-thin incandescent iron streaks)
        for (let i = 0; i < this.shrapnel.length; i++) {
            const s = this.shrapnel[i];
            const px = s.x * w;
            const py = s.y * h;
            const normLife = 1 - (s.life / s.maxLife);

            // Shrapnel line head & tail along velocity vector
            const tailX = px - (s.vx * 0.03 * normLife);
            const tailY = py - (s.vy * 0.03 * normLife);

            let strokeColor = 'rgba(255, 255, 240, ';
            if (s.temp > 0.8) strokeColor = 'rgba(255, 255, 210, '; // White-hot lead
            else if (s.temp > 0.4) strokeColor = 'rgba(255, 140, 30, '; // Molten yellow/amber
            else strokeColor = 'rgba(200, 45, 10, '; // Scorched iron red

            ctx.strokeStyle = strokeColor + (normLife * 0.95).toFixed(2) + ')';
            ctx.lineWidth = Math.max(1, 2.2 * normLife);
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        return true;
    }
}
