/**
 * The Image Stream presenter at the fixation aperture (IMAGE-STREAM-SPEC §5).
 *
 * One small canvas, centred where the reader's eyes already rest, showing
 * decoded images one after another: frame replaces frame, with no fade, no
 * overlay and nothing drawn between them, so the aperture never passes
 * through black. The display drives it; `streamFrameAt` chooses the frame
 * from the stream's own elapsed time, so a held frame is always a whole
 * number of refreshes and a seek or a late refresh never replays frames.
 *
 * Its safety is geometry: the aperture is no larger than the area a flash
 * must exceed to count (`apertureIsInherentlySafe`), and it refuses to mount
 * if that were ever untrue. Behind that, a runtime FlashMeter reads every
 * frame it draws, one cell per drawn pixel, against the area the aperture
 * actually covers on screen (pinch-zoom and stylesheets included). The meter
 * tripping, the meter throwing, the display stalling, or the reader turning
 * on photosensitivity or reduced motion stops the stream for good, hides it,
 * and tells the caller once, so the Continuous Field is what remains.
 */

import { FlashMeter, apertureIsInherentlySafe } from '../core/flash-meter.js';
import { summarizeFrame } from '../core/luminance.js';
import { normalizeStreamRate, streamFrameAt } from '../core/visual-presence.js';

/** The aperture's side in CSS px: 19,600 px², inside the 21,824 px² safe area. */
export const STREAM_APERTURE_PX = 140;

const REFRESH_MEASURE_MS = 500;
// A frame held this long is far beyond any slot (the slowest is 250 ms at
// 4 Hz): the display is not keeping time, so the stream stops.
const STALL_MS = 500;

/**
 * Whether the reader's settings and the page allow the stream at all. Any
 * doubt, including a media query that cannot be asked, is a no.
 */
