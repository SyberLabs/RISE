/**
 * Klee Flash Wrapper
 * Owns the preload queue and episode lifecycle for Klee interlocutions,
 * mirroring the FractalFlame wrapper's shape (preload / signal pool /
 * flash-time nearest match) so the Visual Cortex stays a thin dispatcher.
 *
 * Episode model: one artwork evolves across several short flashes (its
 * progress grows between appearances — never *during* a subliminal cut).
 *
 * Queue survival rules:
 * - Artworks are geometry snapshots; restoreArtwork rescales them, so a
 *   window resize never invalidates the queue.
 * - The queue refills itself whenever it runs low (not only at session start).
 * - configure() flushes only on value changes (preset string, signal
 *   contents), never on array identity.
 */

import { KleeEngine, KLEE_PRESET_NAMES, KLEE_CHAMBER_BACKGROUND } from './klee-enhanced.js';
import { pickNearestSignalIndex } from '../core/conductor.js';
import { compilePolylinesToAscii } from './ascii-engine.js';

export class KleeFlashes {
    constructor(engine) {
        this.engine = engine;              // display engine, bound to the visible canvas
        this.queue = [];
        this.queueTarget = 5;
        this.preset = 'random';
        this.signals = null;
        this.episode = null;               // { preset, seed, progress }
        this.presetOverride = null;        // one-shot semantic/fallback choice

        this._sessionSeed = `${Date.now()}-${Math.random()}`;
        this._artworkIndex = 0;
        this._poolIndex = 0;
        this._preloadEngine = null;
        this._preloadPromise = null;
        this._preloadGeneration = -1;
        this._generation = 0;
        this._destroyed = false;
    }

    _signalsKey(signals) {
        if (!Array.isArray(signals) || signals.length === 0) return 'none';
        return signals.map(s => `${s.valence.toFixed(3)}:${s.arousal.toFixed(3)}`).join('|');
    }

    /**
     * Apply session configuration. Flushes the queue only when the preset
     * or the signal *contents* actually change.
     */
    configure({ preset = 'random', signals = null } = {}) {
        const changed = preset !== this.preset
            || this._signalsKey(signals) !== this._signalsKey(this.signals);
        this.preset = preset;
        this.signals = Array.isArray(signals) && signals.length ? signals : null;
        if (changed) {
            this._generation++;
            this.queue = [];
            this.episode = null;
            this.presetOverride = null;
            this._poolIndex = 0;
        }
    }

    beginSession({ preset = this.preset, signals = this.signals } = {}) {
        this.preset = KLEE_PRESET_NAMES.includes(preset) || preset === 'random' ? preset : 'random';
        this.signals = Array.isArray(signals) && signals.length ? signals : null;
        this._generation++;
        this._sessionSeed = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        this._artworkIndex = 0;
        this._poolIndex = 0;
        this.queue = [];
        this.episode = null;
        this.presetOverride = null;
    }

    /**
     * Track display-canvas dimensions. Snapshots rescale on restore, so the
     * queue and the preload engine both survive resizes intact.
     */
    resize(width, height) {
        this.engine.width = width;
        this.engine.height = height;
        if (this._preloadEngine) {
            this._preloadEngine.width = width;
            this._preloadEngine.height = height;
        }
    }

    queuePresetOverride(preset) {
        if (KLEE_PRESET_NAMES.includes(preset)) this.presetOverride = preset;
    }

    _nextSeed(preset) {
        return `${this._sessionSeed}:${this._artworkIndex++}:${preset}`;
    }

    _getPreloadEngine() {
        if (!this._preloadEngine) this._preloadEngine = new KleeEngine();
        this._preloadEngine.width = this.engine.width;
        this._preloadEngine.height = this.engine.height;
        return this._preloadEngine;
    }

    preload(count = 5) {
        if (this._destroyed) return Promise.resolve();
        const generation = this._generation;
        this.queueTarget = Math.min(12, Math.max(1, count));
        if (this.queue.length >= this.queueTarget) return Promise.resolve();
        if (this._preloadPromise) {
            if (this._preloadGeneration === generation) return this._preloadPromise;
            return this._preloadPromise.catch(() => {}).then(() => this.preload(count));
        }

        this._preloadGeneration = generation;
        this._preloadPromise = (async () => {
            const engine = this._getPreloadEngine();
            while (!this._destroyed && generation === this._generation && this.queue.length < this.queueTarget) {
                const index = this._poolIndex++;
                const preset = this.preset === 'random'
                    ? KLEE_PRESET_NAMES[index % KLEE_PRESET_NAMES.length]
                    : this.preset;
                const signal = this.signals ? this.signals[index % this.signals.length] : null;
                const seed = this._nextSeed(preset);
                try {
                    await engine.generateRandomAsync(preset, { seed, signal, awaitEnhancements: true });
                } catch (error) {
                    // Worker teardown mid-generation (destroy/reload) — stop
                    // filling; a later preload() re-arms with a fresh engine.
                    console.warn('[KleeFlashes] Preload generation aborted:', error.message);
                    break;
                }
                if (generation !== this._generation || this._destroyed) break;
                this.queue.push({ preset, seed, signal, artwork: engine.captureArtwork() });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        })().finally(() => {
            if (this._preloadGeneration === generation) {
                this._preloadPromise = null;
                this._preloadGeneration = -1;
            }
        });
        return this._preloadPromise;
    }

    _takeArtwork(preset, signal) {
        // Dimensions no longer gate matches — restoreArtwork rescales.
        const matches = this.queue
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.preset === preset);
        if (!matches.length) return null;

        let pick = matches[0];
        if (signal && matches.some(({ item }) => item.signal)) {
            const nearest = pickNearestSignalIndex(
                matches.map(({ item }) => item), signal
            );
            if (nearest >= 0) pick = matches[nearest];
        }
        const [taken] = this.queue.splice(pick.index, 1);

        // Refill in the background whenever the pool runs low, so the
        // synchronous-generation fallback stays truly exceptional.
        if (this.queue.length < Math.max(2, Math.ceil(this.queueTarget / 2))) {
            this.preload(this.queueTarget);
        }
        return taken;
    }

