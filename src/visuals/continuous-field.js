/**
 * The Continuous Field — a persistent gallery behind the reading
 * (CONTINUOUS-FIELD-SPEC).
 *
 * NOT a flash source. Where the flash economy presents discrete
 * interrupts that fade the container to black between them, the field
 * is a steady process: a dual-layer double-buffer crossfade that
 * never passes through black, advanced by its own contemplative clock,
 * holding whichever pool the reading provides. It has no flash rate
 * and therefore no flash gate (§5).
 *
 * This module is PURE of the cortex: it is handed a DOM host, a pool
 * accessor (a function returning the current pool's works), and a
 * decode function. It knows nothing of providers, pericopes, or the
 * flash pipeline. The cortex wires those in.
 */

import { ShuffleBag } from '../sources/visual/shuffle-bag.js';

const DEFAULT_DWELL_MS = 10000;      // a work holds ~10s before the next fade
const DEFAULT_CROSSFADE_MS = 2000;   // gentle ~2s dissolve
const MIN_TICK_MS = 250;             // the advance clock's coarsest check

export class ContinuousField {
    /**
     * @param {HTMLElement} host - the container the two layers mount in
     * @param {Object} options
     *   - getPool: () => Array<{ url, fullUrl?, title? }>  the CURRENT
     *       pool's works, re-read every advance so pool growth and cue
     *       swaps are picked up without a reset.
     *   - poolKey: () => string  a stable key for the active pool, so
     *       the ShuffleBag deck resets only when the pool identity
     *       changes (a pericope boundary), not on mere growth.
     *   - decode: (url) => Promise<boolean>  resolves true when the
     *       image at url is decoded and safe to reveal (SacredImage's
     *       decode-before-reveal); false to skip it.
     *   - dwellMs / crossfadeMs: cadence overrides
     *   - reducedMotion: boolean — one still work, no clock, no fades
     *   - now / raf / caf: injectable clock for tests
     */
    constructor(host, options = {}) {
        this.host = host;
        this.getPool = typeof options.getPool === 'function' ? options.getPool : () => [];
        this.poolKey = typeof options.poolKey === 'function' ? options.poolKey : () => 'default';
        this.decode = typeof options.decode === 'function'
            ? options.decode
            : (url) => this._defaultDecode(url);
        this.dwellMs = Number.isFinite(options.dwellMs) ? options.dwellMs : DEFAULT_DWELL_MS;
        this.crossfadeMs = Number.isFinite(options.crossfadeMs) ? options.crossfadeMs : DEFAULT_CROSSFADE_MS;
        this.reducedMotion = !!options.reducedMotion;

        this._now = options.now || (() => performance.now());
        this._raf = options.raf || (cb => requestAnimationFrame(cb));
        this._caf = options.caf || (id => cancelAnimationFrame(id));

        this._bag = new ShuffleBag();
        this._layers = null;      // [imgA, imgB]
        this._front = 0;          // index of the visible layer
        this._currentUrl = null;
        this._running = false;
        this._rafId = null;
        this._nextAdvanceAt = 0;
        this._advanceInFlight = false;
        // A monotone token: an advance whose token is stale when its
        // decode resolves must not enter a layer (the SOL-review
        // principle — the moment that requested it must still exist).
        this._generation = 0;
    }

    /** Mount the two layers (idempotent). */
    _ensureLayers() {
        if (this._layers) return;
        const make = () => {
            const img = document.createElement('img');
            img.className = 'continuous-field-layer';
            img.decoding = 'async';
            img.alt = '';
            img.style.opacity = '0';
            img.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.host.appendChild(img);
            return img;
        };
        this._layers = [make(), make()];
    }

    async _defaultDecode(url) {
        try {
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
            await img.decode();
            return true;
        } catch {
            return false;
        }
    }

    /** Begin the field. Draws the first work, then advances on the clock. */
    start() {
        if (this._running) return;
        this._ensureLayers();
        this._running = true;
        this._generation += 1;
        // First work appears immediately (fades in from transparent —
        // the one benign fade, since there is nothing to dissolve from).
        this._advance(true);
        if (!this.reducedMotion) {
            this._nextAdvanceAt = this._now() + this.dwellMs;
            this._loop();
        }
    }

