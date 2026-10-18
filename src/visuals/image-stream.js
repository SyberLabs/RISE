/**
 * The Image Stream presenter at the fixation aperture (IMAGE-STREAM-SPEC §5).
 *
 * One small canvas, centred where the reader's eyes already rest, showing
 * decoded images one after another: frame replaces frame, with no fade, no
 * overlay and nothing drawn between them, so the aperture never passes
 * through black. The display drives it: the stream counts the refreshes it
 * has been shown for and `streamFrameAtRefresh` chooses the frame, so every
 * frame is held the same whole number of refreshes however the timestamps
 * jitter, and a seek or a late refresh never replays frames. Until the
 * refresh rate is measured the first frame holds still.
 *
 * The small aperture lowers the risk; it is not the safety argument. Page
 * zoom, an OS magnifier or the glass tile's blur can spread its light over
 * more of the screen than the page can measure, so a runtime FlashMeter reads
 * every frame it draws, one cell per drawn pixel, and judges it as if it
 * covered at least METER_FLOOR_AREA_PX. The meter tripping, anything in a
 * refresh throwing, the display stalling, the page being zoomed, the
 * reading's accepted notice ending, or the reader turning on
 * photosensitivity or reduced motion stops the stream for
 * good, hides it, and tells the caller once, so the Continuous Field is what
 * remains.
 */

import { FLASH_SAFE_AREA_PX, FlashMeter } from '../core/flash-meter.js';
import { summarizeFrame } from '../core/luminance.js';
import { normalizeStreamRate, streamFrameAtRefresh } from '../core/visual-presence.js';
import { hasFlashingSessionConsent } from '../core/visual-safety.js';
import { createRemoteImage } from './remote-image.js';

/** The aperture's side in CSS px: 19,600 px², under the 21,824 px² safe area, which lowers the risk and excuses nothing. */
export const STREAM_APERTURE_PX = 140;

/**
 * The least area the meter assumes the stream covers: four times the safe
 * area, 87,296 CSS px², a little more than the 140 px aperture at 200% page
 * zoom (78,400). Page zoom and magnifiers enlarge the canvas without
 * changing what the page measures, and a backdrop blur over the aperture
 * spreads its light, so the aperture's own size is never trusted. At this
 * floor a change over more than a quarter of the aperture counts.
 */
export const METER_FLOOR_AREA_PX = FLASH_SAFE_AREA_PX * 4;

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

function zoomSignature() {
    return `${window.devicePixelRatio}:${window.innerWidth}`;
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
        this._meter = new FlashMeter({ areaPx: METER_FLOOR_AREA_PX });
        // Page zoom changes both; neither should move while the stream runs.
        this._zoomSignature = zoomSignature();
        this._shownMs = 0;
        this.hz = normalizeStreamRate(hz);
        this.side = side;
        this._raf = raf;
        this._caf = caf;
        this._rafId = null;
        this._lastTs = null;
        this._refreshes = 0;
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
        const ms = Math.max(0, Number(elapsedMs) || 0);
        this._refreshes = Math.round(ms * (this._refreshHz ?? 60) / 1000);
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
            if (!hasFlashingSessionConsent()) return this._fallBack('consent');
            if (!imageStreamMayRun()) return this._fallBack('stand-down');
            if (zoomSignature() !== this._zoomSignature) return this._fallBack('zoom');
            if (this._lastTs !== null) {
                const delta = ts - this._lastTs;
                if (delta > STALL_MS) return this._fallBack('stall');
                this._shownMs += delta;
                if (this._refreshHz === null) {
                    this._measure(delta);
                } else {
                    // A whole number of refreshes per timestamp: jitter rounds
                    // away, and a missed refresh still counts as time shown.
                    this._refreshes += Math.max(1, Math.round(delta * this._refreshHz / 1000));
                }
            }
            this._lastTs = ts;
            const { index } = streamFrameAtRefresh(this._refreshes, this.frames.length, {
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
     * The CSS px² the meter judges the aperture by: what it measures on
     * screen (pinch-zoom and stretching stylesheets included), never less
     * than METER_FLOOR_AREA_PX, and unbounded when it cannot be measured, so
     * any transition counts.
     */
    _screenAreaPx() {
        const rect = this.canvas.getBoundingClientRect();
        const scale = Number(window.visualViewport?.scale);
        const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const area = Math.max(this.side * this.side, rect.width * rect.height) * zoom * zoom;
        return Number.isFinite(area) ? Math.max(METER_FLOOR_AREA_PX, area) : Infinity;
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

    /**
     * The display's refresh rate, from the first half second of refreshes,
     * to the nearest whole hertz: a millisecond of timestamp jitter at either
     * end of the window moves the raw figure by about 0.4%, which would
     * otherwise hold 120 Hz frames 16 refreshes instead of 15. A rate that is
     * wrong (a throttled tab, a display that changes its rate) is not a
     * safety question: the meter and the stall stop are.
     */
    _measure(delta) {
        if (this._refreshHz !== null || !(delta > 0)) return;
        this._measuredMs += delta;
        this._measuredRefreshes += 1;
        if (this._measuredMs >= REFRESH_MEASURE_MS) {
            this._refreshHz = Math.max(1, Math.round(this._measuredRefreshes * 1000 / this._measuredMs));
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
 * Decode up to `limit` images for a stream, in order, leaving out any that
 * fail. Each is requested with CORS so its pixels can be read back for the
 * meter; an image served without CORS fails here instead of tainting the
 * canvas, which would stop the stream at its first frame.
 */
export async function decodeStreamFrames(urls, { limit = 24 } = {}) {
    const wanted = (Array.isArray(urls) ? urls : [])
        .filter(url => typeof url === 'string' && url)
        .slice(0, limit);
    const decoded = await Promise.all(wanted.map(async url => {
        const image = createRemoteImage();
        image.crossOrigin = 'anonymous';
        image.src = url;
        try {
            await image.decode();
            return image;
        } catch {
            return null;
        }
    }));
    return decoded.filter(Boolean);
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
    if (!stage || !Array.isArray(frames) || frames.length === 0) return null;
    if (!hasFlashingSessionConsent() || !imageStreamMayRun()) return null;
    return new ImageStream(stage, { frames, hz, side, raf, caf, onFallback });
}
