/**
 * The three frames (docs/plans/LIVE-CURRENT.md §23; the owner's approved study, docs/assets/live/sophia-aperture-study.html):
 * every visual a Live reading shows is held by RISE's face in the inner eye, the outer shell or the full frame, and
 * the visual chooses which.
 *
 * Pure: the table, the room's frame on the venue's clock (createFrameDirector), and the one geometry (frameGeometry)
 * that everything which draws or masks the visual reads. The venue scales the Chamber's visual layers by it and sends
 * it whole to the face's engine, which computes no geometry of its own; so the mask, the scaled visual and the drawn
 * rim come from the same numbers.
 */

/** Which frame each visual takes: a single drawn object the inner eye, a radial moving field the shell, a picture that needs the room the full frame. */
export const FRAME_OF = Object.freeze({
    attractor: 'shell', 'living-flame': 'shell', turrell: 'shell',
    harmonograph: 'inner', ostensoria: 'inner', apparitio: 'inner',
    genesis: 'full', fractal: 'full', neural: 'full', rockgarden: 'full', sourced: 'full', figure: 'full', scene: 'full'
});

/**
 * The pictures with content of their own (a figure, a generated scene): in the full frame they are fitted into the
 * room's safe rectangle, clear of the bar and the words. A field, a texture or an image stays full-bleed.
 */
const CONTENT = new Set(['figure', 'scene']);

/** How long each frame takes to open from the eye; closing takes the same, in proportion to how far it goes. */
export const FRAME_OPEN_MS = Object.freeze({ inner: 1100, shell: 1600, full: 1900 });

/** A cut: the open aperture shuts, holds and opens, as the eye blinks. */
export const CUT_MS = Object.freeze({ close: 220, hold: 70, open: 360 });

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const u = clamp01(value); return u * u * (3 - 2 * u); };
const mix = (from, to, k) => from + (to - from) * k;

/**
 * A cubic Bézier easing, as CSS's cubic-bezier(x1, y1, x2, y2): with y1 0 and y2 1 it leaves and arrives at rest,
 * its speed continuous throughout.
 */
function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const x = t => ((ax * t + bx) * t + cx) * t;
    const slope = t => (3 * ax * t + 2 * bx) * t + cx;
    return value => {
        if (value <= 0) return 0;
        if (value >= 1) return 1;
        let t = value;
        for (let i = 0; i < 8; i += 1) {
            const d = slope(t);
            if (Math.abs(d) < 1e-9) break;
            t = clamp01(t - (x(t) - value) / d);
        }
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 40 && Math.abs(x(t) - value) > 1e-12; i += 1) {
            if (x(t) < value) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return ((ay * t + by) * t + cy) * t;
    };
}

/** The glide's ease: it gathers speed gently and takes longer to arrive than to leave. */
const GLIDE = bezier(0.3, 0, 0.35, 1);
/** The full frame's opening: wide soon after she leaves, and past every corner by the time her eye has reopened. */
const WIPE = bezier(0.35, 0, 0.2, 1);

/** How far `a` is through a phase's window [from, to], eased from rest to rest. */
const phase = (a, [from, to], ease = smooth) => ease(clamp01((a - from) / (to - from)));

/**
 * Each frame's opening as windows of `a`, each eased from rest to rest, overlapping so no moment of a transition
 * stands still. The fold shuts the eye; every other phase begins once it is shut or, in the full frame, as it shuts:
 * the glide sets off while the eye is closing, the shrink finishes just before she arrives, and her eye reopens at
 * the dock as she settles there while the room behind her opens.
 *
 *   inner  fold, dilate (the shut eye to the aperture), dim (the face around it), open (the blades drawn back)
 *   shell  fold, shrink (the eye drawn in), travel (the field to the rim), grow (to the aperture), open
 *   full   fold, glide (to the dock, on an arc), shrink (her size, on a ratio scale), reopen, wipe (the room)
 */
const PHASES = Object.freeze({
    inner: Object.freeze({ fold: [0, 0.25], dilate: [0.25, 0.7], dim: [0.25, 1], open: [0.55, 1] }),
    shell: Object.freeze({ fold: [0, 0.1], shrink: [0.1, 0.4], travel: [0.15, 0.75], grow: [0.36, 0.78], open: [0.66, 1] }),
    full: Object.freeze({ fold: [0, 0.12], glide: [0.05, 0.6], shrink: [0.05, 0.56], reopen: [0.5, 0.72], wipe: [0.08, 1] })
});

