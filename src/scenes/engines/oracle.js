/**
 * The oracle: RISE's own face, the room's resting picture in the Live venue (docs/plans/LIVE-CURRENT.md §22).
 *
 * A port of the approved study (docs/assets/live/sophia-face-study.html): a central eye of three layers of 36
 * petals drifting at their own paces, a breathing pupil that narrows as the reader's pointer comes near, a
 * catchlight set against the gaze, seven orbiting nodes, a field of 24 spiral lines, a torus, phi recursion
 * circles, and a slow trail in the skin's own dark. Its geometry, colours, timings and blink are the owner's
 * decisions; change them in the study first.
 *
 * It is a scene module, run in the scene worker like any generated scene (src/scenes/scene-worker.js): the
 * default export takes `rise` and returns `{ frame, cue, input }`. It listens to the pointer for its gaze and
 * emits nothing: no `rise.emit`, no perception, no journal. It is RISE's own presence, never an engine a model
 * may name, so it is not in SCENE_MANIFESTS. Its start parameters come on `rise.theme` (`skin`, `state`); the
 * face has no reading theme, its skin is its colours.
 *
 * This file is sent to the worker as text (?raw) and loaded from a blob: it imports nothing.
 */

/** Skins: core (the pupil's heart), iris, glow (field and nodes), deep (the pupil's depth), trail (the room's dark). */
export const ORACLE_SKINS = Object.freeze({
    sophia: Object.freeze({ core: [245, 245, 220], iris: [135, 206, 235], glow: [176, 196, 222], deep: [25, 25, 112], trail: [10, 10, 15] }),
    ember: Object.freeze({ core: [255, 236, 210], iris: [240, 163, 107], glow: [214, 120, 92], deep: [70, 20, 20], trail: [14, 9, 8] }),
    jade: Object.freeze({ core: [236, 245, 230], iris: [143, 211, 181], glow: [120, 180, 150], deep: [10, 50, 40], trail: [7, 12, 10] }),
    silver: Object.freeze({ core: [250, 250, 250], iris: [207, 211, 218], glow: [160, 166, 176], deep: [30, 32, 40], trail: [9, 9, 11] })
});

