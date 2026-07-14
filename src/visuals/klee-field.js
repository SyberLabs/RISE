/**
 * KleeField — "Motion Klee" / Genesis mode.
 *
 * Where the Rhythmic cortex flashes still frames between words, the field
 * draws CONTINUOUSLY around a constant token stream: one composition grows
 * slowly (a pen traveling for ~half a minute), holds, dissolves, and the
 * next begins — Klee's "genesis of form" made durational.
 *
 * Interaction doctrine (from the flash-mode findings, inverted for the
 * medium that CAN hold motion):
 * - growth is slow and continuous — never nested inside a cut
 * - one artwork + preset locked per episode; transitions are crossfades
 * - reduced-motion / photosensitivity: no growth animation, compositions
 *   appear complete and change only by slow dissolve
 * - worker contours (forms) fade in late in growth, never mid-stroke
 */

import { KleeEngine, KLEE_PRESET_NAMES, KLEE_CHAMBER_BACKGROUND } from './klee-enhanced.js';
import { planInterlocution } from '../core/conductor.js';

const GROW_MS = 28000;   // one composition unfolds over ~28s
const HOLD_MS = 9000;    // rests complete before dissolving
const FADE_MS = 1600;    // crossfade between episodes (CSS opacity)
const MAX_PIXELS = 2_600_000; // background layer: slightly lighter cap than flashes

export class KleeField {
    /**
     * @param {HTMLElement} host - positioned container the canvas fills
     * @param {Object} options
     * @param {string} options.preset - 'random' | one of KLEE_PRESET_NAMES
     */
    constructor(host, options = {}) {
        this.host = host;
        this.preset = options.preset || 'random';
        this.engine = options.engine || new KleeEngine();
        this.signal = null;           // latest semantic signal (setSignal)
        this.lastPreset = null;
        this.progress = 0;
        this.phase = 'growing';       // 'growing' | 'holding' | 'fading'
        this.phaseStart = 0;
        this._episodeIndex = 0;
        this._lastRenderedProgress = -1;
        this.rafId = null;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'klee-field-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.canvas.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
        this.canvas.style.opacity = '0';
        this.host.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this._resize = this._resize.bind(this);
        this._resizeTimer = null;
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(this._resize, 200);
            });
            this.resizeObserver.observe(this.host);
        }
        this._applyCanvasSize();

        this._beginEpisode(true);
        this.tick = this.tick.bind(this);
        this.rafId = requestAnimationFrame(this.tick);
    }

    /** Latest semantic signal — consumed at the next episode boundary. */
    setSignal(signal) {
        this.signal = signal || null;
    }

    /** Freeze growth while the session is paused; the pen waits with you. */
    pause() {
        if (this.paused) return;
        this.paused = true;
        this._pausedAt = performance.now();
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        // Shift phase time forward by the paused span so growth continues
        // exactly where it stopped
        this.phaseStart += performance.now() - this._pausedAt;
    }

    _isStill() {
        const rootClasses = document.documentElement.classList;
        return rootClasses.contains('reduced-motion')
            || rootClasses.contains('photosensitivity-mode')
            || (typeof window.matchMedia === 'function'
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    _applyCanvasSize() {
        const cssWidth = Math.max(1, this.host.clientWidth || window.innerWidth);
        const cssHeight = Math.max(1, this.host.clientHeight || window.innerHeight);
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const fit = Math.min(1, Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight * dpr * dpr)));
        this.canvas.width = Math.max(1, Math.round(cssWidth * dpr * fit));
        this.canvas.height = Math.max(1, Math.round(cssHeight * dpr * fit));
        this.engine.width = this.canvas.width;
        this.engine.height = this.canvas.height;
    }

    _resize() {
        this._applyCanvasSize();
        // Composition geometry is size-tuned — begin a fresh episode
        this._beginEpisode(true);
    }

    /**
     * Choose the next episode's preset: locked preset wins; 'random' follows
     * the conductor's quadrant when a signal exists, otherwise cycles with
     * no immediate repeats.
     */
    _choosePreset() {
        if (this.preset !== 'random') return this.preset;
        if (this.signal) {
            const plan = planInterlocution(this.signal, { activeTypes: [], kleePreset: 'random', rhythm: false });
            if (plan.kleePreset && plan.kleePreset !== this.lastPreset) return plan.kleePreset;
        }
        const pool = KLEE_PRESET_NAMES.filter(name => name !== this.lastPreset);
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _beginEpisode(instant = false) {
        const preset = this._choosePreset();
        const seed = `field-${Date.now()}-${this._episodeIndex++}`;
        this.engine.generateRandomAsync(preset, {
            seed,
            signal: this.signal,
            blendFrom: this.lastPreset || undefined,
            blend: this.lastPreset ? 0.4 : 1,
            awaitEnhancements: false
        }).catch(() => { /* worker enhancements are decorative */ });
        this.lastPreset = preset;

        this.progress = this._isStill() ? 1 : 0;
        this.phase = this._isStill() ? 'holding' : 'growing';
        this.phaseStart = performance.now();
        this._lastRenderedProgress = -1;

        this._render();
        if (instant) {
            this.canvas.style.opacity = '1';
        }
    }

    _render() {
        if (!this.ctx) return; // headless environment (tests)
        this.engine.render(this.canvas, {
            background: KLEE_CHAMBER_BACKGROUND,
            progress: this.progress,
            // Contours arrive from the worker mid-growth; reveal them only
            // once the composition is substantially present
            showForms: this.progress > 0.7,
            texture: this.progress >= 1 ? this.engine.renderStyle.texture : 0
        });
        this._lastRenderedProgress = this.progress;
    }

    tick(now) {
        if (this.paused) {
            this.rafId = requestAnimationFrame(this.tick);
            return;
        }
        const elapsed = now - this.phaseStart;

        if (this.phase === 'growing') {
            // Ease-out growth: eager start, patient resolution.
            // Render every frame — with fractional tip interpolation in the
            // engine, the pen moves continuously rather than step by step.
            const t = Math.min(1, elapsed / GROW_MS);
            this.progress = 1 - Math.pow(1 - t, 1.8);
            this._render();
            if (t >= 1) {
                this.phase = 'holding';
                this.phaseStart = now;
            }
        } else if (this.phase === 'holding') {
            const holdFor = this._isStill() ? HOLD_MS + GROW_MS * 0.5 : HOLD_MS;
            if (elapsed >= holdFor) {
                this.phase = 'fading';
                this.phaseStart = now;
                this.canvas.style.opacity = '0';
            }
        } else if (this.phase === 'fading') {
            if (elapsed >= FADE_MS + 120) {
                this._beginEpisode();
                this.canvas.style.opacity = '1';
            }
        }

        this.rafId = requestAnimationFrame(this.tick);
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.resizeObserver?.disconnect();
        clearTimeout(this._resizeTimer);
        this.engine.destroy?.();
        this.canvas.remove();
    }
}
