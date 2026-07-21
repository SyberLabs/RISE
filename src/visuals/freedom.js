/**
 * Freedom — the imposed surface, and what shows when it is stripped.
 *
 * Built for the Atrium's liberation sequences: the Haitian uprising,
 * Sonthonax's proclamation, the Spanish American declarations, the
 * abolition acts. Those readings are currently accompanied by generic
 * landscape paintings, because museum collections of this period were
 * assembled by and for the colonizing powers. A procedural field can
 * give them what a Commons search never will.
 *
 * THE ARGUMENT THE ENGINE MAKES
 * ─────────────────────────────
 * The imperial power's colors are the GROUND: a soft, atmospheric wash
 * covering the whole field the way a flag covers a territory — total,
 * but insubstantial. Diffuse, because empire presents itself as the
 * natural condition of the air.
 *
 * The liberating people's colors are UNDERNEATH, and always were. Rough
 * inky brush strokes are thrown across the field, and wherever a stroke
 * lands it does not deposit paint — it STRIPS the wash away, revealing
 * the free flag's solid, saturated color beneath.
 *
 * So the gesture is subtractive. Liberation is not something added to
 * the colonized; it is what shows when the imposed surface is torn off.
 * The strokes are brash, wet, uneven — the opposite of the ground's
 * even atmosphere. That contrast carries the whole argument.
 *
 * HAITI, THE CASE THAT SHAPED THE ENGINE
 * ──────────────────────────────────────
 * The Haitian flag is the French tricolour with the white torn out —
 * Dessalines is said to have done exactly that. Blue and red are
 * inherited; the ABSENCE is the argument.
 *
 * The subtractive design answers this without a special case. France's
 * white washes over Haiti's blue-and-red, and every stroke that strips
 * the wash is literally the white being removed. The shared palette
 * stops being a collision to work around and becomes the point.
 *
 * House rules honored: still frames only, no shadowBlur, deterministic
 * under a seed, null-ctx guard.
 */

import { createSeededRandom } from './lib/klee-core.js';

const TAU = Math.PI * 2;

/**
 * Flag palettes and construction. Historical flags of the period, not
 * modern redesigns.
 */
const FLAGS = {
    // `structure` is how the flag is CONSTRUCTED, which is what keeps
    // the washes distinguishable when the palettes nearly collide:
    // saltire (crossing diagonals), vertical bars, horizontal bands.
    france: { name: 'France', structure: 'vertical',
        bands: [[0, 35, 149], [255, 255, 255], [237, 41, 57]] },
    britain: { name: 'Britain', structure: 'saltire',
        bands: [[1, 33, 105], [255, 255, 255], [200, 16, 46]] },
    spain: { name: 'Spain', structure: 'horizontal',
        bands: [[170, 21, 27], [241, 191, 0], [170, 21, 27]] },
    portugal: { name: 'Portugal', structure: 'vertical',
        bands: [[0, 102, 71], [255, 0, 0]] },
    haiti: { name: 'Haiti', structure: 'horizontal',
        bands: [[0, 32, 145], [212, 16, 25]] },
    venezuela: { name: 'Venezuela', structure: 'horizontal',
        bands: [[247, 185, 0], [0, 36, 125], [207, 20, 43]] },
    peru: { name: 'Peru', structure: 'vertical',
        bands: [[217, 16, 35], [255, 255, 255], [217, 16, 35]] },
    brazil: { name: 'Brazil', structure: 'horizontal',
        bands: [[0, 156, 59], [254, 223, 0]] },
    argentina: { name: 'Argentina', structure: 'horizontal',
        bands: [[117, 170, 219], [255, 255, 255], [117, 170, 219]] },
    unitedStates: { name: 'United States', structure: 'horizontal',
        bands: [[60, 59, 110], [255, 255, 255], [178, 34, 52]] },
    // For readings where the liberating force is not yet a nation —
    // an uprising, a proclamation, an abolition act
    emancipation: { name: 'Emancipation', structure: 'horizontal',
        bands: [[214, 40, 40], [247, 127, 0], [252, 191, 73]] }
};

/**
 * Named relations. Each is a colonial pairing the corpus actually
 * contains; `ground` is the imperial power washed over the field,
 * `fire` the liberating flag revealed beneath it. `derived` marks the
 * cases where the free flag is cut from the imperial one.
 */
