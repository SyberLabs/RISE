/**
 * Blueprint — the mechanism drawn as a drafting plate.
 *
 * Built for the Atrium's MECHANISM sequences (Watt's separate
 * condenser, Arkwright's frame, Cartwright's loom, the Stockton and
 * Darlington). Those passages describe how a thing WORKS, and museum
 * collections hold portraits of the men who built them — a picture of
 * an inventor is not a picture of an invention. See
 * ATRIUM-IMAGERY-CLASSIFICATION.md; this engine is the answer to that
 * gap.
 *
 * The visual language is the engineering drawing, honestly observed:
 *
 *   - A plate, not a picture. Ruled border, corner ticks, a title
 *     block. The frame is part of the drawing.
 *   - Construction under object. Faint grid, centerlines, projection
 *     rays and witness lines beneath the mechanism, because a drafter's
 *     reasoning stays visible on the sheet.
 *   - Line weight carries meaning. Object lines heavy, hidden lines
 *     dashed, centerlines dash-dot, dimensions light. That hierarchy
 *     IS the draftsman's grammar.
 *   - Section hatching at 45°, the universal convention for cut solid.
 *
 * Four mechanisms, each parametric rather than illustrated: a beam
 * engine, a centrifugal governor, a gear train, and a linkage. They are
 * built from real kinematic relations, so proportions stay plausible
 * under any seed.
 *
 * House rules honored: still frames only, glow via wide understroke
 * (never shadowBlur), deterministic under a seed, null-ctx guard.
 */

import { createSeededRandom } from './lib/klee-core.js';

const TAU = Math.PI * 2;

/**
 * Drafting climates. Cyanotype is the historical blueprint — iron-blue
 * ground, white lines, because the process printed the negative. The
 * others are the drawing-office variants a reader would recognize.
 */
const CLIMATES = {
    cyanotype: {
        name: 'Cyanotype',
        ground: [16, 38, 74],
        grid: [86, 132, 190],
        object: [232, 242, 255],
        construction: [120, 168, 220],
        annotation: [176, 208, 240]
    },
    graphite: {
        name: 'Graphite',
        ground: [18, 18, 21],
        grid: [58, 60, 68],
        object: [226, 228, 236],
        construction: [110, 114, 128],
        annotation: [168, 172, 186]
    },
    sepia: {
        name: 'Sepia',
        ground: [30, 22, 14],
        grid: [92, 70, 46],
        object: [246, 226, 190],
        construction: [150, 116, 78],
        annotation: [208, 178, 136]
    },
    verdigris: {
        name: 'Verdigris',
        ground: [12, 34, 32],
        grid: [64, 122, 112],
        object: [222, 248, 240],
        construction: [104, 168, 154],
        annotation: [162, 208, 196]
    }
};

const MECHANISMS = ['beam-engine', 'governor', 'gear-train', 'linkage'];

