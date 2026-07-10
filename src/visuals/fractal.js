/**
 * Fractal Flame Integrator
 * Wraps the DeepLightning engine (FractalFlameGenerator) for use in the Visual Cortex.
 * Implements a "Preload Queue" strategy to ensure instant availability for flashes.
 */
import { FractalFlameGenerator } from './lib/fractal-engine.js';

export class FractalFlame {
    constructor(canvas) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;
        this.generator = new FractalFlameGenerator();

        // Match chamber background: --color-void (#0A0A0C)
        this.generator.backgroundColor = [10, 10, 12];

        this.queue = [];
        this.maxQueueSize = 5;
        this.isGenerating = false;

        // Configuration
        this.config = {
            width: window.innerWidth,
            height: window.innerHeight,
            quality: 1,
            iterations: 2000000
        };

        this.MAX_DIMENSION = 2048; // Hard cap

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Cap visual dimensions
        const w = Math.min(window.innerWidth, this.MAX_DIMENSION);
        const h = Math.min(window.innerHeight, this.MAX_DIMENSION);

        // Only resize if actually changed to avoid clearing canvas unnecessarily
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.config.width = w;
            this.config.height = h;

            // Invalidate stale buffers - they won't match new dimensions
            this.queue = [];
            console.log(`[FractalFlame] Resized to ${w}x${h}, queue cleared.`);
        }
    }

    /**
     * Preload a specific number of fractals.
     * This now AWAITS the fill to ensure queue is ready before session starts.
     */
    async preload(count) {
        console.log(`[FractalFlame] Starting preload of ${count} flames...`);
        const target = Math.min(count, this.maxQueueSize);
        await this.fillQueue(target);
        console.log(`[FractalFlame] Preload complete. Queue: ${this.queue.length}`);
    }

    /**
     * Check if at least one fractal is ready for display.
     */
    isReady() {
        return this.queue.length > 0;
    }

    async fillQueue(targetCount) {
        if (this.isGenerating) return;

        while (this.queue.length < targetCount) {
            this.isGenerating = true;
            try {
                await this.generateToQueue();
            } catch (err) {
                console.error('[FractalFlame] Generation error:', err);
                break;
            } finally {
                this.isGenerating = false;
            }
            // Small breathing room for UI
            await new Promise(r => setTimeout(r, 50));
        }
    }

    async generateToQueue() {
        this.generator.generateRandomFlame();

        // Always generate at the current canvas size to ensure sync putImageData works
        const { width, height } = this.canvas;

        const imageData = await this.generator.generateImage({
            width,
            height,
            iterations: this.config.iterations,
            useWorkers: true,
            oversample: 1,
            gamma: 2.2,
            brightness: 15.0,
            vibrancy: 1.2
        });

        // Store with metadata so we can validate dimensions at draw time
        this.queue.push({ imageData, width, height });
        // console.log(`[FractalFlame] Generated ${width}x${height} flame. Queue: ${this.queue.length}`);
    }

    /**
     * Draw a fractal to the canvas SYNCHRONOUSLY.
     * Returns true on success, false if queue was empty or buffer was stale.
     */
    generate() {
        // console.log('[FractalFlame] generate() called.');

        const item = this.queue.shift();

        if (!item) {
            console.warn('[FractalFlame] Cache miss! Queue empty.');
            // Trigger refill but return failure
            this.fillQueue(this.maxQueueSize);
            return false;
        }

        const { imageData, width: bufW, height: bufH } = item;
        const { width, height } = this.canvas;

        // Clear before drawing
        this.ctx.clearRect(0, 0, width, height);

        if (bufW === width && bufH === height) {
            // Dimensions match - synchronous draw guaranteed
            this.ctx.putImageData(imageData, 0, 0);
            // console.log('[FractalFlame] putImageData executed.');
        } else {
            // Buffer is stale (resize occurred between generation and display)
            console.warn(`[FractalFlame] Stale buffer discarded: ${bufW}x${bufH} vs ${width}x${height}`);
            this.queue = []; // Clear all stale buffers
            this.fillQueue(this.maxQueueSize);
            return false;
        }

        // Trigger refill if getting low
        if (this.queue.length < 2) {
            this.fillQueue(this.maxQueueSize);
        }

        return true;
    }
}
