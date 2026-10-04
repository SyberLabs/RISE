/**
 * Fractal Flame Integrator
 * Wraps the DeepLightning engine (FractalFlameGenerator) for use in the Visual Cortex.
 * Implements a "Preload Queue" strategy to ensure instant availability for flashes.
 */
import { FractalFlameGenerator } from './lib/fractal-engine.js';
import { buildAccentFlamePalette, planFlame, pickNearestSignalIndex } from '../core/conductor.js';

// The flame is drawn at the device's pixels, up to twice the CSS pixels,
// within a pixel budget. The budget bounds every worker's histogram, the
// queue's frames, and the Chamber's WebP snapshot of the canvas, which runs
// on the main thread and grows with it. Samples scale with the pixels so each
// pixel keeps the same share: drawn larger on the same samples, a flame only
// gets sparser and grainier.
export const MAX_FLAME_PIXELS = 1600 * 1000;
const MAX_RENDER_SCALE = 2;
const SAMPLES_PER_PIXEL = 2;
const MIN_ITERATIONS = 2_000_000;
// Each worker holds a whole histogram, so more workers cost memory faster
// than they save time.
const MAX_WORKERS = 4;

/** The flame canvas's backing size for a CSS size and device pixel ratio. */
export function flameCanvasSize(cssWidth, cssHeight, devicePixelRatio) {
    let scale = Math.min(devicePixelRatio || 1, MAX_RENDER_SCALE);
    const pixels = cssWidth * cssHeight * scale * scale;
    if (pixels > MAX_FLAME_PIXELS) scale *= Math.sqrt(MAX_FLAME_PIXELS / pixels);
    return {
        width: Math.max(1, Math.floor(cssWidth * scale)),
        height: Math.max(1, Math.floor(cssHeight * scale))
    };
}

/** Samples for a flame of this many pixels. */
export function flameIterations(width, height) {
    return Math.max(MIN_ITERATIONS, width * height * SAMPLES_PER_PIXEL);
}

export class FractalFlame {
    constructor(canvas) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;
        this.generator = new FractalFlameGenerator();
        this.generator.maxWorkers = Math.min(this.generator.maxWorkers, MAX_WORKERS);

        // Match chamber background: --color-void (#0A0A0C)
        this.generator.backgroundColor = [10, 10, 12];

        this.queue = [];
        this.maxQueueSize = 5;
        this.isGenerating = false;
        this._generation = 0;
        this._fillPromise = null;
        this._destroyed = false;

        // Semantic mode: when a session provides representative signals,
        // queue fills render plan-driven flames (palette/variations/tone by
        // signal) and flash-time pops pick the closest match. Null pool =
        // raw platform behavior.
        this.signalPool = null;
        this._poolIndex = 0;
        // A reading's chosen colors, when it has them (Jev readings do).
        this.accentPalette = null;

