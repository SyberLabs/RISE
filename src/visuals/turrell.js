/**
 * Turrell Generator v4.0
 * Luminous apertures inspired by James Turrell's installations.
 *
 * WHAT CHANGED IN v4 AND WHY
 * ──────────────────────────
 * v3 rendered full-bleed gradients: beautiful washes, but they read as
 * "colored background," not as Turrell. The essential Turrell gesture is
 * not a gradient — it is an APERTURE: a bounded shape of impossible light
 * held inside a darker field, whose edge is soft enough that the eye
 * cannot decide whether it is an opening, a surface, or a solid volume.
 * (Afrum, the Space Division pieces, the Skyspaces: all aperture.)
 *
 * So v4 composes every field as figure-and-ground:
 *
 *   1. GROUND — a deep, desaturated chamber wash, near-black but never
 *      flat black, subtly graded so the "wall" has a direction of light.
 *   2. APERTURE — a bounded ellipse/arch/portal of saturated light with a
 *      luminous core, placed off-center on a compositional third.
 *   3. BLOOM — wide, very low-alpha halo bleeding the aperture's hue into
 *      the ground, the optical spill that makes the shape feel volumetric.
 *   4. ATMOSPHERE — a faint directional haze and a soft vignette that seat
 *      the aperture in a room rather than on a screen.
 *
 * Depth of color comes from LAYERED HUES, not from one ramp: the core,
 * the body, and the spill each carry a slightly different hue, so the
 * aperture shifts temperature across its own radius the way projected
 * light does through air.
 *
 * PLAN CONTRACT (unchanged): generate() still returns and stores a
 * {kind, center, radius, angle, stops} plan for the ASCII compiler. The
 * plan describes the APERTURE — the thing worth transcribing — so ASCII
 * mode reads as a luminous shape rather than an even wash.
 */

// Aperture hues carry a core/body/spill triad. The eye reads the small
// hue drift across the radius as physical light passing through air.
const PALETTES = {
    // Deep twilight blues opening onto a warm horizon
    twilight: {
        ground: { h: 232, s: 30, l: 7 },
        core: { h: 268, s: 62, l: 74 },
        body: { h: 244, s: 58, l: 52 },
        spill: { h: 288, s: 46, l: 34 }
    },
    // Warm emergence — the Skyspace at sunrise
    dawn: {
        ground: { h: 18, s: 26, l: 7 },
        core: { h: 38, s: 80, l: 76 },
        body: { h: 20, s: 72, l: 55 },
        spill: { h: 350, s: 52, l: 33 }
    },
    // Cool transcendent cyan, the classic Turrell aperture
    ethereal: {
        ground: { h: 200, s: 30, l: 6 },
        core: { h: 176, s: 66, l: 76 },
        body: { h: 192, s: 68, l: 54 },
        spill: { h: 214, s: 54, l: 34 }
    },
    // Threshold violet — aligned to the app's own accent
    chamber: {
        ground: { h: 250, s: 26, l: 7 },
        core: { h: 258, s: 58, l: 74 },
        body: { h: 250, s: 52, l: 52 },
        spill: { h: 224, s: 46, l: 33 }
    },
    // Interior fire seen through a wall
    ember: {
        ground: { h: 8, s: 30, l: 6 },
        core: { h: 32, s: 82, l: 72 },
        body: { h: 12, s: 74, l: 50 },
        spill: { h: 344, s: 56, l: 30 }
    },
    // Near-monochrome: luminance does all the work
    void: {
        ground: { h: 228, s: 12, l: 6 },
        core: { h: 216, s: 16, l: 78 },
        body: { h: 222, s: 14, l: 52 },
        spill: { h: 236, s: 16, l: 30 }
    },
    // Turrell's Ganzfeld magentas
    ganzfeld: {
        ground: { h: 300, s: 24, l: 7 },
        core: { h: 326, s: 70, l: 74 },
        body: { h: 310, s: 64, l: 52 },
        spill: { h: 268, s: 52, l: 33 }
    }
};

// Aperture geometries. Each is a bounded shape, never full-bleed: the
// ground must survive around it or the figure dissolves.
const APERTURES = ['ellipse', 'portal', 'arch', 'slab', 'corner'];

export class Turrell {
    constructor(el) {
        this.el = el;
        this.palettes = PALETTES;
    }

