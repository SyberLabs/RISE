/**
 * A FLASH IS MEASURED IN LIGHT, NOT COUNTED IN EVENTS.
 *
 * `VisualFlashGate` limits how often something is shown. That is the right
 * guard for an interrupt economy and the wrong one for a stream: a stream
 * shows something every frame, and whether it flashes depends on how the
 * light changes between frames, where, and over how much of the screen.
 *
 * This meter applies WCAG 2.3.1 to frame summaries from `luminance.js`:
 *
 *   - a general transition is a change of at least 0.1 in relative luminance
 *     where the darker state is below 0.80;
 *   - a red transition is a change of more than 20 in the saturated-red value;
 *   - either only counts on a frame when the area changing exceeds 25% of a
 *     10 degree field (21,824 CSS px², from WCAG's 341 × 256 estimate);
 *   - a flash is a pair of transitions, and RISE allows at most two in any
 *     one second, one inside WCAG's three.
 *
 * Each cell tracks turning points rather than frame-to-frame differences, so
 * a slow dissolve that adds up to a large change is one transition, and many
 * small steps cannot hide a large swing.
 *
 * See docs/specs/IMAGE-STREAM-SPEC.md §3.
 */

export const WCAG_FIELD_PX = 341 * 256;
export const FLASH_SAFE_AREA_PX = WCAG_FIELD_PX / 4;
export const FLASH_WINDOW_MS = 1000;
export const STREAM_MAX_FLASHES_PER_WINDOW = 2;

const GENERAL_DELTA = 0.1;
const GENERAL_DARKER_CEILING = 0.8;
const RED_DELTA = 20;

/**
 * Whether an area, as the page measures it, is within the safe area. This is
 * arithmetic, not a safety argument: page zoom, magnifiers and blur enlarge
 * what the reader sees without changing what the page measures, so no
 * stream is exempt from the meter for being small (IMAGE-STREAM-SPEC §3).
 */
export function apertureIsInherentlySafe(cssWidth, cssHeight, safeAreaPx = FLASH_SAFE_AREA_PX) {
    const area = Number(cssWidth) * Number(cssHeight);
    return Number.isFinite(area) && area >= 0 && area <= safeAreaPx;
}

/** Turning-point tracker for one channel across every cell of the grid. */
class ChannelTracker {
    constructor(cells, delta, darkerCeiling) {
        this.delta = delta;
        this.ceiling = darkerCeiling;
        this.low = new Float32Array(cells);
        this.high = new Float32Array(cells);
        this.extreme = new Float32Array(cells);
        this.direction = new Int8Array(cells);
        this.seen = false;
    }

    /** Feed one frame's values; return how many cells transitioned. */
    observe(values) {
        if (!this.seen) {
            this.low.set(values);
            this.high.set(values);
            this.seen = true;
            return 0;
        }
        let transitioned = 0;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            const dir = this.direction[i];
            if (dir === 0) {
                if (v < this.low[i]) this.low[i] = v;
                if (v > this.high[i]) this.high[i] = v;
                if (this.high[i] - this.low[i] >= this.delta && this.low[i] < this.ceiling) {
                    this.direction[i] = v >= this.high[i] ? 1 : -1;
                    this.extreme[i] = v;
                    transitioned++;
                }
                continue;
            }
            const moved = v - this.extreme[i];
            if (moved * dir >= 0) {
                this.extreme[i] = v;
            } else if (Math.abs(moved) >= this.delta && Math.min(v, this.extreme[i]) < this.ceiling) {
                this.direction[i] = -dir;
                this.extreme[i] = v;
                transitioned++;
            }
        }
        return transitioned;
    }
}

