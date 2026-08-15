/**
 * Gallery plates — Iris and Spectral draw across the dwell.
 *
 * ContinuousField is image-only. Harmonograph already has a living
 * layer; this is that layer for Ostensoria and Apparitio. The engines
 * generate a finished plate once per dwell; the time adapter reveals it.
 * Full-frame and behind-stream keep a finished still. Reduced motion
 * holds the completed plate.
 */

import { Ostensoria } from './ostensoria.js';
import { Apparitio } from './apparitio.js';
import {
    GALLERY_CADENCE_DEFAULT,
    galleryCadenceTimings,
    galleryDrawProgress
} from '../core/visual-presence.js';

const MAX_DPR = 2;
const MAX_FRAME_MS = 50;

export const PLATE_FAMILIES = Object.freeze(['ostensoria', 'apparitio']);

const ENGINES = {
    ostensoria: Ostensoria,
    apparitio: Apparitio
};

export class PlateField {
    /**
     * @param {HTMLElement} host
     * @param {Object} options
     *   - families  active plate ids
     *   - dwellMs / crossfadeMs
     *   - reducedMotion
     *   - getSignal
     */
    constructor(host, options = {}) {
        this.host = host;
        const fallback = galleryCadenceTimings(GALLERY_CADENCE_DEFAULT);
        this.dwellMs = Number.isFinite(options.dwellMs) ? options.dwellMs : fallback.dwellMs;
        this.crossfadeMs = Number.isFinite(options.crossfadeMs)
            ? options.crossfadeMs
            : fallback.crossfadeMs;
        this.reducedMotion = !!options.reducedMotion;
        this.families = normalizeFamilies(options.families);
        this.getSignal = typeof options.getSignal === 'function'
            ? options.getSignal
            : () => null;

        this.running = false;
        this.paused = false;
        this._planes = null;
        this._active = 0;
        this._cursor = 0;
        this._rafId = null;
        this._lastFrameAt = 0;
        this._nextRotateAt = 0;
        this._remainingRotateMs = 0;

        this._tick = this._tick.bind(this);
        this._resize = this._resize.bind(this);
        this._onVisibility = this._onVisibility.bind(this);
    }

    _mount() {
        if (this._planes) return;
        const make = () => {
            const canvas = document.createElement('canvas');
            canvas.className = 'plate-plane';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.opacity = '0';
            canvas.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.host.appendChild(canvas);
            return { canvas, engine: null, elapsedMs: 0 };
        };
        this._planes = [make(), make()];

        if (typeof ResizeObserver === 'function') {
            this._resizeObserver = new ResizeObserver(this._resize);
            this._resizeObserver.observe(this.host);
        }
        window.addEventListener('resize', this._resize);
        document.addEventListener('visibilitychange', this._onVisibility);
        this._resize();
    }

    _resize() {
        if (!this._planes) return;
        const rect = this.host?.getBoundingClientRect?.();
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const w = Math.max(1, Math.round((rect?.width || 0) * dpr));
        const h = Math.max(1, Math.round((rect?.height || 0) * dpr));
        for (const plane of this._planes) {
            if (plane.canvas.width === w && plane.canvas.height === h) continue;
            plane.canvas.width = w;
            plane.canvas.height = h;
            this._draw(plane);
        }
    }

    _onVisibility() {
        if (!this.running || this.paused) return;
        if (document.hidden) {
            this._cancel();
        } else {
            this._lastFrameAt = 0;
            this._rafId = requestAnimationFrame(this._tick);
        }
    }

    _progress(plane) {
        if (this.reducedMotion) return 1;
        return galleryDrawProgress(plane.elapsedMs, this.dwellMs);
    }

    _draw(plane) {
        if (!plane?.engine) return;
        plane.engine.render(plane.canvas, { progress: this._progress(plane) });
    }

