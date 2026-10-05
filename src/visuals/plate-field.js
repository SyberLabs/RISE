/**
 * Gallery plates — Iris and Spectral draw across the dwell.
 *
 * ContinuousField is image-only. Harmonograph already has a living
 * layer; this is that layer for Ostensoria and Apparitio. The engines
 * generate a finished plate once per dwell; the time adapter reveals
 * it. The bake is prefetched during the previous dwell and sliced
 * across frames (~8 ms each) so the seam is a blit, not a 500–900 ms
 * freeze. After the first plate, each plate is born over the one before:
 * its reveal starts at once on top of the finished plate, which holds until
 * the new one is half drawn and then dissolves away, so the screen never
 * passes through the empty ground. The rest of the dwell is travel plus a
 * few seconds of stillness. Full-frame and behind-stream keep a finished
 * still. Reduced motion holds the completed plate.
 *
 * With `sliceFirstPlate`, the first plate is baked the same sliced way and
 * start() resolves once it is drawn (Home's reading backdrop). Without it,
 * start() draws the first plate before it returns (the Chamber).
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
import { PLATE_VOID } from './plate-draw.js';

const MAX_DPR = 2;
const MAX_FRAME_MS = 50;
/** The plate before stays whole beneath the new one until it is this far drawn. */
const UNDERLAY_HOLD_PROGRESS = 0.5;

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
     *   - sliceFirstPlate  bake the first plate in slices too; start()
     *     resolves true once it is drawn, false if stopped before
     */
    constructor(host, options = {}) {
        this.host = host;
        const fallback = galleryCadenceTimings(GALLERY_CADENCE_DEFAULT);
        this.dwellMs = Number.isFinite(options.dwellMs) ? options.dwellMs : fallback.dwellMs;
        this.crossfadeMs = Number.isFinite(options.crossfadeMs)
            ? options.crossfadeMs
            : fallback.crossfadeMs;
        this.reducedMotion = !!options.reducedMotion;
        this.sliceFirstPlate = !!options.sliceFirstPlate;
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
        // Set while the first plate is still baking in slices.
        this._resolveFirstPlate = null;
        this._firstPlate = Promise.resolve(false);

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
            return { canvas, engine: null, elapsedMs: 0, drawDwellMs: 0, underlay: null };
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
        // A plate laid beneath another is repainted first, so the one above
        // never composes over a cleared canvas.
        const ordered = [...this._planes].sort((a, b) => Number(!!a.underlay) - Number(!!b.underlay));
        for (const plane of ordered) {
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
            this._requestFrame();
        }
    }

    _progress(plane) {
        if (this.reducedMotion) return 1;
        const dwell = Number.isFinite(plane.drawDwellMs) && plane.drawDwellMs > 0
            ? plane.drawDwellMs
            : this.dwellMs;
        return galleryDrawProgress(plane.elapsedMs, dwell);
    }

    _draw(plane) {
        if (!plane?.engine) return;
        const progress = this._progress(plane);
        if (progress >= 1 && plane._drawnComplete && !plane.underlay) {
            this._syncProjectionFor(plane);
            return;
        }
        const ok = plane.underlay
            ? plane.engine.render(plane.canvas, { progress, clearGround: true })
            : plane.engine.render(plane.canvas, { progress });
        plane._painted = ok !== false;
        if (plane._painted && plane.underlay) this._drawUnderlay(plane);
        if (progress >= 1 && ok && !plane.underlay) plane._drawnComplete = true;
        this._syncProjectionFor(plane);
    }

    /** Lay the plate before beneath this plate's reveal, on the void. */
    _drawUnderlay(plane) {
        const ctx = plane.canvas.getContext?.('2d');
        if (!ctx) return;
        const { width, height } = plane.canvas;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = plane.underlay.alpha;
        ctx.drawImage(plane.underlay.canvas, 0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = PLATE_VOID;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
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
        incoming.drawDwellMs = this.dwellMs;
        incoming.underlay = outgoing && !this.reducedMotion
            ? { canvas: outgoing.canvas, alpha: 1, fadedMs: 0 }
            : null;
        incoming._drawnComplete = false;
        this._draw(incoming);
        if (!incoming._painted) {
            incoming.canvas.style.opacity = '0';
            incoming.engine = null;
            incoming.underlay = null;
            return;
        }
        // The plate before is drawn inside the incoming canvas, beneath its
        // reveal, so the planes swap in the same frame with nothing to dissolve.
        incoming.canvas.style.transition = 'none';
        incoming.canvas.style.opacity = '1';
        if (this.projectionHost) this._syncProjectionFor(incoming);
        else if (incoming._painted) reportProjectionPaint(this);
        if (outgoing) {
            outgoing.underlay = null;
            outgoing.canvas.style.transition = 'none';
            outgoing.canvas.style.opacity = '0';
            // The projection is told to leave too. It never was: a plane
            // only synced while it was INCOMING, so its copy stayed at
            // full opacity for good, and from the third rotation on the
            // outgoing copy — later in the DOM, and therefore on top —
            // covered the plate that had just arrived.
            if (this.projectionHost) this._syncProjectionFor(outgoing);
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
        // Reduced motion never rotates, so there is nothing to bake ahead
        // beyond the first plate.
        if (this.reducedMotion && !this._resolveFirstPlate) return;
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
        plane.elapsedMs += dt;
        const underlay = plane.underlay;
        if (underlay && this._progress(plane) >= UNDERLAY_HOLD_PROGRESS) {
            underlay.fadedMs += dt;
            underlay.alpha = Math.max(0, 1 - underlay.fadedMs / Math.max(1, this.crossfadeMs));
            if (underlay.alpha <= 0) {
                plane.underlay = null;
                this._retire(underlay.canvas);
            }
        }
        this._draw(plane);
    }

    /** The plate before has fully dissolved: release its engine. */
    _retire(canvas) {
        const retired = this._planes?.find(plane => plane.canvas === canvas);
        if (!retired || retired.canvas.style.opacity !== '0') return;
        retired.engine = null;
        retired.elapsedMs = 0;
    }

    _tick(timestamp) {
        if (!this.running || this.paused) return;
        const dt = this._lastFrameAt
            ? Math.min(timestamp - this._lastFrameAt, MAX_FRAME_MS)
            : 0;
        this._lastFrameAt = timestamp;

        this._pumpBake();

        if (this._resolveFirstPlate) {
            if (this._hot) this._showFirstPlate();
            if (this._resolveFirstPlate) {
                this._requestFrame();
                return;
            }
        }
        // Reduced motion holds one still: nothing advances or rotates.
        if (this.reducedMotion) {
            this._rafId = null;
            return;
        }

        const plane = this._planes[this._active];
        this._advance(plane, dt);

        // A bake still in slices is waited for, never finished here: on a
        // slow phone that one call froze the reading for seconds.
        if (timestamp >= this._nextRotateAt && !this._pending) {
            this._rotate(false);
            this._nextRotateAt = timestamp + this.dwellMs;
        }
        this._requestFrame();
    }

    start() {
        if (this.running) return this._firstPlate;
        if (this.families.length === 0) return Promise.resolve(false);
        this.running = true;
        this.paused = false;
        this._mount();
        this._cursor = 0;
        this._lastFrameAt = 0;
        if (this.sliceFirstPlate) {
            this._firstPlate = new Promise((resolve) => { this._resolveFirstPlate = resolve; });
            this._startBake();
            this._requestFrame();
            return this._firstPlate;
        }
        this._rotate(true);
        this._resize();
        this._firstPlate = Promise.resolve(!!this._planes[0]._painted);
        if (this.reducedMotion) return this._firstPlate;
        this._nextRotateAt = performance.now() + this.dwellMs;
        this._requestFrame();
        return this._firstPlate;
    }

    /** The sliced first bake is done: show it, then run as start() would. */
    _showFirstPlate() {
        const resolve = this._resolveFirstPlate;
        this._resolveFirstPlate = null;
        this._rotate(true);
        this._resize();
        this._nextRotateAt = performance.now() + this.dwellMs;
        resolve(!!this._planes[0]._painted);
    }

    _settleFirstPlate() {
        const resolve = this._resolveFirstPlate;
        this._resolveFirstPlate = null;
        resolve?.(false);
    }

    /** One frame loop: a frame still pending (a hidden tab holds it) is replaced. */
    _requestFrame() {
        this._cancel();
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
        this._settleFirstPlate();
        this._abortBake();
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.engine = null;
                plane.elapsedMs = 0;
                plane.underlay = null;
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
        if (!this.reducedMotion || this._resolveFirstPlate) {
            this._requestFrame();
        }
        return true;
    }

    setFamilies(families) {
        const next = normalizeFamilies(families);
        // The same families again keep the bake under way.
        if (next.length === this.families.length && next.every((id, i) => id === this.families[i])) return;
        this.families = next;
        this._abortBake();
        if (this.running && this.families.length === 0) this.stop();
        else if (this.running) this._startBake();
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