        this.resize();
        this._boundResize = () => this.resize();
        window.addEventListener('resize', this._boundResize);
    }

    resize() {
        const { width: w, height: h } = flameCanvasSize(window.innerWidth, window.innerHeight, window.devicePixelRatio);

        // Only resize if actually changed to avoid clearing canvas unnecessarily
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;

            // Invalidate stale buffers - they won't match new dimensions
            this.queue = [];
            this._generation++;
            console.log(`[FractalFlame] Resized to ${w}x${h}, queue cleared.`);
        }
    }

    /**
     * Set (or clear) the semantic signal pool used to seed queue fills.
     * Clearing flushes semantic buffers so raw sessions start clean.
     */
    setSignalPool(signals) {
        const next = Array.isArray(signals) && signals.length > 0 ? signals : null;
        const key = pool => pool
            ? pool.map(signal => `${Number(signal.valence).toFixed(3)}:${Number(signal.arousal).toFixed(3)}`).join('|')
            : 'none';
        const modeChanged = key(next) !== key(this.signalPool);
        this.signalPool = next;
        this._poolIndex = 0;
        if (modeChanged) {
            this._generation++;
            this.queue = [];
            console.log(`[FractalFlame] Signal pool ${next ? `set (${next.length} signals)` : 'cleared'}, queue flushed.`);
        }
    }

    /**
     * Paint flames in a reading's chosen colors (null = the mood palettes).
     * A change flushes the queue so no flame in the old colors is shown.
     */
    setColorTheme(colors) {
        const next = colors ? buildAccentFlamePalette(colors) : null;
        const key = palette => palette ? palette[128].join(',') + palette[255].join(',') : 'none';
        if (key(next) === key(this.accentPalette)) return;
        this.accentPalette = next;
        this._generation++;
        this.queue = [];
    }

    beginSession(signals) {
        this.signalPool = Array.isArray(signals) && signals.length > 0 ? signals : null;
        this._poolIndex = 0;
        this._generation++;
        this.queue = [];
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
        if (this._destroyed) return;
        const generation = this._generation;
        if (this._fillPromise) {
            await this._fillPromise.catch(() => {});
            if (!this._destroyed && this.queue.length < targetCount) return this.fillQueue(targetCount);
            return;
        }

        this._fillPromise = (async () => {
            while (!this._destroyed && generation === this._generation && this.queue.length < targetCount) {
                this.isGenerating = true;
                try {
                    const item = await this.generateToQueue();
                    if (generation === this._generation && !this._destroyed) this.queue.push(item);
                } catch (err) {
                    console.error('[FractalFlame] Generation error:', err);
                    break;
                } finally {
                    this.isGenerating = false;
                }
                await new Promise(r => setTimeout(r, 50));
            }
        })();
        try {
            await this._fillPromise;
        } finally {
            this._fillPromise = null;
        }
    }

    async generateToQueue() {
        // Semantic mode: cycle through the session's representative signals
        // so the queue covers the text's emotional range; raw mode is the
        // original random flame with the default palette.
        let signal = null;
        let tone = { gamma: 2.2, brightness: 15.0, vibrancy: 1.2 };

        if (this.signalPool) {
            signal = this.signalPool[this._poolIndex % this.signalPool.length];
            this._poolIndex++;
            const plan = planFlame(signal);
            this.generator.generateFlameFromPlan(plan);
            tone = { gamma: plan.tone.gamma, brightness: plan.tone.brightness, vibrancy: plan.tone.vibrancy };
        } else {
            this.generator.palette = this.generator.generateDefaultPalette();
            this.generator.generateRandomFlame();
        }
        if (this.accentPalette) this.generator.palette = this.accentPalette;

        // Always generate at the current canvas size to ensure sync putImageData works
        const { width, height } = this.canvas;

        const imageData = await this.generator.generateImage({
            width,
            height,
            iterations: flameIterations(width, height),
            useWorkers: true,
            smooth: true,
            oversample: 1,
            gamma: tone.gamma,
            brightness: tone.brightness,
            vibrancy: tone.vibrancy
        });

        // Store with metadata so we can validate dimensions at draw time
        // (and the signal the flame was built for, when in semantic mode)
        return { imageData, width, height, signal };
    }

    /**
     * Consume the best queued flame for a live semantic signal. Both native
     * and ASCII renderers use this single ownership path, so one flash can
     * never accidentally consume two different artworks.
     */
    takeFrame(signal) {
        let item;
        if (signal && this.queue.some(q => q.signal)) {
            // Shared perceptual matcher (conductor owns the arousal weighting)
            const bestIdx = pickNearestSignalIndex(this.queue, signal);
            item = this.queue.splice(Math.max(0, bestIdx), 1)[0];
        } else {
            item = this.queue.shift();
        }

        if (!item) {
            console.warn('[FractalFlame] Cache miss! Queue empty.');
            // Trigger refill but return failure
            this.fillQueue(this.maxQueueSize);
            return null;
        }

        const { width: bufW, height: bufH } = item;
        const { width, height } = this.canvas;
        if (bufW !== width || bufH !== height) {
            // Buffer is stale (resize occurred between generation and display)
            console.warn(`[FractalFlame] Stale buffer discarded: ${bufW}x${bufH} vs ${width}x${height}`);
            this.queue = []; // Clear all stale buffers
            this.fillQueue(this.maxQueueSize);
            return null;
        }

        // Trigger refill if getting low
        if (this.queue.length < 2) {
            this.fillQueue(this.maxQueueSize);
        }

        return item;
    }

    /**
     * Draw a fractal to the canvas SYNCHRONOUSLY.
     * When a semantic signal is given and the queue holds tagged flames,
     * pops the closest match in (valence, arousal) space; otherwise FIFO.
     * Returns true on success, false if queue was empty or buffer was stale.
     */
    generate(signal) {
        const item = this.takeFrame(signal);
        if (!item) return false;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(item.imageData, 0, 0);

        return true;
    }

    destroy() {
        this._destroyed = true;
        this._generation++;
        this.queue = [];
        window.removeEventListener('resize', this._boundResize);
        this.generator.dispose?.();
    }
}
