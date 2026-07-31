/**
 * PARADISE LOST — ENGINE 1: FALL OF THE REBEL ANGELS & MANDELBROT ABYSS
 * (Cross Kaleidoscope Attractor & Seamless Mandelbrot Falling Red Region Engine)
 * 
 * "His tail drew the third part of the stars of heaven..." — Revelation 12:4 / Paradise Lost (Book VI)
 * 
 * Conceptual Architecture:
 * 1. Mandelbrot Abyssal Red Texture: The falling 1/3 rebellious red region features a procedural
 *    Mandelbrot / Julia fractal set texture representing the chaotic, infinite depth of the bottomless Pit.
 * 2. Seamless Boundary Blend: Removed the hard horizon line so the divine light bloom melts
 *    organically into the Mandelbrot red abyss.
 * 3. Cross-Shaped Kaleidoscope Attractor: Cruciform Aizawa strange attractor at the heart of the expanding divine sun core.
 * 4. 1/3 Rebellious Red Boundary: Starts 1/3 down the screen (y = 0.333 * H) and is swept downwards out of frame by expanding divine light.
 */

import { createSeededRandom } from '../lib/klee-core.js';

export class ParadiseFallHypercubeEngine {
    constructor() {
        this.name = "Fall of the Rebel Angels (Seamless Mandelbrot Red)";
        this.category = "DIMENSIONAL / SPATIAL";
        this.seed = "paradise-fall-01";
        this.time = 0;
        this.expansionProgress = 0.0; // 0.0 = initial core, 1.0 = fully expanded pushing red down

        // Offscreen canvas for fast procedural Mandelbrot texture
        this.mandelCanvas = null;
        this.mandelCtx = null;
        this.mandelW = 160;
        this.mandelH = 120;

        // Cross-Shaped Kaleidoscope Attractor Filament
        this.attractorPoints = null;

        this.params = {
            rotSpeed: 0.5,
            expansionSpeed: 0.08,
            attractorLength: 6400,
            colorPalette: 'empyrean_sun'
        };

        this._initAttractor();
    }

    _initAttractor() {
        const count = this.params.attractorLength;
        this.attractorPoints = new Float32Array(count * 3);

        let x = 0.1, y = 0.0, z = 0.0;
        const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
        const dt = 0.01;

        for (let i = 0; i < 600; i++) {
            const dx = (z - b) * x - d * y;
            const dy = d * x + (z - b) * y;
            const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
            x += dx * dt; y += dy * dt; z += dz * dt;
        }

        for (let i = 0; i < count; i++) {
            const dx = (z - b) * x - d * y;
            const dy = d * x + (z - b) * y;
            const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
            x += dx * dt; y += dy * dt; z += dz * dt;

            this.attractorPoints[i * 3] = x * 0.38;
            this.attractorPoints[i * 3 + 1] = y * 0.38;
            this.attractorPoints[i * 3 + 2] = z * 0.38;
        }
    }

    /**
     * Generate procedural Mandelbrot / Julia fractal texture for the falling red abyss
     */
    _renderMandelbrotTexture(time) {
        if (!this.mandelCanvas) {
            this.mandelCanvas = document.createElement('canvas');
            this.mandelCanvas.width = this.mandelW;
            this.mandelCanvas.height = this.mandelH;
            this.mandelCtx = this.mandelCanvas.getContext('2d');
        }

        const mw = this.mandelW;
        const mh = this.mandelH;
        const imgData = this.mandelCtx.createImageData(mw, mh);
        const data = imgData.data;

        // Julia / Mandelbrot parameters
        const maxIter = 16;
        const cx = -0.7 + Math.sin(time * 0.2) * 0.08;
        const cy = 0.27015 + Math.cos(time * 0.2) * 0.08;

        for (let py = 0; py < mh; py++) {
            const yOff = py * mw;
            const zy = (py / mh - 0.5) * 2.4 + Math.sin(time * 0.1) * 0.2;

            for (let px = 0; px < mw; px++) {
                const zx = (px / mw - 0.5) * 3.2;

                let zReal = zx;
                let zImag = zy;
                let iter = 0;

                while (zReal * zReal + zImag * zImag < 4.0 && iter < maxIter) {
                    const nextReal = zReal * zReal - zImag * zImag + cx;
                    const nextImag = 2.0 * zReal * zImag + cy;
                    zReal = nextReal;
                    zImag = nextImag;
                    iter++;
                }

                const idx = (yOff + px) * 4;

                if (iter >= maxIter) {
                    // Core Mandelbrot interior (deep pitch black)
                    data[idx] = 10;
                    data[idx + 1] = 2;
                    data[idx + 2] = 2;
                    data[idx + 3] = 240;
                } else {
                    // Boundary escape gradient (volcanic crimson -> sulfur orange -> pitch shadow)
                    const ratio = iter / maxIter;
                    data[idx] = Math.floor(240 * ratio);                          // R
                    data[idx + 1] = Math.floor(60 * Math.sin(ratio * Math.PI));    // G
                    data[idx + 2] = Math.floor(10 * ratio);                       // B
                    data[idx + 3] = Math.floor(220 * ratio + 35);                  // A
                }
            }
        }

        this.mandelCtx.putImageData(imgData, 0, 0);
    }

    generate(signal = {}, seed = 'fall-seed', options = {}) {
        this.seed = seed;
        this.time = 0;
        this.expansionProgress = 0.0;
        this._initAttractor();
        return true;
    }

    step(dt = 0.016, signal = {}) {
        this.time += dt;

        // Divine light expands over time, pushing 1/3 red rebellion downwards out of frame
        if (this.expansionProgress < 1.0) {
            this.expansionProgress = Math.min(1.0, this.expansionProgress + dt * this.params.expansionSpeed);
        }
    }

    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;

