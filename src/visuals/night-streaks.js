/**
 * NightStreaks — light streaks rushing past a vanishing point.
 *
 * NEW. The one visual RISE did not have: forward speed. Streaks are
 * placed in a simple perspective tunnel and travel toward the viewer;
 * the vanishing point sways and the road bends slowly, so the motion
 * reads as a car drifting through a night city rather than a warp jump.
 *
 * Every streak's position is a pure function of time (no accumulated
 * state, no smear buffer), so `sampleAt(seconds)` gives the exact frame
 * a live run would show — the same contract as AttractorField — and the
 * canvas never strobes: nothing changes brightness faster than it moves.
 */

const PALETTES = {
    neon: ['255,46,170', '0,190,255', '154,107,255', '255,120,220', '120,230,255', '255,181,74'],
    ice: ['144,216,240', '72,144,240', '238,240,255']
};

const COUNT = 260;
const REDUCED_STILL_SECONDS = 7.5;
const clampSpeed = v => (Number.isFinite(v) ? Math.min(4, Math.max(0.25, v)) : 1);

function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class NightStreaks {
    /**
     * @param {HTMLElement} host
     * @param {{speed?:number,intensity?:number,palette?:string,seed?:number}} options
     */
    constructor(host, options = {}) {
        this.host = host;
        this.speed = clampSpeed(options.speed);
        this.intensity = options.intensity ?? 0.8;
        this.palette = PALETTES[options.palette] ? options.palette : 'neon';
        // Kept, not read once: the reader may turn reduced motion on mid-reading.
        this.reducedQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'night-streaks-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        host.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        const rnd = mulberry32(options.seed ?? 20260927);
        this.streaks = Array.from({ length: COUNT }, () => {
            const side = rnd() < 0.5 ? -1 : 1;
            const band = rnd();
            return {
                // lateral: kept off the centre line so the text column stays clear
                x: side * (0.35 + rnd() * 2.2),
                // most lights sit low (road, cars), some high (signs, towers)
                y: band < 0.7 ? 0.12 + rnd() * 0.5 : -(0.25 + rnd() * 1.1),
                phase: rnd(),
                rate: 0.55 + rnd() * 0.9,
                len: 0.05 + rnd() * 0.12,
                width: 0.6 + rnd() * 1.6,
                color: Math.floor(rnd() * 64)
            };
        });

        this.t0 = performance.now();
        this._motionBase = 0;
        this._sampleT = null;
        this.resize = this.resize.bind(this);
        this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(this.resize) : null;
        this.ro?.observe(host);
        this.resize();
        this.tick = this.tick.bind(this);
        this.rafId = requestAnimationFrame(this.tick);
    }

    resize() {
        this.DPR = Math.min(window.devicePixelRatio || 1, 2);
        this.W = this.host.clientWidth || window.innerWidth;
        this.H = this.host.clientHeight || window.innerHeight;
        this.canvas.width = Math.round(this.W * this.DPR);
        this.canvas.height = Math.round(this.H * this.DPR);
        this._stillDrawn = false;
    }

    motionTime(now) { return this._motionBase + ((now - this.t0) / 1000) * this.speed; }

    setSpeed(speed) {
        const next = clampSpeed(speed);
        if (next === this.speed) return false;
        const now = performance.now();
        this._motionBase = this.motionTime(now);
        this.t0 = now;
        this.speed = next;
        return true;
    }

    setIntensity(v) { if (Number.isFinite(v)) this.intensity = Math.min(1, Math.max(0.2, v)); }

    draw(t) {
        const { ctx, W, H } = this;
        if (!ctx || !W || !H) return;
        ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        const colors = PALETTES[this.palette];
        const f = Math.min(W, H) * 0.55;
        // drift: the vanishing point sways and the road bends with it
        const sway = Math.sin(t * 0.23) * 0.7 + Math.sin(t * 0.61 + 1.1) * 0.3;
        const vx = W / 2 + sway * W * 0.07;
        const vy = H * 0.56 + Math.sin(t * 0.31) * H * 0.015;
        const bend = sway * 0.9;

        const project = (s, z) => {
            const lateral = s.x + bend * (1 - z) * (1 - z) * 1.4;
            return [vx + (lateral / z) * f * 0.5, vy + (s.y / z) * f * 0.5];
        };

        for (const s of this.streaks) {
            // depth runs 1 (far) → 0.06 (passing the camera), then wraps
            const z = 0.06 + 0.94 * (1 - ((t * 0.16 * s.rate + s.phase) % 1));
            const zTail = Math.min(1, z + s.len * (0.6 + 0.4 * this.speed));
            const [x1, y1] = project(s, z);
            const [x0, y0] = project(s, zTail);
            const near = 1 - z;
            const fadeIn = Math.min(1, (1 - z) / 0.25);
            const a = this.intensity * fadeIn * (0.24 + 0.85 * near * near);
            if (a < 0.01) continue;
            const col = colors[s.color % colors.length];
            const g = ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, `rgba(${col},0)`);
            g.addColorStop(1, `rgba(${col},${Math.min(1, a)})`);
            ctx.strokeStyle = g;
            ctx.lineWidth = s.width * (0.4 + 3.2 * near * near);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    tick(now) {
        if (this._sampleT != null) { this.draw(this._sampleT); return; }
        // Reduced motion (OS or RISE setting): one still, then idle.
        const reduced = this.reducedQuery?.matches === true || document.documentElement.classList.contains('reduced-motion');
        if (!reduced || !this._stillDrawn) this.draw(reduced ? REDUCED_STILL_SECONDS * this.speed : this.motionTime(now));
        this._stillDrawn = reduced;
        this.rafId = requestAnimationFrame(this.tick);
    }

    /** The frame a live run shows `seconds` into playback. */
    sampleAt(seconds) {
        const pending = this.rafId;
        this.rafId = null;
        try {
            this._sampleT = Math.max(0, seconds) * this.speed;
            this.tick(performance.now());
            return this.canvas.toDataURL('image/webp', 0.9);
        } catch { return null; } finally {
            this._sampleT = null;
            this._stillDrawn = false;
            this.rafId = pending;
        }
    }

    pause() { if (!this.rafId) return false; cancelAnimationFrame(this.rafId); this.rafId = null; return true; }
    resume() { if (!this.rafId) this.rafId = requestAnimationFrame(this.tick); }
    destroy() { this.pause(); this.ro?.disconnect(); this.canvas.remove(); }
}