    choose(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    hslToString(hsl, alpha = 1) {
        const h = ((hsl.h % 360) + 360) % 360;
        const s = Math.max(0, Math.min(100, hsl.s));
        const l = Math.max(0, Math.min(100, hsl.l));
        return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${alpha})`;
    }

    shiftColor(hsl, hueShift = 0, satShift = 0, lightShift = 0) {
        return {
            h: (hsl.h + hueShift + 360) % 360,
            s: Math.max(0, Math.min(100, hsl.s + satShift)),
            l: Math.max(0, Math.min(100, hsl.l + lightShift))
        };
    }

    /**
     * The chamber wall the aperture is cut into. Never flat: a shallow
     * gradient gives the room a direction of light, so the aperture has
     * something to sit in.
     */
    createGround(palette, lightFrom) {
        const near = this.shiftColor(palette.ground, 0, 2, 4);
        const far = this.shiftColor(palette.ground, -6, -2, -3);
        return `linear-gradient(${lightFrom}deg,
            ${this.hslToString(near, 1)} 0%,
            ${this.hslToString(palette.ground, 1)} 45%,
            ${this.hslToString(far, 1)} 100%)`;
    }

    /**
     * The aperture: a bounded shape of light whose edge is soft enough to
     * read as opening OR volume. Returns both the CSS layer and the plan
     * the ASCII compiler transcribes.
     *
     * The three hues (core/body/spill) drift across the radius, which is
     * what gives the shape depth instead of a flat colored blob.
     */
    createAperture(palette, shape) {
        // Off-center placement on a compositional third — dead center
        // reads as a target; slightly off reads as a room.
        let cx = this.rand(0.36, 0.64);
        let cy = this.rand(0.38, 0.58);

        // Each geometry gets a genuinely different silhouette: aspect
        // ratio, scale, AND edge hardness. `edgeSharp` is the fraction of
        // the radius the light holds before it begins to fall off — a
        // low value is fog, a high value is an opening in a wall. That
        // contrast is the whole Turrell illusion, so the shapes must
        // actually differ in it, not merely in size.
        let rx, ry, edge, edgeSharp;
        switch (shape) {
            case 'portal':      // tall doorway — narrow, decisive edge
                rx = this.rand(0.09, 0.13);
                ry = this.rand(0.19, 0.27);
                edgeSharp = this.rand(0.74, 0.84);
                break;
            case 'arch':        // wide, low, horizon-like — soft top edge
                rx = this.rand(0.24, 0.32);
                ry = this.rand(0.08, 0.12);
                edgeSharp = this.rand(0.55, 0.68);
                break;
            case 'slab':        // Afrum: a solid of light, hardest edge
                rx = this.rand(0.12, 0.17);
                ry = this.rand(0.16, 0.22);
                edgeSharp = this.rand(0.86, 0.93);
                break;
            case 'corner':      // pushed off-frame; only part is visible
                rx = this.rand(0.22, 0.30);
                ry = this.rand(0.22, 0.30);
                edgeSharp = this.rand(0.48, 0.60);
                // The aperture leaves the frame — the eye completes it
                cx = this.choose([this.rand(0.02, 0.14), this.rand(0.86, 0.98)]);
                cy = this.choose([this.rand(0.04, 0.20), this.rand(0.80, 0.96)]);
                break;
            case 'ellipse':
            default:            // the classic soft oculus — true Ganzfeld
                rx = this.rand(0.16, 0.23);
                ry = this.rand(0.13, 0.19);
                edgeSharp = this.rand(0.34, 0.48);
                break;
        }
        // The soft falloff is expressed inside the ramp (edgeSharp), so
        // the geometry above IS the full extent. Adding a separate edge
        // radius on top would double the aperture and flood the ground —
        // and the ground surviving is what makes this figure, not wash.
        edge = 0;

        const px = (cx * 100).toFixed(1);
        const py = (cy * 100).toFixed(1);

        // The light HOLDS out to edgeSharp, then falls. A slab holds to
        // 0.9 of its radius and drops in the last tenth (an opening in a
        // wall); a Ganzfeld ellipse starts falling at 0.34 and never
        // fully resolves (a fog with no surface). The core sits at a
        // third of the hold distance so the interior still has a source.
        const coreStop = edgeSharp * 0.34;
        const bodyStop = edgeSharp;
        const spillStop = edgeSharp + (1 - edgeSharp) * 0.55;

        const core = palette.core;
        const body = palette.body;
        const spill = palette.spill;

        // The plan the ASCII compiler transcribes: an aperture, with the
        // ground as its outermost stop so ASCII sees figure AND field.
        this.lastPlan = {
            kind: 'radial',
            center: [cx, cy],
            radius: [rx + edge, ry + edge],
            stops: [
                { offset: 0, color: this.shiftColor(core, 0, 0, 6) },
                { offset: coreStop, color: core },
                { offset: bodyStop, color: body },
                { offset: spillStop, color: spill },
                { offset: 1, color: palette.ground }
            ]
        };

        const pct = f => (f * 100).toFixed(1);

        // An extra stop just inside the edge keeps the body at nearly
        // full strength right up to the falloff, so the boundary reads
        // as an EDGE rather than a blur. Without it the ramp spends its
        // whole radius dimming and the shape dissolves into haze.
        const holdStop = coreStop + (bodyStop - coreStop) * 0.62;

        return `radial-gradient(
            ellipse ${((rx + edge) * 200).toFixed(1)}% ${((ry + edge) * 200).toFixed(1)}% at ${px}% ${py}%,
            ${this.hslToString(this.shiftColor(core, 0, 0, 8), 1)} 0%,
            ${this.hslToString(core, 0.99)} ${pct(coreStop)}%,
            ${this.hslToString(this.shiftColor(body, 0, 4, 8), 0.98)} ${pct(holdStop)}%,
            ${this.hslToString(body, 0.94)} ${pct(bodyStop)}%,
            ${this.hslToString(spill, 0.5)} ${pct(spillStop)}%,
            ${this.hslToString(spill, 0)} 100%)`;
    }

    /**
     * Optical spill: a very wide, very faint halo of the aperture's hue
     * bleeding into the ground. This is what sells the light as physical
     * — without it the aperture looks pasted on.
     */
    createBloom(palette, center) {
        const [cx, cy] = center;
        const hue = this.shiftColor(palette.body, 0, -10, 6);
        const strength = this.rand(0.10, 0.20);
        // NOTE: `circle <percentage>` is invalid CSS — a circle radius
        // must be a single length. Percentages require the two-value
        // ellipse form, and one invalid layer voids the whole shorthand.
        const spread = this.rand(70, 100).toFixed(0);
        return `radial-gradient(
            ellipse ${spread}% ${spread}% at ${(cx * 100).toFixed(1)}% ${(cy * 100).toFixed(1)}%,
            ${this.hslToString(hue, strength)} 0%,
            ${this.hslToString(hue, strength * 0.45)} 35%,
            ${this.hslToString(hue, 0)} 72%)`;
    }

    /**
     * Directional haze — the air in the room catching light from one
     * side. Faint by design; it registers as depth, not as color.
     */
    createAtmosphere(palette, lightFrom) {
        // Desaturate proportionally, not by a fixed amount: a flat -30
        // clamps the near-monochrome palettes to pure gray, losing the
        // last trace of hue that makes the haze read as lit air.
        const hue = {
            h: palette.core.h,
            s: palette.core.s * 0.55,
            l: Math.max(0, palette.core.l - 8)
        };
        const intensity = this.rand(0.04, 0.09);
        return `linear-gradient(${lightFrom}deg,
            ${this.hslToString(hue, intensity)} 0%,
            ${this.hslToString(hue, 0)} 55%)`;
    }

    /** Seats the composition in a room rather than on a screen. */
    createVignette() {
        const intensity = this.rand(0.30, 0.50);
        return `radial-gradient(ellipse 118% 118% at 50% 50%,
            rgba(0, 0, 0, 0) 42%,
            rgba(2, 2, 6, ${intensity.toFixed(3)}) 100%)`;
    }

    generate() {
        const paletteKey = this.choose(Object.keys(this.palettes));
        const palette = this.palettes[paletteKey];
        const shape = this.choose(APERTURES);
        // One light direction governs ground, haze, and their agreement
        const lightFrom = this.choose([160, 180, 200, 340, 20]);

        // Build the aperture first: bloom and plan both follow its center
        const apertureLayer = this.createAperture(palette, shape);
        const aperturePlan = this.lastPlan;

        // CSS paints first layer on top, so compose front-to-back:
        // vignette → atmosphere → aperture → bloom → ground
        const layers = [
            this.createVignette(),
            this.createAtmosphere(palette, lightFrom),
            apertureLayer,
            this.createBloom(palette, aperturePlan.center),
            this.createGround(palette, lightFrom)
        ];

        this.el.style.background = layers.join(', ');
        this.el.style.transition = 'none';
        this.el.style.boxShadow = 'none';

        aperturePlan.palette = paletteKey;
        aperturePlan.aperture = shape;
        this.lastPlan = aperturePlan;
        return aperturePlan;
    }
}
