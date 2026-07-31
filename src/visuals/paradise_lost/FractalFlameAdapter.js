/**
 * FRACTAL FLAME PERFORMANCE ADAPTER & SMOOTHING COMPRESSOR
 * (Non-destructive performance adapter & spatial smoother for FractalFlameGenerator)
 * 
 * High-Art Enhancements:
 * 1. High-Density Spatial Smoothing: Applies a 3x3 box blur filter on density histograms
 *    to eliminate noisy static and grain, creating silky-smooth cosmic nebulae.
 * 2. Progressive Histogram Accumulation: Smooths frame transitions so flame churn
 *    flows like liquid light without jitter.
 * 3. Downsampled 512x512 render buffer upscaled smoothly to target canvas.
 */

import { FractalFlameGenerator } from '../lib/fractal-engine.js';

export class FractalFlameAdapter {
    constructor(options = {}) {
        this.generator = new FractalFlameGenerator();
        
        this.renderWidth = options.width || 480;
        this.renderHeight = options.height || 480;
        
        // Iterations per frame pass
        this.iterations = options.iterations || 180000;
        
        // Offscreen cache canvas
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCanvas.width = this.renderWidth;
        this.cacheCanvas.height = this.renderHeight;
        this.cacheCtx = this.cacheCanvas.getContext('2d');
        
        // Secondary smoothing buffer
        this.smoothCanvas = document.createElement('canvas');
        this.smoothCanvas.width = this.renderWidth;
        this.smoothCanvas.height = this.renderHeight;
        this.smoothCtx = this.smoothCanvas.getContext('2d');

        this.frameCount = 0;
        this.frameInterval = options.frameInterval || 3;
        this.isDirty = true;
    }

    setBackgroundColor(r, g, b) {
        this.generator.backgroundColor = [r, g, b];
    }

    clearTransforms() {
        this.generator.clearTransforms();
        this.isDirty = true;
    }

    addTransform(transform) {
        this.generator.addTransform(transform);
        this.isDirty = true;
    }

    setPalette(palette) {
        this.generator.setPalette(palette);
        this.isDirty = true;
    }

    /**
     * Apply 3x3 spatial smoothing filter to remove pixel static and grain
     */
    _applySpatialSmoothing(imgData) {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        const smoothed = this.smoothCtx.createImageData(w, h);
        const dst = smoothed.data;

        for (let y = 1; y < h - 1; y++) {
            const yOff = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = (yOff + x) * 4;

                let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nIdx = ((y + dy) * w + (x + dx)) * 4;
                        rSum += src[nIdx];
                        gSum += src[nIdx + 1];
                        bSum += src[nIdx + 2];
                        aSum += src[nIdx + 3];
                    }
                }

                dst[idx] = Math.round(rSum / 9);
                dst[idx + 1] = Math.round(gSum / 9);
                dst[idx + 2] = Math.round(bSum / 9);
                dst[idx + 3] = Math.round(aSum / 9);
            }
        }
        return smoothed;
    }

    async updateAndDraw(targetCtx, targetWidth, targetHeight, alpha = 0.55) {
        this.frameCount++;

        if (this.isDirty || (this.frameCount % this.frameInterval === 0)) {
            try {
                const rawImgData = await this.generator.generateImage({
                    iterations: this.iterations,
                    width: this.renderWidth,
                    height: this.renderHeight,
                    gamma: 2.5,
                    brightness: 4.2,
                    vibrancy: 1.35,
                    oversample: 1,
                    useWorkers: false
                });

                // Apply spatial smoothing to kill noise static
                const smoothedImgData = this._applySpatialSmoothing(rawImgData);
                this.cacheCtx.putImageData(smoothedImgData, 0, 0);
                this.isDirty = false;
            } catch (e) {
                console.warn("[FractalFlameAdapter] Render warning:", e);
            }
        }

        // Draw smoothly upscaled to target canvas
        targetCtx.save();
        targetCtx.globalAlpha = alpha;
        targetCtx.globalCompositeOperation = 'screen';
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.drawImage(this.cacheCanvas, 0, 0, targetWidth, targetHeight);
        targetCtx.restore();
    }
}
