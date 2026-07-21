/**
 * AttractorField
 * Persistent strange-attractor renderer for the Chamber.
 *
 * Ported from the eidolon studies (strange_attractor*.html):
 * the chosen system is integrated once into a long filament of points,
 * then continuously rotated, projected, and drawn as a glowing curve
 * with light pulses travelling along the flow direction.
 *
 * Unlike Visual Interlocution (probabilistic interrupts), this field is
 * constant: it breathes around the centered text stream for the whole
 * session. Gentle by design — the flicker never approaches a strobe.
 *
 * Systems: 'aizawa' | 'thomas' | 'halvorsen'
 */

const SYSTEMS = {
    aizawa: {
        name: 'Aizawa',
        n: 11000,
        dt: 0.01,
        transient: 1200,
        seed: [0.1, 0.0, 0.0],
        // a=0.95 b=0.7 c=0.6 d=3.5 e=0.25 f=0.1
        f(x, y, z, o) {
            o[0] = (z - 0.7) * x - 3.5 * y;
            o[1] = 3.5 * x + (z - 0.7) * y;
            o[2] = 0.6 + 0.95 * z - (z * z * z) / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
        }
    },
    thomas: {
        name: 'Thomas',
        n: 13000,
        dt: 0.025,
        transient: 1000,
        seed: [0.5, 0.6, -0.7],
        // cyclically symmetric, b=0.19
        f(x, y, z, o) {
            o[0] = Math.sin(y) - 0.19 * x;
            o[1] = Math.sin(z) - 0.19 * y;
            o[2] = Math.sin(x) - 0.19 * z;
        }
    },
    halvorsen: {
        name: 'Halvorsen',
        n: 9000,
        dt: 0.005,
        transient: 2000,
        seed: [-1.48, -1.51, 2.04],
        // a=1.4
        f(x, y, z, o) {
            o[0] = -1.4 * x - 4 * y - 4 * z - y * y;
            o[1] = -1.4 * y - 4 * z - 4 * x - z * z;
            o[2] = -1.4 * z - 4 * x - 4 * y - x * x;
        }
    }
};

const NB = 7; // brightness buckets
const BUCKET_ALPHA = [0.012, 0.03, 0.06, 0.11, 0.2, 0.38, 0.7];

// travelling pulses — light flowing along the curve
const HEADS = [
    { speed: 0.052, phase: 0.00, peak: 1.00 },
    { speed: 0.034, phase: 0.41, peak: 0.78 },
    { speed: 0.071, phase: 0.73, peak: 0.62 }
];

/**
 * Filament palettes.
 *
 * Each is a two-pass structure: a WIDE, dim halo underneath and a NARROW,
 * bright core on top. That pairing is what makes a 1px line read as
 * luminous rather than merely thin — the halo is the light in the air
 * around the filament.
 *
 * `twin` is the cooler mirror form, `head` the travelling pulse. Colored
 * palettes keep their cores near-white at the very center so the pulse
 * still reads as light rather than as paint; the hue lives in the halo.
 */