const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export class Blueprint {
    constructor() {
        this.plan = null;
    }

    /**
     * Plan a plate. Deterministic for a given (signal, seed) pair.
     *
     * The semantic signal shapes the drawing the way it shapes the
     * other engines: arousal drives mechanical complexity (tooth count,
     * linkage members, stroke of the beam), valence drives the climate
     * when one is not pinned.
     *
     * @param {Object} [signal] - { valence, arousal }
     * @param {string|number} [seed]
     * @param {Object} [options] - { climate: 'auto'|name, mechanism: 'auto'|name }
     * @returns {boolean} true when a plan is ready
     */
    generate(signal, seed, options = {}) {
        const rng = createSeededRandom(seed ?? `bp-${Math.random()}`);
        const arousal = Math.max(0, Math.min(1, signal?.arousal ?? 0.45));
        const valence = Math.max(-1, Math.min(1, signal?.valence ?? 0));

        const climateKey = CLIMATES[options.climate]
            ? options.climate
            : this._climateFor(valence, arousal, rng);

        const mechanism = MECHANISMS.includes(options.mechanism)
            ? options.mechanism
            : MECHANISMS[Math.floor(rng() * MECHANISMS.length)];

        this.plan = {
            climate: climateKey,
            palette: CLIMATES[climateKey],
            mechanism,
            // Complexity is bounded well below "busy": a plate the eye
            // cannot read in one glance fails as a reading surface.
            teeth: 12 + Math.floor(arousal * 14),
            members: 3 + Math.floor(arousal * 2),
            strokeAngle: rng() * TAU,
            gridPitch: 0.045 + rng() * 0.02,
            revision: 'A' + (1 + Math.floor(rng() * 3)),
            sheet: `PL-${String(100 + Math.floor(rng() * 900))}`,
            seedFraction: rng()
        };
        return true;
    }

    _climateFor(valence, arousal, rng) {
        // Warm text drifts to sepia, cool to cyanotype; the neutral band
        // takes graphite, and high arousal occasionally strikes verdigris.
        if (Math.abs(valence) < 0.15) {
            return arousal > 0.65 && rng() < 0.4 ? 'verdigris' : 'graphite';
        }
        return valence > 0 ? 'sepia' : 'cyanotype';
    }

    /**
     * Draw the plate as a single still frame.
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
        const pal = p.palette;

        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';

        this._drawGround(ctx, w, h, pal, options.backgroundColor);
        this._drawGrid(ctx, w, h, pal, p);

        // The plate's drawing field, inset from the border
        const margin = Math.min(w, h) * 0.11;
        const field = {
            x: margin,
            y: margin,
            w: w - margin * 2,
            h: h - margin * 2 - Math.min(w, h) * 0.07 // title block below
        };
        // The drawing scale. Taking min(w,h) alone wastes the width of a
        // landscape plate and leaves the mechanism marooned in empty
        // sheet; a drafter fills the field. Bias toward the smaller
        // dimension so nothing overruns vertically, but let a wide plate
        // draw wide.
        const unit = Math.min(field.h, field.w * 0.62) * 1.55;

        ctx.save();
        ctx.translate(field.x + field.w / 2, field.y + field.h / 2);

        switch (p.mechanism) {
            case 'governor': this._drawGovernor(ctx, unit, pal, p); break;
            case 'gear-train': this._drawGearTrain(ctx, unit, pal, p); break;
            case 'linkage': this._drawLinkage(ctx, unit, pal, p); break;
            case 'beam-engine':
            default: this._drawBeamEngine(ctx, unit, pal, p); break;
        }

        ctx.restore();

        this._drawBorder(ctx, w, h, pal, margin);
        this._drawTitleBlock(ctx, w, h, pal, p, margin);

        ctx.restore();
        return true;
    }

    /* ── sheet ── */

    _drawGround(ctx, w, h, pal, override) {
        ctx.fillStyle = override || rgba(pal.ground, 1);
        ctx.fillRect(0, 0, w, h);

        // Paper tone: a faint radial lift so the sheet reads as lit
        // rather than as flat fill. Not a vignette — the opposite.
        const g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.7);
        g.addColorStop(0, rgba(pal.grid, 0.10));
        g.addColorStop(1, rgba(pal.grid, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    _drawGrid(ctx, w, h, pal, p) {
        const pitch = Math.min(w, h) * p.gridPitch;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.grid, 0.14);
        ctx.beginPath();
        for (let x = pitch; x < w; x += pitch) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = pitch; y < h; y += pitch) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();

        // Every fifth line heavier, as on real gridded drafting stock
        ctx.strokeStyle = rgba(pal.grid, 0.22);
        ctx.beginPath();
        for (let x = pitch * 5; x < w; x += pitch * 5) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = pitch * 5; y < h; y += pitch * 5) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();
    }

    _drawBorder(ctx, w, h, pal, margin) {
        const inset = margin * 0.45;
        ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.0022);
        ctx.strokeStyle = rgba(pal.annotation, 0.7);
        ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

        // Corner registration ticks — the drafter's alignment marks
        const t = margin * 0.3;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.annotation, 0.45);
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [
            [inset, inset, 1, 1], [w - inset, inset, -1, 1],
            [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]
        ]) {
            ctx.moveTo(cx, cy + sy * t); ctx.lineTo(cx, cy);
            ctx.lineTo(cx + sx * t, cy);
        }
        ctx.stroke();
    }

    _drawTitleBlock(ctx, w, h, pal, p, margin) {
        const inset = margin * 0.45;
        const bw = Math.min(w * 0.34, 320);
        const bh = Math.min(h * 0.09, 62);
        const x = w - inset - bw;
        const y = h - inset - bh;

        ctx.fillStyle = rgba(pal.ground, 0.82);
        ctx.fillRect(x, y, bw, bh);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = rgba(pal.annotation, 0.65);
        ctx.strokeRect(x, y, bw, bh);
        ctx.beginPath();
        ctx.moveTo(x, y + bh * 0.58);
        ctx.lineTo(x + bw, y + bh * 0.58);
        ctx.moveTo(x + bw * 0.66, y + bh * 0.58);
        ctx.lineTo(x + bw * 0.66, y + bh);
        ctx.stroke();

        const title = {
            'beam-engine': 'BEAM ENGINE — GENERAL ARRANGEMENT',
            'governor': 'CENTRIFUGAL GOVERNOR — ELEVATION',
            'gear-train': 'GEAR TRAIN — PITCH DIAGRAM',
            'linkage': 'LINKAGE — KINEMATIC SCHEME'
        }[p.mechanism] || 'GENERAL ARRANGEMENT';

        ctx.fillStyle = rgba(pal.object, 0.86);
        ctx.font = `${Math.max(8, bh * 0.2)}px "JetBrains Mono", monospace`;
        ctx.textBaseline = 'middle';
        ctx.fillText(title.slice(0, 34), x + bw * 0.04, y + bh * 0.29);

        ctx.fillStyle = rgba(pal.annotation, 0.72);
        ctx.font = `${Math.max(7, bh * 0.17)}px "JetBrains Mono", monospace`;
        ctx.fillText(`SHEET ${p.sheet}`, x + bw * 0.04, y + bh * 0.79);
        ctx.fillText(`REV ${p.revision}`, x + bw * 0.70, y + bh * 0.79);
    }

    /* ── drafting primitives ── */

    /** Object line: the heavy, continuous edge of solid material. */
    _object(ctx, pal, unit) {
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(1.6, unit * 0.0038);
        ctx.strokeStyle = rgba(pal.object, 0.94);
    }

    /** Hidden line: dashed, for an edge behind material. */
    _hidden(ctx, pal, unit) {
        ctx.setLineDash([unit * 0.018, unit * 0.012]);
        ctx.lineWidth = Math.max(1, unit * 0.0022);
        ctx.strokeStyle = rgba(pal.construction, 0.75);
    }

    /** Centerline: dash-dot, the axis a part is built around. */
    _center(ctx, pal, unit) {
        ctx.setLineDash([unit * 0.04, unit * 0.012, unit * 0.006, unit * 0.012]);
        ctx.lineWidth = Math.max(0.8, unit * 0.0016);
        ctx.strokeStyle = rgba(pal.construction, 0.62);
    }

    /** Construction/witness line: light, continuous, extends the geometry. */
    _construction(ctx, pal, unit) {
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(0.7, unit * 0.0013);
        ctx.strokeStyle = rgba(pal.construction, 0.42);
    }

    /**
     * A soft understroke beneath the object lines, so the plate reads
     * as luminous ink rather than hairlines on a flat field.
     * (House rule: glow by wide faint stroke, never shadowBlur.)
     */
    _glow(ctx, pal, unit) {
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(5, unit * 0.014);
        ctx.strokeStyle = rgba(pal.object, 0.07);
    }

    /** 45° section hatching, clipped to the path already on the ctx. */
    _hatch(ctx, pal, unit, box, spacing) {
        ctx.save();
        ctx.clip();
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(0.6, unit * 0.0012);
        ctx.strokeStyle = rgba(pal.object, 0.34);
        const step = spacing || unit * 0.018;
        const span = Math.abs(box.w) + Math.abs(box.h);
        ctx.beginPath();
        for (let d = -span; d < span; d += step) {
            ctx.moveTo(box.x + d, box.y);
            ctx.lineTo(box.x + d + box.h, box.y + box.h);
        }
        ctx.stroke();
        ctx.restore();
    }

    /** Dimension line with arrowheads and a witness pair. */
    _dimension(ctx, pal, unit, x1, y1, x2, y2, label) {
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(0.7, unit * 0.0013);
        ctx.strokeStyle = rgba(pal.annotation, 0.55);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const a = Math.atan2(y2 - y1, x2 - x1);
        const head = unit * 0.014;
        ctx.beginPath();
        for (const [px, py, dir] of [[x1, y1, 1], [x2, y2, -1]]) {
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a + 0.35) * head * dir, py + Math.sin(a + 0.35) * head * dir);
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a - 0.35) * head * dir, py + Math.sin(a - 0.35) * head * dir);
        }
        ctx.stroke();

        if (label) {
            ctx.fillStyle = rgba(pal.annotation, 0.72);
            ctx.font = `${Math.max(7, unit * 0.019)}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - unit * 0.008);
            ctx.textAlign = 'start';
        }
    }

    /* ── mechanisms ── */

    /**
     * Beam engine: the Watt arrangement — cylinder at one end, beam
     * pivoted at centre, connecting rod to a flywheel crank. Drawn in
     * half-section so the piston reads inside the bore.
     */
    _drawBeamEngine(ctx, unit, pal, p) {
        const beamLen = unit * 0.62;
        const beamY = -unit * 0.16;
        const cylX = -beamLen / 2;
        const crankX = beamLen / 2;
        const bore = unit * 0.085;
        const stroke = unit * 0.20;
        const pistonAt = 0.3 + p.seedFraction * 0.4;

        // Centerlines first — the drafter's armature
        this._center(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(cylX, beamY - unit * 0.06);
        ctx.lineTo(cylX, beamY + stroke + unit * 0.16);
        ctx.moveTo(crankX, beamY - unit * 0.06);
        ctx.lineTo(crankX, beamY + unit * 0.34);
        ctx.moveTo(-beamLen * 0.66, beamY);
        ctx.lineTo(beamLen * 0.66, beamY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cylinder in half-section, hatched
        const cylTop = beamY + unit * 0.05;
        const cylH = stroke + unit * 0.10;
        const cylBox = { x: cylX - bore, y: cylTop, w: bore * 2, h: cylH };

        this._glow(ctx, pal, unit);
        ctx.strokeRect(cylBox.x, cylBox.y, cylBox.w, cylBox.h);

        ctx.beginPath();
        ctx.rect(cylBox.x, cylBox.y, bore, cylH);
        this._hatch(ctx, pal, unit, cylBox);

        this._object(ctx, pal, unit);
        ctx.strokeRect(cylBox.x, cylBox.y, cylBox.w, cylBox.h);

        // Piston and rod
        const pistonY = cylTop + cylH * pistonAt;
        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.rect(cylX - bore * 0.86, pistonY, bore * 1.72, unit * 0.022);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cylX, pistonY);
        ctx.lineTo(cylX, beamY);
        ctx.stroke();

        // Beam with its centre trunnion
        this._glow(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(-beamLen / 2, beamY);
        ctx.lineTo(beamLen / 2, beamY);
        ctx.stroke();

        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(-beamLen / 2, beamY - unit * 0.014);
        ctx.lineTo(beamLen / 2, beamY - unit * 0.014);
        ctx.lineTo(beamLen / 2, beamY + unit * 0.014);
        ctx.lineTo(-beamLen / 2, beamY + unit * 0.014);
        ctx.closePath();
        ctx.stroke();

        // Trunnion + entablature
        ctx.beginPath();
        ctx.arc(0, beamY, unit * 0.026, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-unit * 0.05, beamY + unit * 0.03);
        ctx.lineTo(0, beamY);
        ctx.lineTo(unit * 0.05, beamY + unit * 0.03);
        ctx.stroke();

        // Connecting rod to crank + flywheel
        const crankR = unit * 0.075;
        const crankA = p.strokeAngle;
        const crankPx = crankX + Math.cos(crankA) * crankR;
        const crankPy = beamY + unit * 0.24 + Math.sin(crankA) * crankR;

        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(crankX, beamY);
        ctx.lineTo(crankPx, crankPy);
        ctx.stroke();

        this._glow(ctx, pal, unit);
        ctx.beginPath();
        ctx.arc(crankX, beamY + unit * 0.24, unit * 0.13, 0, TAU);
        ctx.stroke();

        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.arc(crankX, beamY + unit * 0.24, unit * 0.13, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(crankX, beamY + unit * 0.24, unit * 0.024, 0, TAU);
        ctx.stroke();

        // Flywheel spokes
        this._construction(ctx, pal, unit);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = crankA + (i * TAU) / 6;
            ctx.moveTo(crankX, beamY + unit * 0.24);
            ctx.lineTo(crankX + Math.cos(a) * unit * 0.13, beamY + unit * 0.24 + Math.sin(a) * unit * 0.13);
        }
        ctx.stroke();

        // Hidden bore edge and a bore dimension
        this._hidden(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(cylX + bore * 0.55, cylTop);
        ctx.lineTo(cylX + bore * 0.55, cylTop + cylH);
        ctx.stroke();
        ctx.setLineDash([]);

        this._dimension(ctx, pal, unit,
            cylX - bore, cylTop - unit * 0.045,
            cylX + bore, cylTop - unit * 0.045, 'BORE');
    }

    /**
     * Centrifugal governor: two arms on a rotating spindle, flyballs
     * swinging out with speed, sleeve linked to the throttle. The
     * feedback device Watt is remembered for.
     */
    _drawGovernor(ctx, unit, pal, p) {
        // The governor is a tall figure on a wide plate, so it is drawn
        // larger and the spindle sits high with the sleeve travel below,
        // which is also how the machine actually stands.
        const spindleTop = -unit * 0.34;
        const spindleBot = unit * 0.26;
        const armLen = unit * 0.30;
        const spread = 0.46 + p.seedFraction * 0.40; // cone half-angle factor
        const angle = spread * 1.0;

        this._center(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(0, spindleTop - unit * 0.06);
        ctx.lineTo(0, spindleBot + unit * 0.06);
        ctx.stroke();
        ctx.setLineDash([]);

        // Spindle
        this._glow(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(0, spindleTop); ctx.lineTo(0, spindleBot);
        ctx.stroke();
        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(-unit * 0.008, spindleTop); ctx.lineTo(-unit * 0.008, spindleBot);
        ctx.moveTo(unit * 0.008, spindleTop); ctx.lineTo(unit * 0.008, spindleBot);
        ctx.stroke();

        const pivotY = spindleTop + unit * 0.03;
        const ballR = unit * 0.045;

        for (const s of [-1, 1]) {
            const bx = s * Math.sin(angle) * armLen;
            const by = pivotY + Math.cos(angle) * armLen;

            this._glow(ctx, pal, unit);
            ctx.beginPath();
            ctx.moveTo(0, pivotY); ctx.lineTo(bx, by);
            ctx.stroke();

            this._object(ctx, pal, unit);
            ctx.beginPath();
            ctx.moveTo(0, pivotY); ctx.lineTo(bx, by);
            ctx.stroke();

            // Flyball, sectioned
            ctx.beginPath();
            ctx.arc(bx, by, ballR, 0, TAU);
            this._hatch(ctx, pal, unit,
                { x: bx - ballR, y: by - ballR, w: ballR * 2, h: ballR * 2 }, unit * 0.014);
            this._object(ctx, pal, unit);
            ctx.beginPath();
            ctx.arc(bx, by, ballR, 0, TAU);
            ctx.stroke();

            // Lower link to the sleeve
            const sleeveY = spindleBot - unit * 0.12;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(0, sleeveY);
            ctx.stroke();

            // Swing arc — the construction that shows the ball's travel
            this._construction(ctx, pal, unit);
            ctx.beginPath();
            ctx.arc(0, pivotY, armLen, Math.PI / 2 - s * 0.9, Math.PI / 2 + s * 0.1, s < 0);
            ctx.stroke();
        }

        // Sleeve
        const sleeveY = spindleBot - unit * 0.12;
        this._object(ctx, pal, unit);
        ctx.strokeRect(-unit * 0.05, sleeveY, unit * 0.10, unit * 0.04);

        // Throttle lever
        ctx.beginPath();
        ctx.moveTo(unit * 0.05, sleeveY + unit * 0.02);
        ctx.lineTo(unit * 0.24, sleeveY + unit * 0.07);
        ctx.stroke();

        this._dimension(ctx, pal, unit,
            0, pivotY - unit * 0.05,
            Math.sin(angle) * armLen, pivotY - unit * 0.05, 'R');
    }

    /**
     * Gear train: meshing pitch circles with real involute proportions.
     * Pitch circles are construction (they are imaginary); the teeth and
     * the bodies are object lines.
     */
    _drawGearTrain(ctx, unit, pal, p) {
        // Module sized so the train spans the plate rather than sitting
        // as a cluster at its centre: with ~26 teeth the driver alone
        // reaches roughly a fifth of the field.
        const m = (unit * 0.30) / Math.max(12, p.teeth);
        const gears = [
            { teeth: p.teeth, x: -unit * 0.20, y: 0 },
            { teeth: Math.max(8, Math.round(p.teeth * 0.55)), x: 0, y: 0 },
            { teeth: Math.max(10, Math.round(p.teeth * 0.8)), x: 0, y: 0 }
        ];
        // Place each gear tangent to the previous — a real mesh
        gears[0].r = (gears[0].teeth * m) / 2;
        gears[1].r = (gears[1].teeth * m) / 2;
        gears[2].r = (gears[2].teeth * m) / 2;
        gears[1].x = gears[0].x + gears[0].r + gears[1].r;
        gears[2].x = gears[1].x + gears[1].r * 0.72;
        gears[2].y = gears[1].y - (gears[1].r + gears[2].r) * 0.72;

        // Recentre the whole train on the plate: built left-to-right, it
        // otherwise hangs off toward the title block.
        const minX = Math.min(...gears.map(g => g.x - g.r));
        const maxX = Math.max(...gears.map(g => g.x + g.r));
        const minY = Math.min(...gears.map(g => g.y - g.r));
        const maxY = Math.max(...gears.map(g => g.y + g.r));
        const shiftX = -(minX + maxX) / 2;
        const shiftY = -(minY + maxY) / 2;
        gears.forEach(g => { g.x += shiftX; g.y += shiftY; });

        let phase = p.strokeAngle;
        gears.forEach((g, i) => {
            // Centerline cross
            this._center(ctx, pal, unit);
            ctx.beginPath();
            ctx.moveTo(g.x - g.r * 1.25, g.y); ctx.lineTo(g.x + g.r * 1.25, g.y);
            ctx.moveTo(g.x, g.y - g.r * 1.25); ctx.lineTo(g.x, g.y + g.r * 1.25);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pitch circle — imaginary, so construction weight
            this._construction(ctx, pal, unit);
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r, 0, TAU);
            ctx.stroke();

            // Teeth
            const addendum = m;
            const dedendum = m * 1.25;
            this._glow(ctx, pal, unit);
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r, 0, TAU);
            ctx.stroke();

            // One continuous outline: tooth flank, crest, flank, then the
            // root arc to the next tooth. Drawing the teeth as separate
            // strokes leaves them floating off the body — a detail that
            // vanishes at thumbnail size and is glaring at full bleed.
            this._object(ctx, pal, unit);
            ctx.beginPath();
            const step = TAU / g.teeth;
            const dir = i % 2 === 0 ? 1 : -1;
            const ro = g.r + addendum;
            const ri = g.r - dedendum;
            const half = step * 0.30;
            for (let t = 0; t < g.teeth; t++) {
                const a0 = phase * dir + t * step;
                const pts = [
                    [a0 - half, ri], [a0 - half * 0.62, ro],
                    [a0 + half * 0.62, ro], [a0 + half, ri]
                ];
                pts.forEach(([a, r], k) => {
                    const px = g.x + Math.cos(a) * r;
                    const py = g.y + Math.sin(a) * r;
                    if (t === 0 && k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                // Root arc carries the outline into the next tooth
                ctx.arc(g.x, g.y, ri, a0 + half, a0 + step - half);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(g.x, g.y, Math.max(unit * 0.016, g.r * 0.16), 0, TAU);
            ctx.stroke();

            // Keyway on the hub — the small truth that sells a drawing
            const kw = Math.max(unit * 0.006, g.r * 0.05);
            ctx.strokeRect(g.x - kw, g.y - Math.max(unit * 0.016, g.r * 0.16) - kw * 0.8, kw * 2, kw * 1.6);
        });

        // Line of centres between the meshing pair
        this._construction(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(gears[0].x, gears[0].y);
        ctx.lineTo(gears[1].x, gears[1].y);
        ctx.lineTo(gears[2].x, gears[2].y);
        ctx.stroke();

        this._dimension(ctx, pal, unit,
            gears[0].x, gears[0].y + gears[0].r + unit * 0.06,
            gears[1].x, gears[1].y + gears[0].r + unit * 0.06,
            `${gears[0].teeth}T:${gears[1].teeth}T`);
    }

    /**
     * Linkage: a four-bar (or five-bar) chain with its coupler curve —
     * the traced path being the point of the drawing. Watt's parallel
     * motion was exactly this kind of problem.
     */
    _drawLinkage(ctx, unit, pal, p) {
        // Grashof proportions: shortest + longest < other two, so the
        // crank fully rotates and the coupler curve actually closes.
        const ground = unit * 0.46;
        const crank = unit * 0.11 + p.seedFraction * unit * 0.03;
        const coupler = unit * 0.40;
        const rocker = unit * 0.30;
        const ax = -ground / 2, ay = unit * 0.16;
        const dx = ground / 2, dy = unit * 0.16;

        // Solve the four-bar for the drawn instant
        const solve = theta => {
            const bx = ax + Math.cos(theta) * crank;
            const by = ay + Math.sin(theta) * crank;
            const ex = dx - bx, ey = dy - by;
            const d = Math.hypot(ex, ey);
            if (d > coupler + rocker || d < Math.abs(coupler - rocker)) return null;
            const a = (coupler * coupler - rocker * rocker + d * d) / (2 * d);
            const hgt = Math.sqrt(Math.max(0, coupler * coupler - a * a));
            const mx = bx + (a * ex) / d, my = by + (a * ey) / d;
            return { bx, by, cx: mx + (hgt * ey) / d, cy: my - (hgt * ex) / d };
        };

        // Coupler curve — construction, because it is a locus not a part
        this._construction(ctx, pal, unit);
        ctx.beginPath();
        let started = false;
        for (let t = 0; t <= TAU + 0.01; t += 0.02) {
            const s = solve(t);
            if (!s) { started = false; continue; }
            const px = s.bx + (s.cx - s.bx) * 0.5;
            const py = s.by + (s.cy - s.by) * 0.5 - unit * 0.06;
            if (!started) { ctx.moveTo(px, py); started = true; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        const pose = solve(p.strokeAngle) || solve(0.6) || { bx: ax + crank, by: ay, cx: dx - rocker, cy: dy };

        // Ground line with hatching beneath — the fixed frame
        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(ax - unit * 0.06, ay + unit * 0.06);
        ctx.lineTo(dx + unit * 0.06, dy + unit * 0.06);
        ctx.stroke();
        this._construction(ctx, pal, unit);
        ctx.beginPath();
        for (let x = ax - unit * 0.05; x < dx + unit * 0.06; x += unit * 0.022) {
            ctx.moveTo(x, ay + unit * 0.06);
            ctx.lineTo(x - unit * 0.018, ay + unit * 0.088);
        }
        ctx.stroke();

        // Members
        this._glow(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(ax, ay); ctx.lineTo(pose.bx, pose.by);
        ctx.lineTo(pose.cx, pose.cy); ctx.lineTo(dx, dy);
        ctx.stroke();

        this._object(ctx, pal, unit);
        ctx.beginPath();
        ctx.moveTo(ax, ay); ctx.lineTo(pose.bx, pose.by);
        ctx.lineTo(pose.cx, pose.cy); ctx.lineTo(dx, dy);
        ctx.stroke();

        // Coupler point marker
        const px = pose.bx + (pose.cx - pose.bx) * 0.5;
        const py = pose.by + (pose.cy - pose.by) * 0.5 - unit * 0.06;
        ctx.beginPath();
        ctx.moveTo(pose.bx, pose.by); ctx.lineTo(px, py); ctx.lineTo(pose.cx, pose.cy);
        ctx.stroke();

        // Pin joints — circles at every revolute
        for (const [jx, jy, fixed] of [
            [ax, ay, true], [dx, dy, true],
            [pose.bx, pose.by, false], [pose.cx, pose.cy, false], [px, py, false]
        ]) {
            this._object(ctx, pal, unit);
            ctx.beginPath();
            ctx.arc(jx, jy, unit * (fixed ? 0.016 : 0.012), 0, TAU);
            ctx.stroke();
            if (fixed) {
                // Fixed-pivot triangle
                ctx.beginPath();
                ctx.moveTo(jx - unit * 0.026, jy + unit * 0.045);
                ctx.lineTo(jx, jy);
                ctx.lineTo(jx + unit * 0.026, jy + unit * 0.045);
                ctx.stroke();
            }
        }

        // Crank circle
        this._center(ctx, pal, unit);
        ctx.beginPath();
        ctx.arc(ax, ay, crank, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);

        this._dimension(ctx, pal, unit, ax, dy + unit * 0.12, dx, dy + unit * 0.12, 'GROUND');
    }

    /**
     * Coarse polylines describing the plate, for the ASCII renderer.
     *
     * ASCII cannot carry line-weight grammar, so this returns the
     * SILHOUETTE the mechanism would read as in characters: the border,
     * the centrelines, and the principal circles/members. Detail that
     * only survives at pixel scale is deliberately dropped rather than
     * rendered into mush.
     *
     * @param {number} width
     * @param {number} height
     * @returns {Array<{points: number[][]}>}
     */
    asciiPolylines(width, height) {
        if (!this.plan) return [];
        const p = this.plan;
        const cx = width / 2;
        const cy = height / 2;
        const unit = Math.min(height * 0.8, width * 0.5) * 1.55;
        const out = [];
        const circle = (x, y, r, n = 28) => {
            const pts = [];
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * TAU;
                pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
            }
            return pts;
        };

        // Sheet border always reads, and anchors the plate in characters
        const inset = Math.min(width, height) * 0.05;
        out.push({ points: [
            [inset, inset], [width - inset, inset],
            [width - inset, height - inset], [inset, height - inset], [inset, inset]
        ] });

        if (p.mechanism === 'gear-train') {
            const m = (unit * 0.30) / Math.max(12, p.teeth);
            const r0 = (p.teeth * m) / 2;
            const r1 = (Math.max(8, Math.round(p.teeth * 0.55)) * m) / 2;
            out.push({ points: circle(cx - r0 * 0.9, cy, r0) });
            out.push({ points: circle(cx + r1 * 1.1, cy, r1) });
        } else if (p.mechanism === 'governor') {
            const arm = unit * 0.30;
            const a = (0.46 + p.seedFraction * 0.40);
            out.push({ points: [[cx, cy - unit * 0.34], [cx, cy + unit * 0.26]] });
            for (const s of [-1, 1]) {
                const bx = cx + s * Math.sin(a) * arm;
                const by = cy - unit * 0.31 + Math.cos(a) * arm;
                out.push({ points: [[cx, cy - unit * 0.31], [bx, by]] });
                out.push({ points: circle(bx, by, unit * 0.045, 16) });
            }
        } else if (p.mechanism === 'linkage') {
            const g = unit * 0.46;
            out.push({ points: [[cx - g / 2, cy + unit * 0.16], [cx + g / 2, cy + unit * 0.16]] });
            out.push({ points: circle(cx - g / 2, cy + unit * 0.16, unit * 0.12, 20) });
        } else {
            // beam engine
            const bl = unit * 0.62;
            const by = cy - unit * 0.16;
            out.push({ points: [[cx - bl / 2, by], [cx + bl / 2, by]] });
            out.push({ points: circle(cx + bl / 2, by + unit * 0.24, unit * 0.13) });
            const bore = unit * 0.085;
            out.push({ points: [
                [cx - bl / 2 - bore, by + unit * 0.05],
                [cx - bl / 2 + bore, by + unit * 0.05],
                [cx - bl / 2 + bore, by + unit * 0.35],
                [cx - bl / 2 - bore, by + unit * 0.35],
                [cx - bl / 2 - bore, by + unit * 0.05]
            ] });
        }
        return out;
    }
}

/** Selectable drafting climates, for settings UI. */
export const BLUEPRINT_CLIMATES = Object.entries(CLIMATES).map(([id, c]) => ({
    id,
    name: c.name,
    swatch: `rgb(${c.ground[0]}, ${c.ground[1]}, ${c.ground[2]})`
}));

export const BLUEPRINT_MECHANISMS = MECHANISMS;
