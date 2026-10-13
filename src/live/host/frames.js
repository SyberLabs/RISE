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

/** How long each frame takes to open from the eye; closing takes the same, in proportion to how open it is. */
export const FRAME_OPEN_MS = Object.freeze({ inner: 1100, shell: 1600, full: 1900 });

/** A cut: the open aperture shuts, holds and opens, as the eye blinks. */
export const CUT_MS = Object.freeze({ close: 220, hold: 70, open: 360 });

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const u = clamp01(value); return u * u * (3 - 2 * u); };
const mix = (from, to, k) => from + (to - from) * k;

/** The eye's radius at rest, as a share of the face's square: the speaking eye (open 0.70), with no gaze. */
const EYE = 0.075 + 0.70 * 0.035;
/** The docked face's size: a 48 px slot, the face a little larger than it. */
const DOCK = 48;

/**
 * The table's key for a cue as the Chamber has it on screen: a field by its renderer, a pattern by its engine, a
 * figure or a generated scene by its kind. A still draws nothing in a Live reading, so it is no visual. Null for none.
 */
function visualOf(cue) {
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
 * frame is shown, how far open (`a`, 0 the eye to 1 open) and how shut its aperture is by a cut.
 *
 * The same frame again is one blink of the open aperture. Another frame shuts the aperture at once, closes the frame
 * over its own time, then opens the next. Under reduced motion every change is instant, and nothing blinks.
 */
export function createFrameDirector({ reduced = false } = {}) {
    let frame = 'none';
    let tween = { from: 0, to: 0, start: 0, dur: 0 };
    let pending = null;
    let cutStart = -1;
    let shut = false;

    const aperture = now => (tween.dur <= 0 ? tween.to : mix(tween.from, tween.to, clamp01((now - tween.start) / tween.dur)));
    const openTo = (to, now) => {
        const from = aperture(now);
        tween = { from, to, start: now, dur: reduced || frame === 'none' ? 0 : FRAME_OPEN_MS[frame] * Math.abs(to - from) };
    };
    const closed = now => aperture(now) === 0 && tween.to === 0;
    const enter = (next, now) => {
        frame = next;
        pending = null;
        shut = false;
        cutStart = -1;
        if (next !== 'none') openTo(1, now);
    };

    return {
        see(next, now) {
            const wanted = next ?? 'none';
            if (closed(now)) {
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
            openTo(0, now);
        },

        at(now) {
            if (pending !== null && closed(now)) enter(pending, now);
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
            return { frame, a: frame === 'none' ? 0 : aperture(now), cut };
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
export function frameGeometry({ frame, a, cut, layout, content = false }) {
    const c = layout.big;
    const eye = { x: c.x, y: c.y, r: c.s * EYE };
    const rest = { frame, big: { ...c }, face: { ...c }, small: 0, dim: 1, spread: 1, travel: 0, eyeClosed: 0, blink: a === 0, eye, crown: null, aperture: null, wipe: null, fit: null };
    if (frame === 'inner' || frame === 'shell') {
        const shell = frame === 'shell';
        const held = smooth(a);
        const travel = shell ? smooth((a - 0.15) / 0.6) : 0;
        const rf = c.s * (shell ? 0.41 : 0.36);
        const shutAt = shell ? 0.1 : 0.25;
        const geometry = {
            ...rest,
            dim: shell ? 1 : 1 - 0.55 * held,
            spread: shell ? 1 : 1 + 0.12 * held,
            travel,
            eyeClosed: smooth(a / shutAt),
            crown: shell ? { x: c.x, y: c.y, r: rf, alpha: travel, layers: 3 } : null
        };
        if (a <= shutAt) return geometry;
        const shrink = shell ? smooth((a - 0.1) / 0.3) : 0;
        const grow = shell ? smooth((a - 0.4) / 0.3) : smooth((a - 0.25) / 0.35);
        const open = shell ? smooth((a - 0.7) / 0.3) : smooth((a - 0.6) / 0.4);
        const r = mix(eye.r * (1 - 0.7 * shrink), rf, grow);
        const hole = open * (1 - cut);
        return {
            ...geometry,
            crown: shell ? geometry.crown : { x: c.x, y: c.y, r, alpha: open, layers: 2 },
            aperture: {
                x: c.x, y: c.y, r, hole, open, turn: hole * 0.9, ring: (shell ? 0.45 : 0.5) * open, petals: 1 - open,
                fade: clamp01(hole * 1.6), settle: 0.92 + 0.08 * hole
            }
        };
    }
    if (frame === 'full') {
        const travel = smooth((a - 0.1) / 0.45);
        const hole = smooth((a - 0.2) / 0.8) * (1 - cut);
        const { dock, safe } = layout;
        return {
            ...rest,
            face: { x: mix(c.x, dock.x, travel), y: mix(c.y, dock.y, travel), s: mix(c.s, dock.s, travel) },
            small: travel,
            eyeClosed: a < 0.5 ? smooth(a / 0.15) : 1 - smooth((a - 0.5) / 0.15),
            blink: a === 0 || a === 1,
            wipe: hole > 0 ? {
                x: c.x, y: c.y, r: (hole * layout.far * 1.08) / Math.cos(Math.PI / 9), turn: hole * 1.2, hole,
                fade: clamp01(hole * 2), ring: hole < 0.98 ? 0.5 * (1 - hole) : 0, scrimTop: layout.wordsTop - 30
            } : null,
            fit: content ? { x: safe.x, y: safe.y, k: Math.min(safe.w / layout.width, safe.h / layout.height) } : null
        };
    }
    return rest;
}

/**
 * How the Chamber's visual layers are moved and scaled so the circle inscribed in their own square is the aperture,
 * settling from 92% to 100% as the blades draw back: a translation of their centre, in CSS pixels, and a scale about
 * it. Before the shutter has dilated the visual already waits where it will open. In the full frame a picture with
 * content is moved to the safe rectangle's centre and scaled by its fit; a field, a texture or an image, and any
 * visual with no frame, are left whole and where they are.
 */
export function visualTransform(geometry, { width, height }) {
    if (geometry.frame === 'full' && geometry.fit) return { x: geometry.fit.x - width / 2, y: geometry.fit.y - height / 2, k: geometry.fit.k };
    if (geometry.frame !== 'inner' && geometry.frame !== 'shell') return { x: 0, y: 0, k: 1 };
    const half = Math.min(width, height) / 2;
    const c = geometry.face;
    const aperture = geometry.aperture;
    const r = aperture ? aperture.r * aperture.settle : c.s * (geometry.frame === 'shell' ? 0.41 : 0.36) * 0.92;
    return { x: (aperture?.x ?? c.x) - width / 2, y: (aperture?.y ?? c.y) - height / 2, k: r / half };
}