/** Where each frame's eye is folded shut. */
export const FRAME_FOLD = Object.freeze(Object.fromEntries(Object.entries(PHASES).map(([frame, p]) => [frame, p.fold[1]])));

/**
 * Where each frame's first motion other than the fold begins: below it only the eye moves. A change of frame closes
 * the one frame to here and opens the next from here, with the eye kept shut, so it never opens between them.
 */
export const FRAME_ENTRY = Object.freeze(Object.fromEntries(Object.entries(PHASES).map(([frame, p]) => [
    frame, Math.min(...Object.entries(p).filter(([name]) => name !== 'fold').map(([, window]) => window[0]))
])));

/**
 * Above this nothing of a frame's opening is seen: in the full frame only the wipe moves there, already past every
 * corner of the room. A frame closes from here.
 */
export const FRAME_TOP = Object.freeze({ inner: 1, shell: 1, full: PHASES.full.reopen[1] });

/** How long the shut eye takes to open when a change of frame turns back to the eye: a blink's opening. */
const LIFT_MS = CUT_MS.open;

/** A circle frame's aperture once open, as a share of the face's square. */
const APERTURE = Object.freeze({ inner: 0.36, shell: 0.41 });

/** The eye's radius at rest, as a share of the face's square: the speaking eye (open 0.70), with no gaze. */
const EYE = 0.075 + 0.70 * 0.035;
/** The docked face's size: a 48 px slot, the face a little larger than it. */
const DOCK = 48;

/**
 * The table's key for a cue as the Chamber has it on screen: a field by its renderer, a pattern by its engine, a
 * figure or a generated scene by its kind. A still draws nothing in a Live reading, so it is no visual. Null for none.
 */
export function visualOf(cue) {
    if (!cue || typeof cue !== 'object' || cue.kind === 'still') return null;
    if (cue.kind === 'field') return cue.renderer ?? null;
    if (cue.kind === 'procedural') return cue.collections?.[0] ?? null;
    if (cue.kind === 'scene') return typeof cue.svg === 'string' ? 'figure' : 'scene';
    return cue.kind ?? null;
}

/** The frame a cue takes, or null for no visual (the eye). A kind the table does not name takes the whole room. */
export function frameOf(cue) {
    const visual = visualOf(cue);
    if (visual === null) return null;
    return Object.hasOwn(FRAME_OF, visual) ? FRAME_OF[visual] : 'full';
}

/** Whether the cue on screen is a picture with content of its own, fitted clear of the bar and the words. */
export function holdsContent(cue) {
    return CONTENT.has(visualOf(cue));
}

/** How shut the aperture is, `elapsed` ms into a cut; null once it is open again. */
export function cutAmount(elapsed) {
    const { close, hold, open } = CUT_MS;
    if (elapsed < close) return smooth(elapsed / close);
    if (elapsed < close + hold) return 1;
    if (elapsed < close + hold + open) return 1 - smooth((elapsed - close - hold) / open);
    return null;
}

/**
 * The room's frame over time, on a clock the caller gives (the venue's, which stands still while the reading is
 * held). `see` is told the frame of the visual on screen whenever that visual changes (null: none); `at` says which
 * frame is shown, how far open (`a`, 0 the eye to 1 open), how shut its aperture is by a cut, and how far the eye is
 * held shut across a change of frame (`lid`).
 *
 * The same frame again is one blink of the open aperture. Another frame shuts the aperture at once and closes the
 * frame over its own time, from what can still be seen of it, as far as the shut eye; the next opens from there, the
 * eye held shut until its own fold has it, so the eye never opens between two frames. Turning back to the eye on the
 * way, the shut eye opens as a blink does. Under reduced motion every change is instant, and nothing blinks.
 */
