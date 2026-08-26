/**
 * Gallery plates — Iris and Spectral draw across the dwell.
 *
 * ContinuousField is image-only. Harmonograph already has a living
 * layer; this is that layer for Ostensoria and Apparitio. The engines
 * generate a finished plate once per dwell; the time adapter reveals
 * it. The bake is prefetched during the previous dwell and sliced
 * across frames (~8 ms each) so the seam is a blit, not a 500–900 ms
 * freeze. After the first plate, the reveal waits out the dissolve so the
 * birth is visible, then the remaining dwell is travel plus a few
 * seconds of stillness. Full-frame and behind-stream keep a finished
 * still. Reduced motion holds the completed plate.
 */

import { Ostensoria } from './ostensoria.js';
import { reportProjectionPaint } from './projection-paint.js';
import { Apparitio } from './apparitio.js';
import {
    GALLERY_CADENCE_DEFAULT,
    galleryCadenceTimings,
    galleryDrawProgress
} from '../core/visual-presence.js';
import { PLATE_BAKE_BUDGET_MS } from './plate-bake.js';

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
        this.onProjectionPaint = typeof options.onProjectionPaint === 'function'
            ? options.onProjectionPaint
            : () => {};

        this.running = false;
        this.paused = false;
        this.projectionHost = null;
        this._planes = null;
        this._projectionPlanes = null;
        this._projectionPainted = false;
        this._projectionHostCleared = false;
        this._active = 0;
        this._cursor = 0;
        this._rafId = null;
        this._lastFrameAt = 0;
        this._nextRotateAt = 0;
        this._remainingRotateMs = 0;
        this._pending = null;
        this._hot = null;

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
            return { canvas, engine: null, elapsedMs: 0, holdPenMs: 0, drawDwellMs: 0 };
        };
        this._planes = [make(), make()];
        this._ensureProjectionPlanes();

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
            // Setting width/height clears the bitmap. A finished plate
            // must be blitted again or the plane stays void.
            plane._drawnComplete = false;
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
        if ((plane.holdPenMs || 0) > 0) return 0;
        const dwell = Number.isFinite(plane.drawDwellMs) && plane.drawDwellMs > 0
            ? plane.drawDwellMs
            : this.dwellMs;
        return galleryDrawProgress(plane.elapsedMs, dwell);
    }

    _draw(plane) {
        if (!plane?.engine) return;
        const progress = this._progress(plane);
        if (progress >= 1 && plane._drawnComplete) {
            this._syncProjectionFor(plane);
            return;
        }
        const ok = plane.engine.render(plane.canvas, { progress });
        plane._painted = ok !== false;
        if (progress >= 1 && ok) plane._drawnComplete = true;
        this._syncProjectionFor(plane);
    }

    /**
     * A second live mount of the same plate clock. One field, two clips.
     */
    setProjectionHost(host) {
        if (host === this.host) host = null;
        if (this.projectionHost === host) return;
        const previousHost = this.projectionHost;
        this._teardownProjectionPlanes();
        this.projectionHost = host || null;
        this._projectionPainted = false;
        this._projectionHostCleared = !!previousHost && !this.projectionHost;
        if (!this.projectionHost || !this._planes) return;
        this._ensureProjectionPlanes();
        for (const plane of this._planes) this._syncProjectionFor(plane);
    }

    _teardownProjectionPlanes() {
        if (this._projectionPlanes) {
            for (const plane of this._projectionPlanes) {
                try { plane.canvas.remove(); } catch { /* detached */ }
            }
        }
        this._projectionPlanes = null;
        if (this.projectionHost) {
            this.projectionHost.querySelectorAll('.plate-plane').forEach((node) => {
                try { node.remove(); } catch { /* detached */ }
            });
        }
    }

    _ensureProjectionPlanes() {
        if (!this.projectionHost || !this._planes || this._projectionPlanes) return;
        this._projectionPlanes = this._planes.map((plane) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'plate-plane';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.opacity = plane.canvas.style.opacity || '0';
            canvas.style.transition = plane.canvas.style.transition
                || `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.projectionHost.appendChild(canvas);
            return { canvas };
        });
    }

    _syncProjectionFor(plane) {
        if (!this._projectionPlanes || !this._planes) return;
        const dest = this._projectionPlanes[this._planes.indexOf(plane)];
        if (!dest) return;
        dest.canvas.style.opacity = plane.canvas.style.opacity;
        dest.canvas.style.transition = plane.canvas.style.transition;
        if (dest.canvas.width !== plane.canvas.width
            || dest.canvas.height !== plane.canvas.height) {
            dest.canvas.width = plane.canvas.width;
            dest.canvas.height = plane.canvas.height;
        }
        if (!plane.engine || !plane._painted) return;
        // Copy the plane we just drew rather than running the engine a
        // second time. _draw() stops re-rendering a finished plate, but the
        // projection used to re-render it every frame for the rest of the
        // dwell. Same pixels, one render. AttractorField blits the same way.
        const ctx = dest.canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
        ctx.drawImage(plane.canvas, 0, 0);
        if (dest.canvas.style.opacity === '1') reportProjectionPaint(this);
    }

    _rotate(first) {
        if (!this._planes || this.families.length === 0) return;
        const incoming = first ? this._planes[0] : this._planes[1 - this._active];
        const outgoing = first ? null : this._planes[this._active];
        const id = this.families[this._cursor % this.families.length];
        this._cursor += 1;
        const Engine = ENGINES[id];
        if (!Engine) return;
        const engine = this._takeEngine(id, this._cursor);
        incoming.engine = engine;
        incoming.family = id;
        incoming.elapsedMs = this.reducedMotion ? this.dwellMs : 0;
        incoming.holdPenMs = this.reducedMotion || first ? 0 : this.crossfadeMs;
        incoming.drawDwellMs = Math.max(1, this.dwellMs - incoming.holdPenMs);
        incoming._drawnComplete = false;
        this._draw(incoming);
        if (!incoming._painted) {
            incoming.canvas.style.opacity = '0';
            incoming.engine = null;
            return;
        }
        incoming.canvas.style.transition = this.reducedMotion || first
            ? 'none'
            : `opacity ${this.crossfadeMs}ms ease-in-out`;
        incoming.canvas.style.opacity = '1';
        if (this.projectionHost) this._syncProjectionFor(incoming);
        else if (incoming._painted) reportProjectionPaint(this);
        if (outgoing) {
            outgoing.canvas.style.opacity = '0';
            const retire = outgoing;
            setTimeout(() => {
                if (retire.canvas.style.opacity === '0') {
                    retire.engine = null;
                    retire.elapsedMs = 0;
                    retire.holdPenMs = 0;
                }
            }, this.reducedMotion ? 0 : this.crossfadeMs);
        }
        this._active = this._planes.indexOf(incoming);
        this._startBake();
    }

    _abortBake() {
        this._pending = null;
        this._hot = null;
    }

    /**
     * The next plate is baked during the current dwell, so its signal is read
     * a dwell earlier than the plate appears. A gallery plate answers the
     * reading it was begun under rather than the one it opens on.
     */
    _startBake() {
        // Reduced motion never rotates, so there is nothing to bake ahead.
        if (this.reducedMotion) return;
        if (this._pending || this._hot) return;
        if (!this.families.length) return;
        const cursor = this._cursor + 1;
        const id = this.families[(cursor - 1) % this.families.length];
        const Engine = ENGINES[id];
        if (!Engine) return;
        const engine = new Engine();
        const seed = `gallery-plate:${id}:${cursor}`;
        if (typeof engine.beginBake === 'function') {
            engine.beginBake(this.getSignal() || null, seed);
            this._pending = { engine, family: id, cursor };
        } else {
            engine.generate(this.getSignal() || null, seed);
            this._hot = { engine, family: id, cursor };
        }
    }

    _pumpBake() {
        const pending = this._pending;
        if (!pending?.engine) return;
        if (typeof pending.engine.stepBake === 'function') {
            pending.engine.stepBake(PLATE_BAKE_BUDGET_MS);
        }
        if (pending.engine.ready) {
            this._hot = pending;
            this._pending = null;
        }
    }

    _takeEngine(id, cursor) {
        const hot = this._hot;
        if (hot && hot.family === id && hot.cursor === cursor && hot.engine?.ready) {
            this._hot = null;
            return hot.engine;
        }
        const pending = this._pending;
        if (pending && pending.family === id && pending.cursor === cursor) {
            if (typeof pending.engine.stepBake === 'function') {
                pending.engine.stepBake(1e9);
            }
            this._pending = null;
            if (pending.engine.ready) return pending.engine;
        }
        this._abortBake();
        const Engine = ENGINES[id];
        const engine = new Engine();
        engine.generate(this.getSignal() || null, `gallery-plate:${id}:${cursor}`);
        return engine;
    }

    _advance(plane, dt) {
        if (!plane?.engine) return;
        let remaining = dt;
        if (plane.holdPenMs > 0) {
            if (remaining <= plane.holdPenMs) {
                plane.holdPenMs -= remaining;
                return;
            }
            remaining -= plane.holdPenMs;
            plane.holdPenMs = 0;
        }
        plane.elapsedMs += remaining;
        this._draw(plane);
    }

    _tick(timestamp) {
        if (!this.running || this.paused) return;
        const dt = this._lastFrameAt
            ? Math.min(timestamp - this._lastFrameAt, MAX_FRAME_MS)
            : 0;
        this._lastFrameAt = timestamp;

        this._pumpBake();

        const plane = this._planes[this._active];
        this._advance(plane, dt);

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
        this._resize();
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
        this._abortBake();
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.engine = null;
                plane.elapsedMs = 0;
                plane.holdPenMs = 0;
                plane._drawnComplete = false;
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
        this._abortBake();
        if (this.running && this.families.length === 0) this.stop();
        else if (this.running && !this.reducedMotion) this._startBake();
    }

    setCadence({ dwellMs, crossfadeMs } = {}) {
        if (Number.isFinite(dwellMs) && dwellMs > 0) this.dwellMs = dwellMs;
        if (Number.isFinite(crossfadeMs) && crossfadeMs >= 0) {
            this.crossfadeMs = crossfadeMs;
            if (this._planes) {
                for (const plane of this._planes) {
                    plane.canvas.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
                    this._syncProjectionFor(plane);
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
        this._teardownProjectionPlanes();
        this.projectionHost = null;
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