export class FlashMeter {
    /**
     * @param {object} options
     * @param {number} options.areaPx       CSS px² the frames are drawn over.
     * @param {number} [options.safeAreaPx] area a transition must exceed to count.
     * @param {number} [options.windowMs]   the sliding window, one second.
     * @param {number} [options.maxFlashes] flashes allowed in any window.
     */
    constructor({
        areaPx,
        safeAreaPx = FLASH_SAFE_AREA_PX,
        windowMs = FLASH_WINDOW_MS,
        maxFlashes = STREAM_MAX_FLASHES_PER_WINDOW
    } = {}) {
        // A missing area would make every transition count as none: refuse it.
        if (typeof areaPx !== 'number' || !(areaPx >= 0)) {
            throw new RangeError(`the meter needs the area the frames cover, in CSS px², not ${String(areaPx)}`);
        }
        this.areaPx = areaPx;
        this.safeAreaPx = safeAreaPx;
        this.windowMs = windowMs;
        this.maxFlashes = maxFlashes;
        this.reset();
    }

    reset() {
        this.grid = null;
        this.general = null;
        this.red = null;
        this.events = { general: [], red: [] };
    }

    /**
     * Record one frame as it reaches the screen at `timeMs`, and report the
     * flashes in the window ending there. `ok` is false once either channel
     * exceeds `maxFlashes`; the caller stops the stream.
     */
    observe(summary, timeMs) {
        if (summary.cols !== summary.width || summary.rows !== summary.height) {
            throw new RangeError(`the meter needs one cell per pixel: a ${summary.cols}×${summary.rows} grid `
                + `averages a ${summary.width}×${summary.height} frame, and a pattern inverting inside a cell is invisible to it`);
        }
        const cells = summary.cols * summary.rows;
        if (!this.grid) {
            this.grid = { cols: summary.cols, rows: summary.rows };
            this.general = new ChannelTracker(cells, GENERAL_DELTA, GENERAL_DARKER_CEILING);
            this.red = new ChannelTracker(cells, RED_DELTA, Infinity);
        } else if (summary.cols !== this.grid.cols || summary.rows !== this.grid.rows) {
            throw new RangeError(`frame grid ${summary.cols}×${summary.rows} does not match the meter's `
                + `${this.grid.cols}×${this.grid.rows}`);
        }

        const cellArea = this.areaPx / cells;
        const counts = (transitioned) => transitioned * cellArea > this.safeAreaPx;
        const transition = {
            general: counts(this.general.observe(summary.luminance)),
            red: counts(this.red.observe(summary.red))
        };

        const flashes = {};
        for (const channel of ['general', 'red']) {
            const kept = this.events[channel].filter(t => timeMs - t < this.windowMs);
            if (transition[channel]) kept.push(timeMs);
            this.events[channel] = kept;
            flashes[channel] = Math.floor(kept.length / 2);
        }
        return {
            transition,
            flashes,
            ok: flashes.general <= this.maxFlashes && flashes.red <= this.maxFlashes
        };
    }
}

/**
 * Play a reel through a fresh meter, looping until every window of a steady
 * stream has been seen (at least two loops, so the wrap from the last frame
 * to the first is always checked), and report the worst window.
 */
export function certifySequence(frames, { frameMs, areaPx, ...meterOptions } = {}) {
    // Without a frame time a reel would certify having checked nothing, or
    // never finish; refuse it instead.
    if (typeof frameMs !== 'number' || !Number.isFinite(frameMs) || frameMs <= 0) {
        throw new RangeError(`a reel needs a positive, finite frame time in ms, not ${String(frameMs)}`);
    }
    const meter = new FlashMeter({ areaPx, ...meterOptions });
    const worst = { general: 0, red: 0 };
    let firstViolationMs = null;
    if (!frames.length) return { ok: true, worst, firstViolationMs };

    const reelMs = frames.length * frameMs;
    const loops = Math.max(2, Math.ceil((reelMs + meter.windowMs) / reelMs));
    for (let i = 0; i < frames.length * loops; i++) {
        const timeMs = i * frameMs;
        const report = meter.observe(frames[i % frames.length], timeMs);
        worst.general = Math.max(worst.general, report.flashes.general);
        worst.red = Math.max(worst.red, report.flashes.red);
        if (!report.ok && firstViolationMs === null) firstViolationMs = timeMs;
    }
    return { ok: firstViolationMs === null, worst, firstViolationMs };
}