export function createFrameDirector({ reduced = false } = {}) {
    let frame = 'none';
    let tween = { from: 0, to: 0, start: 0, dur: 0 };
    let pending = null;
    let cutStart = -1;
    let shut = false;
    // The eye held shut across a change of frame; once that turns back to the eye, when it began to open.
    let held = false;
    let lift = -1;

    const aperture = now => (tween.dur <= 0 || now >= tween.start + tween.dur ? tween.to : mix(tween.from, tween.to, clamp01((now - tween.start) / tween.dur)));
    const openTo = (to, now, from = aperture(now)) => {
        const start = to < from && frame !== 'none' ? Math.min(from, FRAME_TOP[frame]) : from;
        tween = { from: start, to, start: now, dur: reduced || frame === 'none' ? 0 : FRAME_OPEN_MS[frame] * Math.abs(to - start) };
    };
    // Where the frame on screen closes to: the shut eye on the way to another frame, the eye itself otherwise.
    const target = () => (held && pending !== 'none' ? FRAME_ENTRY[frame] : 0);
    const arrived = now => tween.to === target() && aperture(now) === tween.to;
    const lidAt = now => (held ? 1 : lift >= 0 ? 1 - smooth((now - lift) / LIFT_MS) : 0);
    const enter = (next, now) => {
        const through = held && next !== 'none';
        frame = next;
        pending = null;
        shut = false;
        cutStart = -1;
        if (next === 'none') return;
        if (through) openTo(1, now, FRAME_ENTRY[next]);
        else openTo(1, now);
    };

    return {
        see(next, now) {
            const wanted = next ?? 'none';
            if (frame === 'none' || (tween.to === 0 && aperture(now) === 0)) {
                enter(wanted, now);
                return;
            }
            if (wanted === frame && tween.to === 1 && pending === null) {
                if (!reduced) cutStart = now;
                return;
            }
            pending = wanted;
            if (!reduced && !shut && wanted !== 'none') {
                shut = true;
                cutStart = now;
            }
            // The eye is held shut only from where it is already shut: a frame caught folding opens back to the eye.
            if (!reduced && wanted !== 'none' && aperture(now) >= FRAME_ENTRY[frame]) held = true;
            openTo(target(), now);
        },

        at(now) {
            if (held && pending === 'none') {
                // Back to the eye: the shut eye opens from the moment the frame has closed to it.
                const a = aperture(now);
                if (a <= FRAME_ENTRY[frame]) {
                    const span = tween.from - tween.to;
                    held = false;
                    lift = span > 0 && tween.from > FRAME_ENTRY[frame] ? tween.start + ((tween.from - FRAME_ENTRY[frame]) / span) * tween.dur : now;
                }
            }
            if (pending !== null && arrived(now)) enter(pending, now);
            // Folded in the next frame: what holds the eye shut is its own fold from here.
            if (held && pending === null && tween.to === 1 && aperture(now) >= FRAME_FOLD[frame]) held = false;
            if (lift >= 0 && now - lift >= LIFT_MS) lift = -1;
            let cut = 0;
            if (cutStart >= 0) {
                const elapsed = now - cutStart;
                if (shut) cut = smooth(elapsed / CUT_MS.close);
                else {
                    const amount = cutAmount(elapsed);
                    if (amount === null) cutStart = -1;
                    else cut = amount;
                }
            }
            return { frame, a: frame === 'none' ? 0 : aperture(now), cut, lid: lidAt(now) };
        },

        /** Whether, as `at` last left it, the room is at rest on the visual last seen: nothing pending, no cut, open. */
        settled(now) {
            return pending === null && cutStart < 0 && lidAt(now) === 0 && (frame === 'none' || (tween.to === 1 && aperture(now) === 1));
        }
    };
}

/** The ask bar's height when it has no box yet: a 44 px field in 4 px of padding and a 1 px border. */
const BAR = 54;
/** One line of the bar's note (0.85rem at 1.4), kept between the bar and the words, 6 px from each. */
const NOTE = 20;
/** The foot of the corner's sign-in link (10 px down, 44 px tall), which a fitted picture stays 12 px below. */
const CORNER = 54;

/**
 * The room from its foot up, as the venue lays it out and the face sees it: the stage's instrument at the foot; the
 * ask bar 8 px above it (or 8 px above an on-screen keyboard that reaches higher); a line for the bar's note; the
 * spoken words' zone, two lines of the room's size; and above them, from 16 px down to 12 px above the words' zone,
 * the face's square (the eye at its centre, the circle frames inside it). The dock is the slot at the bar's left end,
 * centred on the bar. `far` is the distance from the square's centre to the farthest corner, which the full frame's
 * aperture must pass. The safe rectangle (centre and size) is where a picture with content is fitted in the full
 * frame: 16 px in from the sides, 12 px below the corner's link, 12 px above the words' zone, so it is clear of the
 * words, the bar and the docked face, and does not move with the words.
 *
 *   barFoot, barTop     the bar's distance from the room's foot, and its top edge
 *   wordsFoot           the words' distance from the room's foot; wordsSize their size; wordsTop their zone's top
 *
 * @param {{width: number, height: number, instrumentTop?: number, bar: {left: number, width: number, height: number}|null,
 *   keyboard?: number, note?: number}} room  the instrument's top edge (by default where the stage puts it), the bar's
 *   box (null with none on screen: its place is kept, so nothing moves when it comes), how much of the room's foot an
 *   on-screen keyboard covers, and the height of the bar's note while it says something
 */
