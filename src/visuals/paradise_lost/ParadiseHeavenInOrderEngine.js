/**
 * PARADISE LOST — ENGINE 6: HEAVEN IN ORDER
 * (The Perpetual Round, the Gates of Light, and the Mighty Quadrate)
 *
 * "till Morn,
 *  Waked by the circling Hours, with rosy hand
 *  Unbarred the gates of light. There is a cave
 *  Within the mount of God, fast by his throne,
 *  Where light and darkness in perpetual round
 *  Lodge and dislodge by turns..."          — Book VI, 3-8
 *
 * "...the Powers militant,
 *  That stood for Heaven, in mighty quadrate joined
 *  Of union irresistible, moved on
 *  In silence their bright legions...
 *  Indissolubly firm; nor obvious hill,
 *  Nor straitening vale, nor wood, nor stream, divides
 *  Their perfect ranks..."                  — Book VI, 62-72
 *
 * THE DESIGN ARGUMENT
 * ───────────────────
 * Order before the breach: every motion is rigid (rotate/translate only).
 * No scatter, emit, decay, or independent velocity after generation —
 * that contrast makes later rupture legible.
 *
 * Drawn as Milton's mechanism: a 24-Hour annulus (gates of light/dark),
 * host as a perspective lattice that translates by whole cells. Brightest
 * values at top and bottom; reading sits in the still centre of the round.
 *
 * Rejected: hard-edged gate shapes (read as progress bars), discrete Hour
 * sectors/beads (read as objects), uniform resolvable host dots (halftone).
 */

import { createSeededRandom } from '../lib/klee-core.js';

/** The circling Hours. Twenty-four, because they are hours. */
const HOURS = 24;

export class ParadiseHeavenInOrderEngine {
    constructor() {
        this.name = 'Heaven in Order (The Perpetual Round)';
        this.category = 'DIMENSIONAL / SPATIAL';
        this.seed = 'paradise-order-01';
        this.time = 0;

        this.lattice = [];
        this.motes = [];

        this.params = {
            // ONE REVOLUTION OUTLASTS THE FIGURE ITSELF.
            //
            // Heaven in Order accompanies Book VI lines 0-111 — about
            // four minutes at reading pace. At this speed the Hours take
            // twelve minutes to come round, so the mechanism never
            // repeats a position while anyone is watching it. It should
            // never be seen to move, only to have moved.
            roundSpeed: 0.029,
            // The gates unbar over the opening, then hold. Dawn is an
            // event that finishes; the order it reveals is the subject.
            dawnSpeed: 0.05,
            marchSpeed: 0.045,
            // "By thousands and by millions, ranged for fight." A coarse
            // grid of large dots is polka, not a host — the multitude
            // has to be legible AS multitude, so the ranks are fine and
            // many rather than few and bold.
            latticeCols: 112,
            latticeRows: 26,
            glowIntensity: 0.9,
            colorPalette: 'empyreal_gold'   // | 'orient_beam' | 'pre_dawn'
        };
    }

