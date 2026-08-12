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

        this.running = false;
        this.paused = false;
        this._planes = null;
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
            // An engine holding geometry sized to the old canvas must be
            // asked to lay itself out again.
            plane.engine?.generate?.({}, plane.engine.seed);
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
        const key = `${this.families.join(',')}|${this.only.join(',')}`;
        if (this._loading && this._loadedKey === key) return this._loading;
        this._loadedKey = key;
        this._loading = (async () => {
            const collected = [];
            for (const familyId of this.families) {
                const engines = await loadWorkEngines(familyId);
                for (const entry of engines) collected.push({ ...entry, familyId });
            }
            this._engines = this._narrow(collected);
            return this._engines;
        })();
        return this._loading;
    }

    /**
     * Keep only the engines a figure named, in order. A missing engine
     * is an authoring error: do not fall back to the whole family —
     * leave the field still.
     */
    _narrow(all) {
        if (!this.only.length) return all;
        const found = this.only
            .map(id => all.find(entry => entry.id === id))
            .filter(Boolean);
        if (found.length !== this.only.length) {
            const missing = this.only.filter(id => !all.some(e => e.id === id));
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
        this._draw(incoming);
        incoming.canvas.style.transition = this.reducedMotion || first
            ? 'none'
            : `opacity ${this.crossfadeMs}ms ease-in-out`;
        incoming.canvas.style.opacity = '1';
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
        if (!plane?.engine) return;
        try {
            plane.engine.render(plane.canvas, {
                width: plane.canvas.width,
                height: plane.canvas.height
            });
        } catch (error) {
            console.warn(`[WorkEngines] ${plane.entry?.familyId}/${plane.entry?.id} failed:`,
                error?.message || error);
            plane.engine = null;
        }
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
        await this._loadEngines();
        // A family that will not load leaves the field still rather than
        // substituting a general generator (work-engines.js).
        if (!this._engines.length || !this.running) return;

        this._cursor = 0;
        this._rotate(true);

        if (this.reducedMotion) {
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
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.engine = null;
                plane.entry = null;
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
        await this._loadEngines();
        if (!this.running) return;
        if (!this._engines.length) {
            this.stop();
            this.running = false;
            return;
        }
        this._cursor = 0;
        this._rotate(false);
        if (this.reducedMotion || this.paused) return;
        this._lastFrameAt = 0;
        this._nextRotateAt = performance.now() + this.dwellMs;
        this._rafId = requestAnimationFrame(this._tick);
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
        if (this._planes) {
            for (const plane of this._planes) plane.canvas.remove();
        }
        this._planes = null;
        this._engines = [];
        this._loading = null;
    }
}
