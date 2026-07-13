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
            this.queue = [];
            this.episode = null;
            this._poolIndex = 0;
        }
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
        this.queueTarget = Math.min(12, Math.max(1, count));
        if (this.queue.length >= this.queueTarget) return Promise.resolve();
        if (this._preloadPromise) return this._preloadPromise;

        this._preloadPromise = (async () => {
            const engine = this._getPreloadEngine();
            while (!this._destroyed && this.queue.length < this.queueTarget) {
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
                this.queue.push({ preset, seed, signal, artwork: engine.captureArtwork() });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        })().finally(() => {
            this._preloadPromise = null;
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
    async renderFlash(canvas, duration, signal) {
        const preset = this._choosePreset();
        const artwork = await this._prepareArtwork(preset, signal);

        const growth = Math.min(0.38, Math.max(0.12, 0.1 + duration / 700));
        artwork.progress = Math.min(1, artwork.progress + growth);

        this.engine.render(canvas, {
            background: KLEE_CHAMBER_BACKGROUND,
            progress: artwork.progress,
            texture: this.engine.renderStyle.texture
        });
        return true;
    }

    destroy() {
        this._destroyed = true;
        this._preloadEngine?.destroy?.();
        this._preloadEngine = null;
        this.queue = [];
        this.episode = null;
    }
}