const RELATIONS = {
    'haiti-france': { ground: 'france', fire: 'haiti', derived: true },
    'venezuela-spain': { ground: 'spain', fire: 'venezuela' },
    'peru-spain': { ground: 'spain', fire: 'peru' },
    'argentina-spain': { ground: 'spain', fire: 'argentina' },
    'brazil-portugal': { ground: 'portugal', fire: 'brazil' },
    'usa-britain': { ground: 'britain', fire: 'unitedStates', derived: true },
    // Abolition is legislative rather than insurgent: the same reveal,
    // but the freed palette is not a national flag.
    'abolition-britain': { ground: 'britain', fire: 'emancipation' },
    'abolition-france': { ground: 'france', fire: 'emancipation' }
};

const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
];
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/**
 * How well two palettes separate — drives how hard the reveal works.
 *
 * For each color in the freed flag, how far is its NEAREST counterpart
 * in the imperial one; the score is the average of those. Taking the
 * global minimum instead would call almost every pair "shared", since
 * nearly all these flags contain a red.
 */
function paletteDistance(a, b) {
    let total = 0;
    for (const x of a) {
        let nearest = Infinity;
        for (const y of b) {
            const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) / 441.7;
            if (d < nearest) nearest = d;
        }
        total += nearest;
    }
    return a.length ? total / a.length : 1;
}

export class Freedom {
    constructor() {
        this.plan = null;
    }

    /**
     * Plan a field.
     *
     * @param {Object} [signal] - { valence, arousal }
     * @param {string|number} [seed]
     * @param {Object} [options] - { relation, ground, fire }
     * @returns {boolean}
     */
    generate(signal, seed, options = {}) {
        const rng = createSeededRandom(seed ?? `fr-${Math.random()}`);
        const arousal = Math.max(0, Math.min(1, signal?.arousal ?? 0.55));

        const relation = RELATIONS[options.relation] || null;
        const groundKey = FLAGS[options.ground] ? options.ground
            : relation ? relation.ground : 'britain';
        const fireKey = FLAGS[options.fire] ? options.fire
            : relation ? relation.fire : 'emancipation';

        const ground = FLAGS[groundKey];
        const fire = FLAGS[fireKey];
        const derived = options.derived ?? relation?.derived ?? false;

        // A derived flag shares its palette with the imperial one, so
        // the reveal needs more strokes to read as removal rather than
        // as a variation in the same cloth (Haiti, and the US against
        // Britain).
        const collision = paletteDistance(ground.bands, fire.bands);
        const shared = derived || collision < 0.28;

        this.plan = {
            groundKey, fireKey, ground, fire, derived, shared,
            // Stroke count and length scale with the passage's intensity;
            // a shared palette needs more of them to read as removal
            plumes: (shared ? 5 : 3) + Math.floor(arousal * 4),
            reach: 0.42 + arousal * 0.30,
            // Where the gesture concentrates — off-centre reads as an
            // event, dead centre reads as a target
            originX: 0.30 + rng() * 0.40,
            originY: 0.55 + rng() * 0.28,
            grain: 0.05 + rng() * 0.04,
            seedFraction: rng(),
            rngSeed: seed ?? 'fr'
        };
        return true;
    }

    /**
     * Draw the field as a single still frame.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options] - { backgroundColor }
     */
    render(canvas, options = {}) {
        if (!this.plan || !canvas) return false;
        const ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return false; // headless guard

        const w = canvas.width;
        const h = canvas.height;
        const p = this.plan;
        const rng = createSeededRandom(`${p.rngSeed}-render`);

        ctx.save();
        // 1. The free flag, solid and saturated — it is underneath, and
        //    always was. Nothing about it is added later.
        this._drawUnderflag(ctx, w, h, p);

        // 2 & 3. The imperial wash, and the strokes that strip it. These
        // must happen on a SEPARATE surface: destination-out on the main
        // canvas would punch through the flag to black as well, since
        // compositing has no notion of "only the layer above". The wash
        // is built and eroded off-screen, then laid over the flag.
        const veil = this._makeVeil(w, h, p, rng, canvas);
        if (veil) {
            ctx.drawImage(veil, 0, 0);
        } else {
            // Headless or unsupported: draw the wash without the reveal
            // rather than dropping the imperial ground entirely.
            this._drawGround(ctx, w, h, p);
        }
        // 4. Heat where the surface was broken.
        this._drawEmbers(ctx, w, h, p, rng);
        this._drawGrain(ctx, w, h, p, rng);
        ctx.restore();
        return true;
    }