    /**
     * Choose the preset for this flash: a running episode keeps its preset
     * for visual continuity; otherwise the one-shot override (conductor's
     * semantic choice or the fallback path) wins once; otherwise the user's
     * configured preset ('random' draws from what the pool has ready).
     */
    _choosePreset() {
        if (this.episode && this.episode.progress < 0.999) return this.episode.preset;

        const override = this.presetOverride;
        this.presetOverride = null;
        if (override) return override;

        if (this.preset !== 'random') return this.preset;
        const pooled = [...new Set(this.queue.map(item => item.preset))];
        return pooled.length
            ? pooled[Math.floor(Math.random() * pooled.length)]
            : KLEE_PRESET_NAMES[Math.floor(Math.random() * KLEE_PRESET_NAMES.length)];
    }

    async _prepareArtwork(preset, signal) {
        const previous = this.episode;
        const needsArtwork = !previous || previous.progress >= 0.999;
        if (needsArtwork) {
            const cached = this._takeArtwork(preset, signal);
            const seed = cached?.seed ?? this._nextSeed(preset);
            if (cached) {
                this.engine.restoreArtwork(cached.artwork);
                this.engine.configurePresetStyle(preset, {
                    blendFrom: previous?.preset,
                    blend: previous ? 0.35 : 1,
                    signal
                });
            } else {
                await this.engine.generateRandomAsync(preset, {
                    seed,
                    signal,
                    blendFrom: previous?.preset,
                    blend: previous ? 0.35 : 1,
                    awaitEnhancements: false
                });
            }
            this.episode = {
                preset,
                fromPreset: previous?.preset || preset,
                seed,
                progress: 0,
                transition: previous ? 0.35 : 1
            };
        } else {
            this.engine.applySemanticSignal(signal, 0.28);
            if (previous.transition < 1) {
                previous.transition = Math.min(1, previous.transition + 0.25);
                this.engine.configurePresetStyle(preset, {
                    blendFrom: previous.fromPreset,
                    blend: previous.transition,
                    signal
                });
            }
        }
        return this.episode;
    }

    /**
     * Render one flash frame onto the canvas. Subliminal flashes are still
     * frames; the artwork's progress advances *between* appearances.
     * Returns true when a frame was rendered.
     */
    async prepareFlash(duration, signal) {
        const preset = this._choosePreset();
        const artwork = await this._prepareArtwork(preset, signal);

        const growth = Math.min(0.38, Math.max(0.12, 0.1 + duration / 700));
        artwork.progress = Math.min(1, artwork.progress + growth);

        return artwork;
    }

    async renderFlash(canvas, duration, signal) {
        const artwork = await this.prepareFlash(duration, signal);

        this.engine.render(canvas, {
            background: KLEE_CHAMBER_BACKGROUND,
            progress: artwork.progress,
            texture: this.engine.renderStyle.texture
        });
        return true;
    }

    /**
     * Preserve Klee's native line grammar in ASCII instead of sampling its
     * finished pixels. The same episode seed and progressive state drive both
     * render languages, so switching language never changes the artwork.
     */
    async createAsciiFlash(duration, signal, options = {}) {
        const artwork = await this.prepareFlash(duration, signal);
        const palette = Array.isArray(this.engine.palette) && this.engine.palette.length
            ? this.engine.palette
            : ['#e5e3df'];
        const forms = Array.isArray(this.engine.forms) ? this.engine.forms : [];
        const lines = Array.isArray(this.engine.lines) ? this.engine.lines : [];
        const formPolylines = forms
            .filter(form => Array.isArray(form.contour) && form.contour.length > 2)
            .map(form => ({
                points: [...form.contour, form.contour[0]],
                color: palette[Math.floor((form.centerX / Math.max(1, this.engine.width)) * palette.length) % palette.length],
                delay: 0
            }));
        const linePolylines = lines.map((line, index) => ({
            points: line.points,
            color: palette[Math.floor((line.colorIndex ?? 0) * palette.length) % palette.length],
            alpha: line.alpha,
            weight: line.weight,
            variation: line.variation,
            delay: lines.length > 1 ? (index / (lines.length - 1)) * 0.16 : 0
        }));

        return compilePolylinesToAscii({
            width: this.engine.width,
            height: this.engine.height,
            palette,
            polylines: [...formPolylines, ...linePolylines]
        }, {
            ...options,
            signal,
            progress: artwork.progress,
            background: KLEE_CHAMBER_BACKGROUND,
            metadata: {
                source: 'klee',
                preset: artwork.preset,
                seed: artwork.seed,
                ...(options.metadata || {})
            }
        });
    }

    destroy() {
        this._destroyed = true;
        this._generation++;
        this._preloadEngine?.destroy?.();
        this._preloadEngine = null;
        this.queue = [];
        this.episode = null;
    }
}
