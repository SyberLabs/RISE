/**
 * The oracle: RISE's own face, the room's resting picture in the Live venue (docs/plans/LIVE-CURRENT.md §22), and
 * the frame every visual of a Live reading is held in (§23).
 *
 * A port of the approved studies (docs/assets/live/sophia-face-study.html, the face; docs/assets/live/sophia-aperture-study.html,
 * the three frames): a central eye of three layers of 36 petals drifting at their own paces, a breathing pupil that
 * narrows as the reader's pointer comes near, a catchlight set against the gaze, seven orbiting nodes, a field of 24
 * spiral lines, a torus, phi recursion circles, and a slow trail in the skin's own dark. Its geometry, colours,
 * timings and blink are the owner's decisions; change them in the studies first.
 *
 * In the venue's room the canvas covers the whole room, over the reading's visual and under its words, and the venue
 * sends the room's geometry on every animation frame as the cue `aperture:<json>` (src/live/host/frames.js
 * frameGeometry): where the face is, how closed the transition has the eye, and the aperture of the inner eye, the
 * outer shell or the full frame. The canvas is ground everywhere but that aperture, through which the visual beneath
 * shows. The engine draws the rim, the crown, the shutter and the face from those numbers and computes no geometry
 * of its own. `aperture:null` gives it back its own square, as in the entry.
 *
 * It is a scene module, run in the scene worker like any generated scene (src/scenes/scene-worker.js): the
 * default export takes `rise` and returns `{ frame, cue, input }`. It listens to the pointer for its gaze and
 * emits nothing: no `rise.emit`, no perception, no journal. It is RISE's own presence, never an engine a model
 * may name, so it is not in SCENE_MANIFESTS. Its start parameters come on `rise.theme` (`skin`, `state`); the
 * face has no reading theme, its skin is its colours.
 *
 * This file is sent to the worker as text (?raw) and loaded from a blob: it imports nothing.
 */

/**
 * Skins: core (the pupil's heart), iris, glow (field and nodes), deep (the pupil's depth), trail (the room's ground).
 * A `light` skin is a pale room drawn as glaze on porcelain: its heart is a white highlight, its lines darken what is
 * under them rather than lighten it, its trail fades up to its ground rather than down, and its `ink` is the room's
 * words (a dark skin's words are its core).
 */
export const ORACLE_SKINS = Object.freeze({
    sophia: Object.freeze({ core: [245, 245, 220], iris: [135, 206, 235], glow: [176, 196, 222], deep: [25, 25, 112], trail: [10, 10, 15] }),
    ember: Object.freeze({ core: [255, 236, 210], iris: [240, 163, 107], glow: [214, 120, 92], deep: [70, 20, 20], trail: [14, 9, 8] }),
    jade: Object.freeze({ core: [236, 245, 230], iris: [143, 211, 181], glow: [120, 180, 150], deep: [10, 50, 40], trail: [7, 12, 10] }),
    silver: Object.freeze({ core: [250, 250, 250], iris: [207, 211, 218], glow: [160, 166, 176], deep: [30, 32, 40], trail: [9, 9, 11] }),
    porcelain: Object.freeze({ core: [255, 253, 248], iris: [47, 95, 179], glow: [168, 192, 230], deep: [14, 27, 54], trail: [244, 239, 230], ink: [23, 42, 79], light: true })
});

/** Each state is a set of targets the face eases toward (time constant 0.18 s): nothing snaps. */
export const ORACLE_STATES = Object.freeze({
    arrival: Object.freeze({ open: 0.55, orbit: 0.10, spin: 0.08, field: 0.9, tight: 1.00, glow: 0.55 }),
    listening: Object.freeze({ open: 0.95, orbit: 0.18, spin: 0.12, field: 1.1, tight: 0.80, glow: 0.90 }),
    thinking: Object.freeze({ open: 0.80, orbit: 0.55, spin: 0.40, field: 1.6, tight: 0.62, glow: 1.00 }),
    speaking: Object.freeze({ open: 0.70, orbit: 0.10, spin: 0.06, field: 0.6, tight: 1.10, glow: 0.35 }),
    rest: Object.freeze({ open: 0.45, orbit: 0.07, spin: 0.05, field: 0.7, tight: 1.05, glow: 0.45 })
});

const SKIN_NAMES = Object.freeze(Object.keys(ORACLE_SKINS));
const STATE_NAMES = Object.freeze(Object.keys(ORACLE_STATES));

