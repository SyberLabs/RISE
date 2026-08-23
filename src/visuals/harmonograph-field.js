/**
 * Gallery Harmonograph — the pen travels across the dwell.
 *
 * ContinuousField is image-only. Work-engine families already have a
 * living layer under the gallery; this is that layer for Harmonograph
 * alone. Full-frame and behind-stream keep a finished still. Reduced
 * motion draws one complete figure and holds it.
 *
 * After the first figure, the pen waits out the dissolve. The incoming
 * plane fades in empty; drawing starts once it is opaque. The remaining
 * dwell is then travel plus a few seconds of stillness before the next
 * work.
 */

import { Harmonograph } from './harmonograph.js';
import { KLEE_CHAMBER_BACKGROUND } from './klee-enhanced.js';
import {
    GALLERY_CADENCE_DEFAULT,
    galleryCadenceTimings,
    harmonographDrawProgress
} from '../core/visual-presence.js';

const MAX_DPR = 2;
const MAX_FRAME_MS = 50;

export class HarmonographField {
    /**
     * @param {HTMLElement} host
     * @param {Object} options
     *   - dwellMs / crossfadeMs
     *   - reducedMotion
     *   - getSignal / getClimate
     */
    constructor(host, options = {}) {
        this.host = host;
        const fallback = galleryCadenceTimings(GALLERY_CADENCE_DEFAULT);
        this.dwellMs = Number.isFinite(options.dwellMs) ? options.dwellMs : fallback.dwellMs;
        this.crossfadeMs = Number.isFinite(options.crossfadeMs)
            ? options.crossfadeMs
            : fallback.crossfadeMs;
        this.reducedMotion = !!options.reducedMotion;
        this.getSignal = typeof options.getSignal === 'function'
            ? options.getSignal
            : () => null;
        this.getClimate = typeof options.getClimate === 'function'
            ? options.getClimate
            : () => 'auto';

        this.running = false;
        this.paused = false;
        this.projectionHost = null;
        this._planes = null;
        this._projectionPlanes = null;
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
            canvas.className = 'harmonograph-plane';
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
        return harmonographDrawProgress(plane.elapsedMs, dwell);
    }

    _draw(plane) {
        if (!plane?.engine) return;
        plane.engine.render(plane.canvas, {
            backgroundColor: KLEE_CHAMBER_BACKGROUND,
            progress: this._progress(plane)
        });
        this._syncProjectionFor(plane);
    }

    /**
     * A second live mount of the same pen. One clock, two clips —
     * not a second Harmonograph and not a second director.
     */
    setProjectionHost(host) {
        if (host === this.host) host = null;
        if (this.projectionHost === host) return;
        this._teardownProjectionPlanes();
        this.projectionHost = host || null;
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
            this.projectionHost.querySelectorAll('.harmonograph-plane').forEach((node) => {
                try { node.remove(); } catch { /* detached */ }
            });
        }
    }

    _ensureProjectionPlanes() {
        if (!this.projectionHost || !this._planes || this._projectionPlanes) return;
        this._projectionPlanes = this._planes.map((plane) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'harmonograph-plane';
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
        if (!plane.engine) return;
        // Copy the plane we just drew rather than tracing the figure a
        // second time. Same pixels, one render. AttractorField blits the
        // same way.
        const ctx = dest.canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
        ctx.drawImage(plane.canvas, 0, 0);
    }

    _rotate(first) {
        if (!this._planes) return;
        const incoming = first ? this._planes[0] : this._planes[1 - this._active];
        const outgoing = first ? null : this._planes[this._active];
        const engine = new Harmonograph();
        this._cursor += 1;
        engine.generate(this.getSignal() || null, `gallery-hg:${this._cursor}`, {
            climate: this.getClimate() || 'auto'
        });
        incoming.engine = engine;
        incoming.elapsedMs = this.reducedMotion ? this.dwellMs : 0;
        incoming.holdPenMs = this.reducedMotion || first ? 0 : this.crossfadeMs;
        incoming.drawDwellMs = Math.max(1, this.dwellMs - incoming.holdPenMs);
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
                    retire.holdPenMs = 0;
                }
            }, this.reducedMotion ? 0 : this.crossfadeMs);
        }
        this._active = this._planes.indexOf(incoming);
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
                plane.holdPenMs = 0;
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