        const cx = w / 2;
        const cy = h / 2;

        // 1. Cosmic Void Background Gradient
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
        bgGrad.addColorStop(0, '#0d071a');
        bgGrad.addColorStop(0.5, '#05030d');
        bgGrad.addColorStop(1, '#020105');

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // 2. Render PROCEDURAL MANDELBROT TEXTURE in 1/3 REBELLIOUS RED REGION
        // Starts 1/3 down the screen at y = 0.333 * h, pushed downwards over time
        const initialRedY = h * 0.333; // Exactly 1/3 of the screen down
        const redPushY = initialRedY + (this.expansionProgress * (h * 0.87));

        if (this.expansionProgress < 0.98) {
            // Update offscreen Mandelbrot texture
            this._renderMandelbrotTexture(this.time);

            const flameAlpha = Math.max(0, (1 - this.expansionProgress) * 0.85);

            ctx.save();
            ctx.globalAlpha = flameAlpha;

            // Draw Mandelbrot fractal texture over the falling red region
            const redRegionHeight = h - redPushY;
            ctx.drawImage(this.mandelCanvas, 0, 0, this.mandelW, this.mandelH, 0, redPushY, w, redRegionHeight);

            // Overlay linear fire gradient for organic seamless blend (NO hard horizon line)
            const redFlameGrad = ctx.createLinearGradient(0, redPushY, 0, h);
            redFlameGrad.addColorStop(0, 'rgba(230, 40, 10, 0)');
            redFlameGrad.addColorStop(0.25, 'rgba(210, 30, 10, 0.45)');
            redFlameGrad.addColorStop(1, 'rgba(40, 5, 2, 0.85)');

            ctx.fillStyle = redFlameGrad;
            ctx.fillRect(0, redPushY, w, redRegionHeight);
            ctx.restore();
        }

        // 3. Render EXPANDING INCANDESCENT DIVINE SUN CORE
        const exp = this.expansionProgress;
        const currentSunRad = Math.min(w, h) * (0.20 + exp * 0.50); // Expands from 20% to 70%

        // Volumetric Divine Light Rays
        const rayCount = 18;
        ctx.strokeStyle = `rgba(255, 240, 200, ${(0.3 + exp * 0.3).toFixed(2)})`;
        ctx.lineWidth = 1.6;

        for (let r = 0; r < rayCount; r++) {
            const angle = (r / rayCount) * Math.PI * 2 + this.time * 0.15;
            const rLen = currentSunRad * (1.35 + Math.sin(angle * 4 + this.time) * 0.25);
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * rLen, cy + Math.sin(angle) * rLen);
            ctx.stroke();
        }

        // Central Multi-Layer Incandescent Sun Radial Bloom
        const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentSunRad);
        sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');     // White-hot core
        sunGrad.addColorStop(0.25, 'rgba(255, 220, 100, 0.88)'); // Divine gold
        sunGrad.addColorStop(0.55, `rgba(90, 190, 255, ${(0.45 + exp * 0.45).toFixed(2)})`); // Sapphire radiance
        sunGrad.addColorStop(1, 'rgba(15, 60, 180, 0)');

        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, currentSunRad, 0, Math.PI * 2);
        ctx.fill();

        // 4. Render CROSS-SHAPED KALEIDOSCOPE ATTRACTOR
        if (this.attractorPoints) {
            const rotA = this.time * this.params.rotSpeed;
            const cosA = Math.cos(rotA), sinA = Math.sin(rotA);
            const scale = Math.min(w, h) * 0.38;
            const count = this.attractorPoints.length / 3;

            // Project 3D Attractor filament into 2D plane
            const projX = new Float32Array(count);
            const projY = new Float32Array(count);

            for (let i = 0; i < count; i++) {
                let x0 = this.attractorPoints[i * 3];
                let y0 = this.attractorPoints[i * 3 + 1];
                let z0 = this.attractorPoints[i * 3 + 2];

                let rx = x0 * cosA - y0 * sinA;
                let ry = x0 * sinA + y0 * cosA;
                let rz = z0;

                const pScale = 1 / (2.2 - rz * 0.35);
                projX[i] = rx * scale * pScale;
                projY[i] = ry * scale * pScale;
            }

            // Draw 4-Fold Cross Dihedral Kaleidoscope Rosette (8 Symmetrical Passes)
            const sectorAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

            // Pass 1 - Wide Luminous Halo
            ctx.lineWidth = 3.2;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)'; // Incandescent gold halo
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            sectorAngles.forEach((angle) => {
                const cA = Math.cos(angle), sA = Math.sin(angle);
                
                ctx.beginPath();
                for (let i = 0; i < count; i += 2) {
                    const px = cx + (projX[i] * cA - projY[i] * sA);
                    const py = cy + (projX[i] * sA + projY[i] * cA);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();

                ctx.beginPath();
                for (let i = 0; i < count; i += 2) {
                    const px = cx + (projY[i] * cA - projX[i] * sA);
                    const py = cy + (projY[i] * sA + projX[i] * cA);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            });

            // Pass 2 - Sharp White-Hot Core Cross Lines
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255, 255, 250, 0.85)'; // White-hot core filament

            sectorAngles.forEach((angle) => {
                const cA = Math.cos(angle), sA = Math.sin(angle);
                
                ctx.beginPath();
                for (let i = 0; i < count; i += 2) {
                    const px = cx + (projX[i] * cA - projY[i] * sA);
                    const py = cy + (projX[i] * sA + projY[i] * cA);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();

                ctx.beginPath();
                for (let i = 0; i < count; i += 2) {
                    const px = cx + (projY[i] * cA - projX[i] * sA);
                    const py = cy + (projY[i] * sA + projX[i] * cA);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            });
        }

        return true;
    }
}
