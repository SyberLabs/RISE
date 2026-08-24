/**
 * A living field for the engines authored for a work.
 *
 * Animated canvas behind readings for work engines with step(dt).
 * ContinuousField is image-only; this layer advances engines at
 * TIME_SCALE (reading pace, not demo pace) via dt.
 */

import { loadWorkEngines, isWorkEngineFamily } from './work-engines.js';

/**
 * Reading pace, not demo pace. Applied to dt, so it slows rotation,
 * drift, particle travel and decay uniformly — every engine advances
 * its own state from the same clock.
 */
export const TIME_SCALE = 0.3;

/**
 * The largest step any frame may take. A backgrounded tab produces one
 * enormous dt on return; unclamped, an engine integrates the whole
 * absence in a single frame and the field lurches. Clamped, it simply
 * resumes.
 */
const MAX_STEP_SECONDS = 1 / 20;

/** Device pixels are capped: a full-bleed field at DPR 3 is mostly heat. */
const MAX_DPR = 2;

export class WorkEngineField {
    /**
     * @param {HTMLElement} host positioned container the canvases fill
     * @param {Object} options
     * @param {string[]} options.families work-engine family ids to draw from
     * @param {string[]} [options.only] specific engine ids — a figure. When
     *   set, exactly these are drawn and the family is not rotated.
     * @param {number} [options.dwellMs] how long one engine holds
     * @param {number} [options.crossfadeMs] the fade between engines
     * @param {boolean} [options.reducedMotion] draw one frame and hold
     * @param {number} [options.timeScale]
     * @param {() => object} [options.getSignal] semantic signal for step()
     */
    constructor(host, options = {}) {
        this.host = host;
        this.families = (options.families || []).filter(isWorkEngineFamily);
        this.only = Array.isArray(options.only) ? options.only : [];
        this.dwellMs = Math.max(4000, options.dwellMs ?? 20000);
        this.crossfadeMs = Math.max(0, options.crossfadeMs ?? 2400);
        this.reducedMotion = !!options.reducedMotion;
        this.timeScale = options.timeScale ?? TIME_SCALE;
        this.getSignal = typeof options.getSignal === 'function'
            ? options.getSignal
            : () => ({});
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
        this._projectionGeneration = 0;
        this._loadGeneration = 0;
        this._loadInFlight = false;
        this._pendingProjectionLoad = false;
        this._active = 0;
        this._rafId = null;
        this._lastFrameAt = 0;
        this._nextRotateAt = 0;
        this._remainingRotateMs = 0;
        this._cursor = 0;
        this._engines = [];          // [{ familyId, id, engineClass }, ...]
        this._loading = null;

        this._tick = this._tick.bind(this);
        this._resize = this._resize.bind(this);
        this._onVisibility = this._onVisibility.bind(this);
    }

    /** Is any engine actually available to draw? */
    hasEngines() {
        return this._engines.length > 0;
    }

    _mount() {
        if (this._planes) return;
        const make = () => {
            const canvas = document.createElement('canvas');
            canvas.className = 'work-engine-plane';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.opacity = '0';
            canvas.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.host.appendChild(canvas);
            return { canvas, engine: null, entry: null };
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
            const dest = this._projectionPlanes?.[this._planes.indexOf(plane)]?.canvas;
            if (dest) {
                dest.width = w;
                dest.height = h;
            }
            // An engine holding geometry sized to the old canvas must be
            // asked to lay itself out again.
            plane.engine?.generate?.({}, plane.engine.seed);
            if (plane.engine) {
                const painted = this._draw(plane);
                if (!painted && dest) {
                    dest.style.opacity = '0';
                    const ctx = dest.getContext('2d');
                    ctx?.clearRect(0, 0, dest.width, dest.height);
                }
            }
        }
    }

    _onVisibility() {
        if (!this.running || this.paused) return;
        if (document.hidden) {
            this._cancel();
        } else {
            // Resume from now, not from whenever the tab was hidden.
            this._lastFrameAt = 0;
            this._nextRotateAt = performance.now() + this.dwellMs;
            this._rafId = requestAnimationFrame(this._tick);
        }
    }

