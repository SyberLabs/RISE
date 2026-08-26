
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
 * This module is PURE of the cortex: it is handed a DOM host, either a pool
 * accessor or an asynchronous next-work adapter, and a decode function. It
 * knows nothing of providers, generators, pericopes, or the flash pipeline.
 * The cortex wires those in.
 */

import { ShuffleBag } from '../sources/visual/shuffle-bag.js';
import {
    GALLERY_CADENCE_DEFAULT,
    galleryCadenceTimings
} from '../core/visual-presence.js';
import {
    applyArtworkLabelElement,
    displayedArtworkLabel
} from './artwork-label.js';
import { createRemoteImage } from './remote-image.js';
import { reportProjectionPaint } from './projection-paint.js';

const DEFAULT_TIMINGS = galleryCadenceTimings(GALLERY_CADENCE_DEFAULT);

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Resolve the visible rectangle of an `object-fit: contain` image.
 * Keeping this as pure geometry gives the label and the artwork one shared
 * definition of "the displayed image", independent of browser paint timing.
 */
export function containedArtworkBounds(
    frameWidth,
    frameHeight,
    naturalWidth,
    naturalHeight
) {
    const fw = Number(frameWidth);
    const fh = Number(frameHeight);
    const nw = Number(naturalWidth);
    const nh = Number(naturalHeight);
    if (![fw, fh, nw, nh].every(value => Number.isFinite(value) && value > 0)) {
        return null;
    }

    const scale = Math.min(fw / nw, fh / nh);
    const width = nw * scale;
    const height = nh * scale;
    const left = (fw - width) / 2;
    const top = (fh - height) / 2;
    return Object.freeze({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height
    });
}

/**
 * True only when `contain` leaves a visually meaningful matte.
 *
 * The threshold is the uncovered share of either viewport axis, not total
 * area. This maps directly to the bars a reader perceives and avoids paying
 * for a filtered full-screen duplicate to cover sub-pixel rounding or tiny
 * aspect-ratio differences.
 */
export function needsAdaptiveImageWash({
    frameWidth,
    frameHeight,
    naturalWidth,
    naturalHeight,
    minimumMatteRatio = 0.02
} = {}) {
    const artwork = containedArtworkBounds(
        frameWidth,
        frameHeight,
        naturalWidth,
        naturalHeight
    );
    const threshold = Number(minimumMatteRatio);
    if (!artwork || !Number.isFinite(threshold) || threshold < 0) return false;

    const horizontalMatte = Math.max(0, 1 - (artwork.width / Number(frameWidth)));
    const verticalMatte = Math.max(0, 1 - (artwork.height / Number(frameHeight)));
    return Math.max(horizontalMatte, verticalMatte) > threshold;
}

function placementForMode(mode, frame, artwork, label, padding, gap) {
    const { width: frameWidth, height: frameHeight } = frame;
    const { width: labelWidth, height: labelHeight } = label;

    switch (mode) {
        case 'outside-left':
            return {
                mode,
                left: padding,
                top: frameHeight - padding - labelHeight,
                maxWidth: artwork.left - gap - padding
            };
        case 'outside-right':
            return {
                mode,
                left: frameWidth - padding - labelWidth,
                top: frameHeight - padding - labelHeight,
                maxWidth: frameWidth - padding - artwork.right - gap
            };
        case 'outside-bottom':
            return {
                mode,
                left: frameWidth - padding - labelWidth,
                top: frameHeight - padding - labelHeight,
                maxWidth: frameWidth - (2 * padding)
            };
        case 'outside-top':
            return {
                mode,
                left: frameWidth - padding - labelWidth,
                top: padding,
                maxWidth: frameWidth - (2 * padding)
            };
        default:
            return {
                mode: 'inside',
                left: artwork.right - padding - labelWidth,
                top: clamp(
                    artwork.bottom - padding - labelHeight,
                    artwork.top + padding,
                    artwork.bottom - padding - labelHeight
                ),
                maxWidth: artwork.width - (2 * padding)
            };
    }
}

/**
 * Choose one of two legal attribution relationships:
 *   1. wholly in the matte outside the contained artwork, separated by `gap`;
 *   2. wholly inside the artwork, inset by `padding`.
 *
 * A candidate matte must contain the complete measured label. This prevents
 * the former half-on / half-off placement when a portrait or panorama leaves
 * substantial adaptive borders.
 */
