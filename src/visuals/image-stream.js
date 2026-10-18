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
 * The least area the meter judges the stream by: 64 × the safe area,
 * 1,396,736 CSS px². What it buys: a transition counts once it covers more
 * than 19,600 / 64 = 306.25 of the aperture's 19,600 pixels (1.56%, about a
 * 17.5 px square). The largest change it lets pass, 306 px, then covers
 *
 *   - at 500% zoom, no blur:            306 × 25 = 7,650 px², 0.35 × the safe area;
 *   - under the glass tile's blur(16px), which carries a ≥ 0.1 change up to
 *     about 20 px past each edge: (17.5 + 40)² = 3,306 px² at 100%, still
 *     under the safe area up to √(21,824 / 3,306) = 2.57× magnification.
 *
 * No floor covers blur at 500%: the 40 px margin alone covers 200² = 40,000
 * px² there. So zoom the page can see is handled apart from the floor
 * (refused at mount, any change of browser zoom or pinch-zoom mid-stream
 * stops it, the device pixel ratio multiplies the measured area), and an OS
 * magnifier above about 2.5× over the glass tile is a residual risk the
 * floor only narrows
 * (IMAGE-STREAM-SPEC §3).
 */
export const METER_FLOOR_AREA_PX = FLASH_SAFE_AREA_PX * 64;

const REFRESH_MEASURE_MS = 500;
// A small pool, loaded one at a time: at most 24 frames and sixteen
// megapixels retained (64 MB nominal RGBA), none over eight megapixels. The whole
// reel gets five seconds, so sequential loading cannot multiply the wait.
const STREAM_FRAMES_MAX = 24;
const DECODE_MAX_PIXELS = 8_000_000;
const DECODE_TOTAL_MAX_PIXELS = 16_000_000;
const DECODE_TIMEOUT_MS = 5000;
// A frame held this long is far beyond any slot (the slowest is 250 ms at
// 4 Hz): the display is not keeping time, so the stream stops.
const STALL_MS = 500;
// The clock counts refreshes at the measured rate, and real time caps it: a
// frame is never replaced sooner than one frame at the asked rate, less this
// much for timestamp jitter. If the last 30 refresh intervals disagree with
// the measured rate by more than a fifth, the stream stands down.
const RATE_CAP_TOLERANCE_MS = 2.5;
const REFRESH_CHECK_COUNT = 30;
const REFRESH_DISAGREEMENT = 0.2;

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

/** Browser zoom moves the first two, pinch-zoom the third; none may move while the stream runs. */
function zoomSignature() {
    return `${window.devicePixelRatio}:${window.innerWidth}:${window.visualViewport?.scale}`;
}

/**
 * Whether the page already looks zoomed: browser zoom makes the CSS viewport
 * narrower than the window, and pinch-zoom scales the visual viewport. A
 * window with something docked beside the page reads as zoomed too, and the
 * stream simply does not start: a refusal costs nothing.
 */
function pageLooksZoomed() {
    const outer = Number(window.outerWidth);
    const inner = Number(window.innerWidth);
    const ratio = outer > 0 && inner > 0 ? outer / inner : 1;
    const scale = Number(window.visualViewport?.scale);
    return ratio > 1.1 || ratio < 0.9 || (Number.isFinite(scale) && scale > 1.01);
}

/** A magnification the page reports, never less than 1. */
function magnification(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 1 ? number : 1;
}

/** Cover a side × side square with the source, cropping its longer side. */
function drawCover(ctx, source, side) {
    const crop = Math.min(source.width, source.height);
    ctx.drawImage(
        source,
        (source.width - crop) / 2, (source.height - crop) / 2, crop, crop,
        0, 0, side, side
    );
}

function isOpaque(rgba) {
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) return false;
    return true;
}

/**
 * Whether a frame, drawn as the aperture draws it, covers every pixel. A
 * frame with any transparency (a PNG with an alpha channel) would let the
 * Gallery show through light the meter never reads, so it is left out; so is
 * one whose pixels cannot be read.
 */