    /**
     * Build the imperial wash on its own surface and erode it with the
     * brush strokes, so the reveal uncovers the flag rather than the
     * void. Returns null where an offscreen surface cannot be made.
     */
    _makeVeil(w, h, p, rng, hostCanvas) {
        let surface = null;
        try {
            if (typeof OffscreenCanvas === 'function') {
                surface = new OffscreenCanvas(w, h);
            } else if (typeof document !== 'undefined' && document.createElement) {
                surface = document.createElement('canvas');
                surface.width = w;
                surface.height = h;
            }
        } catch { return null; }
        const vctx = surface?.getContext && surface.getContext('2d');
        if (!vctx) return null;

        this._drawGround(vctx, w, h, p);
        this._drawStrokes(vctx, w, h, p, rng);
        return surface;
    }

    /**
     * The liberating flag, painted first at full saturation. Bands are
     * hard-edged and slightly angled: this is the solid thing, the fact
     * under the atmosphere.
     */
    _drawUnderflag(ctx, w, h, p) {
        const bands = p.fire.bands;
        // Canted slightly, so a revealed band never reads as a stripe
        // the brush happened to draw. The flag is cloth under tension,
        // not a chart.
        const tilt = (p.seedFraction - 0.5) * 0.28;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(tilt);
        ctx.translate(-w / 2, -h / 2);
        const over = Math.max(w, h) * 0.4;
        const bandH = (h + over * 2) / bands.length;
        bands.forEach((band, i) => {
            ctx.fillStyle = rgba(band, 1);
            ctx.fillRect(-over, -over + i * bandH, w + over * 2, bandH + 2);
        });
        ctx.restore();
        // A faint internal grade so the solid colors still read as cloth
        const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * Rough, wet brush strokes that cut back to the flag beneath.
     *
     * The stroke is drawn with destination-out so it removes the wash
     * instead of adding pigment — the reveal IS the gesture. Each stroke
     * is built from overlapping stamps of varying radius, so the edge
     * frays and the body carries the dry-brush skips a loaded bristle
     * makes.
     */
    _drawStrokes(ctx, w, h, p, rng) {
        const span = Math.max(w, h);
        const cx = w * p.originX;
        const cy = h * p.originY;

        // One dominant sweep direction for the whole gesture — a hand
        // works in a direction. Strokes vary around it but never radiate
        // from a point, which would read as an explosion diagram rather
        // than as painting.
        const sweep = -0.62 + p.seedFraction * 1.24;

        for (let i = 0; i < p.plumes; i++) {
            const from = (i + 0.5) / p.plumes;
            const angle = sweep + (rng() - 0.5) * 0.55;
            const len = span * (0.70 + rng() * 0.65);

            // Strokes are staggered ACROSS the field, perpendicular to
            // the sweep, so together they cover it like brushwork.
            const perp = angle + Math.PI / 2;
            const offset = (from - 0.5) * span * 0.85 + (rng() - 0.5) * span * 0.12;
            const midX = cx + Math.cos(perp) * offset;
            const midY = cy + Math.sin(perp) * offset;
            const startX = midX - Math.cos(angle) * len * (0.4 + rng() * 0.2);
            const startY = midY - Math.sin(angle) * len * (0.4 + rng() * 0.2);

            const steps = 90;
            const baseW = span * (0.020 + rng() * 0.040);
            let x = startX, y = startY, a = angle;

            ctx.globalCompositeOperation = 'destination-out';
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                a += (rng() - 0.5) * 0.10;
                x += Math.cos(a) * (len / steps);
                y += Math.sin(a) * (len / steps);

                // Pressure: heavy through the middle, lifting at both
                // ends the way an arm loads and releases
                const pressure = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
                const r = baseW * pressure * (0.75 + rng() * 0.5);
                if (r <= 0.4) continue;

                // Dry-brush skip: the bristle occasionally misses
                const alpha = rng() < 0.14 ? 0.25 + rng() * 0.3 : 0.85 + rng() * 0.15;

                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.ellipse(x, y, r, r * (0.55 + rng() * 0.5), a, 0, TAU);
                ctx.fill();

                // Frayed rim: small stamps scattered along the edge, so
                // the boundary is bristle-torn rather than knife-clean.
                // (A jagged-polygon body was tried and rejected: the
                // edge read better, but the slivers flooded the veil and
                // the REVEAL is what carries the argument.)
                const frays = 2 + Math.floor(rng() * 3);
                for (let f = 0; f < frays; f++) {
                    const fa = a + Math.PI / 2 * (rng() < 0.5 ? 1 : -1);
                    const fd = r * (0.75 + rng() * 0.55);
                    ctx.globalAlpha = alpha * (0.2 + rng() * 0.5);
                    ctx.beginPath();
                    ctx.ellipse(
                        x + Math.cos(fa) * fd + (rng() - 0.5) * r * 0.6,
                        y + Math.sin(fa) * fd + (rng() - 0.5) * r * 0.6,
                        r * (0.10 + rng() * 0.30), r * (0.06 + rng() * 0.18),
                        a + (rng() - 0.5), 0, TAU
                    );
                    ctx.fill();
                }

                // Splayed bristles either side of the core
                if (rng() < 0.45) {
                    const off = r * (0.7 + rng() * 0.9);
                    const oa = a + Math.PI / 2;
                    ctx.globalAlpha = alpha * (0.35 + rng() * 0.4);
                    ctx.beginPath();
                    ctx.ellipse(
                        x + Math.cos(oa) * off * (rng() < 0.5 ? 1 : -1),
                        y + Math.sin(oa) * off * (rng() < 0.5 ? 1 : -1),
                        r * 0.35, r * 0.22, a, 0, TAU
                    );
                    ctx.fill();
                }

                // Flung droplets — the brash throw
                if (rng() < 0.05) {
                    const da = a + (rng() - 0.5) * 2.2;
                    const dd = r * (2 + rng() * 7);
                    ctx.globalAlpha = 0.5 + rng() * 0.5;
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(da) * dd, y + Math.sin(da) * dd,
                        r * (0.10 + rng() * 0.22), 0, TAU);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    /**
     * Heat at the breach: a low bloom in the freed palette, so the
     * uncovered flag looks lit from within rather than merely exposed.
     */
    _drawEmbers(ctx, w, h, p, rng) {
        const span = Math.max(w, h);
        const cx = w * p.originX;
        const cy = h * p.originY;
        ctx.globalCompositeOperation = 'lighter';
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, span * 0.5);
        bloom.addColorStop(0, rgba(p.fire.bands[0], 0.16));
        bloom.addColorStop(0.5, rgba(p.fire.bands[p.fire.bands.length - 1], 0.06));
        bloom.addColorStop(1, rgba(p.fire.bands[0], 0));
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * The imperial ground: ruled, flat, total. Drawn as hard bands with
     * only a slight vertical grade, because an imposed order does not
     * blend — it is applied.
     */
    _drawGround(ctx, w, h, p) {
        const bands = p.ground.bands;

        // The wash: the imperial colors as ATMOSPHERE rather than as
        // cloth — unmistakably present, but with no edges to hold on to.
        // Empire as weather.
        //
        // Hue alone cannot carry this. Britain and France are both
        // blue/white/red within a few points of each other, so as soft
        // gradients they read as the same empire — a real problem when
        // abolition-britain and abolition-france sit beside each other
        // in the corpus. What actually distinguishes them is GEOMETRY:
        // the Union Jack is diagonal saltires, the tricolour vertical
        // bars, Spain horizontal bands. So each ground carries its own
        // wash structure, softened but never dissolved.
        const structure = p.ground.structure || 'diagonal';
        const soft = 0.16;

        const stops = (grad, order = bands) => {
            order.forEach((band, i) => {
                const at = order.length === 1 ? 0.5 : i / (order.length - 1);
                grad.addColorStop(Math.max(0, at - soft), rgba(mix(band, [0, 0, 0], 0.12), 1));
                grad.addColorStop(at, rgba(band, 1));
                grad.addColorStop(Math.min(1, at + soft), rgba(mix(band, [0, 0, 0], 0.22), 1));
            });
            return grad;
        };

        if (structure === 'vertical') {
            // Tricolour: bars run hoist to fly
            ctx.fillStyle = stops(ctx.createLinearGradient(0, 0, w, h * 0.25));
            ctx.fillRect(0, 0, w, h);
        } else if (structure === 'horizontal') {
            // Spain, Portugal: bands run top to bottom
            ctx.fillStyle = stops(ctx.createLinearGradient(w * 0.15, 0, 0, h));
            ctx.fillRect(0, 0, w, h);
        } else {
            // Saltire: two crossing diagonals over the field colour.
            // This is what makes Britain unmistakably not France.
            ctx.fillStyle = rgba(bands[0], 1);
            ctx.fillRect(0, 0, w, h);
            const arms = [
                ctx.createLinearGradient(0, 0, w, h),
                ctx.createLinearGradient(w, 0, 0, h)
            ];
            const cross = bands.slice(1).length ? bands.slice(1) : bands;
            for (const arm of arms) {
                arm.addColorStop(0, rgba(bands[0], 0));
                arm.addColorStop(0.30, rgba(bands[0], 0));
                arm.addColorStop(0.44, rgba(cross[0], 0.92));
                arm.addColorStop(0.5, rgba(cross[cross.length - 1], 0.96));
                arm.addColorStop(0.56, rgba(cross[0], 0.92));
                arm.addColorStop(0.70, rgba(bands[0], 0));
                arm.addColorStop(1, rgba(bands[0], 0));
                ctx.fillStyle = arm;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // Cloudy modulation so the wash breathes instead of banding
        ctx.globalCompositeOperation = 'overlay';
        for (const [fx, fy, r, a] of [
            [0.24, 0.28, 0.55, 0.22], [0.78, 0.36, 0.48, 0.18], [0.5, 0.82, 0.62, 0.20]
        ]) {
            const cloud = ctx.createRadialGradient(
                w * fx, h * fy, 0, w * fx, h * fy, Math.max(w, h) * r);
            cloud.addColorStop(0, `rgba(255, 255, 255, ${a})`);
            cloud.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = cloud;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = 'source-over';

        // Depth toward the edges, and headroom for the reading text
        const vig = ctx.createRadialGradient(
            w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0.10)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
    }



    /** Canvas tooth, so the field reads as pigment rather than gradient. */
    _drawGrain(ctx, w, h, p, rng) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = p.grain;
        const step = Math.max(3, Math.round(Math.min(w, h) / 220));
        for (let i = 0; i < 900; i++) {
            const v = Math.floor(rng() * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(rng() * w, rng() * h, step, step);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Coarse polylines for the ASCII renderer: the plumes only, since
     * the ground is a fill that characters cannot carry.
     */
    asciiPolylines(width, height) {
        if (!this.plan) return [];
        const p = this.plan;
        const rng = createSeededRandom(`${p.rngSeed}-ascii`);
        const cx = width * p.originX;
        const cy = height * p.originY;
        const span = Math.max(width, height);
        const out = [];
        for (let i = 0; i < p.plumes; i++) {
            const pts = [];
            let x = cx, y = cy;
            let angle = -Math.PI / 2 + (rng() - 0.5) * 2.1;
            const reach = span * p.reach * (0.55 + rng() * 0.6);
            const curl = (rng() - 0.5) * 0.20;
            for (let s = 0; s < 14; s++) {
                pts.push([x, y]);
                angle += curl + (rng() - 0.5) * 0.22;
                const step = reach / 14;
                x += Math.cos(angle) * step;
                y += Math.sin(angle) * step;
            }
            out.push({ points: pts });
        }
        return out;
    }
}

/** Colonial relations the engine can draw, for settings and content. */
export const FREEDOM_RELATIONS = Object.keys(RELATIONS);
export const FREEDOM_FLAGS = Object.entries(FLAGS).map(([id, f]) => ({
    id,
    name: f.name,
    structure: f.structure,
    swatch: `rgb(${f.bands[0][0]}, ${f.bands[0][1]}, ${f.bands[0][2]})`
}));