    generate(signal = {}, seed = 'order-seed', options = {}) {
        this.seed = seed;
        const rng = createSeededRandom(seed || 'order-seed');
        const cols = options.latticeCols || this.params.latticeCols;
        const rows = options.latticeRows || this.params.latticeRows;

        // THE QUADRATE. Built once, as a perfect grid, and thereafter
        // only ever moved as a whole. The per-point values below are
        // brightness and phase — never position — so no accumulated
        // per-point state can bend the ranks over a long reading.
        this.lattice = [];
        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                this.lattice.push({
                    col,
                    row,
                    // "Reflecting blaze on blaze": each shield catches the
                    // light on its own beat, from a fixed phase.
                    phase: rng() * Math.PI * 2,
                    gleam: 0.55 + rng() * 0.45
                });
            }
        }

        // Motes in the empyreal air. They hold station and breathe;
        // they do not drift, for the same reason as everything else.
        this.motes = [];
        for (let i = 0; i < 90; i += 1) {
            this.motes.push({
                x: rng(),
                y: rng(),
                r: 0.4 + rng() * 1.6,
                phase: rng() * Math.PI * 2,
                gleam: 0.25 + rng() * 0.5
            });
        }
        return true;
    }

    step(dt = 0.016, signal = {}) {
        // The only state this engine keeps. Everything drawn is a pure
        // function of it, which is what makes the order provably rigid
        // rather than carefully tuned.
        this.time += dt;
    }

    _palette(name) {
        if (name === 'orient_beam') {
            return {
                void: ['#0a0714', '#140c1e', '#241326'],
                ray: '255, 214, 150',
                gold: '255, 198, 96',
                rose: '255, 158, 128',
                pale: '255, 246, 224'
            };
        }
        if (name === 'pre_dawn') {
            return {
                void: ['#05060f', '#0a0c1a', '#141227'],
                ray: '186, 200, 255',
                gold: '206, 214, 255',
                rose: '176, 158, 220',
                pale: '236, 242, 255'
            };
        }
        // Empyreal gold — "arrayed in gold / Empyreal", with the rosy
        // hand of line 4 held at the horizon.
        return {
            void: ['#070713', '#0e0a1c', '#1e1226'],
            ray: '255, 206, 138',
            gold: '255, 196, 92',
            rose: '255, 150, 122',
            pale: '255, 248, 228'
        };
    }

    /**
     * THE COMPOSITION IS BUILT AROUND THE TEXT, NOT MERELY BEHIND IT.
     *
     * Three registers, vertically, exactly as Book VI stacks them:
     *
     *   ~0.15   the gates of light, unbarred on high, and the golden
     *           cloud the Sovran Voice speaks from
     *   ~0.47   the perpetual round — an annulus, so the reader's words
     *           sit INSIDE the mechanism, in the one part of it that
     *           does not turn
     *   ~0.78   the plain, and the quadrate marching on it
     *
     * The first draft put all three on one centre, and the result was a
     * bullseye with a bar of light straight through the reading. The
     * middle band is now the calmest region in the frame by
     * construction rather than by dimming.
     */
    render(canvas, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return false;
        if (!this.lattice.length) this.generate({}, this.seed);

        const pal = this._palette(options.colorPalette || this.params.colorPalette);
        const t = this.time;
        const unit = Math.min(w, h);
        // The gates clear the round entirely. When they overlapped, the
        // bar of light cut across the top of the annulus and washed out
        // the very Hours it was supposed to be turning.
        const gateY = h * 0.085;
        const roundY = h * 0.50;
        const plainY = h * 0.87;

        // Dawn opens once and stays open. `1 - e^-x`, not a sine: the
        // gates are unbarred, not oscillating.
        const dawn = 1 - Math.exp(-t * this.params.dawnSpeed);

        this._renderVoid(ctx, w, h, gateY, pal, dawn);
        this._renderGates(ctx, w, h, gateY, unit, pal, dawn);
        this._renderBeams(ctx, w, h, gateY, unit, pal, dawn, t);
        this._renderPerpetualRound(ctx, w, roundY, unit, pal, dawn, t);
        this._renderQuadrate(ctx, w, h, plainY, unit, pal, dawn, t);
        this._renderMotes(ctx, w, h, pal, dawn, t);
        this._renderReadingScrim(ctx, w, h);
        return true;
    }

    /** Empyreal night, warmest where the gates stand. */
    _renderVoid(ctx, w, h, gateY, pal, dawn) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, pal.void[1]);
        grad.addColorStop(Math.max(0.02, gateY / h), pal.void[2]);
        grad.addColorStop(0.55, pal.void[1]);
        grad.addColorStop(1, pal.void[0]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // "from before her vanished Night, / Shot through with orient
        // beams" — warmth pooled at the gates, falling away downward.
        const warm = ctx.createLinearGradient(0, 0, 0, h * 0.62);
        warm.addColorStop(0, `rgba(${pal.rose}, ${0.07 * dawn})`);
        warm.addColorStop(0.35, `rgba(${pal.gold}, ${0.05 * dawn})`);
        warm.addColorStop(1, `rgba(${pal.rose}, 0)`);
        ctx.fillStyle = warm;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * "Unbarred the gates of light."
     *
     * A slit, not a rule. The first version drew a flat bar with hard
     * ends and it read as a progress indicator; light has no ends, so
     * this tapers to nothing in both directions and carries a bloom.
     */
    _renderGates(ctx, w, h, gateY, unit, pal, dawn) {
        const cx = w / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // The golden cloud the voice speaks from.
        const cloud = ctx.createRadialGradient(cx, gateY, 0, cx, gateY, unit * 0.62);
        cloud.addColorStop(0, `rgba(${pal.pale}, ${0.26 * dawn})`);
        cloud.addColorStop(0.22, `rgba(${pal.gold}, ${0.14 * dawn})`);
        cloud.addColorStop(0.6, `rgba(${pal.rose}, ${0.045 * dawn})`);
        cloud.addColorStop(1, `rgba(${pal.rose}, 0)`);
        ctx.fillStyle = cloud;
        ctx.fillRect(0, 0, w, h);

        // THE SLIT, AS AN ELLIPTICAL FALLOFF RATHER THAN A RECTANGLE.
        //
        // Two drafts of this were drawn as filled rects — tapered along
        // their length but with hard edges across, and at any size that
        // reads as a rule someone drew, or worse, a progress bar. Light
        // has no edges. A radial gradient flattened on one axis has a
        // true 2D falloff in every direction, so the slit dissolves into
        // the cloud instead of ending.
        const reach = w * (0.20 + 0.28 * dawn);
        for (const [flatten, radius, alpha, colour] of [
            [0.045, reach, 0.55 * dawn, pal.pale],     // the core
            [0.16, reach * 0.8, 0.16 * dawn, pal.gold], // its spill
            [0.42, reach * 0.5, 0.07 * dawn, pal.rose]  // the flush around it
        ]) {
            ctx.save();
            ctx.translate(cx, gateY);
            ctx.scale(1, flatten);
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            glow.addColorStop(0, `rgba(${colour}, ${alpha})`);
            glow.addColorStop(0.35, `rgba(${colour}, ${alpha * 0.34})`);
            glow.addColorStop(1, `rgba(${colour}, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    /**
     * "Shot through with orient beams."
     *
     * They FALL from the gates rather than crossing the whole frame —
     * the first draft's full-width rays read as scratches on the plate.
     * Confined to the upper register and to the descending half of the
     * fan, so nothing rakes across the reading.
     */
    _renderBeams(ctx, w, h, gateY, unit, pal, dawn, t) {
        const cx = w / 2;
        const count = 11;
        const reach = h * 0.46;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h * 0.46);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(cx, gateY);
        // A whole revolution takes many minutes: over a paragraph this
        // is light that is present, not light that sweeps.
        const drift = Math.sin(t * this.params.roundSpeed * 0.35) * 0.05;
        for (let i = 0; i < count; i += 1) {
            const angle = 0.18 + (i / (count - 1)) * (Math.PI - 0.36) + drift;
            const length = reach * (0.55 + 0.45 * Math.sin(i * 1.7 + 1));
            const spread = unit * 0.020;
            const ex = Math.cos(angle) * length;
            const ey = Math.sin(angle) * length;
            const beam = ctx.createLinearGradient(0, 0, ex, ey);
            beam.addColorStop(0, `rgba(${pal.ray}, ${0.085 * dawn})`);
            beam.addColorStop(0.4, `rgba(${pal.ray}, ${0.028 * dawn})`);
            beam.addColorStop(1, `rgba(${pal.ray}, 0)`);
            ctx.fillStyle = beam;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex - Math.sin(angle) * spread, ey + Math.cos(angle) * spread);
            ctx.lineTo(ex + Math.sin(angle) * spread, ey - Math.cos(angle) * spread);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * The cave within the mount of God: light and darkness in perpetual
     * round, lodging and dislodging by turns.
     *
     * Twenty-four Hours on an annulus, sized so the WHOLE ring is in
     * frame — a clipped circle reads as an accident, and this figure
     * cannot afford to look accidental.
     *
     * The doors are fixed points in the FRAME, not properties the
     * sectors carry with them: light issues at the top and darkness
     * enters below, and the Hours pass THROUGH that standing pattern.
     * That is what makes the turning legible at all, and the difference
     * between a mechanism and a spinning ornament.
     */
    _renderPerpetualRound(ctx, w, roundY, unit, pal, dawn, t) {
        const cx = w / 2;
        // Thin. The ring is a halo, not a hoop: at the old thickness it
        // had the presence of a physical object in the room.
        const outer = unit * 0.318;
        const inner = unit * 0.288;
        const turn = t * this.params.roundSpeed;

        ctx.save();
        ctx.translate(cx, roundY);
        ctx.globalCompositeOperation = 'lighter';

        // A CONTINUOUS BAND UNDER THE SECTORS.
        //
        // Without it the twenty-four Hours read as a dashed circle —
        // tick marks on a dial, a loading spinner. The cave is a place
        // light lives in; the Hours modulate it, they are not the whole
        // of it. So the ring exists as an unbroken annulus first, and
        // the sectors are the measure laid over it.
        const band = ctx.createRadialGradient(0, 0, inner * 0.94, 0, 0, outer * 1.06);
        band.addColorStop(0, `rgba(${pal.rose}, 0)`);
        band.addColorStop(0.5, `rgba(${pal.gold}, ${0.075 * dawn})`);
        band.addColorStop(1, `rgba(${pal.rose}, 0)`);
        ctx.fillStyle = band;
        ctx.beginPath();
        ctx.arc(0, 0, outer * 1.06, 0, Math.PI * 2);
        ctx.fill();

        // TWO GRADIENTS, NOT TWENTY-FOUR SHAPES.
        //
        // This took three tries. Filled annular sectors have straight
        // radial sides and twenty-four of them is a watch bezel. Thick
        // arcs with round caps end in curves — and read as a bracelet of
        // beads, which was worse. The trouble was never the edge
        // treatment: it was that discrete SHAPES read as objects, and
        // this is supposed to be light in a cave.
        //
        // So nothing here is a shape. Two strokes of the same circle:
        //
        //   the Hours   a conic gradient, TURNING — the measure
        //   the doors   a vertical gradient, FIXED — light issuing above,
        //               darkness entering below
        //
        // Their product is a ring bright at the top and dim at the
        // bottom with twenty-four soft undulations passing through it,
        // which is what "light and darkness in perpetual round / Lodge
        // and dislodge by turns" actually describes. No hard edge exists
        // anywhere in it.
        const mid = (outer + inner) / 2;
        ctx.lineWidth = (outer - inner) * 0.92;

        if (typeof ctx.createConicGradient === 'function') {
            const hours = ctx.createConicGradient(turn, 0, 0);
            for (let i = 0; i <= HOURS * 2; i += 1) {
                const at = i / (HOURS * 2);
                const on = i % 2 === 0;
                hours.addColorStop(Math.min(1, at),
                    `rgba(${pal.gold}, ${(on ? 0.145 : 0.028) * dawn})`);
            }
            ctx.strokeStyle = hours;
            ctx.beginPath();
            ctx.arc(0, 0, mid, 0, Math.PI * 2);
            ctx.stroke();
        }

        // The doors. Fixed in the frame, so the Hours pass through them
        // rather than carrying their own brightness around with them —
        // which is the difference between a mechanism and an ornament
        // that spins.
        const doors = ctx.createLinearGradient(0, -outer, 0, outer);
        doors.addColorStop(0, `rgba(${pal.pale}, ${0.26 * dawn})`);
        doors.addColorStop(0.42, `rgba(${pal.gold}, ${0.10 * dawn})`);
        doors.addColorStop(0.78, `rgba(${pal.rose}, ${0.035 * dawn})`);
        doors.addColorStop(1, `rgba(${pal.rose}, ${0.02 * dawn})`);
        ctx.strokeStyle = doors;
        ctx.beginPath();
        ctx.arc(0, 0, mid, 0, Math.PI * 2);
        ctx.stroke();

        // Hairlines bounding the round. Perfect circles are what tell the
        // eye this is an instrument and not weather.
        ctx.lineWidth = Math.max(1, unit * 0.0011);
        for (const r of [inner, outer]) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${pal.gold}, ${0.20 * dawn})`;
            ctx.stroke();
        }
        // The door of light, held open at the top of the round.
        const door = ctx.createRadialGradient(0, -outer, 0, 0, -outer, unit * 0.13);
        door.addColorStop(0, `rgba(${pal.pale}, ${0.30 * dawn})`);
        door.addColorStop(1, `rgba(${pal.gold}, 0)`);
        ctx.fillStyle = door;
        ctx.beginPath();
        ctx.arc(0, -outer, unit * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * "in mighty quadrate joined / Of union irresistible."
     *
     * Every point's position is derived from its integer (col, row) on
     * every frame and the whole body wraps by one cell, so nothing
     * accumulates. The ranks are not merely unlikely to go crooked over
     * a long reading — they cannot.
     *
     * The rank LINES are the point. A field of dots is a halftone; dots
     * on drawn ranks are a host. "nor obvious hill, / Nor straitening
     * vale, nor wood, nor stream, divides / Their perfect ranks" is a
     * claim about connection, and it has to be visible as connection.
     */
    _renderQuadrate(ctx, w, h, plainY, unit, pal, dawn, t) {
        const cols = this.params.latticeCols;
        const rows = this.params.latticeRows;
        const marched = (t * this.params.marchSpeed) % 1;
        const depthOf = row => Math.pow((row + 0.5) / rows, 2);
        const yOf = depth => plainY + depth * (h - plainY) * 1.04;
        // Ranks converge toward the gates: the formation is aimed.
        const spanOf = depth => w * (0.22 + 1.05 * depth);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // THE FAR HOST DOES NOT RESOLVE.
        //
        // Every draft of this looked like a halftone screen, and no
        // amount of tuning dot size fixed it, because the fault was
        // conceptual: a grid of identical resolvable circles IS a
        // halftone, at any scale. "By thousands and by millions" is a
        // claim about a number too large to count, and a multitude at
        // distance does not resolve into individuals — it becomes a
        // continuous shimmer.
        //
        // So the far ranks are a band of light and only the near ranks
        // are points. Which is also just what depth does.
        const haze = ctx.createLinearGradient(0, plainY - unit * 0.02, 0, h);
        haze.addColorStop(0, `rgba(${pal.gold}, 0)`);
        haze.addColorStop(0.16, `rgba(${pal.pale}, ${0.055 * dawn})`);
        haze.addColorStop(0.45, `rgba(${pal.gold}, ${0.03 * dawn})`);
        haze.addColorStop(1, `rgba(${pal.rose}, 0)`);
        ctx.fillStyle = haze;
        ctx.fillRect(0, plainY - unit * 0.02, w, h - plainY + unit * 0.02);

        // The ranks themselves, drawn first so the shields sit on them.
        for (let row = 0; row < rows; row += 1) {
            const depth = depthOf(row);
            const y = yOf(depth);
            if (y > h + 8) continue;
            const span = spanOf(depth);
            const line = ctx.createLinearGradient(w / 2 - span / 2, 0, w / 2 + span / 2, 0);
            const a = dawn * (0.02 + 0.10 * depth);
            line.addColorStop(0, `rgba(${pal.gold}, 0)`);
            line.addColorStop(0.5, `rgba(${pal.gold}, ${a})`);
            line.addColorStop(1, `rgba(${pal.gold}, 0)`);
            ctx.strokeStyle = line;
            ctx.lineWidth = Math.max(1, unit * 0.0009);
            ctx.beginPath();
            ctx.moveTo(w / 2 - span / 2, y);
            ctx.lineTo(w / 2 + span / 2, y);
            ctx.stroke();
        }

        // "Reflecting blaze on blaze."
        //
        // THE RANKS ARE RIGID; THE LIGHT IS WHAT MOVES. A perfectly even
        // grid of identical dots is a halftone screen, and the second
        // draft looked exactly like one — a printed dither, not a host.
        // The obvious cure is to perturb the lattice, and that is the one
        // cure this figure may not use: irregular ranks would say the
        // opposite of "indissolubly firm".
        //
        // So the geometry stays exact and a broad illumination crosses
        // it, as light from the gates falling along a formation. The
        // variation is in the fall of light, which is where variation
        // belongs in a thing that is not allowed to bend.
        const sweep = Math.sin(t * 0.06) * 0.6;
        for (const point of this.lattice) {
            const depth = depthOf(point.row);
            const y = yOf(depth);
            if (y > h + 8) continue;
            // A RIGID DECIMATION. Alternate columns drop out on
            // alternate ranks, which breaks the dot-matrix read
            // without moving one point off its true place — the
            // quincunx a real formation stands in, and still exact.
            if ((point.col + point.row) % 2 === 1 && depth > 0.35) continue;
            const across = ((point.col + marched) / cols) - 0.5;
            const x = w / 2 + across * spanOf(depth);
            if (x < -8 || x > w + 8) continue;

            // Falls off toward the edges of the plain, so the host has a
            // near and a far side rather than filling the frame evenly.
            const edge = Math.max(0, 1 - Math.pow(Math.abs(across) * 2.1, 2.2));
            const illumination = 0.35 + 0.65 * Math.max(0,
                1 - Math.abs(across * 2 - sweep) * 0.9);
            const gleam = 0.5 + 0.5 * Math.sin(t * 0.55 + point.phase);
            const size = Math.max(0.45, unit * 0.0013 * (0.25 + depth * 2.2));
            // Points fade out toward the horizon, handing the far
            // ranks over to the haze rather than competing with it.
            const resolves = Math.max(0, Math.min(1, (depth - 0.04) * 2.4));
            const alpha = dawn * point.gleam * edge * illumination * resolves
                * (0.11 + 0.30 * gleam) * (0.20 + 0.80 * depth);
            if (alpha < 0.004) continue;
            ctx.fillStyle = `rgba(${pal.pale}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /** Motes in the empyreal air: they breathe, they do not travel. */
    _renderMotes(ctx, w, h, pal, dawn, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const mote of this.motes) {
            const gleam = 0.5 + 0.5 * Math.sin(t * 0.3 + mote.phase);
            ctx.fillStyle = `rgba(${pal.ray}, ${dawn * mote.gleam * gleam * 0.13})`;
            ctx.beginPath();
            ctx.arc(mote.x * w, mote.y * h, mote.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * The band the words sit in is held down deliberately — a trough
     * across the middle rather than a global dim, which would flatten
     * the whole image to protect one strip.
     */
    _renderReadingScrim(ctx, w, h) {
        const scrim = ctx.createLinearGradient(0, h * 0.26, 0, h * 0.74);
        scrim.addColorStop(0, 'rgba(4, 4, 10, 0)');
        scrim.addColorStop(0.5, 'rgba(4, 4, 10, 0.30)');
        scrim.addColorStop(1, 'rgba(4, 4, 10, 0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, w, h);

        const vignette = ctx.createRadialGradient(
            w / 2, h * 0.5, Math.min(w, h) * 0.34,
            w / 2, h * 0.5, Math.max(w, h) * 0.80);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }
}