/** What the face takes, in a manifest's shape (src/scenes/manifests.js): read by the venue, never by a model. */
export const ORACLE_MANIFEST = Object.freeze({
    id: 'oracle', kind: 'presence', surface: 'oracle',
    parameters: Object.freeze({
        skin: Object.freeze({ type: 'enum', values: SKIN_NAMES, default: 'sophia', cueable: true }),
        state: Object.freeze({ type: 'enum', values: STATE_NAMES, default: 'arrival', cueable: true })
    }),
    cues: Object.freeze({
        ...Object.fromEntries(STATE_NAMES.map(name => [name, Object.freeze({ state: name })])),
        blink: Object.freeze({})
    })
});

const TAU = Math.PI * 2;
const PHI = 1.618033988749895;
const PETALS = 36;
const BLADES = 9;
const CROWN = 48;

const smooth = u => u * u * (3 - 2 * u);
const clamp01 = value => Math.max(0, Math.min(1, value));
const mix = (from, to, k) => from + (to - from) * k;

/**
 * How closed the eye is, `elapsed` seconds into a blink: the petals fold over 220 ms (easing in), rest 70 ms, and
 * open over 360 ms (easing out); a thinking face blinks 1.2 times slower, the rest unchanged. Null once it is over.
 */
export function blinkClosure(elapsed, thinking) {
    const slow = thinking ? 1.2 : 1;
    const close = 0.22 * slow;
    const hold = 0.07;
    const open = 0.36 * slow;
    if (elapsed < close) return smooth(elapsed / close);
    if (elapsed < close + hold) return 1;
    if (elapsed < close + hold + open) return 1 - smooth((elapsed - close - hold) / open);
    return null;
}

/**
 * The shutter's seams at unit radius, before any turn: an S from the centre to the rim, out along the blade,
 * bending with the sweep, settling at the rim. The turn is a rotation of the whole, applied when drawn.
 */
const SEAMS = Array.from({ length: BLADES + 1 }, (_, k) => {
    const a = (k / BLADES) * TAU;
    return {
        a,
        p1: [0.30 * Math.cos(a + 0.95), 0.30 * Math.sin(a + 0.95)],
        p2: [0.72 * Math.cos(a - 0.22), 0.72 * Math.sin(a - 0.22)],
        p3: [1.02 * Math.cos(a + 0.08), 1.02 * Math.sin(a + 0.08)]
    };
});

export const listens = ['pointer'];