    /**
     * KEYED ON WHAT IT LOADED, not on whether it has loaded.
     *
     * This was `if (this._loading) return this._loading` — a bare
     * "already done" flag — and the Demonstration showed what that
     * costs. A Journey stops the field at a movement boundary (the
     * transition cue is `still`, so the families go empty) and starts it
     * again on the next movement. The Chamber's sync assigns `families`
     * and `only` directly and calls start(), which bypasses
     * setFamilies() and so never invalidated the promise — and start()
     * awaited a load cached for the PREVIOUS family, adopting its
     * already-narrowed engines.
     *
     * Jünger's movement therefore opened on Milton, and the ASCII trench
     * that should have opened it was never drawn. Nothing threw and
     * nothing warned, because the engines had resolved perfectly well
     * for the wrong movement.
     *
     * A key makes that unrepresentable: the cache answers "these
     * families and this figure" rather than "something, once". Callers
     * may assign the fields directly and it still cannot be wrong.
     */
    async _loadEngines() {
        const families = [...this.families];
        const only = [...this.only];
        const key = `${families.join(',')}|${only.join(',')}`;
        if (this._loading && this._loadedKey === key) return this._loading;
        this._loadedKey = key;
        this._loading = (async () => {
            const collected = [];
            for (const familyId of families) {
                const engines = await loadWorkEngines(familyId);
                for (const entry of engines) collected.push({ ...entry, familyId });
            }
            return this._narrow(collected, only);
        })();
        return this._loading;
    }

    /**
     * Keep only the engines a figure named, in order. A missing engine
     * is an authoring error: do not fall back to the whole family —
     * leave the field still.
     */
    _narrow(all, only = this.only) {
        if (!only.length) return all;
        const found = only
            .map(id => all.find(entry => entry.id === id))
            .filter(Boolean);
        if (found.length !== only.length) {
            const missing = only.filter(id => !all.some(e => e.id === id));
            console.warn('[WorkEngines] figure names engines that do not exist:',
                missing.join(', '));
        }
        return found;
    }

    /**
     * Put the next engine on the inactive plane and cross to it.
     *
     * Both planes animate during the fade, which is the point: two
     * living images dissolving, not a still sliding under a still.
     */
    _rotate(first) {
        if (!this._engines.length || !this._planes) return;
        const entry = this._engines[this._cursor % this._engines.length];
        this._cursor += 1;

        const incoming = first ? this._planes[0] : this._planes[1 - this._active];
        const outgoing = first ? null : this._planes[this._active];

        try {
            incoming.engine = new entry.engineClass();
            incoming.entry = entry;
            incoming.engine.generate?.({}, incoming.engine.seed);
        } catch (error) {
            console.warn(`[WorkEngines] ${entry.familyId}/${entry.id} would not start:`,
                error?.message || error);
            incoming.engine = null;
            incoming.entry = null;
            return;
        }

        // Draw one frame before revealing, so the crossfade never opens
        // on an empty canvas.
        const painted = this._draw(incoming);
        incoming.canvas.style.transition = this.reducedMotion || first
            ? 'none'
            : `opacity ${this.crossfadeMs}ms ease-in-out`;
        incoming.canvas.style.opacity = '1';
        if (painted) {
            if (this.projectionHost) this._syncProjectionFor(incoming);
            else this._reportProjectionPaint();
        }
        if (outgoing) {
            outgoing.canvas.style.opacity = '0';
            // Release the retired engine only once it is invisible.
            const retire = outgoing;
            setTimeout(() => {
                if (retire.canvas.style.opacity === '0') {
                    retire.engine = null;
                    retire.entry = null;
                }
            }, this.reducedMotion ? 0 : this.crossfadeMs);
        }
        this._active = this._planes.indexOf(incoming);
    }