export function roomLayout({ width, height, instrumentTop = height - (width < 640 ? 68 : 80), bar, keyboard = 0, note = 0 }) {
    const barBottom = Math.min(instrumentTop - 8, keyboard > 0 ? height - keyboard - 8 : Infinity);
    const barTop = barBottom - (bar?.height || BAR);
    const wordsFoot = height - barTop + 6 + Math.max(NOTE, note) + 6;
    const wordsSize = width < 640 ? 26 : 34;
    const wordsTop = height - wordsFoot - 2 * 1.4 * wordsSize;
    const top = 16;
    const bottom = wordsTop - 12;
    const s = Math.max(80, Math.min(width - 32, bottom - top));
    const big = { x: width / 2, y: top + (bottom - top) / 2, s };
    const dock = { x: bar ? bar.left - 8 - DOCK / 2 : 16 + DOCK / 2, y: (barTop + barBottom) / 2, s: DOCK * 1.15 };
    const far = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - big.x, y - big.y)));
    const safeTop = Math.max(top, CORNER + 12);
    const safe = { x: width / 2, y: (safeTop + bottom) / 2, w: Math.max(0, width - 32), h: Math.max(0, bottom - safeTop) };
    return { width, height, barFoot: height - barBottom, barTop, wordsFoot, wordsSize, wordsTop, big, dock, far, safe };
}

/**
 * Everything the face draws and the visual is masked and scaled by, at one moment: from the frame, how far open it is
 * (`a`), how shut a cut has its aperture, and the room's layout. The eye's own blink, gaze and breath are the
 * engine's; where the face is, how closed the transition has it, and the aperture are here.
 *
 *   big            the face's square at rest
 *   face, small    where the face is drawn and how far it has shrunk to the dock (its eye 0.28 of it when docked)
 *   dim, spread    the face around an inner eye: dimmed to 45%, drawn 12% outward
 *   travel         how far the field, torus, lights and petals have gone to the shell's rim
 *   eyeClosed      how closed the transition has the eye (the engine takes the larger of this and its blink)
 *   blink          whether the eye may blink on its own now (at rest, or docked)
 *   eye            the eye the shutter dilates from: the face's centre, at rest
 *   crown          the petals moved to an edge: where, how bright, how many layers
 *   aperture       the circle frames' aperture: centre, radius, how far the blades are drawn back (hole), the ring,
 *                  the closing petals, the visual's fade-in and how far it has settled from 92% to 100%
 *   wipe           the full frame's nine-sided aperture: centre, radius, turn, opening, the visual's fade-in, the
 *                  edge it draws while opening, and where the scrim behind the words begins
 *   fit            in the full frame, for a picture with content (`content`): the room's box scaled uniformly by k
 *                  and centred on the safe rectangle, so the picture lies wholly inside it; null otherwise
 */