export default function oracle(rise) {
    const ctx = rise.ctx;
    const reduced = rise.reducedMotion === true;
    rise.listen?.('pointer');

    let skinName = SKIN_NAMES.includes(rise.theme?.skin) ? rise.theme.skin : 'sophia';
    let skin = ORACLE_SKINS[skinName];
    let stateName = STATE_NAMES.includes(rise.theme?.state) ? rise.theme.state : 'arrival';
    let target = ORACLE_STATES[stateName];
    const live = { ...target };
    const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

    // Size: the square the face is drawn in, centred in the canvas; the pixel ratio is the worker's, capped at 2.
    let width = 0;
    let height = 0;
    let dpr = 1;
    let size = 0;
    let cx = 0;
    let cy = 0;
    let repaint = true;
    let torusBuilds = 0;
    // The room's geometry from the venue (frames.js frameGeometry), or null: the face in its own square.
    let room = null;
    // Where the face was drawn in the last frame, for the gaze.
    let face = { x: 0, y: 0, s: 1 };

    // The torus's rings and segments, once per size: 48 rings of 24 segments, deformed each frame by a slow wave.
    const torus = { u: new Float64Array(48), v: new Float64Array(25), cosV: new Float64Array(25) };
    for (let j = 0; j <= 24; j += 1) {
        torus.v[j] = (j / 24) * TAU;
        torus.cosV[j] = Math.cos(torus.v[j]);
    }
    for (let i = 0; i < 48; i += 1) torus.u[i] = (i / 48) * TAU;

    function fit() {
        width = rise.size.width;
        height = rise.size.height;
        dpr = Math.min(2, rise.size.dpr || 1);
        size = Math.min(width, height);
        cx = width / 2;
        cy = height / 2;
        torusBuilds += 1;
        repaint = true;
    }

    /** The face in its own square, at rest: what the entry draws, and the room before the venue has said otherwise. */
    const atRest = () => ({
        frame: 'none', big: { x: cx, y: cy, s: size }, face: { x: cx, y: cy, s: size }, small: 0, dim: 1, spread: 1,
        travel: 0, eyeClosed: 0, blink: true, eye: null, crown: null, aperture: null, wipe: null
    });

    // Seven nodes, each with its own phase and pace.
    const nodes = Array.from({ length: 7 }, (_, i) => ({ angle: (i / 7) * TAU, phase: Math.random() * TAU, pace: 0.5 + Math.random() * 0.5, lit: 0.5 }));

    // Gaze: the pointer's offset from the face's centre, normalised and clamped; eased so the eye turns, never jumps.
    const gaze = { x: 0, y: 0, depth: 0 };
    const aim = { x: 0, y: 0, depth: 0 };

    // The blink: every 4 to 8 seconds (the first after 3 to 7).
    let nextBlink = 3 + Math.random() * 4;
    let blinkAt = -1;
    let wasFree = true;
    let closed = 0;

    let t = 0;
    const clamp1 = value => Math.max(-1, Math.min(1, value));

    function setState(name, instant) {
        if (!STATE_NAMES.includes(name)) return;
        stateName = name;
        target = ORACLE_STATES[name];
        if (instant || reduced) Object.assign(live, target);
    }

    function setSkin(name) {
        if (!SKIN_NAMES.includes(name) || name === skinName) return;
        skinName = name;
        skin = ORACLE_SKINS[name];
        repaint = true;
    }

    /**
     * The room's geometry, as sent; anything that is not an object with a frame is no geometry. Entering the room or
     * leaving it repaints the canvas whole; a new geometry in the room keeps the slow trails, as the study's room does.
     */
    function setRoom(json) {
        let next = null;
        try { next = JSON.parse(json); } catch { next = null; }
        next = next && typeof next === 'object' && typeof next.frame === 'string' && next.face && next.big ? next : null;
        if ((next === null) !== (room === null)) repaint = true;
        room = next;
    }

    /**
     * The blink, when the eye may blink on its own (at rest, or docked); otherwise none is begun, and one under way
     * runs to its end, so the eye never snaps open as a transition begins.
     */
    function blinkAmount(free) {
        if (reduced) return 0;
        // Let free again after a transition, the eye has just opened: its own next blink is at least 2 to 4 s away.
        if (free && !wasFree) nextBlink = Math.max(nextBlink, t + 2 + Math.random() * 2);
        wasFree = free;
        if (blinkAt < 0 && free && t > nextBlink) blinkAt = t;
        if (blinkAt < 0) return 0;
        const amount = blinkClosure(t - blinkAt, stateName === 'thinking');
        if (amount !== null) return amount;
        blinkAt = -1;
        nextBlink = t + 4 + Math.random() * 4;
        return 0;
    }

    /** The field's 24 spiral lines; `m` carries them to the shell's woven band at 0.43 to 0.46. */
    function drawField(f, m, alpha) {
        const amp = live.field;
        ctx.strokeStyle = rgba(skin.iris, (0.10 + 0.10 * live.glow) * alpha);
        const thin = Math.min(1, f.s / 300);
        for (let i = 0; i < 24; i += 1) {
            const a = (i / 24) * TAU;
            ctx.beginPath();
            for (let j = 0; j <= 40; j += 1) {
                const u = j / 40;
                const wave = Math.sin(t * 2 * amp + a * 3 + u * Math.PI * 4) * 0.1;
                const spiral = u * TAU + t * 0.6 * amp + a;
                const r = mix(f.s * 0.10 + u * f.s * 0.35 * live.tight * (1 + wave), f.s * (0.43 + u * 0.03 + wave * 0.12), m);
                const x = f.x + r * Math.cos(spiral);
                const y = f.y + r * Math.sin(spiral);
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.lineWidth = Math.max(0.4, (0.8 + Math.sin(t + a) * 0.4) * thin);
            ctx.stroke();
        }
    }

    const recursionInk = ['', '', '', ''];
    function drawRecursion(x, y, radius, depthLeft, phase) {
        if (depthLeft <= 0 || radius < 3) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase);
        const child = radius / PHI;
        for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * TAU;
            drawRecursion(radius * Math.cos(a), radius * Math.sin(a), child, depthLeft - 1, phase + a);
        }
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TAU);
        ctx.strokeStyle = recursionInk[depthLeft];
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
    }

    /** The torus; `m` carries it to the shell's rim, at 0.445 with a thin tube. */
    function drawTorus(f, m) {
        ctx.save();
        ctx.globalCompositeOperation = skin.light ? 'multiply' : 'screen';
        ctx.strokeStyle = rgba(skin.glow, mix(0.04 + gaze.depth * 0.08 + live.glow * 0.03, 0.16, m));
        ctx.lineWidth = 0.5;
        const R = mix(f.s * 0.30 * live.tight, f.s * 0.445, m);
        const tube = mix(f.s * 0.09 * live.tight, f.s * 0.014, m);
        const turn = t * 0.05;
        const pace = t * 0.8 * (0.5 + live.spin);
        for (let i = 0; i < 48; i += 1) {
            const u = torus.u[i];
            const cosU = Math.cos(u + turn);
            const sinU = Math.sin(u + turn);
            ctx.beginPath();
            for (let j = 0; j <= 24; j += 1) {
                const w = Math.sin(pace + u * 2 + torus.v[j]) * 0.2;
                const reach = R + tube * (1 + w) * torus.cosV[j];
                const x = f.x + reach * cosU;
                const y = f.y + reach * sinU;
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    /** The seven lights; `m` carries them to orbit the shell's rim at 0.452, smaller. They shrink with the face. */
    function drawNodes(f, m, scale, dt) {
        const orbitR = mix(f.s * 0.25 * live.tight, f.s * 0.452, m);
        const settle = 1 - 0.9 ** (dt * 60);
        const shrink = mix(1, 0.42, m) * scale;
        for (const node of nodes) {
            node.angle += (reduced ? 0 : live.orbit) * 0.4 * dt;
            const x = f.x + orbitR * Math.cos(node.angle);
            const y = f.y + orbitR * Math.sin(node.angle);
            const near = Math.max(0, 1 - Math.hypot(gaze.x * f.s * 0.5 + f.x - x, gaze.y * f.s * 0.5 + f.y - y) / (f.s * 0.2));
            node.lit = mix(node.lit, 0.45 + near * 0.35 + live.glow * 0.3, settle);
            const pulse = Math.max(1, (16 + Math.sin(t * node.pace * (1 + live.orbit) + node.phase) * 8 * node.lit) * shrink);
            ctx.lineWidth = 1;
            for (let ring = 3; ring > 0; ring -= 1) {
                ctx.beginPath();
                ctx.arc(x, y, pulse * ring * 0.5, 0, TAU);
                ctx.strokeStyle = rgba(skin.iris, (0.08 / ring) * node.lit);
                ctx.stroke();
            }
            const g = ctx.createRadialGradient(x, y, 0, x, y, pulse);
            if (skin.light) {
                // On a pale ground a light is a bead of ink: densest at its heart, not a pale heart in a dark ring.
                g.addColorStop(0, rgba(skin.iris, 0.6 * node.lit));
                g.addColorStop(0.45, rgba(skin.glow, 0.35 * node.lit));
                g.addColorStop(1, rgba(skin.glow, 0));
            } else {
                g.addColorStop(0, rgba(skin.core, 0.7 * node.lit));
                g.addColorStop(0.4, rgba(skin.glow, 0.5 * node.lit));
                g.addColorStop(0.7, rgba(skin.iris, 0.3 * node.lit));
                g.addColorStop(1, rgba(skin.iris, 0));
            }
            ctx.beginPath();
            ctx.arc(x, y, pulse, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
        }
    }

    /** The petals moved to an edge: slivers of the eye's own layers, pointing outward from the radius given. */
    function drawCrown({ x, y, r, alpha, layers }) {
        if (alpha <= 0.01) return;
        ctx.save();
        ctx.translate(x, y);
        for (let layer = 0; layer < layers; layer += 1) {
            ctx.rotate((reduced ? 0 : t) * (0.02 + layer * 0.015) + layer * 0.7);
            const r0 = r * (1.0 + layer * 0.018);
            const r1 = r * (1.045 + layer * 0.022);
            const k = layer / 2;
            const ink = [0, 1, 2].map(i => Math.round(mix(skin.core[i], skin.iris[i], k)));
            ctx.fillStyle = rgba(ink, (0.34 - layer * 0.08) * alpha);
            ctx.beginPath();
            for (let i = 0; i < CROWN; i += 1) {
                const a = (i / CROWN) * TAU;
                ctx.moveTo(r0 * Math.cos(a - 0.035), r0 * Math.sin(a - 0.035));
                ctx.lineTo(r0 * Math.cos(a + 0.035), r0 * Math.sin(a + 0.035));
                ctx.lineTo(r1 * Math.cos(a + 0.09), r1 * Math.sin(a + 0.09));
                ctx.closePath();
            }
            ctx.fill();
        }
        ctx.restore();
    }

    /** The nine-sided opening, `turn` radians round, of radius `r`, as a path at (x, y). */
    function nonagon(x, y, r, turn) {
        ctx.beginPath();
        for (let k = 0; k <= BLADES; k += 1) {
            const a = (k / BLADES) * TAU + turn;
            if (k === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
            else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        }
        ctx.closePath();
    }

    /**
     * The closed eye's dark: nine blades sweeping from the centre to the rim in S-curves, each a dark surface lit
     * in the iris's own colours and shaded toward its seam, the seams drawn core to iris. Drawn beneath the petals,
     * so the fold reveals them; they turn a few degrees as the petals fold over them. Opened (`hole`), they draw back
     * from a nine-sided opening at their centre, turning as they go.
     */
    function drawShutter(ex, ey, rim, show, hole = 0, turn = (1 - show) * 0.6) {
        if (show <= 0.02 || hole >= 0.999) return;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.beginPath();
        ctx.arc(0, 0, rim * (hole > 0.001 ? 1.02 : 1), 0, TAU);
        if (hole > 0.001) {
            const r = hole * rim * 1.12;
            for (let k = 0; k <= BLADES; k += 1) {
                const a = (k / BLADES) * TAU + turn * 1.3;
                if (k === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
            }
            ctx.closePath();
            ctx.clip('evenodd');
        } else {
            ctx.clip();
        }
        ctx.rotate(turn);
        ctx.scale(rim, rim);
        const ground = rgba(skin.trail, 0.94 * show);
        const radial = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        radial.addColorStop(0, rgba(skin.core, 0.30 * show));
        radial.addColorStop(0.45, rgba(skin.iris, 0.18 * show));
        radial.addColorStop(1, rgba(skin.iris, 0.07 * show));
        const deep = rgba(skin.trail, 0.55 * show);
        const none = rgba(skin.trail, 0);
        for (let k = 0; k < BLADES; k += 1) {
            const s0 = SEAMS[k];
            const s1 = SEAMS[k + 1];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(s0.p1[0], s0.p1[1], s0.p2[0], s0.p2[1], s0.p3[0], s0.p3[1]);
            ctx.arc(0, 0, 1.02, s0.a + 0.08, s1.a + 0.08);
            ctx.bezierCurveTo(s1.p2[0], s1.p2[1], s1.p1[0], s1.p1[1], 0, 0);
            ctx.closePath();
            ctx.fillStyle = ground;
            ctx.fill();
            ctx.fillStyle = radial;
            ctx.fill();
            const mid = (s0.a + s1.a) / 2;
            const shade = ctx.createLinearGradient(0.9 * Math.cos(s0.a + 0.5), 0.9 * Math.sin(s0.a + 0.5), 0.9 * Math.cos(mid - 0.15), 0.9 * Math.sin(mid - 0.15));
            shade.addColorStop(0, deep);
            shade.addColorStop(1, none);
            ctx.fillStyle = shade;
            ctx.fill();
        }
        ctx.lineWidth = 1.1 / rim;
        for (let k = 0; k < BLADES; k += 1) {
            const { p1, p2, p3 } = SEAMS[k];
            const g = ctx.createLinearGradient(0, 0, p3[0], p3[1]);
            g.addColorStop(0, rgba(skin.core, 0.5 * show));
            g.addColorStop(0.5, rgba(skin.iris, 0.32 * show));
            g.addColorStop(1, rgba(skin.iris, 0.14 * show));
            ctx.strokeStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Three layers of 36 petals, each drifting at its own pace. In a blink the outer layer folds first and the inner
     * last, each petal drawing in toward the centre and twisting as it goes. A petal is drawn in its own frame
     * (scaled to its reach, turned to its angle), so one gradient serves a whole layer. A seed of light shows where
     * the petals meet once they are mostly closed, so the closed eye is not a hole.
     */
    function drawPetals(ex, ey, R, shut, alpha = 1) {
        const open = live.open;
        ctx.save();
        ctx.translate(ex, ey);
        const drift = reduced ? 0 : t;
        for (let layer = 0; layer < 3; layer += 1) {
            const order = 2 - layer;
            const fold = clamp01((shut - order * 0.18) / 0.64);
            ctx.rotate(drift * (0.06 + layer * 0.04) * (0.6 + live.spin) + layer + fold * 0.9);
            const reach = 1 - fold * 0.92;
            const flare = 0.1 + fold * 0.07;
            const r2 = R * (0.5 + layer * 0.3) * reach;
            const inner = (0.3 + layer * 0.3) / (0.5 + layer * 0.3);
            const lit = (0.5 + open * 0.5) * alpha;
            const g = ctx.createLinearGradient(0, 0, 1, 0);
            g.addColorStop(0, rgba(skin.core, (0.32 - layer * 0.1) * lit));
            g.addColorStop(1, rgba(skin.iris, (0.12 - layer * 0.03) * lit));
            ctx.fillStyle = g;
            ctx.save();
            ctx.scale(r2, r2);
            const tipX = Math.cos(flare);
            const tipY = Math.sin(flare);
            for (let i = 0; i < PETALS; i += 1) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(inner, 0);
                ctx.lineTo(tipX, tipY);
                ctx.fill();
                ctx.rotate(TAU / PETALS);
            }
            ctx.restore();
        }
        ctx.restore();
        if (shut > 0.6) {
            const seed = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 0.12);
            seed.addColorStop(0, rgba(skin.core, (shut - 0.6) * 1.2 * alpha));
            seed.addColorStop(1, rgba(skin.core, 0));
            ctx.beginPath();
            ctx.arc(ex, ey, R * 0.12, 0, TAU);
            ctx.fillStyle = seed;
            ctx.fill();
        }
    }

    /** The eye at (ex, ey), radius R, `shut` closed: the socket and shutter as it closes, the petals, the pupil, the catchlight. */
    function drawEye(ex, ey, R, shut) {
        closed = shut;
        // The socket beneath the petals, in the room's near-black, only as the petals fold.
        if (shut > 0) {
            const socket = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 1.02);
            socket.addColorStop(0, rgba(skin.trail, 0.9 * shut));
            socket.addColorStop(0.8, rgba(skin.trail, 0.85 * shut));
            socket.addColorStop(1, rgba(skin.trail, 0));
            ctx.beginPath();
            ctx.arc(ex, ey, R * 1.02, 0, TAU);
            ctx.fillStyle = socket;
            ctx.fill();
        }
        drawShutter(ex, ey, R, smooth(shut));
        drawPetals(ex, ey, R, shut);
        // The pupil: it breathes, narrows as the reader comes close, and draws to a point as the petals close over it.
        const breath = 1 + Math.sin(t * 0.9) * 0.05;
        const pupil = R * (0.34 - gaze.depth * 0.08) * breath * (1 - shut * 0.9);
        const pg = ctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(1, pupil));
        pg.addColorStop(0, rgba(skin.deep, 0.95));
        pg.addColorStop(0.55, rgba(skin.glow, 0.55));
        pg.addColorStop(1, rgba(skin.iris, 0.25));
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(0.5, pupil), 0, TAU);
        ctx.fillStyle = pg;
        ctx.fill();
        // A catchlight, set against the gaze, so the eye reads as wet and lit from one side; gone while closed.
        ctx.beginPath();
        ctx.arc(ex - pupil * 0.35 - gaze.x * 2, ey - pupil * 0.38 - gaze.y * 2, Math.max(0.5, pupil * 0.16), 0, TAU);
        ctx.fillStyle = rgba(skin.core, (0.55 + live.open * 0.3) * (1 - shut));
        ctx.fill();
    }

    /** The eye's own place and size in the face: its gaze and breath; docked (`small`), it is most of the face. */
    function eyeOf(f, small, seed = 1) {
        const R = mix((f.s * (0.075 + live.open * 0.035) + gaze.depth * f.s * 0.015) * seed, f.s * 0.28, small);
        return { x: f.x + gaze.x * f.s * 0.045 * (1 - small), y: f.y + gaze.y * f.s * 0.045 * (1 - small), R };
    }

    /** The face's field, recursion, torus and lights at its place, dimmed and spread as the geometry has them. */
    function drawSurround(g, dt) {
        const f = g.face;
        ctx.save();
        ctx.globalAlpha = g.dim;
        if (g.spread !== 1) {
            ctx.translate(f.x, f.y);
            ctx.scale(g.spread, g.spread);
            ctx.translate(-f.x, -f.y);
        }
        // Gone to the rim (travel) and shrunk to the dock (small) both thin the field and fade the recursion.
        drawField(f, g.travel, mix(1, 0.75, g.travel) * mix(1, 0.6, g.small));
        const ink = (0.6 + live.glow) * (1 - g.travel) * (1 - g.small);
        for (let depth = 1; depth <= 3; depth += 1) recursionInk[depth] = rgba(skin.glow, 0.05 * depth / 3 * ink);
        if (ink > 0.01) drawRecursion(f.x, f.y, f.s * 0.34 * live.tight, 3, t * 0.25 * live.spin * 2);
        drawTorus(f, g.travel);
        drawNodes(f, g.travel, f.s / g.big.s, dt);
        ctx.restore();
    }

    /** The visual shows through `path` (a hole already cleared): faded in by `fade`, and blended into the rim. */
    function clearHole(path) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        path();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
    }

    /** Inner eye and outer shell: the face around the aperture, the aperture, its shutter, crown and ring. */
    function drawCircle(g, dt) {
        drawSurround(g, dt);
        if (g.frame === 'shell' && g.crown) drawCrown(g.crown);
        const ap = g.aperture;
        if (!ap) {
            const own = eyeOf(g.face, 0);
            const to = g.eye ?? { x: own.x, y: own.y, r: own.R };
            const k = g.eyeClosed;
            drawEye(mix(own.x, to.x, k), mix(own.y, to.y, k), mix(own.R, to.r, k), Math.max(blinkAmount(g.blink), g.eyeClosed));
            return;
        }
        blinkAmount(false);
        if (g.frame === 'inner' && g.crown) drawCrown(g.crown);
        if (ap.hole <= 0) {
            drawEye(ap.x, ap.y, ap.r, 1);
            return;
        }
        closed = 1;
        // Under the aperture the face is the visual's: the circle is ground, then the opening is cleared through it.
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, ap.r, 0, TAU);
        ctx.fillStyle = rgba(skin.trail, 1);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, ap.r, 0, TAU);
        ctx.clip();
        clearHole(() => nonagon(ap.x, ap.y, ap.hole * ap.r * 1.12, ap.turn * 1.3));
        // A light room's aperture is a window on a night of its own (LiveHost.css): the visual fades in from that night
        // and blends into it at the rim, never into the pale ground, which over the night would be grey.
        const behind = skin.light ? skin.deep : skin.trail;
        if (ap.fade < 1) {
            ctx.fillStyle = rgba(behind, 1 - ap.fade);
            ctx.fillRect(ap.x - ap.r, ap.y - ap.r, 2 * ap.r, 2 * ap.r);
        }
        const edge = ctx.createRadialGradient(ap.x, ap.y, ap.r * 0.86, ap.x, ap.y, ap.r);
        edge.addColorStop(0, rgba(behind, 0));
        edge.addColorStop(1, rgba(behind, 0.85));
        ctx.fillStyle = edge;
        ctx.fillRect(ap.x - ap.r, ap.y - ap.r, 2 * ap.r, 2 * ap.r);
        ctx.restore();
        drawShutter(ap.x, ap.y, ap.r, 1, ap.hole, ap.turn);
        if (ap.petals > 0) drawPetals(ap.x, ap.y, ap.r, 1, ap.petals);
        if (ap.ring > 0.01) {
            ctx.beginPath();
            ctx.arc(ap.x, ap.y, ap.r, 0, TAU);
            ctx.strokeStyle = rgba(skin.iris, ap.ring);
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }

    /**
     * Full frame: the room's own aperture, nine-sided, from where the eye was until it is past every corner, a scrim
     * of the ground behind the words; and over it the face, travelling to the dock and blinking there.
     */
    function drawFull(g, dt) {
        const w = g.wipe;
        if (w) {
            const path = () => nonagon(w.x, w.y, w.r, w.turn);
            clearHole(path);
            ctx.save();
            path();
            ctx.clip();
            if (w.fade < 1) {
                ctx.fillStyle = rgba(skin.trail, 1 - w.fade);
                ctx.fillRect(0, 0, width, height);
            }
            const scrim = ctx.createLinearGradient(0, w.scrimTop, 0, height);
            scrim.addColorStop(0, rgba(skin.trail, 0));
            scrim.addColorStop(1, rgba(skin.trail, 0.82));
            ctx.fillStyle = scrim;
            ctx.fillRect(0, w.scrimTop, width, height - w.scrimTop);
            ctx.restore();
            if (w.ring > 0) {
                path();
                ctx.strokeStyle = rgba(skin.iris, w.ring);
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
        drawSurround(g, dt);
        if (g.crown) drawCrown(g.crown);
        const eye = eyeOf(g.face, g.small, g.seed ?? 1);
        drawEye(eye.x, eye.y, eye.R, Math.max(g.eyeClosed, blinkAmount(g.blink)));
    }

    function frame(ms, stepMs) {
        if (rise.size.width !== width || rise.size.height !== height || Math.min(2, rise.size.dpr || 1) !== dpr) fit();
        const dt = Math.min(0.05, Math.max(0, stepMs / 1000));
        t = ms / 1000;
        const k = reduced ? 1 : 1 - Math.exp(-dt / 0.18);
        for (const key of Object.keys(live)) live[key] = mix(live[key], target[key], k);
        const look = 1 - Math.exp(-dt / 0.35);
        gaze.x = mix(gaze.x, aim.x, look);
        gaze.y = mix(gaze.y, aim.y, look);
        gaze.depth = mix(gaze.depth, aim.depth, 1 - Math.exp(-dt / 0.4));

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // Trails: the slow fade, in the skin's own dark; whole when the canvas or the skin is new.
        if (reduced || repaint) {
            ctx.fillStyle = rgba(skin.trail, 1);
            ctx.fillRect(0, 0, width, height);
        } else {
            // In 8 bits an 8% fade toward the ground stalls about 6 levels above it, and would leave a grey shadow
            // of every stroke. So it fades toward a dark 8 levels below the ground, and the ground is laid back by
            // each channel's maximum: what went below is the ground again, exactly; what is brighter is untouched.
            // Laid back over the whole canvas, it also fills what the last aperture left clear, so nothing of the
            // visual shows through but the aperture this frame cuts.
            // A light skin is the mirror, laid back by each channel's minimum, but not by aiming above its ground:
            // a faint fade up stalls as far as 14 levels short of its aim, and a pale ground has no such room above
            // it. It fades toward the ground itself and adds 2 levels a frame, which always arrives.
            ctx.fillStyle = rgba(skin.light ? skin.trail : skin.trail.map(level => Math.max(0, level - 8)), 0.08);
            ctx.fillRect(0, 0, width, height);
            if (skin.light) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = rgba([2, 2, 2], 1);
                ctx.fillRect(0, 0, width, height);
            }
            ctx.globalCompositeOperation = skin.light ? 'darken' : 'lighten';
            ctx.fillStyle = rgba(skin.trail, 1);
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';
        }
        repaint = false;
        const g = room ?? atRest();
        face = g.face;
        if (g.frame === 'full') drawFull(g, dt);
        else drawCircle(g, dt);
    }

    function cue(name, { instant = false } = {}) {
        if (typeof name !== 'string') return;
        if (STATE_NAMES.includes(name)) setState(name, instant);
        else if (name === 'blink') { if (!reduced && blinkAt < 0) blinkAt = t; }
        else if (name.startsWith('aperture:')) setRoom(name.slice('aperture:'.length));
        else if (name.startsWith('set:state=')) setState(name.slice('set:state='.length), instant);
        else if (name.startsWith('set:skin=')) setSkin(name.slice('set:skin='.length));
    }

    /** The reader's pointer, in CSS pixels within the canvas: where the eye looks, from where the face is. A cancel is the pointer gone. */
    function input(event) {
        if (event?.type === 'pointercancel') {
            Object.assign(aim, { x: 0, y: 0, depth: 0 });
            return;
        }
        if (!event?.type?.startsWith('pointer') || !Number.isFinite(event.x) || !Number.isFinite(event.y) || !width || !height) return;
        const f = room?.face ?? { x: cx, y: cy, s: size };
        const dx = (event.x - f.x) / f.s;
        const dy = (event.y - f.y) / f.s;
        aim.x = clamp1(dx * 2);
        aim.y = clamp1(dy * 2);
        aim.depth = 1 - Math.min(Math.hypot(dx, dy) / 0.45, 1);
    }

    /** What the face is doing, for its tests: nothing here is drawn or sent. */
    function inspect() {
        return {
            skin: skinName, state: stateName, live: { ...live }, closed, room,
            gaze: { ...gaze }, aim: { ...aim }, nodes: nodes.map(node => node.angle), drift: reduced ? 0 : t, torusBuilds, face: { ...face }
        };
    }

    fit();
    return { frame, cue, input, inspect };
}