function frameIsOpaque(source, side) {
    try {
        const scratch = document.createElement('canvas');
        scratch.width = side;
        scratch.height = side;
        const ctx = scratch.getContext('2d', { willReadFrequently: true });
        drawCover(ctx, source, side);
        return isOpaque(ctx.getImageData(0, 0, side, side).data);
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
        this._fallBackReason = null;
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
        this._changedAtMs = null;
        this._intervals = [];
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
        // Photosensitivity mode or reduced motion switched on at any moment,
        // paused or not, ends the stream: switching it off again does not
        // bring it back.
        if (typeof MutationObserver === 'function') {
            this._observer = new MutationObserver(() => {
                if (!imageStreamMayRun()) this._fallBack('stand-down');
            });
            this._observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
    }

    get running() {
        return this._rafId !== null;
    }

    resume() {
        if (this.running || !this.canvas || this._fellBack) return;
        if (!hasFlashingSessionConsent()) return this._fallBack('consent');
        if (!imageStreamMayRun()) return this._fallBack('stand-down');
        this._lastTs = null;
        this._intervals = [];
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
        this._observer?.disconnect();
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
                    if (this._refreshRateDisagrees(delta)) return this._fallBack('refresh');
                }
            }
            this._lastTs = ts;
            const { index } = streamFrameAtRefresh(this._refreshes, this.frames.length, {
                hz: this.hz,
                refreshHz: this._refreshHz
            });
            const capOpen = this._changedAtMs === null
                || this._shownMs - this._changedAtMs >= 1000 / this.hz - RATE_CAP_TOLERANCE_MS;
            if (index !== this._shownIndex && capOpen) {
                this._draw(index);
                this._changedAtMs = this._shownMs;
                if (!this._lightIsSafe()) return this._fallBack(this._fallBackReason || 'meter');
            }
        } catch {
            return this._fallBack('error');
        }
        this._rafId = this._raf(this._tick);
    }

    /**
     * Whether the display has stopped refreshing at the rate it was measured
     * at: the median of the last 30 intervals more than a fifth away from it.
     */
    _refreshRateDisagrees(delta) {
        this._intervals.push(delta);
        if (this._intervals.length > REFRESH_CHECK_COUNT) this._intervals.shift();
        if (this._intervals.length < REFRESH_CHECK_COUNT) return false;
        const sorted = [...this._intervals].sort((a, b) => a - b);
        const median = (sorted[REFRESH_CHECK_COUNT / 2 - 1] + sorted[REFRESH_CHECK_COUNT / 2]) / 2;
        return Math.abs(median * this._refreshHz / 1000 - 1) > REFRESH_DISAGREEMENT;
    }

    /** Read back the frame just drawn and put it through the meter. */
    _lightIsSafe() {
        const { data } = this._ctx.getImageData(0, 0, this.side, this.side);
        const summary = summarizeFrame(data, this.side, this.side);
        // The meter composites over black; what is under the canvas is the
        // Gallery, so a canvas that is not opaque is light it has not seen.
        if (!isOpaque(data)) {
            this._fallBackReason = 'transparent';
            return false;
        }
        // The meter's area is set per frame because the aperture's size on
        // screen can change under it. Time is time shown: a seek moves the
        // stream's clock, never the meter's window.
        this._meter.areaPx = this._screenAreaPx();
        return this._meter.observe(summary, this._shownMs).ok;
    }

    /**
     * The CSS px² the meter judges the aperture by: what it measures on
     * screen, multiplied by the device pixel ratio (squared, never below 1),
     * never less
     * than METER_FLOOR_AREA_PX, and unbounded when it cannot be measured, so
     * any transition counts.
     */
    _screenAreaPx() {
        const rect = this.canvas.getBoundingClientRect();
        // Pinch-zoom is not multiplied in: it is refused at mount and stands
        // the stream down the moment it changes.
        const zoom = magnification(window.devicePixelRatio);
        const area = Math.max(this.side * this.side, rect.width * rect.height) * zoom * zoom;
        return Number.isFinite(area) ? Math.max(METER_FLOOR_AREA_PX, area) : Infinity;
    }

    /** Stop for good, hide the aperture, and say so once. */
    _fallBack(reason) {
        if (this._fellBack) return;
        this._fellBack = true;
        this._observer?.disconnect();
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
     * wrong (a throttled tab, a display that changes its rate) cannot speed
     * the stream up: real time caps every frame, and the refresh check stands
     * the stream down.
     */
    _measure(delta) {
        if (this._refreshHz !== null || !(delta > 0)) return;
        this._measuredMs += delta;
        this._measuredRefreshes += 1;
        if (this._measuredMs >= REFRESH_MEASURE_MS) {
            this._refreshHz = Math.max(1, Math.round(this._measuredRefreshes * 1000 / this._measuredMs));
        }
    }

    _draw(index) {
        drawCover(this._ctx, this.frames[index], this.side);
        this._shownIndex = index;
    }
}

/**
 * Decode up to `limit` images for a stream, in order, leaving out any that
 * fail. Each is requested with CORS so its pixels can be read back for the
 * meter; an image served without CORS fails here instead of tainting the
 * canvas, which would stop the stream at its first frame.
 */
export async function decodeStreamFrames(urls, { limit = STREAM_FRAMES_MAX } = {}) {
    const wanted = (Array.isArray(urls) ? urls : [])
        .filter(url => typeof url === 'string' && url)
        .slice(0, Math.min(STREAM_FRAMES_MAX, Math.max(0, Number(limit) || 0)));
    const decoded = [];
    let retainedPixels = 0;
    const deadline = Date.now() + DECODE_TIMEOUT_MS;
    for (const url of wanted) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0 || retainedPixels >= DECODE_TOTAL_MAX_PIXELS) break;
        const image = createRemoteImage();
        image.crossOrigin = 'anonymous';
        const loaded = new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });
        image.src = url;
        let timer = null;
        let active = true;
        let accepted = false;
        let pixels = 0;
        const timedOut = new Promise(resolve => { timer = setTimeout(() => resolve(false), remainingMs); });
        // Check natural size before explicitly decoding. Browsers may also
        // allocate while loading: one request at a time bounds concurrency,
        // not the browser's internal peak memory usage.
        const ready = async () => {
            await loaded;
            if (!active) return false;
            pixels = (image.naturalWidth || image.width) * (image.naturalHeight || image.height);
            if (!(pixels > 0 && pixels <= DECODE_MAX_PIXELS)
                || retainedPixels + pixels > DECODE_TOTAL_MAX_PIXELS) return false;
            await image.decode();
            return true;
        };
        try {
            if (await Promise.race([ready(), timedOut])) {
                accepted = true;
                retainedPixels += pixels;
                decoded.push(image);
            }
        } catch {
            // Leave out a failed load or decode and try the next URL.
        } finally {
            active = false;
            clearTimeout(timer);
            image.onload = null;
            image.onerror = null;
            if (!accepted) image.src = '';
        }
    }
    return decoded;
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
    if (!stage || !Array.isArray(frames) || !hasFlashingSessionConsent() || !imageStreamMayRun()) return null;
    if (pageLooksZoomed()) return null;
    const opaque = frames.filter(source => frameIsOpaque(source, side));
    if (opaque.length === 0) return null;
    return new ImageStream(stage, { frames: opaque, hz, side, raf, caf, onFallback });
}