    _loop() {
        const tick = () => {
            if (!this._running) return;
            const t = this._now();
            if (t >= this._nextAdvanceAt && !this._advanceInFlight) {
                this._nextAdvanceAt = t + this.dwellMs;
                this._advance(false);
            }
            this._rafId = this._raf(tick);
        };
        this._rafId = this._raf(tick);
    }

    /**
     * Pick the next work from the current pool and crossfade to it.
     * @param {boolean} first - the initial reveal (fade in from nothing)
     */
    async _advance(first) {
        const pool = this.getPool() || [];
        if (pool.length === 0) {
            // Cold or emptied pool: hold what is shown (or nothing).
            // The next advance retries; the pin-recovery backoff refills.
            if (first) this._fadeToNothing();
            return;
        }
        this._advanceInFlight = true;
        const generation = this._generation;
        const key = this.poolKey();
        // The bag decks per pool identity: a pericope boundary (new key)
        // starts a fresh no-repeat cycle; growth of the same pool keeps
        // the cycle (ShuffleBag's growth-merge).
        let work = this._bag.draw(key, pool);
        // Skip the current work if the bag handed it back (a 1-item pool
        // legitimately repeats; a larger pool should move on).
        if (work && pool.length > 1 && work.url === this._currentUrl) {
            work = this._bag.draw(key, pool) || work;
        }
        const url = work?.url;
        if (!url) { this._advanceInFlight = false; return; }

        const ok = await this.decode(url);
        // The moment that requested this must still exist, and nothing
        // newer must have superseded it.
        if (!ok || !this._running || generation !== this._generation) {
            this._advanceInFlight = false;
            // a decode failure holds the current work; the next tick retries
            return;
        }
        this._crossfadeTo(url, first);
        this._currentUrl = url;
        this._advanceInFlight = false;
    }

    _crossfadeTo(url, first) {
        if (!this._layers) return;
        if (this.reducedMotion) {
            // One still work, no motion: set it on the front layer at
            // full opacity, no transition.
            const front = this._layers[this._front];
            front.style.transition = 'none';
            front.src = url;
            front.style.opacity = '1';
            return;
        }
        const incoming = this._layers[1 - this._front];
        const outgoing = this._layers[this._front];
        incoming.src = url;
        // Rise the incoming and (unless first) fall the outgoing over the
        // same window — the double-buffer never passes through black.
        // Force a style flush so the transition runs from opacity 0.
        incoming.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
        void incoming.offsetWidth;
        incoming.style.opacity = '1';
        if (!first) {
            outgoing.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            outgoing.style.opacity = '0';
        }
        this._front = 1 - this._front;
    }

    _fadeToNothing() {
        if (!this._layers) return;
        for (const layer of this._layers) {
            layer.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            layer.style.opacity = '0';
        }
        this._currentUrl = null;
    }

    /**
     * The active pool changed (a pericope cue). Advance to the new
     * pool's imagery on the next crossfade — or, when the new pool is
     * works-less (stillness), fade the field to nothing. Increments the
     * generation so any in-flight decode from the old pool is discarded.
     */
    poolChanged() {
        if (!this._running) return;
        this._generation += 1;
        const pool = this.getPool() || [];
        if (pool.length === 0) {
            this._fadeToNothing();
        } else {
            // crossfade to the new episode immediately, not on the next
            // dwell — the scene changed, the field should follow
            this._advance(false);
            this._nextAdvanceAt = this._now() + this.dwellMs;
        }
    }

    /** Stop the field and clear its layers. */
    stop() {
        this._running = false;
        this._generation += 1;
        if (this._rafId != null) { this._caf(this._rafId); this._rafId = null; }
        if (this._layers) {
            for (const layer of this._layers) {
                try { layer.remove(); } catch { /* detached */ }
            }
            this._layers = null;
        }
        this._currentUrl = null;
        this._bag.clear();
    }

    /** Diagnostics: the currently displayed url (or null). */
    get currentUrl() {
        return this._currentUrl;
    }

    get running() {
        return this._running;
    }
}