const PALETTES = {
    white: {
        name: 'White',
        core: [{ w: 2.6, mul: 0.5, col: '200,222,255' }, { w: 0.7, mul: 1.0, col: '255,255,255' }],
        twin: [{ w: 2.6, mul: 0.5, col: '120,150,205' }, { w: 0.7, mul: 1.0, col: '182,206,245' }],
        head: ['255,255,255', '210,230,255', '120,170,255']
    },
    red: {
        name: 'Red',
        core: [{ w: 2.8, mul: 0.5, col: '196,44,40' }, { w: 0.7, mul: 1.0, col: '255,196,170' }],
        twin: [{ w: 2.8, mul: 0.5, col: '120,26,30' }, { w: 0.7, mul: 1.0, col: '226,130,110' }],
        head: ['255,236,222', '255,138,96', '190,30,30']
    },
    blue: {
        name: 'Blue',
        core: [{ w: 2.8, mul: 0.5, col: '44,110,220' }, { w: 0.7, mul: 1.0, col: '198,226,255' }],
        twin: [{ w: 2.8, mul: 0.5, col: '26,62,140' }, { w: 0.7, mul: 1.0, col: '130,170,226' }],
        head: ['244,250,255', '120,186,255', '20,70,200']
    },
    gold: {
        name: 'Gold',
        core: [{ w: 2.8, mul: 0.5, col: '196,132,26' }, { w: 0.7, mul: 1.0, col: '255,232,176' }],
        twin: [{ w: 2.8, mul: 0.5, col: '120,78,20' }, { w: 0.7, mul: 1.0, col: '224,180,110' }],
        head: ['255,248,226', '255,200,90', '190,120,20']
    },
    purple: {
        name: 'Purple',
        core: [{ w: 2.8, mul: 0.5, col: '128,72,214' }, { w: 0.7, mul: 1.0, col: '224,204,255' }],
        twin: [{ w: 2.8, mul: 0.5, col: '74,40,130' }, { w: 0.7, mul: 1.0, col: '166,140,220' }],
        head: ['248,242,255', '178,132,255', '90,40,190']
    }
};

const DEFAULT_PALETTE = 'white';

/**
 * Forms the filament can take. `mirror` is the original 3D twin; the
 * others are symmetry operations applied to the same projected points,
 * so switching between them costs nothing but a different draw pass.
 */
const FORMS = ['mirror', 'kaleido', 'bilateral'];

// Kaleidoscope: dihedral rosette. Each of M sectors is drawn twice,
// reflected, which is what closes the rosette into a seamless mandala.
const KALEIDO_SECTORS = 6;
const KALEIDO_MUL = 0.52;

const wrap01 = v => v - Math.floor(v);

export class AttractorField {
    /**
     * @param {HTMLElement} host - positioned container the canvas fills
     * @param {Object} options
     * @param {string} options.system - 'aizawa' | 'thomas' | 'halvorsen'
     * @param {string} options.palette - 'white' | 'red' | 'blue' | 'gold' | 'purple'
     * @param {string} options.form - 'mirror' | 'kaleido' | 'bilateral'
     * @param {number} options.intensity - master brightness multiplier (default 0.65, keeps text legible)
     */
    constructor(host, options = {}) {
        this.host = host;
        this.system = SYSTEMS[options.system] ? options.system : 'aizawa';
        this.palette = PALETTES[options.palette] ? options.palette : DEFAULT_PALETTE;
        this.form = FORMS.includes(options.form) ? options.form : 'mirror';
        this.intensity = options.intensity ?? 0.65;
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'attractor-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.host.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.W = 0;
        this.H = 0;
        this.DPR = 1;
        this.rafId = null;
        this.t0 = performance.now();

        this.integrate();

        this.resize = this.resize.bind(this);
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(this.host);
        window.addEventListener('resize', this.resize);
        this.resize();

        this.tick = this.tick.bind(this);
        this.rafId = requestAnimationFrame(this.tick);
    }