    _draw(plane) {
        if (!plane?.engine) return false;
        try {
            const painted = plane.engine.render(plane.canvas, {
                width: plane.canvas.width,
                height: plane.canvas.height
            }) !== false;
            plane._painted = painted;
            if (painted) this._syncProjectionFor(plane);
            return painted;
        } catch (error) {
            console.warn(`[WorkEngines] ${plane.entry?.familyId}/${plane.entry?.id} failed:`,
                error?.message || error);
            plane.engine = null;
            plane._painted = false;
            return false;
        }
    }

    setProjectionHost(host) {
        if (host === this.host) host = null;
        if (this.projectionHost === host) return;
        const previousHost = this.projectionHost;
        this._teardownProjectionPlanes();
        this.projectionHost = host || null;
        this._projectionGeneration += 1;
        this._pendingProjectionLoad = !!(
            this.running && this._loadInFlight && this.projectionHost
        );
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
            this.projectionHost.querySelectorAll('.work-engine-plane').forEach((node) => {
                try { node.remove(); } catch { /* detached */ }
            });
        }
    }

    _ensureProjectionPlanes() {
        if (!this.projectionHost || !this._planes || this._projectionPlanes) return;
        this._projectionPlanes = this._planes.map((plane) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'work-engine-plane';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.opacity = plane.canvas.style.opacity || '0';
            canvas.style.transition = plane.canvas.style.transition
                || `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.projectionHost.appendChild(canvas);
            return { canvas };
        });
    }

    _syncProjectionFor(plane) {
        if (!plane?._painted || !this._projectionPlanes || !this._planes) return;
        const dest = this._projectionPlanes[this._planes.indexOf(plane)];
        if (!dest) return;
        dest.canvas.style.opacity = plane.canvas.style.opacity;
        dest.canvas.style.transition = plane.canvas.style.transition;
        if (dest.canvas.width !== plane.canvas.width
            || dest.canvas.height !== plane.canvas.height) {
            dest.canvas.width = plane.canvas.width;
            dest.canvas.height = plane.canvas.height;
        }
        const ctx = dest.canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
        ctx.drawImage(plane.canvas, 0, 0);
        if (dest.canvas.style.opacity === '1') this._reportProjectionPaint();
    }

    _reportProjectionPaint() {
        if (this._projectionPainted) return;
        const host = this.projectionHost || this.host;
        if (!host || (!this.projectionHost && this._projectionHostCleared)) return;
        this._projectionPainted = true;
        this.onProjectionPaint(host);
    }

    _tick(timestamp) {
        if (!this.running || this.paused) return;
        const dt = this._lastFrameAt
            ? Math.min((timestamp - this._lastFrameAt) / 1000, MAX_STEP_SECONDS)
            : 0;
        this._lastFrameAt = timestamp;

        const signal = this.getSignal() || {};
        for (const plane of this._planes) {
            if (!plane.engine) continue;
            // A plane at zero opacity mid-retirement still steps, so it
            // is not frozen while it fades out.
            if (dt > 0) {
                try {
                    plane.engine.step?.(dt * this.timeScale, signal);
                } catch (error) {
                    console.warn('[WorkEngines] step failed:', error?.message || error);
                    plane.engine = null;
                    continue;
                }
            }
            this._draw(plane);
        }

        // One engine is a figure, not a rotation: it holds for as long as
        // the figure does.
        if (timestamp >= this._nextRotateAt && this._engines.length > 1) {
            this._rotate(false);
            this._nextRotateAt = timestamp + this.dwellMs;
        }
        this._rafId = requestAnimationFrame(this._tick);
    }

    async start() {
        if (this.running) return;
        this.running = true;
        this.paused = false;
        this._mount();
        return this._loadAndReveal(true, false);
    }

    async _loadAndReveal(first, stopWhenEmpty) {
        const loadGeneration = ++this._loadGeneration;
        const familyKey = `${this.families.join(',')}|${this.only.join(',')}`;
        const projectionGeneration = this._projectionGeneration;
        const projectionHost = this.projectionHost;
        this._loadInFlight = true;
        let candidates;
        try {
            candidates = await this._loadEngines();
        } catch (error) {
            if (loadGeneration === this._loadGeneration) this._loadInFlight = false;
            throw error;
        }
        const currentFamilyKey = `${this.families.join(',')}|${this.only.join(',')}`;
        if (loadGeneration !== this._loadGeneration || familyKey !== currentFamilyKey) return;
        this._loadInFlight = false;
        if (!this.running) return;
        if (projectionGeneration !== this._projectionGeneration
            || projectionHost !== this.projectionHost) {
            if (this._pendingProjectionLoad && this.projectionHost) {
                this._pendingProjectionLoad = false;
                this._loading = null;
                this._engines = [];
                return this._loadAndReveal(first, stopWhenEmpty);
            }
            return;
        }
        this._pendingProjectionLoad = false;
        this._engines = candidates;
        // A family that will not load leaves the field still rather than
        // substituting a general generator (work-engines.js).
        if (!this._engines.length) {
            if (stopWhenEmpty) this.stop();
            return;
        }

        this._cursor = 0;
        this._rotate(first);

        if (this.reducedMotion || this.paused) {
            // One frame, held. The imagery is present; nothing moves.
            return;
        }
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
        this._loadGeneration += 1;
        this._loadInFlight = false;
        this._pendingProjectionLoad = false;
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.engine = null;
                plane.entry = null;
                plane._painted = false;
            }
        }
        if (this._projectionPlanes) {
            for (const plane of this._projectionPlanes) {
                plane.canvas.style.opacity = '0';
                const ctx = plane.canvas.getContext('2d');
                ctx?.clearRect(0, 0, plane.canvas.width, plane.canvas.height);
            }
        }
    }

    /** Hold the live canvases and their engine state at the current frame. */
    pause() {
        if (!this.running || this.paused) return false;
        this.paused = true;
        this._remainingRotateMs = Math.max(0, this._nextRotateAt - performance.now());
        this._cancel();
        return true;
    }

    /** Continue stepping the held engines without a catch-up lurch. */
    resume() {
        if (!this.running || !this.paused) return false;
        this.paused = false;
        this._lastFrameAt = 0;
        this._nextRotateAt = performance.now() + this._remainingRotateMs;
        if (!this.reducedMotion && this._engines.length) {
            this._rafId = requestAnimationFrame(this._tick);
        }
        return true;
    }

    /**
     * Change which families — or which figure — the field draws, without
     * remounting. Called at every cue, so it must be a no-op when the
     * cue asks for what is already on screen; otherwise the field would
     * restart on every atom of a movement and never move at all.
     */
    async setFamilies(families, only = null) {
        const next = (families || []).filter(isWorkEngineFamily);
        const nextOnly = Array.isArray(only) ? only : this.only;
        const same = next.length === this.families.length
            && next.every((id, i) => id === this.families[i])
            && nextOnly.length === this.only.length
            && nextOnly.every((id, i) => id === this.only[i]);
        if (same) return;
        this.families = next;
        this.only = nextOnly;
        this._loading = null;
        this._engines = [];
        if (!this.running) return;
        this._cancel();
        return this._loadAndReveal(false, true);
    }

    setCadence({ dwellMs, crossfadeMs } = {}) {
        if (Number.isFinite(dwellMs)) this.dwellMs = Math.max(4000, dwellMs);
        if (Number.isFinite(crossfadeMs)) this.crossfadeMs = Math.max(0, crossfadeMs);
    }

    destroy() {
        this.stop();
        this._resizeObserver?.disconnect?.();
        this._resizeObserver = null;
        window.removeEventListener('resize', this._resize);
        document.removeEventListener('visibilitychange', this._onVisibility);
        this._teardownProjectionPlanes();
        this.projectionHost = null;
        if (this._planes) {
            for (const plane of this._planes) plane.canvas.remove();
        }
        this._planes = null;
        this._engines = [];
        this._loading = null;
    }
}