export function imageStreamMayRun() {
    try {
        const root = document.documentElement;
        if (root.classList.contains('photosensitivity-mode')) return false;
        if (root.classList.contains('reduced-motion')) return false;
        if (typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        return document.visibilityState !== 'hidden';
    } catch {
        return false;
    }
}

function apertureSide(value) {
    const side = Math.floor(Number(value));
    return Number.isFinite(side) && side > 0
        ? Math.min(side, STREAM_APERTURE_PX)
        : STREAM_APERTURE_PX;
}

export class ImageStream {
    constructor(stage, { frames, hz, side, raf, caf, onFallback }) {
        this.frames = frames;
        this._onFallback = onFallback;
        this._fellBack = false;
        this._meter = new FlashMeter({ areaPx: side * side });
        this._shownMs = 0;
        this.hz = normalizeStreamRate(hz);
        this.side = side;
        this._raf = raf;
        this._caf = caf;
        this._rafId = null;
        this._lastTs = null;
        this._elapsedMs = 0;
        this._refreshHz = null;
        this._measuredMs = 0;
        this._measuredRefreshes = 0;
        this._shownIndex = null;
        this._tick = ts => this._onRefresh(ts);

        const canvas = document.createElement('canvas');
        canvas.className = 'image-stream';
        canvas.width = side;
        canvas.height = side;
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${side}px`,
            height: `${side}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
        });
        this.canvas = canvas;
        this._ctx = canvas.getContext('2d', { willReadFrequently: true });
        stage.appendChild(canvas);
    }

    get running() {
        return this._rafId !== null;
    }

    resume() {
        if (this.running || !this.canvas || this._fellBack) return;
        this._lastTs = null;
        this._rafId = this._raf(this._tick);
    }

    pause() {
        if (!this.running) return;
        this._caf(this._rafId);
        this._rafId = null;
    }

    /** Move the stream's clock. The next refresh draws the frame for that time and nothing between. */
    seek(elapsedMs) {
        this._elapsedMs = Math.max(0, Number(elapsedMs) || 0);
    }

    destroy() {
        this.pause();
        this.canvas?.remove();
        this.canvas = null;
        this._ctx = null;
    }

    _onRefresh(ts) {
        this._rafId = null;
        try {
            if (!imageStreamMayRun()) return this._fallBack('stand-down');
            if (this._lastTs !== null) {
                const delta = ts - this._lastTs;
                if (delta > STALL_MS) return this._fallBack('stall');
                this._elapsedMs += delta;
                this._shownMs += delta;
                this._measure(delta);
            }
            this._lastTs = ts;
            const { index } = streamFrameAt(this._elapsedMs, this.frames.length, {
                hz: this.hz,
                refreshHz: this._refreshHz
            });
            if (index !== this._shownIndex) {
                this._draw(index);
                if (!this._lightIsSafe()) return this._fallBack('meter');
            }
        } catch {
            return this._fallBack('error');
        }
        this._rafId = this._raf(this._tick);
    }

    /** Read back the frame just drawn and put it through the meter. */
    _lightIsSafe() {
        const { data } = this._ctx.getImageData(0, 0, this.side, this.side);
        const summary = summarizeFrame(data, this.side, this.side);
        // The meter's area is set per frame because the aperture's size on
        // screen can change under it. Time is time shown: a seek moves the
        // stream's clock, never the meter's window.
        this._meter.areaPx = this._screenAreaPx();
        return this._meter.observe(summary, this._shownMs).ok;
    }

    /**
     * The CSS px² the aperture covers as the reader sees it: never less than
     * its declared size, more under pinch-zoom or a stylesheet that stretches
     * it, and unbounded when it cannot be measured, so any transition counts.
     */
    _screenAreaPx() {
        const rect = this.canvas.getBoundingClientRect();
        const scale = Number(window.visualViewport?.scale);
        const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const area = Math.max(this.side * this.side, rect.width * rect.height) * zoom * zoom;
        return Number.isFinite(area) ? area : Infinity;
    }

    /** Stop for good, hide the aperture, and say so once. */
    _fallBack(reason) {
        if (this._fellBack) return;
        this._fellBack = true;
        this.pause();
        if (this.canvas) this.canvas.style.display = 'none';
        try {
            this._onFallback?.(reason);
        } catch {
            // The stream is already stopped and hidden; nothing more to undo.
        }
    }

    /** The display's refresh rate, from the first half second of refreshes. */
    _measure(delta) {
        if (this._refreshHz !== null || !(delta > 0)) return;
        this._measuredMs += delta;
        this._measuredRefreshes += 1;
        if (this._measuredMs >= REFRESH_MEASURE_MS) {
            this._refreshHz = this._measuredRefreshes * 1000 / this._measuredMs;
        }
    }

    /** Cover the whole aperture with the frame, cropping its longer side. */
    _draw(index) {
        const source = this.frames[index];
        const width = source.width;
        const height = source.height;
        const crop = Math.min(width, height);
        this._ctx.drawImage(
            source,
            (width - crop) / 2, (height - crop) / 2, crop, crop,
            0, 0, this.side, this.side
        );
        this._shownIndex = index;
    }
}

/**
 * Mount a stream in `stage`, or return null when it must not appear.
 *
 * @param {HTMLElement} stage   the element the aperture is centred in
 * @param {object} options
 * @param {Array<CanvasImageSource & {width:number,height:number}>} options.frames decoded images
 * @param {number} [options.hz]      images per second, 4 to 12
 * @param {number} [options.sizePx]  the aperture's side, at most STREAM_APERTURE_PX
 * @param {Function} [options.onFallback] called once, with a reason, when the stream stops itself
 * @param {Function} [options.raf]   requestAnimationFrame, injectable for tests
 * @param {Function} [options.caf]   cancelAnimationFrame
 */
export function mountImageStream(stage, {
    frames,
    hz,
    sizePx,
    onFallback,
    raf = callback => requestAnimationFrame(callback),
    caf = id => cancelAnimationFrame(id)
} = {}) {
    const side = apertureSide(sizePx);
    // The whole safety case of this regime: refuse rather than draw if the
    // aperture could ever hold a flash that counts.
    if (!apertureIsInherentlySafe(side, side)) return null;
    if (!stage || !Array.isArray(frames) || frames.length === 0) return null;
    if (!imageStreamMayRun()) return null;
    return new ImageStream(stage, { frames, hz, side, raf, caf, onFallback });
}