export function frameGeometry({ frame, a, cut, lid = 0, layout, content = false }) {
    const c = layout.big;
    const eye = { x: c.x, y: c.y, r: c.s * EYE };
    const rest = { frame, big: { ...c }, face: { ...c }, small: 0, dim: 1, spread: 1, travel: 0, eyeClosed: lid, blink: a === 0 && lid === 0, eye, crown: null, aperture: null, wipe: null, fit: null };
    if (frame === 'inner' || frame === 'shell') {
        const shell = frame === 'shell';
        const p = PHASES[frame];
        const held = shell ? 0 : phase(a, p.dim);
        const travel = shell ? phase(a, p.travel) : 0;
        const rf = c.s * APERTURE[frame];
        const geometry = {
            ...rest,
            dim: 1 - 0.55 * held,
            spread: 1 + 0.12 * held,
            travel,
            eyeClosed: Math.max(phase(a, p.fold), lid),
            crown: shell ? { x: c.x, y: c.y, r: rf, alpha: travel, layers: 3 } : null
        };
        if (a <= p.fold[1]) return geometry;
        const shrink = shell ? phase(a, p.shrink) : 0;
        const grow = phase(a, shell ? p.grow : p.dilate);
        const open = phase(a, p.open);
        const r = mix(eye.r * (1 - 0.7 * shrink), rf, grow);
        const hole = open * (1 - cut);
        return {
            ...geometry,
            crown: shell ? geometry.crown : { x: c.x, y: c.y, r, alpha: open, layers: 2 },
            aperture: {
                x: c.x, y: c.y, r, hole, open, turn: hole * 0.9, ring: (shell ? 0.45 : 0.5) * open, petals: 1 - open,
                fade: smooth(hole / 0.625), settle: 0.92 + 0.08 * hole
            }
        };
    }
    if (frame === 'full') {
        const p = PHASES.full;
        const { dock, safe } = layout;
        const small = phase(a, p.shrink, GLIDE);
        const closure = a < p.reopen[0] ? phase(a, p.fold) : 1 - phase(a, p.reopen);
        const hole = phase(a, p.wipe, WIPE) * (1 - cut);
        return {
            ...rest,
            face: { ...glidePoint(c, dock, phase(a, p.glide, GLIDE)), s: small >= 1 ? dock.s : c.s * (dock.s / c.s) ** small },
            small,
            eyeClosed: a < p.reopen[0] ? Math.max(closure, lid) : closure,
            blink: (a === 0 || a === 1) && lid === 0,
            wipe: hole > 0 ? {
                x: c.x, y: c.y, r: (hole * layout.far * 1.08) / Math.cos(Math.PI / 9), turn: hole * 1.2, hole,
                fade: smooth(hole / 0.5), ring: 0.5 * (1 - hole), scrimTop: layout.wordsTop - 30
            } : null,
            fit: content ? { x: safe.x, y: safe.y, k: Math.min(safe.w / layout.width, safe.h / layout.height) } : null
        };
    }
    return rest;
}

/** How far the glide bows from the straight path at its middle, as a share of its length. */
const BOW = 0.055;

/**
 * The glide's path `u` of the way from the face's square to the dock: a quadratic arc bowed below the straight line,
 * so she drops and then tucks in to the dock rather than sliding across.
 */
function glidePoint(from, to, u) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return { x: from.x, y: from.y };
    const side = dx >= 0 ? 1 : -1;
    const k = { x: (from.x + to.x) / 2 - (dy / d) * side * 2 * BOW * d, y: (from.y + to.y) / 2 + (dx / d) * side * 2 * BOW * d };
    const v = 1 - u;
    return { x: v * v * from.x + 2 * u * v * k.x + u * u * to.x, y: v * v * from.y + 2 * u * v * k.y + u * u * to.y };
}

/**
 * The scale a circle frame shows its visual layers at once open (visualTransform's at rest), and 1 in any other
 * frame or none: what the venue declares on each layer so the visual is drawn at the size it is shown.
 */
export function restScale(frame, layout) {
    if (frame !== 'inner' && frame !== 'shell') return 1;
    return (layout.big.s * APERTURE[frame]) / (Math.min(layout.width, layout.height) / 2);
}

/**
 * How the Chamber's visual layers are moved and scaled so the circle inscribed in their own square is the aperture,
 * settling from 92% to 100% as the blades draw back: a translation of their centre, in CSS pixels, and a scale about
 * it. The visual is seen only through the drawn-back blades, once the aperture is at its full radius, so until then it
 * already waits where it will open, at 92%. In the full frame a picture with content is moved to the safe rectangle's
 * centre and scaled by its fit; a field, a texture or an image, and any visual with no frame, are left whole and where
 * they are.
 */
export function visualTransform(geometry, { width, height }) {
    if (geometry.frame === 'full' && geometry.fit) return { x: geometry.fit.x - width / 2, y: geometry.fit.y - height / 2, k: geometry.fit.k };
    if (geometry.frame !== 'inner' && geometry.frame !== 'shell') return { x: 0, y: 0, k: 1 };
    const half = Math.min(width, height) / 2;
    const c = geometry.big;
    const r = c.s * APERTURE[geometry.frame] * (geometry.aperture?.settle ?? 0.92);
    return { x: c.x - width / 2, y: c.y - height / 2, k: r / half };
}
