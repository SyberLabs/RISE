/**
 * Gallery snapshot engines — a living canvas under the reading.
 *
 * ContinuousField is image-only. Harmonograph and plates already have
 * living layers; Klee / Turrell / Fractal / Neural / Rock Garden used
 * to be snapshotted as stills into that image wall. A failed snapshot
 * left glass (or void) where the engine should paint. This field is
 * that living layer for those five families.
 */

import { KleeEngine, KLEE_CHAMBER_BACKGROUND } from './klee-enhanced.js';
import { Turrell } from './turrell.js';
import { FractalFlame } from './fractal.js';
import { NeuralNetwork } from './neural.js';
import { RockGarden } from './rockgarden.js';
import { SNAPSHOT_PROCEDURAL_IDS } from '../core/visual-registry.js';
import {
    GALLERY_CADENCE_DEFAULT,
    galleryCadenceTimings
} from '../core/visual-presence.js';

const MAX_DPR = 2;
const MAX_FRAME_MS = 50;

export { SNAPSHOT_PROCEDURAL_IDS };

export async function paintSnapshotEngine(type, canvas, options = {}) {
    if (!canvas || !SNAPSHOT_PROCEDURAL_IDS.includes(type)) return false;
    const signal = options.signal || null;
    try {
        if (type === 'klee') {
            const engine = new KleeEngine();
            engine.width = Math.max(1, canvas.width);
            engine.height = Math.max(1, canvas.height);
            const preset = options.kleePreset && options.kleePreset !== 'random'
                ? options.kleePreset
                : 'harmonic';
            engine.generateRandom(preset, { detectForms: false });
            engine.render(canvas, { background: KLEE_CHAMBER_BACKGROUND });
            return true;
        }
        if (type === 'turrell') {
            const field = new Turrell(document.createElement('div'));
            const plan = field.generate();
            return field.render(canvas, plan) === true;
        }
        if (type === 'fractal') {
            const flame = new FractalFlame(canvas);
            try {
                if (!flame.isReady()) await flame.fillQueue(1);
                return flame.generate(signal) === true;
            } finally {
                flame.destroy?.();
            }
        }
        if (type === 'neural') {
            return new NeuralNetwork(canvas).generate() === true;
        }
        if (type === 'rockgarden') {
            const garden = new RockGarden();
            garden.generateRockGarden({
                width: Math.max(1, canvas.width),
                height: Math.max(1, canvas.height)
            });
            return garden.renderRockGarden(canvas, {
                backgroundColor: KLEE_CHAMBER_BACKGROUND,
                strokeColor: 'rgba(232, 232, 236, 0.8)',
                brushStroke: true
            }) !== false;
        }
    } catch {
        return false;
    }
    return false;
}

export class GalleryEngineField {
    /**
     * @param {HTMLElement} host
     * @param {Object} options
     *   - families  active snapshot engine ids
     *   - dwellMs / crossfadeMs
     *   - reducedMotion
     *   - getSignal / getKleePreset
     *   - paint     optional (type, canvas, options) => boolean | Promise
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
        this.getKleePreset = typeof options.getKleePreset === 'function'
            ? options.getKleePreset
            : () => 'random';
        this.paint = typeof options.paint === 'function'
            ? options.paint
            : paintSnapshotEngine;

        this.running = false;
        this.paused = false;
        this._planes = null;
        this._active = 0;
        this._cursor = 0;
        this._rafId = null;
        this._lastFrameAt = 0;
        this._nextRotateAt = 0;
        this._remainingRotateMs = 0;
        this._paintGeneration = 0;

        this._tick = this._tick.bind(this);
        this._resize = this._resize.bind(this);
        this._onVisibility = this._onVisibility.bind(this);
    }

    _mount() {
        if (this._planes) return;
        const make = () => {
            const canvas = document.createElement('canvas');
            canvas.className = 'gallery-engine-plane';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.opacity = '0';
            canvas.style.transition = `opacity ${this.crossfadeMs}ms ease-in-out`;
            this.host.appendChild(canvas);
            return { canvas, family: null, elapsedMs: 0 };
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
            if (plane.family) this._paintPlane(plane);
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

    _paintOptions() {
        return {
            signal: this.getSignal() || null,
            kleePreset: this.getKleePreset() || 'random'
        };
    }

    _paintPlane(plane) {
        if (!plane?.family) return null;
        const generation = ++this._paintGeneration;
        const result = this.paint(plane.family, plane.canvas, this._paintOptions());
        if (result && typeof result.then === 'function') {
            return result.then(ok => {
                if (generation !== this._paintGeneration || !this.running) return false;
                return ok !== false;
            }).catch(() => false);
        }
        return result !== false;
    }

    _rotate(first) {
        if (!this._planes || this.families.length === 0) return;
        const incoming = first ? this._planes[0] : this._planes[1 - this._active];
        const outgoing = first ? null : this._planes[this._active];
        incoming.family = this.families[this._cursor % this.families.length];
        this._cursor += 1;
        incoming.elapsedMs = 0;
        this._paintPlane(incoming);
        incoming.canvas.style.transition = this.reducedMotion || first
            ? 'none'
            : `opacity ${this.crossfadeMs}ms ease-in-out`;
        incoming.canvas.style.opacity = '1';
        if (outgoing) {
            outgoing.canvas.style.opacity = '0';
            const retire = outgoing;
            setTimeout(() => {
                if (retire.canvas.style.opacity === '0') {
                    retire.family = null;
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
        const plane = this._planes[this._active];
        if (plane) plane.elapsedMs += dt;

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
        this._paintGeneration += 1;
        this._cancel();
        if (this._planes) {
            for (const plane of this._planes) {
                plane.canvas.style.opacity = '0';
                plane.family = null;
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
        const next = normalizeFamilies(families);
        const changed = next.length !== this.families.length
            || next.some((id, index) => id !== this.families[index]);
        this.families = next;
        if (this.running && this.families.length === 0) {
            this.stop();
            return;
        }
        if (this.running && changed) this._rotate(true);
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
    return families.filter(id => SNAPSHOT_PROCEDURAL_IDS.includes(id));
}