/** Each state is a set of targets the face eases toward (time constant 0.18 s): nothing snaps. */
export const ORACLE_STATES = Object.freeze({
    arrival: Object.freeze({ open: 0.55, orbit: 0.10, spin: 0.08, field: 0.9, tight: 1.00, glow: 0.55, presence: 1.0 }),
    listening: Object.freeze({ open: 0.95, orbit: 0.18, spin: 0.12, field: 1.1, tight: 0.80, glow: 0.90, presence: 1.0 }),
    thinking: Object.freeze({ open: 0.80, orbit: 0.55, spin: 0.40, field: 1.6, tight: 0.62, glow: 1.00, presence: 1.0 }),
    speaking: Object.freeze({ open: 0.70, orbit: 0.10, spin: 0.06, field: 0.6, tight: 1.10, glow: 0.35, presence: 0.22 }),
    rest: Object.freeze({ open: 0.45, orbit: 0.07, spin: 0.05, field: 0.7, tight: 1.05, glow: 0.45, presence: 1.0 })
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

const smooth = u => u * u * (3 - 2 * u);

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

    // The torus, once per size: 48 rings of 24 segments, deformed each frame by a slow wave.
    const torus = { R: 0, r: 0, u: new Float64Array(48), v: new Float64Array(25), cosV: new Float64Array(25) };
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
        torus.R = size * 0.30;
        torus.r = size * 0.09;
        torusBuilds += 1;
        repaint = true;
    }

    // Seven nodes, each with its own phase and pace.
    const nodes = Array.from({ length: 7 }, (_, i) => ({ angle: (i / 7) * TAU, phase: Math.random() * TAU, pace: 0.5 + Math.random() * 0.5, lit: 0.5 }));

    // Gaze: the pointer's offset from the centre, normalised and clamped; eased so the eye turns, never jumps.
    const gaze = { x: 0, y: 0, depth: 0 };
    const aim = { x: 0, y: 0, depth: 0 };

    // The blink: every 4 to 8 seconds (the first after 3 to 7).
    let nextBlink = 3 + Math.random() * 4;
    let blinkAt = -1;
    let closed = 0;

    let t = 0;
    const ease = (from, to, k) => from + (to - from) * k;
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

    function blinkAmount() {
        if (reduced) return 0;
        if (blinkAt < 0 && t > nextBlink) blinkAt = t;
        if (blinkAt < 0) return 0;
        const amount = blinkClosure(t - blinkAt, stateName === 'thinking');
        if (amount !== null) return amount;
        blinkAt = -1;
        nextBlink = t + 4 + Math.random() * 4;
        return 0;
    }

    function drawField() {
        const amp = live.field;
        ctx.strokeStyle = rgba(skin.iris, 0.10 + 0.10 * live.glow);
        for (let i = 0; i < 24; i += 1) {
            const a = (i / 24) * TAU;
            ctx.beginPath();
            for (let j = 0; j <= 40; j += 1) {
                const u = j / 40;
                const wave = Math.sin(t * 2 * amp + a * 3 + u * Math.PI * 4) * 0.1;
                const spiral = u * TAU + t * 0.6 * amp + a;
                const r = size * 0.10 + u * size * 0.35 * live.tight * (1 + wave);
                const x = cx + r * Math.cos(spiral);
                const y = cy + r * Math.sin(spiral);
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.lineWidth = 0.8 + Math.sin(t + a) * 0.4;
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

    function drawTorus() {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = rgba(skin.glow, 0.04 + gaze.depth * 0.08 + live.glow * 0.03);
        ctx.lineWidth = 0.5;
        const R = torus.R * live.tight;
        const turn = t * 0.05;
        const pace = t * 0.8 * (0.5 + live.spin);
        for (let i = 0; i < 48; i += 1) {
            const u = torus.u[i];
            const cosU = Math.cos(u + turn);
            const sinU = Math.sin(u + turn);
            ctx.beginPath();
            for (let j = 0; j <= 24; j += 1) {
                const w = Math.sin(pace + u * 2 + torus.v[j]) * 0.2;
                const reach = R + torus.r * (1 + w) * live.tight * torus.cosV[j];
                const x = cx + reach * cosU;
                const y = cy + reach * sinU;
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawNodes(dt) {
        const orbitR = size * 0.25 * live.tight;
        const settle = 1 - 0.9 ** (dt * 60);
        for (const node of nodes) {
            node.angle += (reduced ? 0 : live.orbit) * 0.4 * dt;
            const x = cx + orbitR * Math.cos(node.angle);
            const y = cy + orbitR * Math.sin(node.angle);
            const near = Math.max(0, 1 - Math.hypot(gaze.x * size * 0.5 + cx - x, gaze.y * size * 0.5 + cy - y) / (size * 0.2));
            node.lit = ease(node.lit, 0.45 + near * 0.35 + live.glow * 0.3, settle);
            const pulse = 16 + Math.sin(t * node.pace * (1 + live.orbit) + node.phase) * 8 * node.lit;
            ctx.lineWidth = 1;
            for (let ring = 3; ring > 0; ring -= 1) {
                ctx.beginPath();
                ctx.arc(x, y, pulse * ring * 0.5, 0, TAU);
                ctx.strokeStyle = rgba(skin.iris, (0.08 / ring) * node.lit);
                ctx.stroke();
            }
            const g = ctx.createRadialGradient(x, y, 0, x, y, pulse);
            g.addColorStop(0, rgba(skin.core, 0.7 * node.lit));
            g.addColorStop(0.4, rgba(skin.glow, 0.5 * node.lit));
            g.addColorStop(0.7, rgba(skin.iris, 0.3 * node.lit));
            g.addColorStop(1, rgba(skin.iris, 0));
            ctx.beginPath();
            ctx.arc(x, y, pulse, 0, TAU);
            ctx.fillStyle = g;
            ctx.fill();
        }
    }

    /**
     * The closed eye's dark: nine blades sweeping from the centre to the rim in S-curves, each a dark surface lit
     * in the iris's own colours and shaded toward its seam, the seams drawn core to iris. Drawn beneath the petals,
     * so the fold reveals them; they turn a few degrees as the petals fold over them, and are not there open.
     */
    function drawShutter(ex, ey, rim) {
        if (closed <= 0.02) return;
        const show = smooth(closed);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.beginPath();
        ctx.arc(0, 0, rim, 0, TAU);
        ctx.clip();
        ctx.rotate((1 - show) * 0.6);
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

    function drawEye() {
        const open = live.open;
        const R = size * (0.075 + open * 0.035) + gaze.depth * size * 0.015;
        const ex = cx + gaze.x * size * 0.045;
        const ey = cy + gaze.y * size * 0.045;
        closed = blinkAmount();
        // The socket beneath the petals, in the room's near-black, only as the petals fold.
        if (closed > 0) {
            const socket = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 1.02);
            socket.addColorStop(0, rgba(skin.trail, 0.9 * closed));
            socket.addColorStop(0.8, rgba(skin.trail, 0.85 * closed));
            socket.addColorStop(1, rgba(skin.trail, 0));
            ctx.beginPath();
            ctx.arc(ex, ey, R * 1.02, 0, TAU);
            ctx.fillStyle = socket;
            ctx.fill();
        }
        drawShutter(ex, ey, R);
        // Three layers of 36 petals, each drifting at its own pace. In a blink the outer layer folds first and the
        // inner last, each petal drawing in toward the centre and twisting as it goes. A petal is drawn in its own
        // frame (scaled to its reach, turned to its angle), so one gradient serves a whole layer.
        ctx.save();
        ctx.translate(ex, ey);
        const drift = reduced ? 0 : t;
        for (let layer = 0; layer < 3; layer += 1) {
            const order = 2 - layer;
            const fold = Math.max(0, Math.min(1, (closed - order * 0.18) / 0.64));
            ctx.rotate(drift * (0.06 + layer * 0.04) * (0.6 + live.spin) + layer + fold * 0.9);
            const reach = 1 - fold * 0.92;
            const flare = 0.1 + fold * 0.07;
            const r2 = R * (0.5 + layer * 0.3) * reach;
            const inner = (0.3 + layer * 0.3) / (0.5 + layer * 0.3);
            const lit = 0.5 + open * 0.5;
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
        // The pupil: it breathes, narrows as the reader comes close, and draws to a point as the petals close over it.
        const breath = 1 + Math.sin(t * 0.9) * 0.05;
        const pupil = R * (0.34 - gaze.depth * 0.08) * breath * (1 - closed * 0.9);
        const pg = ctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(1, pupil));
        pg.addColorStop(0, rgba(skin.deep, 0.95));
        pg.addColorStop(0.55, rgba(skin.glow, 0.55));
        pg.addColorStop(1, rgba(skin.iris, 0.25));
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(0.5, pupil), 0, TAU);
        ctx.fillStyle = pg;
        ctx.fill();
        // A seed of light where the petals meet, so the closed eye is not a hole.
        if (closed > 0.6) {
            const seed = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 0.12);
            seed.addColorStop(0, rgba(skin.core, (closed - 0.6) * 1.2));
            seed.addColorStop(1, rgba(skin.core, 0));
            ctx.beginPath();
            ctx.arc(ex, ey, R * 0.12, 0, TAU);
            ctx.fillStyle = seed;
            ctx.fill();
        }
        // A catchlight, set against the gaze, so the eye reads as wet and lit from one side; gone while closed.
        ctx.beginPath();
        ctx.arc(ex - pupil * 0.35 - gaze.x * 2, ey - pupil * 0.38 - gaze.y * 2, Math.max(0.5, pupil * 0.16), 0, TAU);
        ctx.fillStyle = rgba(skin.core, (0.55 + open * 0.3) * (1 - closed));
        ctx.fill();
    }

    function frame(ms, stepMs) {
        if (rise.size.width !== width || rise.size.height !== height || Math.min(2, rise.size.dpr || 1) !== dpr) fit();
        const dt = Math.min(0.05, Math.max(0, stepMs / 1000));
        t = ms / 1000;
        const k = reduced ? 1 : 1 - Math.exp(-dt / 0.18);
        for (const key of Object.keys(live)) live[key] = ease(live[key], target[key], k);
        const look = 1 - Math.exp(-dt / 0.35);
        gaze.x = ease(gaze.x, aim.x, look);
        gaze.y = ease(gaze.y, aim.y, look);
        gaze.depth = ease(gaze.depth, aim.depth, 1 - Math.exp(-dt / 0.4));

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // Trails: the slow fade, in the skin's own dark; whole when the canvas or the skin is new.
        ctx.fillStyle = rgba(skin.trail, reduced || repaint ? 1 : 0.08);
        ctx.fillRect(0, 0, width, height);
        repaint = false;

        const presence = live.presence;
        ctx.save();
        ctx.globalAlpha = presence;
        ctx.translate(cx, cy);
        ctx.scale(0.72 + presence * 0.28, 0.72 + presence * 0.28);
        ctx.translate(-cx, -cy);
        drawField();
        const ink = 0.6 + live.glow;
        for (let depth = 1; depth <= 3; depth += 1) recursionInk[depth] = rgba(skin.glow, 0.05 * depth / 3 * ink);
        drawRecursion(cx, cy, size * 0.34 * live.tight, 3, t * 0.25 * live.spin * 2);
        drawTorus();
        drawNodes(dt);
        drawEye();
        ctx.restore();
    }

    function cue(name, { instant = false } = {}) {
        if (typeof name !== 'string') return;
        if (STATE_NAMES.includes(name)) setState(name, instant);
        else if (name === 'blink') { if (!reduced && blinkAt < 0) blinkAt = t; }
        else if (name.startsWith('set:state=')) setState(name.slice('set:state='.length), instant);
        else if (name.startsWith('set:skin=')) setSkin(name.slice('set:skin='.length));
    }

    /** The reader's pointer, in CSS pixels within the canvas: where the eye looks. A cancel is the pointer gone. */
    function input(event) {
        if (event?.type === 'pointercancel') {
            Object.assign(aim, { x: 0, y: 0, depth: 0 });
            return;
        }
        if (!event?.type?.startsWith('pointer') || !Number.isFinite(event.x) || !Number.isFinite(event.y) || !width || !height) return;
        const dx = event.x / width - 0.5;
        const dy = event.y / height - 0.5;
        aim.x = clamp1(dx * 2);
        aim.y = clamp1(dy * 2);
        aim.depth = 1 - Math.min(Math.hypot(dx, dy) / 0.45, 1);
    }

    /** What the face is doing, for its tests: nothing here is drawn or sent. */
    function inspect() {
        return {
            skin: skinName, state: stateName, live: { ...live }, closed,
            gaze: { ...gaze }, aim: { ...aim }, nodes: nodes.map(node => node.angle), drift: reduced ? 0 : t, torusBuilds
        };
    }

    fit();
    return { frame, cue, input, inspect };
}