    /* ── integrate the chosen system into a filament of points (RK4) ── */
    integrate() {
        const sys = SYSTEMS[this.system];
        const N = sys.n;
        const dt = sys.dt;
        this.N = N;
        this.px = new Float32Array(N);
        this.py = new Float32Array(N);
        this.pz = new Float32Array(N);

        let [x, y, z] = sys.seed;
        const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0];
        const step = () => {
            sys.f(x, y, z, k1);
            sys.f(x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1], z + 0.5 * dt * k1[2], k2);
            sys.f(x + 0.5 * dt * k2[0], y + 0.5 * dt * k2[1], z + 0.5 * dt * k2[2], k3);
            sys.f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2], k4);
            x += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
            y += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
            z += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        };
        for (let i = 0; i < sys.transient; i++) step();
        for (let i = 0; i < N; i++) {
            step();
            this.px[i] = x; this.py[i] = y; this.pz[i] = z;
        }

        // centroid + radius for centering / fitting
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < N; i++) { cx += this.px[i]; cy += this.py[i]; cz += this.pz[i]; }
        this.cx = cx / N; this.cy = cy / N; this.cz = cz / N;
        let r2 = 0;
        for (let i = 0; i < N; i++) {
            const a = this.px[i] - this.cx, b = this.py[i] - this.cy, c = this.pz[i] - this.cz;
            const r = a * a + b * b + c * c;
            if (r > r2) r2 = r;
        }
        this.modelR = Math.sqrt(r2);
        this.focal = this.modelR * 2.6;

        // per-frame projection buffers (base + mirror twin)
        this.sx = new Float32Array(N); this.sy = new Float32Array(N);
        this.sx2 = new Float32Array(N); this.sy2 = new Float32Array(N);
        this.briB = new Float32Array(N); this.briT = new Float32Array(N);
        this.bktsB = Array.from({ length: NB }, () => []);
        this.bktsT = Array.from({ length: NB }, () => []);
    }

    resize() {
        this.DPR = Math.min(window.devicePixelRatio || 1, 2);
        this.W = this.host.clientWidth || window.innerWidth;
        this.H = this.host.clientHeight || window.innerHeight;
        this.canvas.width = Math.round(this.W * this.DPR);
        this.canvas.height = Math.round(this.H * this.DPR);
        this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    }

    strokeForm(X, Y, bkts, passes, mul, flick) {
        const ctx = this.ctx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let pi = 0; pi < passes.length; pi++) {
            const pass = passes[pi];
            ctx.lineWidth = pass.w;
            for (let b = 1; b < NB; b++) {
                const list = bkts[b];
                if (!list.length) continue;
                let alpha = BUCKET_ALPHA[b] * pass.mul * mul * flick * this.intensity;
                if (alpha <= 0.004) continue;
                if (alpha > 1) alpha = 1;
                ctx.strokeStyle = `rgba(${pass.col},${alpha})`;
                ctx.beginPath();
                for (let j = 0; j < list.length; j++) {
                    const i = list[j];
                    ctx.moveTo(X[i], Y[i]);
                    ctx.lineTo(X[i + 1], Y[i + 1]);
                }
                ctx.stroke();
            }
        }
    }

    drawHeads(X, Y, hp, mul, flick) {
        const ctx = this.ctx;
        const [hot, mid, cold] = PALETTES[this.palette].head;
        for (let k = 0; k < HEADS.length; k++) {
            const idx = Math.min(this.N - 1, (hp[k] * this.N) | 0);
            const hx = X[idx], hy = Y[idx];
            const rad = (2.0 + HEADS[k].peak * 2.2) * 4;
            const ha = HEADS[k].peak * flick * mul * this.intensity;
            const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, rad);
            g.addColorStop(0, `rgba(${hot},${0.9 * ha})`);
            g.addColorStop(0.3, `rgba(${mid},${0.35 * ha})`);
            g.addColorStop(1, `rgba(${cold},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(hx, hy, rad, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    bucketize(bri, bkts) {
        for (let b = 0; b < NB; b++) bkts[b].length = 0;
        for (let i = 0; i < this.N - 1; i++) {
            let v = bri[i];
            if (v > 1) v = 1;
            let bk = (v * NB) | 0;
            if (bk >= NB) bk = NB - 1;
            bkts[bk].push(i);
        }
    }

    tick(now) {
        const t = (now - this.t0) / 1000;
        const N = this.N;

        // Respect both the OS media query (cached) and the app's own
        // accessibility settings (root classes set by Settings) — the
        // canvas layer is invisible to CSS-based animation kill switches.
        const rootClasses = document.documentElement.classList;
        const reduced = this.reduced || rootClasses.contains('reduced-motion');
        const photosafe = rootClasses.contains('photosensitivity-mode');
        const yawSpeed = reduced ? 0.06 : 0.16;
        const flickAmp = photosafe ? 0 : (reduced ? 0.04 : 0.12);

        // gentle, never-fully-dark flicker — a living filament, not a strobe
        const flick = 1 - flickAmp * (0.5 + 0.5 * Math.sin(t * 2.3))
            * (0.6 + 0.4 * Math.sin(t * 7.9 + 1.3));

        // camera: steady yaw, slow pitch wobble
        const yaw = t * yawSpeed;
        const pitch = -0.30 + 0.22 * Math.sin(t * 0.21);
        const cyA = Math.cos(yaw), syA = Math.sin(yaw);
        const cxA = Math.cos(pitch), sxA = Math.sin(pitch);

        const fitR = 0.42 * Math.min(this.W, this.H);
        const scale = fitR / this.modelR;
        const CX = this.W / 2, CY = this.H / 2;

        const hp = HEADS.map(h => wrap01(t * h.speed + h.phase));
        const needTwin = this.form === 'mirror';

        // project + brightness for base form and mirror twin
        for (let i = 0; i < N; i++) {
            const ax = this.px[i] - this.cx, ay = this.py[i] - this.cy, az = this.pz[i] - this.cz;
            const x1 = ax * cyA + az * syA, z1 = -ax * syA + az * cyA, y1 = ay;
            const y2 = y1 * cxA - z1 * sxA, z2 = y1 * sxA + z1 * cxA;
            const persp = this.focal / (this.focal + z2);
            this.sx[i] = x1 * scale * persp;
            this.sy[i] = y2 * scale * persp;

            let flow = 0;
            const p = i / N;
            for (let k = 0; k < HEADS.length; k++) {
                const h = HEADS[k];
                let fwd = wrap01(hp[k] - p);
                if (fwd > 0.5) fwd -= 1;
                const core = Math.exp(-(fwd * fwd) / (2 * 0.012 * 0.012));
                const wake = (fwd > 0) ? 0.42 * Math.exp(-(fwd * fwd) / (2 * 0.07 * 0.07)) : 0;
                flow += h.peak * (core + wake);
            }
            this.briB[i] = 0.06 + flow + 0.05 * (persp - 0.85);

            // Only the mirror form needs the reflected twin projection;
            // kaleido and bilateral are symmetry operations on the base
            // points, so skipping this halves their per-frame math.
            if (needTwin) {
                const mx = -ax;
                const X1 = mx * cyA + az * syA, Z1 = -mx * syA + az * cyA;
                const Y2 = y1 * cxA - Z1 * sxA, Z2 = y1 * sxA + Z1 * cxA;
                const persp2 = this.focal / (this.focal + Z2);
                this.sx2[i] = X1 * scale * persp2;
                this.sy2[i] = Y2 * scale * persp2;
                this.briT[i] = 0.045 + 0.9 * flow + 0.05 * (persp2 - 0.85);
            }
        }

        this.bucketize(this.briB, this.bktsB);
        if (needTwin) this.bucketize(this.briT, this.bktsT);

        const palette = PALETTES[this.palette];
        const ctx = this.ctx;
        ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, this.W, this.H);
        ctx.globalCompositeOperation = 'lighter';

        if (this.form === 'kaleido') {
            // Dihedral rosette: every sector drawn twice, once reflected,
            // which closes the figure into a seamless mandala.
            for (let k = 0; k < KALEIDO_SECTORS; k++) {
                for (let r = 1; r >= -1; r -= 2) {
                    ctx.save();
                    ctx.translate(CX, CY);
                    ctx.rotate((k * 2 * Math.PI) / KALEIDO_SECTORS);
                    ctx.scale(1, r);
                    this.strokeForm(this.sx, this.sy, this.bktsB, palette.core, KALEIDO_MUL, flick);
                    this.drawHeads(this.sx, this.sy, hp, KALEIDO_MUL * 0.9, flick);
                    ctx.restore();
                }
            }
        } else if (this.form === 'bilateral') {
            for (let s = 1; s >= -1; s -= 2) {
                ctx.save();
                ctx.translate(CX, CY);
                ctx.scale(s, 1);
                this.strokeForm(this.sx, this.sy, this.bktsB, palette.core, 1.0, flick);
                this.drawHeads(this.sx, this.sy, hp, 1.0, flick);
                ctx.restore();
            }
        } else {
            ctx.save();
            ctx.translate(CX, CY);
            this.strokeForm(this.sx, this.sy, this.bktsB, palette.core, 1.0, flick);
            this.drawHeads(this.sx, this.sy, hp, 1.0, flick);
            ctx.restore();

            ctx.save();
            ctx.translate(CX, CY);
            this.strokeForm(this.sx2, this.sy2, this.bktsT, palette.twin, 0.6, flick);
            this.drawHeads(this.sx2, this.sy2, hp, 0.5, flick);
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        this.rafId = requestAnimationFrame(this.tick);
    }

    /**
     * Switch to a different attractor system in place
     */
    setSystem(system) {
        if (!SYSTEMS[system] || system === this.system) return;
        this.system = system;
        this.integrate();
    }

    /**
     * Recolor the filament in place. Costs nothing but the next frame:
     * the geometry is untouched, only the stroke colors change.
     * @returns {boolean} whether the palette changed
     */
    setPalette(palette) {
        if (!PALETTES[palette] || palette === this.palette) return false;
        this.palette = palette;
        return true;
    }

    /**
     * Change the symmetry form in place — this is the mid-session
     * control. Nothing is re-integrated and no frame is dropped; the
     * next tick simply draws the same points through a different
     * symmetry, so the filament appears to fold or unfold.
     * @returns {boolean} whether the form changed
     */
    setForm(form) {
        if (!FORMS.includes(form) || form === this.form) return false;
        this.form = form;
        return true;
    }

    /**
     * Toggle the kaleidoscope, restoring whichever form was showing
     * before it was engaged (so the reader gets their session back,
     * not a hardcoded default).
     * @returns {boolean} whether the kaleidoscope is now engaged
     */
    toggleKaleidoscope() {
        if (this.form === 'kaleido') {
            this.setForm(this._formBeforeKaleido || 'mirror');
            return false;
        }
        this._formBeforeKaleido = this.form;
        this.setForm('kaleido');
        return true;
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.resizeObserver?.disconnect();
        window.removeEventListener('resize', this.resize);
        this.canvas.remove();
    }
}

/**
 * Selectable systems, for settings UI
 */
export const ATTRACTOR_SYSTEMS = [
    { id: 'aizawa', name: 'Aizawa', icon: '∮', description: 'Toroidal bloom — orbits folding through a luminous sphere' },
    { id: 'thomas', name: 'Thomas', icon: '∿', description: 'Cyclically symmetric weave — slow, looping lattice' },
    { id: 'halvorsen', name: 'Halvorsen', icon: '❋', description: 'Threefold sweep — spiral arms in rotational symmetry' }
];

/**
 * Selectable filament colors, for settings UI. `swatch` is the color the
 * chip shows — the bright core, since that is what the eye reads as the
 * filament's identity.
 */
export const ATTRACTOR_PALETTES = [
    { id: 'white', name: 'White', swatch: '#ffffff' },
    { id: 'red', name: 'Red', swatch: '#ffc4aa' },
    { id: 'blue', name: 'Blue', swatch: '#c6e2ff' },
    { id: 'gold', name: 'Gold', swatch: '#ffe8b0' },
    { id: 'purple', name: 'Purple', swatch: '#e0ccff' }
];

export const ATTRACTOR_PALETTE_IDS = ATTRACTOR_PALETTES.map(p => p.id);
export const ATTRACTOR_FORMS = FORMS;