    _rotate(first) {
        if (!this._planes || this.families.length === 0) return;
        const incoming = first ? this._planes[0] : this._planes[1 - this._active];
        const outgoing = first ? null : this._planes[this._active];
        const id = this.families[this._cursor % this.families.length];
        const Engine = ENGINES[id];
        this._cursor += 1;
        if (!Engine) return;
        const engine = new Engine();
        engine.generate(this.getSignal() || null, `gallery-plate:${id}:${this._cursor}`);
        incoming.engine = engine;
        incoming.elapsedMs = this.reducedMotion ? this.dwellMs : 0;
        this._draw(incoming);
        incoming.canvas.style.transition = this.reducedMotion || first
            ? 'none'
            : `opacity ${this.crossfadeMs}ms ease-in-out`;
        incoming.canvas.style.opacity = '1';
        if (outgoing) {
            outgoing.canvas.style.opacity = '0';
            const retire = outgoing;
            setTimeout(() => {
                if (retire.canvas.style.opacity === '0') {
                    retire.engine = null;
                    retire.elapsedMs = 0;
                }
            }, this.reducedMotion ? 0 : this.crossfadeMs);
        }
        this._active = this._planes.indexOf(incoming);
    }

    _tick(timestamp) {
        if (!this.running || this.paused) return;
        const dt = this._lastFrameAt
            ? Math.min(timestamp - this._lastFrameAt, MAX_FRAME_MS)
            : 0;
        this._lastFrameAt = timestamp;

        for (const plane of this._planes) {
            if (!plane.engine) continue;
            plane.elapsedMs += dt;
            this._draw(plane);
        }

        if (timestamp >= this._nextRotateAt) {
            this._rotate(false);
            this._nextRotateAt = timestamp + this.dwellMs;
        }
        this._rafId = requestAnimationFrame(this._tick);
    }

    start() {
        if (this.running) return;
        if (this.families.length === 0) return;
        this.running = true;
        this.paused = false;
        this._mount();
        this._cursor = 0;
        this._rotate(true);
        if (this.reducedMotion) return;
        this._lastFrameAt = 0;
        this._nextRotateAt = performance.now() + this.dwellMs;
        this._rafId = requestAnimationFrame(this._tick);
    }

    _cancel() {
        if (this._rafId !== null) cancelAnimationFrame(this._rafId);
        this._rafId = null;
    }

    stop() {
        this.running = false;
        this.paused = false;
        this._remainingRotateMs = 0;
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.engine = null;
                plane.elapsedMs = 0;
            }
        }
    }

    pause() {
        if (!this.running || this.paused) return false;
        this.paused = true;
        this._remainingRotateMs = Math.max(0, this._nextRotateAt - performance.now());
        this._cancel();
        return true;
    }

    resume() {
        if (!this.running || !this.paused) return false;
        this.paused = false;
        this._lastFrameAt = 0;
        this._nextRotateAt = performance.now() + this._remainingRotateMs;
        if (!this.reducedMotion) {
            this._rafId = requestAnimationFrame(this._tick);
        }
        return true;
    }

    setFamilies(families) {
        this.families = normalizeFamilies(families);
        if (this.running && this.families.length === 0) this.stop();
    }

    setCadence({ dwellMs, crossfadeMs } = {}) {
        if (Number.isFinite(dwellMs) && dwellMs > 0) this.dwellMs = dwellMs;
        if (Number.isFinite(crossfadeMs) && crossfadeMs >= 0) {
            this.crossfadeMs = crossfadeMs;
            if (this._planes) {
                for (const plane of this._planes) {
                    plane.canvas.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
                }
            }
        }
    }

    destroy() {
        this.stop();
        this._resizeObserver?.disconnect?.();
        this._resizeObserver = null;
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._resize);
            document.removeEventListener('visibilitychange', this._onVisibility);
        }
        if (this._planes) {
            for (const plane of this._planes) plane.canvas.remove();
        }
        this._planes = null;
    }
}

function normalizeFamilies(families) {
    if (!Array.isArray(families)) return [];
    return families.filter(id => PLATE_FAMILIES.includes(id));
}