export function resolveGalleryLabelPlacement({
    frameWidth,
    frameHeight,
    naturalWidth,
    naturalHeight,
    labelWidth,
    labelHeight,
    padding = 18,
    gap = 12
} = {}) {
    const artwork = containedArtworkBounds(
        frameWidth,
        frameHeight,
        naturalWidth,
        naturalHeight
    );
    const dimensions = [
        frameWidth,
        frameHeight,
        labelWidth,
        labelHeight,
        padding,
        gap
    ].map(Number);
    if (!artwork || !dimensions.every(value => Number.isFinite(value) && value >= 0)) {
        return null;
    }

    const [
        fw,
        fh,
        lw,
        lh,
        safePadding,
        safeGap
    ] = dimensions;
    const frame = { width: fw, height: fh };
    const label = { width: lw, height: lh };
    const fullHeightFits = lh <= fh - (2 * safePadding);
    const fullWidthFits = lw <= fw - (2 * safePadding);

    // The attribution grammar is lower-right: a portrait prefers its right
    // matte; a panorama prefers its lower matte. Left/top are fallbacks only
    // for asymmetric future artwork positioning.
    const candidates = [
        {
            mode: 'outside-right',
            fits: fullHeightFits
                && lw <= fw - artwork.right - safeGap - safePadding
        },
        {
            mode: 'outside-bottom',
            fits: fullWidthFits
                && lh <= fh - artwork.bottom - safeGap - safePadding
        },
        {
            mode: 'outside-left',
            fits: fullHeightFits
                && lw <= artwork.left - safeGap - safePadding
        },
        {
            mode: 'outside-top',
            fits: fullWidthFits
                && lh <= artwork.top - safeGap - safePadding
        }
    ];
    const outside = candidates.find(candidate => candidate.fits);
    const placement = placementForMode(
        outside?.mode || 'inside',
        frame,
        artwork,
        label,
        safePadding,
        safeGap
    );

    return Object.freeze({
        ...placement,
        padding: safePadding,
        gap: safeGap,
        artwork
    });
}

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
     *   - getNextWork: async ({ currentUrl }) => { url, title? } | null
     *       optional source adapter for generated works. When present it
     *       owns selection/materialization; the field remains a presenter.
     *   - getNextProjectionWork: async ({ currentUrl }) => { url, title? } | null
     *       optional adapter for a distinct word-fill playlist. Same clock
     *       as getNextWork; used when the projection is not a URL pool.
     *   - hasWorks: () => boolean  whether the current identity has either
     *       ready or generatable works (used on live pool changes).
     *   - dwellMs / crossfadeMs: cadence overrides
     *   - reducedMotion: boolean — one still work, no clock, no fades
     *   - showArtworkLabels: boolean — optional title/artist labels
     *   - now / raf / caf: injectable clock for tests
     */
    constructor(host, options = {}) {
        this.host = host;
        this.getPool = typeof options.getPool === 'function' ? options.getPool : () => [];
        this.poolKey = typeof options.poolKey === 'function' ? options.poolKey : () => 'default';
        this.getProjectionPool = typeof options.getProjectionPool === 'function'
            ? options.getProjectionPool
            : null;
        this.projectionPoolKey = typeof options.projectionPoolKey === 'function'
            ? options.projectionPoolKey
            : () => 'projection';
        this.getNextWork = typeof options.getNextWork === 'function'
            ? options.getNextWork
            : null;
        this.getNextProjectionWork = typeof options.getNextProjectionWork === 'function'
            ? options.getNextProjectionWork
            : null;
        this.hasWorks = typeof options.hasWorks === 'function'
            ? options.hasWorks
            : () => (this.getPool() || []).length > 0;
        this.decode = typeof options.decode === 'function'
            ? options.decode
            : (url) => this._defaultDecode(url);
        this.dwellMs = Number.isFinite(options.dwellMs) ? options.dwellMs : DEFAULT_TIMINGS.dwellMs;
        this.crossfadeMs = Number.isFinite(options.crossfadeMs)
            ? options.crossfadeMs
            : DEFAULT_TIMINGS.crossfadeMs;
        this._nextCrossfadeMs = null;
        this.reducedMotion = !!options.reducedMotion;
        this.showArtworkLabels = options.showArtworkLabels !== false;
        this.onProjectionPaint = typeof options.onProjectionPaint === 'function'
            ? options.onProjectionPaint
            : () => {};

        this._now = options.now || (() => performance.now());
        this._raf = options.raf || (cb => requestAnimationFrame(cb));
        this._caf = options.caf || (id => cancelAnimationFrame(id));

        this._bag = new ShuffleBag();
        this._projectionBag = new ShuffleBag();
        this._layers = null;      // [{ root, backdrop, artwork, label, work, projection? }, ...]
        this.projectionHost = null;
        this._projectionPainted = false;
        this._projectionHostCleared = false;
        this._front = 0;          // index of the visible layer
        this._currentUrl = null;
        this._currentProjectionUrl = null;
        this._running = false;
        this._paused = false;
        this._rafId = null;
        this._nextAdvanceAt = 0;
        this._remainingDwellMs = 0;
        this._pendingPoolChange = null;
        this._advanceInFlight = false;
        this._pendingProjectionAdvance = false;
        this._resizeObserver = null;
        this._boundRefreshLayers = () => this._refreshLayerGeometry();
        // A monotone token: an advance whose token is stale when its
        // decode resolves must not enter a layer (the SOL-review
        // principle — the moment that requested it must still exist).
        this._generation = 0;
        this._projectionGeneration = 0;
    }

    /**
     * Apply a new presentation cadence without remounting or changing the
     * current work. A live clock restarts its dwell from the user's change;
     * the next transition and every mounted layer use the new dissolve.
     */
    setCadence({ dwellMs, crossfadeMs } = {}) {
        if (Number.isFinite(dwellMs) && dwellMs > 0) this.dwellMs = dwellMs;
        if (Number.isFinite(crossfadeMs) && crossfadeMs >= 0) {
            this.crossfadeMs = crossfadeMs;
        }
        if (this._layers && !this.reducedMotion) {
            for (const layer of this._layers) {
                layer.root.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
                if (layer.projection) {
                    layer.projection.root.style.transition = layer.root.style.transition;
                }
            }
        }
        if (this._running && !this.reducedMotion) {
            if (this._paused) this._remainingDwellMs = this.dwellMs;
            else this._nextAdvanceAt = this._now() + this.dwellMs;
        }
    }

    setArtworkLabelsVisible(visible) {
        this.showArtworkLabels = visible !== false;
        if (!this._layers) return;
        for (const layer of this._layers) this._renderLayerLabel(layer);
    }

    /**
     * A second live mount of the same clock. `_crossfadeTo` writes the
     * same urls and opacities onto image pairs in this host. Labels stay
     * on the gallery host. This is not a second field and not cloneNode
     * of a detached tree.
     */
    setProjectionHost(host) {
        // Projecting into our own host would make _teardownProjectionLayers
        // sweep this field's real layers out of the gallery. PlateField,
        // HarmonographField and AttractorField all guard the same way.
        if (host === this.host) host = null;
        if (this.projectionHost === host) return;
        const previousHost = this.projectionHost;
        this._teardownProjectionLayers();
        this.projectionHost = host || null;
        this._projectionGeneration += 1;
        this._pendingProjectionAdvance = !!(
            this._running && this._advanceInFlight && this.projectionHost
        );
        this._projectionPainted = false;
        this._projectionHostCleared = !!previousHost && !this.projectionHost;
        if (!this.projectionHost) return;
        this._ensureProjectionLayers();
        if (this._layers) {
            for (const layer of this._layers) this._syncProjectionLayer(layer);
        }
    }

    _teardownProjectionLayers() {
        if (this._layers) {
            for (const layer of this._layers) {
                if (!layer.projection) continue;
                try { layer.projection.root.remove(); } catch { /* detached */ }
                layer.projection = null;
            }
        }
        if (this.projectionHost) {
            this.projectionHost.querySelectorAll('.continuous-field-layer').forEach((node) => {
                try { node.remove(); } catch { /* detached */ }
            });
        }
    }

    _ensureProjectionLayers() {
        if (!this.projectionHost || !this._layers) return;
        for (const layer of this._layers) {
            if (layer.projection) continue;
            const root = document.createElement('div');
            root.className = 'continuous-field-layer';
            root.setAttribute('aria-hidden', 'true');
            root.style.opacity = layer.root.style.opacity || '0';
            root.style.transition = layer.root.style.transition
                || `opacity ${this.crossfadeMs}ms ease-in-out`;

            const backdrop = document.createElement('img');
            backdrop.className = 'continuous-field-backdrop';
            backdrop.decoding = 'async';
            backdrop.alt = '';
            backdrop.draggable = false;
            backdrop.style.objectFit = 'cover';

            // THE PROJECTION IS A STENCIL, NOT A FRAME — SO IT COVERS.
            //
            // The gallery layer fits the authored work with `contain` so a
            // portrait is never cropped to the screen's ratio. The glyph
            // viewport is the opposite case: it is letter-shaped, and what
            // it needs is that every pixel inside the letters carries the
            // material. Contained here, a portrait source (843x1260) in a
            // wide word (1125x401) draws 268x401 — 24% of the glyph — and
            // the rest falls through to the darkened blur backdrop, which
            // reads as black bars swallowing most of the word.
            //
            // This is also the contract fit-projection.js already computes:
            // it derives the projection `scale` from coverScale and the
            // visibleAreaRatio from the cover-scaled source. The renderer
            // was the half that disagreed. Reverence is not lost — the
            // gallery behind the reading shows the same work uncropped at
            // the same moment.
            const artwork = document.createElement('img');
            artwork.className = 'continuous-field-artwork';
            artwork.decoding = 'async';
            artwork.alt = '';
            artwork.draggable = false;
            artwork.style.objectFit = 'cover';

            root.append(backdrop, artwork);
            this.projectionHost.appendChild(root);
            layer.projection = { root, backdrop, artwork };
        }
    }

    _usesDistinctProjection() {
        return Array.isArray(this.getProjectionPool?.());
    }

    _drawProjectionWork() {
        const pool = this.getProjectionPool?.() || [];
        if (!pool.length) return null;
        const key = this.projectionPoolKey() || 'projection';
        let work = this._projectionBag.draw(key, pool);
        if (work && pool.length > 1 && work.url === this._currentProjectionUrl) {
            work = this._projectionBag.draw(key, pool) || work;
        }
        return work;
    }

    _syncProjectionLayer(layer) {
        const proj = layer?.projection;
        if (!proj) return;
        proj.root.style.transition = layer.root.style.transition;
        proj.root.style.opacity = layer.root.style.opacity;
        const url = (this._usesDistinctProjection() && layer.projectionWork?.url)
            ? layer.projectionWork.url
            : (layer.projectionWork?.living ? null : layer.work?.url);
        if (url) {
            if (proj.artwork.getAttribute('src') !== url) proj.artwork.src = url;
        } else {
            proj.artwork.removeAttribute('src');
        }
        // The projection's artwork covers, so nothing can ever show behind
        // it: the backdrop exists only to fill the matte that `contain`
        // leaves, and the projection no longer leaves one. Kept hidden and
        // sourceless rather than mirroring the gallery's wash — it would
        // cost a second decode and a 43px blur to paint zero visible pixels.
        proj.backdrop.hidden = true;
        proj.backdrop.removeAttribute('src');
        this._reportProjectionPaint();
    }

    _reportProjectionPaint() {
        reportProjectionPaint(this, () => {
            if (!this._layers) return false;
            const host = this.projectionHost || this.host;
            if (!host) return false;
            return this.projectionHost
                ? this._layers.some(layer => layer.projection?.root.style.opacity === '1'
                    && !!layer.projection.artwork.getAttribute('src'))
                : this._layers.some(layer => layer.root.style.opacity === '1' && !!layer.work?.url);
        });
    }

    /** Mount the two layers (idempotent). */
    _ensureLayers() {
        if (this._layers) return;
        const make = () => {
            const root = document.createElement('div');
            root.className = 'continuous-field-layer';
            root.setAttribute('aria-hidden', 'true');
            root.style.opacity = '0';
            root.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;

            // The backdrop fills the viewport with a softened extension of
            // the work. The foreground remains the untouched composition,
            // fitted with `contain`, so portraits and panoramas are never
            // cropped merely to match the reader's screen ratio.
            const backdrop = document.createElement('img');
            backdrop.className = 'continuous-field-backdrop';
            backdrop.decoding = 'async';
            backdrop.alt = '';
            backdrop.draggable = false;
            backdrop.style.objectFit = 'cover';

            const artwork = document.createElement('img');
            artwork.className = 'continuous-field-artwork';
            artwork.decoding = 'async';
            artwork.alt = '';
            artwork.draggable = false;
            artwork.style.objectFit = 'contain';

            const label = document.createElement('div');
            label.className = 'continuous-field-label';
            label.hidden = true;

            root.append(backdrop, artwork, label);
            this.host.appendChild(root);
            const layer = { root, backdrop, artwork, label, work: null };
            artwork.addEventListener('load', () => {
                this._syncLayerWash(layer);
                this._layoutLayerLabel(layer);
            });
            return layer;
        };
        this._layers = [make(), make()];
        this._ensureProjectionLayers();
        if (typeof ResizeObserver === 'function') {
            this._resizeObserver = new ResizeObserver(this._boundRefreshLayers);
            this._resizeObserver.observe(this.host);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._boundRefreshLayers);
        }
    }

    _renderLayerLabel(layer) {
        const label = layer?.work?.artworkLabel || null;
        const text = displayedArtworkLabel(label, this.showArtworkLabels);
        applyArtworkLabelElement(layer.label, text, label?.creditRequired);
        this._layoutLayerLabel(layer);
    }

    _refreshLayerGeometry() {
        if (!this._layers) return;
        for (const layer of this._layers) {
            this._syncLayerWash(layer);
            this._layoutLayerLabel(layer);
        }
    }

    _syncLayerWash(layer) {
        if (!layer?.backdrop || !layer?.artwork || !layer.work?.url) return;
        const frameRect = this.host?.getBoundingClientRect?.();
        const showWash = needsAdaptiveImageWash({
            frameWidth: frameRect?.width,
            frameHeight: frameRect?.height,
            naturalWidth: layer.artwork.naturalWidth,
            naturalHeight: layer.artwork.naturalHeight
        });

        layer.root.dataset.imageWash = showWash ? 'active' : 'none';
        layer.backdrop.hidden = !showWash;
        if (showWash) {
            if (layer.backdrop.getAttribute('src') !== layer.work.url) {
                layer.backdrop.src = layer.work.url;
            }
        } else {
            layer.backdrop.removeAttribute('src');
        }
        this._syncProjectionLayer(layer);
    }

    _layoutLayerLabel(layer) {
        if (!layer?.label || layer.label.hidden) return;
        const frameRect = this.host?.getBoundingClientRect?.();
        const labelRect = layer.label.getBoundingClientRect?.();
        const naturalWidth = layer.artwork.naturalWidth;
        const naturalHeight = layer.artwork.naturalHeight;
        if (!frameRect?.width || !frameRect?.height
            || !labelRect?.width || !labelRect?.height
            || !naturalWidth || !naturalHeight) {
            return;
        }

        // Scale spacing gently with the field while retaining practical
        // minimums on compact screens and restrained maximums on large ones.
        const shorterEdge = Math.min(frameRect.width, frameRect.height);
        const padding = clamp(shorterEdge * 0.022, 12, 24);
        const gap = clamp(shorterEdge * 0.016, 10, 18);
        const placement = resolveGalleryLabelPlacement({
            frameWidth: frameRect.width,
            frameHeight: frameRect.height,
            naturalWidth,
            naturalHeight,
            labelWidth: labelRect.width,
            labelHeight: labelRect.height,
            padding,
            gap
        });
        if (!placement) return;

        layer.label.dataset.placement = placement.mode;
        layer.label.style.left = `${placement.left}px`;
        layer.label.style.top = `${placement.top}px`;
        layer.label.style.right = 'auto';
        layer.label.style.bottom = 'auto';
        layer.label.style.maxWidth = `${Math.max(1, placement.maxWidth)}px`;

        // An inside placement may narrow and wrap the label. Re-read its
        // height once and keep its lower edge padded inside the artwork.
        if (placement.mode === 'inside') {
            const wrapped = layer.label.getBoundingClientRect?.();
            if (wrapped?.height) {
                layer.label.style.left = `${placement.artwork.right
                    - placement.padding
                    - wrapped.width}px`;
                layer.label.style.top = `${clamp(
                    placement.artwork.bottom - placement.padding - wrapped.height,
                    placement.artwork.top + placement.padding,
                    placement.artwork.bottom - placement.padding - wrapped.height
                )}px`;
            }
        }
    }

    _setLayerWork(layer, work, projectionWork = null) {
        layer.work = work || null;
        layer.projectionWork = projectionWork || null;
        // The wash starts unallocated. The foreground's intrinsic dimensions
        // decide whether a matte actually exists once it loads.
        layer.backdrop.hidden = true;
        layer.backdrop.removeAttribute('src');
        layer.artwork.src = work.url;
        this._renderLayerLabel(layer);
        if (layer.artwork.complete && layer.artwork.naturalWidth) {
            this._syncLayerWash(layer);
        }
        this._syncProjectionLayer(layer);
    }

    async _defaultDecode(url) {
        try {
            const img = createRemoteImage();
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
        this._paused = false;
        this._remainingDwellMs = this.dwellMs;
        this._pendingPoolChange = null;
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
            if (!this._running || this._paused) return;
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
        this._advanceInFlight = true;
        const generation = this._generation;
        const projectionGeneration = this._projectionGeneration;
        const projectionHost = this.projectionHost;
        let work = null;
        try {
            if (this.getNextWork) {
                // Generated sources may cross an asynchronous boundary.
                // The generation token below gives them the same stale
                // completion protection as image decode.
                work = await this.getNextWork({
                    currentUrl: this._currentUrl,
                    poolKey: this.poolKey()
                });
            } else {
                const pool = this.getPool() || [];
                if (pool.length > 0) {
                    const key = this.poolKey();
                    // The bag decks per pool identity: a pericope boundary
                    // starts a fresh no-repeat cycle; growth of the same pool
                    // keeps the cycle (ShuffleBag's growth-merge).
                    work = this._bag.draw(key, pool);
                    if (work && pool.length > 1 && work.url === this._currentUrl) {
                        work = this._bag.draw(key, pool) || work;
                    }
                }
            }
        } catch {
            // A generator failure is equivalent to a cold work: retain the
            // current wall and retry at the next cadence boundary.
            work = null;
        }

        if (!this._running || this._paused || generation !== this._generation
            || projectionGeneration !== this._projectionGeneration
            || projectionHost !== this.projectionHost) {
            this._finishAdvance();
            return;
        }
        const url = work?.url;
        if (!url) {
            if (!this._currentUrl && this._usesDistinctProjection() && this.projectionHost) {
                let projectionWork = null;
                if (this.getNextProjectionWork) {
                    try {
                        projectionWork = await this.getNextProjectionWork({
                            currentUrl: this._currentProjectionUrl,
                            roomUrl: null,
                            poolKey: this.projectionPoolKey()
                        });
                    } catch {
                        projectionWork = null;
                    }
                }
                if (!projectionWork?.url) projectionWork = this._drawProjectionWork();
                if (projectionWork?.url) {
                    const projectionReady = await this.decode(projectionWork.url);
                    if (projectionReady && this._running && !this._paused
                        && generation === this._generation
                        && projectionGeneration === this._projectionGeneration
                        && projectionHost === this.projectionHost) {
                        this._crossfadeProjectionTo(projectionWork, first);
                        this._currentProjectionUrl = projectionWork.url;
                        this._finishAdvance();
                        return;
                    }
                }
            }
            if (first) this._fadeToNothing();
            this._finishAdvance();
            return;
        }

        const ok = await this.decode(url);
        // The moment that requested this must still exist, and nothing
        // newer must have superseded it.
        if (!ok || !this._running || this._paused || generation !== this._generation
            || projectionGeneration !== this._projectionGeneration
            || projectionHost !== this.projectionHost) {
            this._finishAdvance();
            // a decode failure holds the current work; the next tick retries
            return;
        }

        let projectionWork = null;
        if (this._usesDistinctProjection()) {
            if (this.getNextProjectionWork) {
                try {
                    projectionWork = await this.getNextProjectionWork({
                        currentUrl: this._currentProjectionUrl,
                        roomUrl: url,
                        poolKey: this.projectionPoolKey()
                    });
                } catch {
                    projectionWork = null;
                }
            }
            if (projectionGeneration !== this._projectionGeneration
                || projectionHost !== this.projectionHost) {
                this._finishAdvance();
                return;
            }
            if (projectionWork?.living) {
                this._crossfadeTo(work, first, { living: true });
                this._currentUrl = url;
                this._currentProjectionUrl = null;
                this._finishAdvance();
                return;
            }
            if (!projectionWork?.url) projectionWork = this._drawProjectionWork();
            if (projectionWork?.url && projectionWork.url !== url) {
                const projOk = await this.decode(projectionWork.url);
                if (!projOk || !this._running || this._paused || generation !== this._generation
                    || projectionGeneration !== this._projectionGeneration
                    || projectionHost !== this.projectionHost) {
                    projectionWork = this._currentProjectionUrl
                        ? { url: this._currentProjectionUrl }
                        : null;
                }
            }
            if (!projectionWork?.url) projectionWork = work;
        }

        if (projectionGeneration !== this._projectionGeneration
            || projectionHost !== this.projectionHost) {
            this._finishAdvance();
            return;
        }

        this._crossfadeTo(work, first, projectionWork);
        this._currentUrl = url;
        this._currentProjectionUrl = this._usesDistinctProjection()
            ? (projectionWork?.url || this._currentProjectionUrl)
            : url;
        this._finishAdvance();
    }

    _finishAdvance() {
        this._advanceInFlight = false;
        if (!this._pendingProjectionAdvance || !this._running || this._paused) return;
        this._pendingProjectionAdvance = false;
        this._advance(false);
    }

    _crossfadeProjectionTo(projectionWork, first) {
        if (!this._layers) return;
        if (this.reducedMotion) {
            const front = this._layers[this._front];
            front.projectionWork = projectionWork;
            this._syncProjectionLayer(front);
            if (front.projection) {
                front.projection.root.style.transition = 'none';
                front.projection.root.style.opacity = '1';
            }
            this._reportProjectionPaint();
            return;
        }

        const incoming = this._layers[1 - this._front];
        const outgoing = this._layers[this._front];
        const crossfadeMs = this._nextCrossfadeMs ?? this.crossfadeMs;
        this._nextCrossfadeMs = null;
        incoming.projectionWork = projectionWork;
        this._syncProjectionLayer(incoming);
        if (!incoming.projection) return;
        incoming.projection.root.style.transition = `opacity ${crossfadeMs}ms ease-in-out`;
        void incoming.projection.root.offsetWidth;
        incoming.projection.root.style.opacity = '1';
        if (!first && outgoing.projection) {
            outgoing.projection.root.style.transition = incoming.projection.root.style.transition;
            outgoing.projection.root.style.opacity = '0';
        }
        this._front = 1 - this._front;
        this._reportProjectionPaint();
    }

    _crossfadeTo(work, first, projectionWork = null) {
        if (!this._layers) return;
        if (this.reducedMotion) {
            // One still work, no motion: set it on the front layer at
            // full opacity, no transition.
            const front = this._layers[this._front];
            front.root.style.transition = 'none';
            this._setLayerWork(front, work, projectionWork);
            front.root.style.opacity = '1';
            if (front.projection) {
                front.projection.root.style.transition = 'none';
                front.projection.root.style.opacity = '1';
            }
            this._reportProjectionPaint();
            return;
        }
        const incoming = this._layers[1 - this._front];
        const outgoing = this._layers[this._front];
        const crossfadeMs = this._nextCrossfadeMs ?? this.crossfadeMs;
        this._nextCrossfadeMs = null;
        this._setLayerWork(incoming, work, projectionWork);
        // Rise the incoming and (unless first) fall the outgoing over the
        // same window — the double-buffer never passes through black.
        // Force a style flush so the transition runs from opacity 0.
        incoming.root.style.transition = `opacity ${crossfadeMs}ms ease-in-out`;
        if (incoming.projection) {
            incoming.projection.root.style.transition = incoming.root.style.transition;
            void incoming.projection.root.offsetWidth;
        }
        void incoming.root.offsetWidth;
        incoming.root.style.opacity = '1';
        if (incoming.projection) incoming.projection.root.style.opacity = '1';
        if (!first) {
            outgoing.root.style.transition = `opacity ${crossfadeMs}ms ease-in-out`;
            outgoing.root.style.opacity = '0';
            if (outgoing.projection) {
                outgoing.projection.root.style.transition = outgoing.root.style.transition;
                outgoing.projection.root.style.opacity = '0';
            }
        }
        this._front = 1 - this._front;
        this._reportProjectionPaint();
    }

    _fadeToNothing() {
        if (!this._layers) return;
        for (const layer of this._layers) {
            layer.root.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            layer.root.style.opacity = '0';
            if (layer.projection) {
                layer.projection.root.style.transition = layer.root.style.transition;
                layer.projection.root.style.opacity = '0';
            }
        }
        this._currentUrl = null;
        this._currentProjectionUrl = null;
    }

    /**
     * The active pool changed (a pericope cue). Advance to the new
     * pool's imagery on the next crossfade — or, when the new episode is
     * genuinely works-less (stillness), fade the field to nothing.
     * Increments the generation so any in-flight decode from the old pool
     * is discarded.
     *
     * @param {Object} [opts]
     *   - stillness: true when the new episode has NO imagery by design
     *     (a works-less pericope — the one sanctioned fade). Distinct from
     *     a cold pool whose works are merely still warming: an empty pool
     *     that is NOT stillness holds the current work and lets the
     *     advance clock reveal the new episode once it warms, rather than
     *     flashing to black. (CONTINUOUS-FIELD-SPEC §4, §8.)
     */
    poolChanged(opts = {}) {
        if (!this._running) return;
        if (Number.isFinite(opts.transitionMs) && opts.transitionMs >= 0) {
            this._nextCrossfadeMs = opts.transitionMs;
        }
        if (this._paused) {
            // A schedule may cross an identity boundary while the player is
            // settling. Remember it, but never alter the authored wall until
            // the reading resumes.
            this._pendingPoolChange = { ...opts };
            this._generation += 1;
            return;
        }
        this._generation += 1;
        if (!this.hasWorks()) {
            if (opts.stillness) {
                // A genuinely works-less episode: fade to stillness.
                this._fadeToNothing();
            } else {
                // Cold pool, warming: hold the current work; the advance
                // clock reveals the new episode when its works resolve.
                // Bring the next advance forward so the reveal is prompt.
                this._nextAdvanceAt = this._now();
            }
        } else {
            // crossfade to the new episode immediately, not on the next
            // dwell — the scene changed, the field should follow
            if (!this._advanceInFlight) {
                this._advance(false);
                this._nextAdvanceAt = this._now() + this.dwellMs;
            } else {
                this._nextAdvanceAt = this._now();
            }
        }
    }

    /** Freeze cadence and in-flight publication without discarding the wall. */
    pause() {
        if (!this._running || this._paused) return false;
        this._paused = true;
        this._remainingDwellMs = Math.max(0, this._nextAdvanceAt - this._now());
        // Invalidate async generation/decode begun before the pause. It may
        // finish, but it can no longer publish into the held presentation.
        this._generation += 1;
        if (this._rafId != null) {
            this._caf(this._rafId);
            this._rafId = null;
        }
        return true;
    }

    /** Continue from the held wall and the remaining dwell interval. */
    resume() {
        if (!this._running || !this._paused) return false;
        this._paused = false;
        this._nextAdvanceAt = this._now() + this._remainingDwellMs;
        const pending = this._pendingPoolChange;
        this._pendingPoolChange = null;
        if (pending) this.poolChanged(pending);
        if (this._pendingProjectionAdvance && !this._advanceInFlight) {
            this._pendingProjectionAdvance = false;
            this._advance(false);
        }
        if (!this.reducedMotion && this._rafId == null) this._loop();
        return true;
    }

    /** Stop the field and clear its layers. */
    stop() {
        this._running = false;
        this._paused = false;
        this._remainingDwellMs = 0;
        this._pendingPoolChange = null;
        this._pendingProjectionAdvance = false;
        this._generation += 1;
        if (this._rafId != null) { this._caf(this._rafId); this._rafId = null; }
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._boundRefreshLayers);
        }
        this._teardownProjectionLayers();
        if (this._layers) {
            for (const layer of this._layers) {
                layer.backdrop.removeAttribute('src');
                layer.artwork.removeAttribute('src');
                layer.label.textContent = '';
                layer.work = null;
                try { layer.root.remove(); } catch { /* detached */ }
            }
            this._layers = null;
        }
        this._currentUrl = null;
        this._currentProjectionUrl = null;
        this._bag.clear();
        this._projectionBag.clear();
    }

    /** Diagnostics: the currently displayed url (or null). */
    get currentUrl() {
        return this._currentUrl;
    }

    /** Layer B url. Same as currentUrl unless a distinct projection pool is on. */
    get currentProjectionUrl() {
        return this._usesDistinctProjection() ? this._currentProjectionUrl : this._currentUrl;
    }

    get running() {
        return this._running;
    }

    get paused() {
        return this._paused;
    }
}
